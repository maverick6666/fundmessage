package com.fundmessenger.trading.dto;

import com.fundmessenger.trading.entity.TradingPlan;
import com.fundmessenger.user.dto.UserBrief;
import lombok.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Utility class to convert a TradingPlan entity to a response Map.
 */
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class TradingPlanResponse {

    /**
     * Converts a TradingPlan entity to a response map with snake_case keys.
     * BigDecimal fields are converted to Double for JSON serialization.
     */
    public static Map<String, Object> from(TradingPlan plan) {
        Map<String, Object> map = new LinkedHashMap<>();

        map.put("id", plan.getId());
        map.put("position_id", plan.getPosition().getId());
        map.put("version", plan.getVersion());
        map.put("record_type", plan.getRecordType());
        map.put("buy_plan", plan.getBuyPlan());
        map.put("take_profit_targets", plan.getTakeProfitTargets());
        map.put("stop_loss_targets", plan.getStopLossTargets());
        map.put("memo", plan.getMemo());
        map.put("changes", plan.getChanges());

        // Execution-specific fields
        map.put("plan_type", plan.getPlanType());
        map.put("execution_index", plan.getExecutionIndex());
        map.put("target_price", toDouble(plan.getTargetPrice()));
        map.put("target_quantity", toDouble(plan.getTargetQuantity()));
        map.put("executed_price", toDouble(plan.getExecutedPrice()));
        map.put("executed_quantity", toDouble(plan.getExecutedQuantity()));
        map.put("executed_amount", toDouble(plan.getExecutedAmount()));
        map.put("profit_loss", toDouble(plan.getProfitLoss()));
        map.put("profit_rate", toDouble(plan.getProfitRate()));

        map.put("status", plan.getStatus());

        // User brief
        if (plan.getUser() != null) {
            UserBrief userBrief = UserBrief.builder()
                    .id(plan.getUser().getId())
                    .username(plan.getUser().getUsername())
                    .fullName(plan.getUser().getFullName())
                    .build();
            map.put("user", userBrief);
        } else {
            map.put("user", null);
        }

        map.put("created_at", plan.getCreatedAt());
        map.put("submitted_at", plan.getSubmittedAt());

        return map;
    }

    private static Double toDouble(java.math.BigDecimal value) {
        return value != null ? value.doubleValue() : null;
    }
}
