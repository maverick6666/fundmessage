package com.fundmessenger.newsdesk.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "stock_news", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"news_id", "stock_id"})
})
@Getter
@Setter
@NoArgsConstructor
public class StockNews {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "news_id", nullable = false)
    private RawNews news;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stock_id", nullable = false)
    private MarketStock stock;

    @Column(name = "relevance_score", precision = 5, scale = 2, nullable = false)
    private BigDecimal relevanceScore;

    @Column(name = "coupling_reason", columnDefinition = "text")
    private String couplingReason;

    @Column(name = "coupled_by", length = 50, columnDefinition = "varchar(50) default 'ai'")
    private String coupledBy = "ai";

    @Column(name = "coupled_at", columnDefinition = "timestamptz")
    private OffsetDateTime coupledAt;

    @PrePersist
    protected void onCreate() {
        this.coupledAt = OffsetDateTime.now();
    }
}
