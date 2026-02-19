package com.fundmessenger.price.entity;

import com.fundmessenger.position.entity.Position;
import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
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
@Table(name = "price_alerts")
@Getter
@Setter
@NoArgsConstructor
public class PriceAlert {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "position_id", nullable = false, insertable = false, updatable = false)
    private Long positionId;

    @Column(name = "alert_type", length = 20, nullable = false)
    private String alertType;

    @Column(name = "target_price", precision = 20, scale = 4, nullable = false)
    private BigDecimal targetPrice;

    @Column(name = "current_price", precision = 20, scale = 4, nullable = false)
    private BigDecimal currentPrice;

    @Type(JsonType.class)
    @Column(name = "notified_users", columnDefinition = "jsonb")
    private Object notifiedUsers;

    @Column(name = "is_read", columnDefinition = "boolean default false")
    private Boolean isRead = false;

    @CreationTimestamp
    @Column(name = "created_at", columnDefinition = "timestamptz")
    private OffsetDateTime createdAt;

    // --- ManyToOne Relationships ---

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "position_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Position position;
}
