package com.fundmessenger.newsdesk.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class MarketStockResponse {
    private Long id;
    private String ticker;
    private String tickerName;
    private String market;
    private String sectorCode;
    private String sectorName;
    private Long marketCap;
    private Boolean isActive;
    private long newsCount;
}
