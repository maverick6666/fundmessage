package com.fundmessenger.request.entity;

import com.fundmessenger.position.entity.Position;
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

@Entity
@Table(name = "requests")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TradeRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "position_id")
    private Position position;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requester_id")
    private User requester;

    @Column(name = "request_type", length = 20, nullable = false)
    private String requestType;

    @Column(name = "target_ticker", length = 20)
    private String targetTicker;

    @Column(name = "ticker_name", length = 100)
    private String tickerName;

    @Column(name = "target_market", length = 20)
    private String targetMarket;

    @Column(name = "order_type", length = 20)
    private String orderType;

    @Column(name = "order_amount", precision = 20, scale = 4)
    private BigDecimal orderAmount;

    @Column(name = "order_quantity", precision = 20, scale = 8)
    private BigDecimal orderQuantity;

    @Column(name = "buy_price", precision = 20, scale = 4)
    private BigDecimal buyPrice;

    @Type(JsonType.class)
    @Column(name = "buy_orders", columnDefinition = "jsonb")
    private Object buyOrders;

    @Column(name = "target_ratio", precision = 5, scale = 4)
    private BigDecimal targetRatio;

    @Type(JsonType.class)
    @Column(name = "take_profit_targets", columnDefinition = "jsonb")
    private Object takeProfitTargets;

    @Type(JsonType.class)
    @Column(name = "stop_loss_targets", columnDefinition = "jsonb")
    private Object stopLossTargets;

    @Column(name = "memo", columnDefinition = "text")
    private String memo;

    @Column(name = "sell_quantity", precision = 20, scale = 8)
    private BigDecimal sellQuantity;

    @Column(name = "sell_price", precision = 20, scale = 4)
    private BigDecimal sellPrice;

    @Column(name = "sell_reason", columnDefinition = "text")
    private String sellReason;

    @Column(name = "status", length = 20, nullable = false, columnDefinition = "varchar(20) default 'pending'")
    private String status = "pending";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by")
    private User approver;

    @Column(name = "approved_at", columnDefinition = "timestamptz")
    private OffsetDateTime approvedAt;

    @Column(name = "rejection_reason", columnDefinition = "text")
    private String rejectionReason;

    @Column(name = "executed_price", precision = 20, scale = 4)
    private BigDecimal executedPrice;

    @Column(name = "executed_quantity", precision = 20, scale = 8)
    private BigDecimal executedQuantity;

    @Column(name = "executed_at", columnDefinition = "timestamptz")
    private OffsetDateTime executedAt;

    @CreationTimestamp
    @Column(name = "created_at", columnDefinition = "timestamptz")
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", columnDefinition = "timestamptz")
    private OffsetDateTime updatedAt;
}
