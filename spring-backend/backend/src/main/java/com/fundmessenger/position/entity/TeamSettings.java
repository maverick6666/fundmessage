package com.fundmessenger.position.entity;

import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Type;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "team_settings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TeamSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "initial_capital_krw", precision = 20, scale = 0, columnDefinition = "numeric(20,0) default 0")
    private BigDecimal initialCapitalKrw = BigDecimal.ZERO;

    @Column(name = "initial_capital_usd", precision = 20, scale = 2, columnDefinition = "numeric(20,2) default 0")
    private BigDecimal initialCapitalUsd = BigDecimal.ZERO;

    @Type(JsonType.class)
    @Column(name = "exchange_history", columnDefinition = "jsonb")
    private Object exchangeHistory;

    @Column(name = "ai_daily_limit", columnDefinition = "integer default 3")
    private Integer aiDailyLimit = 3;

    @Column(name = "ai_usage_count", columnDefinition = "integer default 0")
    private Integer aiUsageCount = 0;

    @Column(name = "ai_usage_reset_date")
    private LocalDate aiUsageResetDate;

    @Column(name = "description", columnDefinition = "text")
    private String description;

    @CreationTimestamp
    @Column(name = "created_at", columnDefinition = "timestamptz")
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", columnDefinition = "timestamptz")
    private OffsetDateTime updatedAt;
}
