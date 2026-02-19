package com.fundmessenger.trading.dto;

import lombok.*;

import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TradingPlanCreate {

    private List<Map<String, Object>> buyPlan;
    private List<Map<String, Object>> takeProfitTargets;
    private List<Map<String, Object>> stopLossTargets;
    private String memo;
    private List<Map<String, Object>> changes;
}
