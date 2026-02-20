package com.fundmessenger.university.controller;

import com.fundmessenger.common.dto.ApiResponse;
import com.fundmessenger.university.dto.UniversityRequest;
import com.fundmessenger.university.dto.UniversityResponse;
import com.fundmessenger.university.entity.University;
import com.fundmessenger.university.service.UniversityService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/universities")
@RequiredArgsConstructor
public class UniversityController {

    private final UniversityService universityService;

    /**
     * GET /api/v1/universities/active - 활성 대학교 목록 (회원가입 시 사용, 공개)
     */
    @GetMapping("/active")
    public ResponseEntity<ApiResponse<List<UniversityResponse>>> getActiveUniversities() {
        List<UniversityResponse> universities = universityService.getActiveUniversities()
                .stream()
                .map(UniversityResponse::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(universities));
    }

    /**
     * GET /api/v1/universities - 전체 대학교 목록 (관리자)
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public ResponseEntity<ApiResponse<List<UniversityResponse>>> getAllUniversities() {
        List<UniversityResponse> universities = universityService.getAllUniversities()
                .stream()
                .map(UniversityResponse::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(universities));
    }

    /**
     * GET /api/v1/universities/{id} - 대학교 상세 (관리자)
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public ResponseEntity<ApiResponse<UniversityResponse>> getUniversity(@PathVariable Long id) {
        University university = universityService.getUniversityById(id);
        return ResponseEntity.ok(ApiResponse.success(UniversityResponse.from(university)));
    }

    /**
     * POST /api/v1/universities - 대학교 추가 (관리자)
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public ResponseEntity<ApiResponse<UniversityResponse>> createUniversity(
            @Valid @RequestBody UniversityRequest request) {
        University university = universityService.createUniversity(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(UniversityResponse.from(university)));
    }

    /**
     * PUT /api/v1/universities/{id} - 대학교 수정 (관리자)
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public ResponseEntity<ApiResponse<UniversityResponse>> updateUniversity(
            @PathVariable Long id,
            @Valid @RequestBody UniversityRequest request) {
        University university = universityService.updateUniversity(id, request);
        return ResponseEntity.ok(ApiResponse.success(UniversityResponse.from(university)));
    }

    /**
     * DELETE /api/v1/universities/{id} - 대학교 비활성화 (관리자)
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteUniversity(@PathVariable Long id) {
        universityService.deleteUniversity(id);
        return ResponseEntity.ok(ApiResponse.success(null, "대학교가 비활성화되었습니다"));
    }
}
