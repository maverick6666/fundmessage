package com.fundmessenger.discussion.entity;

import com.fundmessenger.position.entity.Position;
import com.fundmessenger.request.entity.TradeRequest;
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
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;

@Entity
@Table(name = "discussions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Discussion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "request_id")
    @OnDelete(action = OnDeleteAction.CASCADE)
    private TradeRequest request;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "position_id")
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Position position;

    @Column(name = "title", length = 200, nullable = false)
    private String title;

    @Column(name = "status", length = 20, nullable = false, columnDefinition = "varchar(20) default 'open'")
    private String status = "open";

    @Column(name = "session_count", columnDefinition = "integer default 1")
    private Integer sessionCount = 1;

    @Column(name = "current_agenda", columnDefinition = "text")
    private String currentAgenda;

    @Column(name = "summary", columnDefinition = "text")
    private String summary;

    @Type(JsonType.class)
    @Column(name = "summary_by_participant", columnDefinition = "jsonb")
    private Object summaryByParticipant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "opened_by")
    private User opener;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "closed_by")
    private User closer;

    @Column(name = "opened_at", columnDefinition = "timestamptz default now()")
    private OffsetDateTime openedAt;

    @Column(name = "closed_at", columnDefinition = "timestamptz")
    private OffsetDateTime closedAt;

    @CreationTimestamp
    @Column(name = "created_at", columnDefinition = "timestamptz")
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", columnDefinition = "timestamptz")
    private OffsetDateTime updatedAt;
}
