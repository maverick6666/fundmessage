package com.fundmessenger.position.dto;

import com.fundmessenger.user.dto.UserBrief;
import lombok.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PositionResponse {
    private Long id;
    private String ticker;
    private String tickerName;
    private String market;
    private String status;
    private boolean isInfoConfirmed;

    private BigDecimal averageBuyPrice;
    private BigDecimal totalQuantity;
    private BigDecimal totalBuyAmount;

    private List<Map<String, Object>> buyPlan;
    private List<Map<String, Object>> takeProfitTargets;
    private List<Map<String, Object>> stopLossTargets;

    private int remainingBuys;
    private int remainingTakeProfits;
    private int remainingStopLosses;

    private BigDecimal averageSellPrice;
    private BigDecimal totalSellAmount;
    private BigDecimal profitLoss;
    private BigDecimal profitRate;
    private BigDecimal realizedProfitLoss;

    private Integer holdingPeriodHours;

    private OffsetDateTime openedAt;
    private OffsetDateTime closedAt;

    private UserBrief openedBy;
    private UserBrief closedBy;

    private OffsetDateTime createdAt;

    private PositionStatusInfo statusInfo;
}
