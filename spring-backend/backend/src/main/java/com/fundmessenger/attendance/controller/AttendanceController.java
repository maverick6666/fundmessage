package com.fundmessenger.attendance.controller;

import com.fundmessenger.attendance.dto.RecoverRequest;
import com.fundmessenger.attendance.service.AttendanceService;
import com.fundmessenger.common.dto.ApiResponse;
import com.fundmessenger.common.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1/attendance")
@RequiredArgsConstructor
public class AttendanceController {

    private final AttendanceService attendanceService;

    // ──────────────────────────────────────────────
    // POST /api/v1/attendance/check-in
    // ──────────────────────────────────────────────

    @PostMapping("/check-in")
    public ApiResponse<Map<String, Object>> checkIn(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Map<String, Object> data = attendanceService.checkIn(principal.getId());

        boolean shieldUsed = Boolean.TRUE.equals(data.get("shield_used"));
        String message = "출석 체크 완료!";
        if (shieldUsed) {
            String recoveredDate = (String) data.get("shield_recovered_date");
            int remaining = data.get("remaining_shields") != null
                    ? ((Number) data.get("remaining_shields")).intValue() : 0;
            message += " (방패를 사용하여 " + recoveredDate + " 결석이 자동 복구되었습니다. 남은 방패: " + remaining + "개)";
        }

        return ApiResponse.success(data, message);
    }

    // ──────────────────────────────────────────────
    // GET /api/v1/attendance/me
    // ──────────────────────────────────────────────

    @GetMapping("/me")
    public ApiResponse<Map<String, Object>> getMyAttendance(
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Map<String, Object> data = attendanceService.getMyAttendance(principal.getId(), year, month);
        return ApiResponse.success(data);
    }

    // ──────────────────────────────────────────────
    // GET /api/v1/attendance/me/stats
    // ──────────────────────────────────────────────

    @GetMapping("/me/stats")
    public ApiResponse<Map<String, Object>> getMyAttendanceStats(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Map<String, Object> data = attendanceService.getMyAttendanceStats(principal.getId());
        return ApiResponse.success(data);
    }

    // ──────────────────────────────────────────────
    // POST /api/v1/attendance/recover
    // ──────────────────────────────────────────────

    @PostMapping("/recover")
    public ApiResponse<Map<String, Object>> requestRecovery(
            @RequestBody RecoverRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Map<String, Object> data = attendanceService.requestRecovery(
                principal.getId(), request.getColumnId(), request.getDate());
        return ApiResponse.success(data, "복구 요청이 제출되었습니다. 팀장 승인을 기다려주세요.");
    }

    // ──────────────────────────────────────────────
    // GET /api/v1/attendance/pending (manager only)
    // ──────────────────────────────────────────────

    @GetMapping("/pending")
    @PreAuthorize("hasRole('MANAGER')")
    public ApiResponse<Map<String, Object>> getPendingRecoveries() {
        Map<String, Object> data = attendanceService.getPendingRecoveries();
        return ApiResponse.success(data);
    }

    // ──────────────────────────────────────────────
    // POST /api/v1/attendance/{attendanceId}/approve (manager only)
    // ──────────────────────────────────────────────

    @PostMapping("/{attendanceId}/approve")
    @PreAuthorize("hasRole('MANAGER')")
    public ApiResponse<Map<String, Object>> approveRecovery(
            @PathVariable Long attendanceId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Map<String, Object> data = attendanceService.approveRecovery(attendanceId, principal.getId());
        return ApiResponse.success(data, "복구가 승인되었습니다");
    }

    // ──────────────────────────────────────────────
    // POST /api/v1/attendance/{attendanceId}/reject (manager only)
    // ──────────────────────────────────────────────

    @PostMapping("/{attendanceId}/reject")
    @PreAuthorize("hasRole('MANAGER')")
    public ApiResponse<Map<String, Object>> rejectRecovery(
            @PathVariable Long attendanceId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Map<String, Object> data = attendanceService.rejectRecovery(attendanceId, principal.getId());
        return ApiResponse.success(data, "복구 요청이 거부되었습니다");
    }

    // ──────────────────────────────────────────────
    // GET /api/v1/attendance/user/{userId}
    // ──────────────────────────────────────────────

    @GetMapping("/user/{userId}")
    public ApiResponse<Map<String, Object>> getUserAttendance(
            @PathVariable Long userId,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month
    ) {
        Map<String, Object> data = attendanceService.getUserAttendance(userId, year, month);
        return ApiResponse.success(data);
    }
}
