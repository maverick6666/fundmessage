package com.fundmessenger.newsdesk.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "stock_daily_price", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"stock_id", "trade_date"})
})
@Getter
@Setter
@NoArgsConstructor
public class StockDailyPrice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stock_id", nullable = false)
    private MarketStock stock;

    @Column(name = "trade_date", nullable = false)
    private LocalDate tradeDate;

    @Column(name = "open_price", precision = 15, scale = 2)
    private BigDecimal openPrice;

    @Column(name = "high_price", precision = 15, scale = 2)
    private BigDecimal highPrice;

    @Column(name = "low_price", precision = 15, scale = 2)
    private BigDecimal lowPrice;

    @Column(name = "close_price", precision = 15, scale = 2)
    private BigDecimal closePrice;

    @Column(name = "volume")
    private Long volume;

    @Column(name = "trade_amount")
    private Long tradeAmount;

    @Column(name = "change_rate", precision = 8, scale = 4)
    private BigDecimal changeRate;

    @Column(name = "market_cap")
    private Long marketCap;

    @Column(name = "created_at", columnDefinition = "timestamptz")
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = OffsetDateTime.now();
    }
}
