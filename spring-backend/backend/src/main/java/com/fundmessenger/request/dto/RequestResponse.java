package com.fundmessenger.request.dto;

import com.fundmessenger.position.dto.PositionBrief;
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
public class RequestResponse {

    private Long id;
    private Long positionId;
    private String requestType;
    private String targetTicker;
    private String tickerName;
    private String targetMarket;

    private String orderType;
    private BigDecimal orderAmount;
    private BigDecimal orderQuantity;
    private BigDecimal buyPrice;

    private List<Map<String, Object>> buyOrders;
    private BigDecimal targetRatio;
    private List<Map<String, Object>> takeProfitTargets;
    private List<Map<String, Object>> stopLossTargets;
    private String memo;

    private BigDecimal sellQuantity;
    private BigDecimal sellPrice;
    private String sellReason;

    private String status;
    private UserBrief requester;
    private UserBrief approvedBy;
    private OffsetDateTime approvedAt;
    private String rejectionReason;

    private BigDecimal executedPrice;
    private BigDecimal executedQuantity;
    private OffsetDateTime executedAt;

    private OffsetDateTime createdAt;

    private PositionBrief position;
    private Long discussionId;
}
