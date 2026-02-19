package com.fundmessenger.asset.entity;

import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Type;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "asset_snapshots")
@Getter
@Setter
@NoArgsConstructor
public class AssetSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "snapshot_date", unique = true, nullable = false)
    private LocalDate snapshotDate;

    @Column(name = "krw_cash", precision = 20, scale = 2, columnDefinition = "numeric(20,2) default 0")
    private BigDecimal krwCash = BigDecimal.ZERO;

    @Column(name = "krw_evaluation", precision = 20, scale = 2, columnDefinition = "numeric(20,2) default 0")
    private BigDecimal krwEvaluation = BigDecimal.ZERO;

    @Column(name = "usd_cash", precision = 20, scale = 4, columnDefinition = "numeric(20,4) default 0")
    private BigDecimal usdCash = BigDecimal.ZERO;

    @Column(name = "usd_evaluation", precision = 20, scale = 4, columnDefinition = "numeric(20,4) default 0")
    private BigDecimal usdEvaluation = BigDecimal.ZERO;

    @Column(name = "usdt_evaluation", precision = 20, scale = 4, columnDefinition = "numeric(20,4) default 0")
    private BigDecimal usdtEvaluation = BigDecimal.ZERO;

    @Column(name = "total_krw", precision = 20, scale = 2, columnDefinition = "numeric(20,2) default 0")
    private BigDecimal totalKrw = BigDecimal.ZERO;

    @Column(name = "exchange_rate", precision = 10, scale = 2)
    private BigDecimal exchangeRate;

    @Column(name = "realized_pnl", precision = 20, scale = 2, columnDefinition = "numeric(20,2) default 0")
    private BigDecimal realizedPnl = BigDecimal.ZERO;

    @Column(name = "unrealized_pnl", precision = 20, scale = 2, columnDefinition = "numeric(20,2) default 0")
    private BigDecimal unrealizedPnl = BigDecimal.ZERO;

    @Type(JsonType.class)
    @Column(name = "position_details", columnDefinition = "jsonb")
    private Object positionDetails;

    @Column(name = "created_at", columnDefinition = "timestamptz")
    private OffsetDateTime createdAt;
}
