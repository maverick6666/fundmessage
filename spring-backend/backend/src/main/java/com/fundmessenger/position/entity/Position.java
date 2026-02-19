package com.fundmessenger.position.entity;

import com.fundmessenger.user.entity.User;
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
import java.time.OffsetDateTime;
import java.util.Map;

@Entity
@Table(name = "positions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Position {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "ticker", length = 20, nullable = false)
    private String ticker;

    @Column(name = "ticker_name", length = 100)
    private String tickerName;

    @Column(name = "market", length = 20, nullable = false)
    private String market;

    @Column(name = "status", length = 20, nullable = false, columnDefinition = "varchar(20) default 'open'")
    private String status = "open";

    @Column(name = "is_info_confirmed", columnDefinition = "boolean default false")
    private Boolean isInfoConfirmed = false;

    @Column(name = "average_buy_price", precision = 20, scale = 4)
    private BigDecimal averageBuyPrice;

    @Column(name = "total_quantity", precision = 20, scale = 8, columnDefinition = "numeric(20,8) default 0")
    private BigDecimal totalQuantity = BigDecimal.ZERO;

    @Column(name = "total_buy_amount", precision = 20, scale = 2, columnDefinition = "numeric(20,2) default 0")
    private BigDecimal totalBuyAmount = BigDecimal.ZERO;

    @Type(JsonType.class)
    @Column(name = "buy_plan", columnDefinition = "jsonb")
    private Object buyPlan;

    @Type(JsonType.class)
    @Column(name = "take_profit_targets", columnDefinition = "jsonb")
    private Object takeProfitTargets;

    @Type(JsonType.class)
    @Column(name = "stop_loss_targets", columnDefinition = "jsonb")
    private Object stopLossTargets;

    @Column(name = "average_sell_price", precision = 20, scale = 4)
    private BigDecimal averageSellPrice;

    @Column(name = "total_sell_amount", precision = 20, scale = 2)
    private BigDecimal totalSellAmount;

    @Column(name = "profit_loss", precision = 20, scale = 2)
    private BigDecimal profitLoss;

    @Column(name = "profit_rate", precision = 10, scale = 4)
    private BigDecimal profitRate;

    @Column(name = "holding_period_hours")
    private Integer holdingPeriodHours;

    @Column(name = "realized_profit_loss", precision = 20, scale = 2, columnDefinition = "numeric(20,2) default 0")
    private BigDecimal realizedProfitLoss = BigDecimal.ZERO;

    @Column(name = "opened_at", columnDefinition = "timestamptz")
    private OffsetDateTime openedAt;

    @Column(name = "closed_at", columnDefinition = "timestamptz")
    private OffsetDateTime closedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "opened_by")
    private User opener;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "closed_by")
    private User closer;

    @CreationTimestamp
    @Column(name = "created_at", columnDefinition = "timestamptz")
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", columnDefinition = "timestamptz")
    private OffsetDateTime updatedAt;
}
