package com.fundmessenger.request.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Getter
@Setter
public class BuyRequestCreate {

    @NotBlank
    private String targetTicker;

    private String tickerName;

    private String targetMarket = "KOSPI";

    private String orderType = "amount";

    private BigDecimal orderAmount;

    private BigDecimal orderQuantity;

    private BigDecimal buyPrice;

    private List<Map<String, Object>> buyOrders;

    private BigDecimal targetRatio;

    private List<Map<String, Object>> takeProfitTargets;

    private List<Map<String, Object>> stopLossTargets;

    private String memo;
}
