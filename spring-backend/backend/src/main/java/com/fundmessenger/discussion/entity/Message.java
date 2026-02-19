package com.fundmessenger.discussion.entity;

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

import java.time.OffsetDateTime;

@Entity
@Table(name = "messages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "discussion_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Discussion discussion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "content", columnDefinition = "text", nullable = false)
    private String content;

    @Column(name = "message_type", length = 20, columnDefinition = "varchar(20) default 'text'")
    private String messageType = "text";

    @Type(JsonType.class)
    @Column(name = "chart_data", columnDefinition = "jsonb")
    private Object chartData;

    @Column(name = "session_number", columnDefinition = "integer default 1")
    private Integer sessionNumber = 1;

    @CreationTimestamp
    @Column(name = "created_at", columnDefinition = "timestamptz")
    private OffsetDateTime createdAt;
}
