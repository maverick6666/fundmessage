package com.fundmessenger.column.controller;

import com.fundmessenger.column.dto.TeamColumnCreate;
import com.fundmessenger.column.dto.TeamColumnUpdate;
import com.fundmessenger.column.service.ColumnService;
import com.fundmessenger.common.dto.ApiResponse;
import com.fundmessenger.common.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1/columns")
@RequiredArgsConstructor
public class ColumnController {

    private final ColumnService columnService;

    // ──────────────────────────────────────────────
    // GET /api/v1/columns
    // ──────────────────────────────────────────────

    @GetMapping("")
    public ApiResponse<Map<String, Object>> getColumns(
            @RequestParam(defaultValue = "0") int skip,
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(name = "author_id", required = false) Long authorId,
            @RequestParam(required = false) Boolean verified
    ) {
        Map<String, Object> data = columnService.getColumns(skip, limit, authorId, verified);
        return ApiResponse.success(data);
    }

    // ──────────────────────────────────────────────
    // GET /api/v1/columns/{columnId}
    // ──────────────────────────────────────────────

    @GetMapping("/{columnId}")
    public ApiResponse<Map<String, Object>> getColumn(@PathVariable Long columnId) {
        Map<String, Object> data = columnService.getColumn(columnId);
        return ApiResponse.success(data);
    }

    // ──────────────────────────────────────────────
    // POST /api/v1/columns
    // ──────────────────────────────────────────────

    @PostMapping("")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Map<String, Object>> createColumn(
            @RequestBody TeamColumnCreate columnData,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Map<String, Object> data = columnService.createColumn(columnData, principal.getId());
        return ApiResponse.success(data, "칼럼이 작성되었습니다");
    }

    // ──────────────────────────────────────────────
    // PUT /api/v1/columns/{columnId} (author only)
    // ──────────────────────────────────────────────

    @PutMapping("/{columnId}")
    public ApiResponse<Map<String, Object>> updateColumn(
            @PathVariable Long columnId,
            @RequestBody TeamColumnUpdate columnData,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Map<String, Object> data = columnService.updateColumn(columnId, columnData, principal.getId());
        return ApiResponse.success(data, "칼럼이 수정되었습니다");
    }

    // ──────────────────────────────────────────────
    // DELETE /api/v1/columns/{columnId} (author or manager)
    // ──────────────────────────────────────────────

    @DeleteMapping("/{columnId}")
    public ApiResponse<Void> deleteColumn(
            @PathVariable Long columnId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        columnService.deleteColumn(columnId, principal.getId(), principal.getRole());
        return ApiResponse.success(null, "칼럼이 삭제되었습니다");
    }

    // ──────────────────────────────────────────────
    // POST /api/v1/columns/{columnId}/verify (manager only)
    // ──────────────────────────────────────────────

    @PostMapping("/{columnId}/verify")
    @PreAuthorize("hasRole('MANAGER')")
    public ApiResponse<Map<String, Object>> verifyColumn(
            @PathVariable Long columnId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Map<String, Object> data = columnService.verifyColumn(columnId, principal.getId());

        String recoveredDate = (String) data.get("recovered_date");
        boolean shieldGranted = Boolean.TRUE.equals(data.get("shield_granted"));

        String message = "칼럼이 검증되었습니다";
        if (recoveredDate != null) {
            message += " (" + recoveredDate + " 결석이 출석으로 복구되었습니다)";
        } else if (shieldGranted) {
            message += " (출석 방패 +1 적립!)";
        }

        return ApiResponse.success(data, message);
    }

    // ──────────────────────────────────────────────
    // POST /api/v1/columns/{columnId}/unverify (manager only)
    // ──────────────────────────────────────────────

    @PostMapping("/{columnId}/unverify")
    @PreAuthorize("hasRole('MANAGER')")
    public ApiResponse<Map<String, Object>> unverifyColumn(@PathVariable Long columnId) {
        Map<String, Object> data = columnService.unverifyColumn(columnId);

        boolean shieldDeducted = Boolean.TRUE.equals(data.get("shield_deducted"));

        String message = "검증이 취소되었습니다";
        if (shieldDeducted) {
            message += " (적립된 방패 1개가 차감되었습니다)";
        }

        return ApiResponse.success(data, message);
    }
}
