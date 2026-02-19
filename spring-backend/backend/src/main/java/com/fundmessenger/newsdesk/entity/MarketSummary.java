package com.fundmessenger.newsdesk.entity;

import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Type;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

@Entity
@Table(name = "market_summary", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"summary_date", "market"})
})
@Getter
@Setter
@NoArgsConstructor
public class MarketSummary {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "summary_date", nullable = false)
    private LocalDate summaryDate;

    @Column(name = "market", length = 20, nullable = false)
    private String market;

    @Column(name = "index_value", precision = 15, scale = 2)
    private BigDecimal indexValue;

    @Column(name = "index_change", precision = 10, scale = 2)
    private BigDecimal indexChange;

    @Column(name = "index_change_rate", precision = 8, scale = 4)
    private BigDecimal indexChangeRate;

    @Column(name = "total_volume")
    private Long totalVolume;

    @Column(name = "total_trade_amount")
    private Long totalTradeAmount;

    @Column(name = "advance_count")
    private Integer advanceCount;

    @Column(name = "decline_count")
    private Integer declineCount;

    @Column(name = "unchanged_count")
    private Integer unchangedCount;

    @Type(JsonType.class)
    @Column(name = "sector_performance", columnDefinition = "jsonb")
    private List<Map<String, Object>> sectorPerformance;

    @Column(name = "ai_summary", columnDefinition = "text")
    private String aiSummary;

    @Column(name = "created_at", columnDefinition = "timestamptz")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", columnDefinition = "timestamptz")
    private OffsetDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = OffsetDateTime.now();
    }
}
