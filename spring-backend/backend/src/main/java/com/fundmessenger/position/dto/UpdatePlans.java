package com.fundmessenger.position.dto;

import lombok.*;

import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UpdatePlans {
    private List<Map<String, Object>> buyPlan;
    private List<Map<String, Object>> takeProfitTargets;
    private List<Map<String, Object>> stopLossTargets;
}
