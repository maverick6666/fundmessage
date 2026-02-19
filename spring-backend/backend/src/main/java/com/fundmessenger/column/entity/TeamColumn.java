package com.fundmessenger.column.entity;

import com.fundmessenger.user.entity.User;
import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Type;

import java.time.OffsetDateTime;

@Entity
@Table(name = "team_columns")
@Getter
@Setter
@NoArgsConstructor
public class TeamColumn {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "author_id", nullable = false, insertable = false, updatable = false)
    private Long authorId;

    @Column(name = "title", length = 200, nullable = false)
    private String title;

    @Column(name = "content", columnDefinition = "text")
    private String content;

    @Type(JsonType.class)
    @Column(name = "blocks", columnDefinition = "jsonb")
    private Object blocks;

    @Column(name = "created_at", columnDefinition = "timestamptz")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", columnDefinition = "timestamptz")
    private OffsetDateTime updatedAt;

    @Column(name = "is_verified", columnDefinition = "boolean default false")
    private Boolean isVerified = false;

    @Column(name = "verified_by", insertable = false, updatable = false)
    private Long verifiedById;

    @Column(name = "verified_at", columnDefinition = "timestamptz")
    private OffsetDateTime verifiedAt;

    @Column(name = "shield_granted", nullable = false, columnDefinition = "boolean default false")
    private Boolean shieldGranted = false;

    // --- ManyToOne Relationships ---

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id", nullable = false)
    private User author;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "verified_by")
    private User verifier;
}
