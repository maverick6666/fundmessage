package com.fundmessenger.position.dto;

import lombok.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PositionUpdate {
    private String tickerName;
    private BigDecimal averageBuyPrice;
    private BigDecimal totalQuantity;
    private BigDecimal totalBuyAmount;
    private List<Map<String, Object>> takeProfitTargets;
    private List<Map<String, Object>> stopLossTargets;
}
