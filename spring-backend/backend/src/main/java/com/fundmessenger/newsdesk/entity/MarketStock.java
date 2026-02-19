package com.fundmessenger.newsdesk.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

@Entity
@Table(name = "market_stocks", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"ticker", "market"})
})
@Getter
@Setter
@NoArgsConstructor
public class MarketStock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ticker", length = 20, nullable = false)
    private String ticker;

    @Column(name = "ticker_name", length = 100, nullable = false)
    private String tickerName;

    @Column(name = "market", length = 20, nullable = false)
    private String market;

    @Column(name = "sector_code", length = 20)
    private String sectorCode;

    @Column(name = "sector_name", length = 100)
    private String sectorName;

    @Column(name = "market_cap")
    private Long marketCap;

    @Column(name = "is_active", columnDefinition = "boolean default true")
    private Boolean isActive = true;

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
