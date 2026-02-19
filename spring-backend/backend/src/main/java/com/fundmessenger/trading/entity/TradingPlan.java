package com.fundmessenger.trading.entity;

import com.fundmessenger.position.entity.Position;
import com.fundmessenger.user.entity.User;
import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import org.hibernate.annotations.Type;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "trading_plans")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TradingPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "position_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Position position;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "version", columnDefinition = "integer default 1")
    private Integer version = 1;

    @Column(name = "record_type", length = 20, columnDefinition = "varchar(20) default 'plan_saved'")
    private String recordType = "plan_saved";

    @Type(JsonType.class)
    @Column(name = "buy_plan", columnDefinition = "jsonb")
    private Object buyPlan;

    @Type(JsonType.class)
    @Column(name = "take_profit_targets", columnDefinition = "jsonb")
    private Object takeProfitTargets;

    @Type(JsonType.class)
    @Column(name = "stop_loss_targets", columnDefinition = "jsonb")
    private Object stopLossTargets;

    @Column(name = "memo", columnDefinition = "text")
    private String memo;

    @Type(JsonType.class)
    @Column(name = "changes", columnDefinition = "jsonb")
    private Object changes;

    @Column(name = "plan_type", length = 20)
    private String planType;

    @Column(name = "execution_index")
    private Integer executionIndex;

    @Column(name = "target_price", precision = 20, scale = 8)
    private BigDecimal targetPrice;

    @Column(name = "target_quantity", precision = 20, scale = 8)
    private BigDecimal targetQuantity;

    @Column(name = "executed_price", precision = 20, scale = 8)
    private BigDecimal executedPrice;

    @Column(name = "executed_quantity", precision = 20, scale = 8)
    private BigDecimal executedQuantity;

    @Column(name = "executed_amount", precision = 20, scale = 2)
    private BigDecimal executedAmount;

    @Column(name = "profit_loss", precision = 20, scale = 2)
    private BigDecimal profitLoss;

    @Column(name = "profit_rate", precision = 10, scale = 6)
    private BigDecimal profitRate;

    @Column(name = "status", length = 20, columnDefinition = "varchar(20) default 'draft'")
    private String status = "draft";

    @CreationTimestamp
    @Column(name = "created_at", columnDefinition = "timestamptz")
    private OffsetDateTime createdAt;

    @Column(name = "submitted_at", columnDefinition = "timestamptz")
    private OffsetDateTime submittedAt;
}
