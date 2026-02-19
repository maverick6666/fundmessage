package com.fundmessenger.position.dto;

import lombok.*;

import java.math.BigDecimal;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PositionBrief {

    private Long id;
    private String ticker;
    private String tickerName;
    private String market;
    private String status;
    private boolean isInfoConfirmed;

    private BigDecimal averageBuyPrice;
    private BigDecimal totalQuantity;
    private BigDecimal totalBuyAmount;

    private int remainingBuys;
    private int remainingTakeProfits;
    private int remainingStopLosses;
}
