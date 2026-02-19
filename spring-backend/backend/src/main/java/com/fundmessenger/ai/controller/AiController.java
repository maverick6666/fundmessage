package com.fundmessenger.ai.controller;

import com.fundmessenger.ai.service.AiService;
import com.fundmessenger.common.dto.ApiResponse;
import com.fundmessenger.common.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiService aiService;

    /**
     * GET /api/v1/ai/status - Get AI usage status (daily limit and remaining).
     */
    @GetMapping("/status")
    public ApiResponse<Map<String, Object>> getStatus(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Map<String, Object> status = aiService.getStatus(principal.getId());
        return ApiResponse.success(status);
    }

    /**
     * POST /api/v1/ai/generate-decision-note - Generate an AI decision note for a position.
     */
    @PostMapping("/generate-decision-note")
    public ApiResponse<Map<String, Object>> generateDecisionNote(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Long positionId = toLong(body.get("positionId"));
        if (positionId == null) {
            positionId = toLong(body.get("position_id"));
        }
        String verbosity = body.get("verbosity") != null
                ? body.get("verbosity").toString()
                : "medium";

        Map<String, Object> result = aiService.generateDecisionNote(positionId, principal.getId(), verbosity);
        return ApiResponse.success(result, "Decision note generated successfully");
    }

    /**
     * POST /api/v1/ai/generate-operation-report - Generate an AI operation report for a position.
     */
    @PostMapping("/generate-operation-report")
    public ApiResponse<Map<String, Object>> generateOperationReport(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Long positionId = toLong(body.get("positionId"));
        if (positionId == null) {
            positionId = toLong(body.get("position_id"));
        }
        String verbosity = body.get("verbosity") != null
                ? body.get("verbosity").toString()
                : "medium";

        Map<String, Object> result = aiService.generateOperationReport(positionId, principal.getId(), verbosity);
        return ApiResponse.success(result, "Operation report generated successfully");
    }

    /**
     * GET /api/v1/ai/position-data/{positionId} - Get position data used for AI generation.
     */
    @GetMapping("/position-data/{positionId}")
    public ApiResponse<Map<String, Object>> getPositionData(
            @PathVariable Long positionId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Map<String, Object> data = aiService.getPositionData(positionId);
        return ApiResponse.success(data);
    }

    /**
     * Helper to convert Object to Long.
     */
    private Long toLong(Object value) {
        if (value == null) return null;
        if (value instanceof Number) return ((Number) value).longValue();
        try {
            return Long.parseLong(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
