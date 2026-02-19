package com.fundmessenger.newsdesk.dto;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Getter
@Builder
public class MarketSummaryResponse {
    private Long id;
    private LocalDate summaryDate;
    private String market;
    private BigDecimal indexValue;
    private BigDecimal indexChange;
    private BigDecimal indexChangeRate;
    private Long totalVolume;
    private Long totalTradeAmount;
    private Integer advanceCount;
    private Integer declineCount;
    private Integer unchangedCount;
    private List<Map<String, Object>> sectorPerformance;
    private String aiSummary;
}
