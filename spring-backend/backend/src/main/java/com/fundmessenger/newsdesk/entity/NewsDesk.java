package com.fundmessenger.newsdesk.entity;

import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Type;

import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "news_desks")
@Getter
@Setter
@NoArgsConstructor
public class NewsDesk {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "publish_date", unique = true, nullable = false)
    private LocalDate publishDate;

    @Type(JsonType.class)
    @Column(name = "columns", columnDefinition = "jsonb")
    private Object columns;

    @Type(JsonType.class)
    @Column(name = "news_cards", columnDefinition = "jsonb")
    private Object newsCards;

    @Type(JsonType.class)
    @Column(name = "keywords", columnDefinition = "jsonb")
    private Object keywords;

    @Type(JsonType.class)
    @Column(name = "sentiment", columnDefinition = "jsonb")
    private Object sentiment;

    @Type(JsonType.class)
    @Column(name = "top_stocks", columnDefinition = "jsonb")
    private Object topStocks;

    @Column(name = "status", length = 20, columnDefinition = "varchar(20) default 'pending'")
    private String status = "pending";

    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;

    @Column(name = "raw_news_count", columnDefinition = "integer default 0")
    private Integer rawNewsCount = 0;

    @Column(name = "generation_count", columnDefinition = "integer default 0")
    private Integer generationCount = 0;

    @Column(name = "last_generated_at", columnDefinition = "timestamptz")
    private OffsetDateTime lastGeneratedAt;

    @Column(name = "created_at", columnDefinition = "timestamptz")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", columnDefinition = "timestamptz")
    private OffsetDateTime updatedAt;
}
