package com.fundmessenger.upload.service;

import com.fundmessenger.common.config.AppProperties;
import com.fundmessenger.common.exception.BusinessException;
import com.fundmessenger.common.exception.NotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;

@Slf4j
@Service
public class UploadService {

    private static final Set<String> ALLOWED_TYPES = Set.of(
            "image/jpeg", "image/png", "image/gif", "image/webp"
    );
    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    private final Path uploadDir;

    public UploadService(AppProperties appProperties) {
        this.uploadDir = Paths.get(appProperties.getUpload().getDir()).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.uploadDir);
            log.info("Upload directory initialized: {}", this.uploadDir);
        } catch (IOException e) {
            throw new RuntimeException("Could not create upload directory: " + this.uploadDir, e);
        }
    }

    /**
     * Upload an image file. Validates type and size, saves to upload dir, returns the URL path.
     *
     * @param file the multipart file to upload
     * @return relative URL path to the uploaded file (e.g., "/api/v1/uploads/files/uuid.png")
     */
    public String uploadImage(MultipartFile file) {
        // Validate content type
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_TYPES.contains(contentType.toLowerCase())) {
            throw new BusinessException("Invalid file type. Allowed: jpeg, png, gif, webp");
        }

        // Validate file size
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BusinessException("File size exceeds maximum of 10MB");
        }

        // Generate unique filename with original extension
        String originalFilename = file.getOriginalFilename();
        String extension = "";
        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        }
        String filename = UUID.randomUUID() + extension;

        try {
            Path targetPath = this.uploadDir.resolve(filename).normalize();

            // Security: ensure we don't write outside upload dir
            if (!targetPath.startsWith(this.uploadDir)) {
                throw new BusinessException("Invalid file path");
            }

            Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);

            log.info("File uploaded: {} ({} bytes)", filename, file.getSize());

            return "/api/v1/uploads/files/" + filename;
        } catch (IOException e) {
            log.error("Failed to save file: {}", e.getMessage());
            throw new BusinessException("Failed to save file");
        }
    }

    /**
     * Get a file as a Resource for serving.
     *
     * @param filename the filename to retrieve
     * @return the file resource
     */
    public Resource getFile(String filename) {
        // Validate no path traversal
        if (filename.contains("..") || filename.contains("/") || filename.contains("\\")) {
            throw new BusinessException("Invalid filename");
        }

        try {
            Path filePath = this.uploadDir.resolve(filename).normalize();

            // Security: ensure we don't read outside upload dir
            if (!filePath.startsWith(this.uploadDir)) {
                throw new BusinessException("Invalid file path");
            }

            Resource resource = new UrlResource(filePath.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                throw new NotFoundException("File", filename);
            }

            return resource;
        } catch (MalformedURLException e) {
            throw new NotFoundException("File", filename);
        }
    }

    /**
     * Get disk usage statistics for the upload directory.
     *
     * @return map with file_count and total_size_bytes
     */
    public Map<String, Object> getDiskUsage() {
        Map<String, Object> usage = new LinkedHashMap<>();

        try (Stream<Path> files = Files.list(this.uploadDir)) {
            long[] stats = {0, 0}; // [count, totalSize]
            files.filter(Files::isRegularFile).forEach(path -> {
                stats[0]++;
                try {
                    stats[1] += Files.size(path);
                } catch (IOException e) {
                    log.warn("Could not read file size: {}", path);
                }
            });

            usage.put("file_count", stats[0]);
            usage.put("total_size_bytes", stats[1]);
            usage.put("total_size_mb", Math.round(stats[1] / (1024.0 * 1024.0) * 100.0) / 100.0);
            usage.put("upload_dir", this.uploadDir.toString());
        } catch (IOException e) {
            log.error("Failed to read upload directory: {}", e.getMessage());
            usage.put("file_count", 0);
            usage.put("total_size_bytes", 0);
            usage.put("total_size_mb", 0.0);
            usage.put("upload_dir", this.uploadDir.toString());
            usage.put("error", "Could not read upload directory");
        }

        return usage;
    }
}
