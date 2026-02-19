package com.fundmessenger.notification.entity;

import com.fundmessenger.user.entity.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

@Entity
@Table(name = "push_subscriptions", uniqueConstraints = {
        @UniqueConstraint(name = "uq_push_subscription_endpoint", columnNames = {"endpoint"})
})
@Getter
@Setter
@NoArgsConstructor
public class PushSubscription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "user_id", nullable = false, insertable = false, updatable = false)
    private Long userId;

    @Column(name = "endpoint", columnDefinition = "text", nullable = false)
    private String endpoint;

    @Column(name = "p256dh", length = 200, nullable = false)
    private String p256dh;

    @Column(name = "auth", length = 100, nullable = false)
    private String auth;

    @Column(name = "created_at", columnDefinition = "timestamptz")
    private OffsetDateTime createdAt;

    // --- ManyToOne Relationships ---

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
}
