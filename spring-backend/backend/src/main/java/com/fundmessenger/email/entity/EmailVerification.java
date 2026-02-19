package com.fundmessenger.email.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;

@Entity
@Table(name = "email_verifications")
@Getter
@Setter
@NoArgsConstructor
public class EmailVerification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "email", length = 255, nullable = false)
    private String email;

    @Column(name = "code", length = 6, nullable = false)
    private String code;

    @Column(name = "is_verified", columnDefinition = "boolean default false")
    private Boolean isVerified = false;

    @Column(name = "expires_at", columnDefinition = "timestamptz", nullable = false)
    private OffsetDateTime expiresAt;

    @CreationTimestamp
    @Column(name = "created_at", columnDefinition = "timestamptz")
    private OffsetDateTime createdAt;

    /**
     * Returns true if this verification has expired.
     */
    public boolean isExpired() {
        return OffsetDateTime.now().isAfter(expiresAt);
    }
}
