package com.fundmessenger.upload.controller;

import com.fundmessenger.common.dto.ApiResponse;
import com.fundmessenger.common.security.UserPrincipal;
import com.fundmessenger.upload.service.UploadService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/uploads")
@RequiredArgsConstructor
public class UploadController {

    private final UploadService uploadService;

    /**
     * POST /api/v1/uploads/image - Upload an image file.
     */
    @PostMapping("/image")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Map<String, Object>> uploadImage(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        String url = uploadService.uploadImage(file);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("url", url);
        data.put("filename", file.getOriginalFilename());
        data.put("size", file.getSize());

        return ApiResponse.success(data, "Image uploaded successfully");
    }

    /**
     * GET /api/v1/uploads/files/{filename} - Serve a previously uploaded file.
     * This endpoint is typically public (no auth required) so images can be embedded.
     */
    @GetMapping("/files/{filename}")
    public ResponseEntity<Resource> getFile(@PathVariable String filename) {
        Resource resource = uploadService.getFile(filename);

        // Determine content type from filename extension
        String contentType = determineContentType(filename);

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=31536000")
                .body(resource);
    }

    /**
     * GET /api/v1/uploads/disk-usage - Get disk usage statistics.
     */
    @GetMapping("/disk-usage")
    public ApiResponse<Map<String, Object>> getDiskUsage(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Map<String, Object> usage = uploadService.getDiskUsage();
        return ApiResponse.success(usage);
    }

    // ──────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────

    private String determineContentType(String filename) {
        String lower = filename.toLowerCase();
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        return "application/octet-stream";
    }
}
