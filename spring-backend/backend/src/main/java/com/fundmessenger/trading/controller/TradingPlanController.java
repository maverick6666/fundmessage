package com.fundmessenger.trading.controller;

import com.fundmessenger.common.dto.ApiResponse;
import com.fundmessenger.common.security.UserPrincipal;
import com.fundmessenger.trading.dto.ExecutionCreate;
import com.fundmessenger.trading.dto.TradingPlanCreate;
import com.fundmessenger.trading.dto.TradingPlanResponse;
import com.fundmessenger.trading.entity.TradingPlan;
import com.fundmessenger.trading.service.TradingPlanService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/positions")
@RequiredArgsConstructor
public class TradingPlanController {

    private final TradingPlanService tradingPlanService;

    // ──────────────────────────────────────────────
    // List & Get
    // ──────────────────────────────────────────────

    /**
     * GET /api/v1/positions/{positionId}/plans - List all trading plans for a position.
     */
    @GetMapping("/{positionId}/plans")
    public ApiResponse<List<Map<String, Object>>> getPositionPlans(
            @PathVariable Long positionId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        List<TradingPlan> plans = tradingPlanService.getPositionPlans(positionId);
        List<Map<String, Object>> data = plans.stream()
                .map(TradingPlanResponse::from)
                .toList();
        return ApiResponse.success(data);
    }

    /**
     * GET /api/v1/positions/{positionId}/plans/{planId} - Get a single trading plan.
     */
    @GetMapping("/{positionId}/plans/{planId}")
    public ApiResponse<Map<String, Object>> getPlan(
            @PathVariable Long positionId,
            @PathVariable Long planId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        TradingPlan plan = tradingPlanService.getPlan(positionId, planId);
        return ApiResponse.success(TradingPlanResponse.from(plan));
    }

    // ──────────────────────────────────────────────
    // Create / Submit / Delete
    // ──────────────────────────────────────────────

    /**
     * POST /api/v1/positions/{positionId}/plans - Create a new trading plan.
     */
    @PostMapping("/{positionId}/plans")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Map<String, Object>> createPlan(
            @PathVariable Long positionId,
            @RequestBody TradingPlanCreate dto,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        TradingPlan plan = tradingPlanService.createPlan(positionId, dto, principal.getId());
        return ApiResponse.success(TradingPlanResponse.from(plan), "Trading plan created");
    }

    /**
     * POST /api/v1/positions/{positionId}/plans/{planId}/submit - Submit a plan.
     */
    @PostMapping("/{positionId}/plans/{planId}/submit")
    public ApiResponse<Map<String, Object>> submitPlan(
            @PathVariable Long positionId,
            @PathVariable Long planId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        TradingPlan plan = tradingPlanService.submitPlan(positionId, planId, principal.getId());
        return ApiResponse.success(TradingPlanResponse.from(plan), "Trading plan submitted");
    }

    /**
     * DELETE /api/v1/positions/{positionId}/plans/{planId} - Delete a draft plan.
     */
    @DeleteMapping("/{positionId}/plans/{planId}")
    public ApiResponse<Void> deletePlan(
            @PathVariable Long positionId,
            @PathVariable Long planId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        boolean isManager = principal.getUser().isManagerOrAdmin();
        tradingPlanService.deletePlan(positionId, planId, principal.getId(), isManager);
        return ApiResponse.success(null, "Trading plan deleted");
    }

    // ──────────────────────────────────────────────
    // Executions (manager only)
    // ──────────────────────────────────────────────

    /**
     * POST /api/v1/positions/{positionId}/executions - Create an execution record (manager only).
     */
    @PostMapping("/{positionId}/executions")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN')")
    public ApiResponse<Map<String, Object>> createExecution(
            @PathVariable Long positionId,
            @RequestBody ExecutionCreate dto,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        TradingPlan execution = tradingPlanService.createExecution(positionId, dto, principal.getId());
        return ApiResponse.success(TradingPlanResponse.from(execution), "Execution recorded");
    }
}
