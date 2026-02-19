package com.fundmessenger.stats.controller;

import com.fundmessenger.asset.entity.AssetSnapshot;
import com.fundmessenger.common.dto.ApiResponse;
import com.fundmessenger.common.exception.ForbiddenException;
import com.fundmessenger.common.security.UserPrincipal;
import com.fundmessenger.stats.service.AssetService;
import com.fundmessenger.stats.service.StatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/stats")
@RequiredArgsConstructor
public class StatsController {

    private final StatsService statsService;
    private final AssetService assetService;

    /**
     * GET /api/v1/stats/users/{userId} - Get statistics for a specific user.
     */
    @GetMapping("/users/{userId}")
    public ApiResponse<Map<String, Object>> getUserStats(
            @PathVariable Long userId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Map<String, Object> stats = statsService.getUserStats(userId);
        return ApiResponse.success(stats);
    }

    /**
     * GET /api/v1/stats/team - Get team-wide statistics.
     */
    @GetMapping("/team")
    public ApiResponse<Map<String, Object>> getTeamStats(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Map<String, Object> stats = statsService.getTeamStats();
        return ApiResponse.success(stats);
    }

    /**
     * GET /api/v1/stats/exchange-rate - Get current USD/KRW exchange rate.
     */
    @GetMapping("/exchange-rate")
    public ApiResponse<Map<String, Object>> getExchangeRate(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Map<String, Object> rate = statsService.getExchangeRate();
        return ApiResponse.success(rate);
    }

    /**
     * GET /api/v1/stats/asset-history - Get asset snapshot history.
     * Accepts period param (1w, 1m, 3m, 6m, 1y) and converts to days.
     */
    @GetMapping("/asset-history")
    public ApiResponse<List<AssetSnapshot>> getAssetHistory(
            @RequestParam(defaultValue = "1m") String period,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        int days = periodToDays(period);
        List<AssetSnapshot> history = assetService.getAssetHistory(days);
        return ApiResponse.success(history);
    }

    /**
     * GET /api/v1/stats/asset-snapshot/{date} - Get a single asset snapshot by date.
     */
    @GetMapping("/asset-snapshot/{date}")
    public ApiResponse<AssetSnapshot> getSnapshotDetail(
            @PathVariable LocalDate date,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        AssetSnapshot snapshot = assetService.getSnapshotByDate(date);
        return ApiResponse.success(snapshot);
    }

    /**
     * POST /api/v1/stats/asset-snapshot - Create a new asset snapshot (manager only).
     */
    @PostMapping("/asset-snapshot")
    public ApiResponse<AssetSnapshot> createSnapshot(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        requireManagerOrAdmin(principal);
        AssetSnapshot snapshot = assetService.createSnapshot(principal.getId());
        return ApiResponse.success(snapshot, "Asset snapshot created successfully");
    }

    /**
     * GET /api/v1/stats/team-ranking - Get team ranking by profit rate.
     */
    @GetMapping("/team-ranking")
    public ApiResponse<List<Map<String, Object>>> getTeamRanking(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        List<Map<String, Object>> ranking = statsService.getTeamRanking();
        return ApiResponse.success(ranking);
    }

    private void requireManagerOrAdmin(UserPrincipal principal) {
        if (!principal.getUser().isManagerOrAdmin()) {
            throw new ForbiddenException("Manager or admin role required");
        }
    }

    private int periodToDays(String period) {
        if (period == null) return 30;
        return switch (period.toLowerCase()) {
            case "1w" -> 7;
            case "1m" -> 30;
            case "3m" -> 90;
            case "6m" -> 180;
            case "1y" -> 365;
            default -> 30;
        };
    }
}
