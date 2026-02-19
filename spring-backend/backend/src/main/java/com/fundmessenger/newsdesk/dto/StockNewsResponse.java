package com.fundmessenger.newsdesk.dto;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Getter
@Builder
public class StockNewsResponse {
    private Long id;
    private Long newsId;
    private String title;
    private String description;
    private String link;
    private String source;
    private OffsetDateTime pubDate;
    private BigDecimal relevanceScore;
    private String couplingReason;
    private String coupledBy;
    private OffsetDateTime coupledAt;
}
