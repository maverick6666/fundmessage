package com.fundmessenger.newsdesk.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

@Getter
@Setter
public class NewsDeskUploadRequest {

    /**
     * For POST /upload/news
     */
    @Getter
    @Setter
    public static class NewsUpload {
        private List<NewsItem> news;
    }

    @Getter
    @Setter
    public static class NewsItem {
        private String title;
        private String description;
        private String link;
        private OffsetDateTime pubDate;
        private String source;
        private String mediaName;
        private String language;
        private String newsdeskDate; // YYYY-MM-DD
    }

    /**
     * For POST /upload/coupling
     */
    @Getter
    @Setter
    public static class CouplingUpload {
        private List<CouplingItem> couplings;
    }

    @Getter
    @Setter
    public static class CouplingItem {
        private Long newsId;
        private String ticker;
        private String market;
        private BigDecimal relevanceScore;
        private String reason;
        private String coupledBy;
    }

    /**
     * For POST /upload/market-summary
     */
    @Getter
    @Setter
    public static class MarketSummaryUpload {
        private String date; // YYYY-MM-DD
        private String market;
        private String aiSummary;
    }
}
