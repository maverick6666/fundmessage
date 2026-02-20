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
@Table(name = "raw_news")
@Getter
@Setter
@NoArgsConstructor
public class RawNews {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "source", length = 50, nullable = false)
    private String source;

    @Column(name = "title", length = 500, nullable = false)
    private String title;

    @Column(name = "description", columnDefinition = "text")
    private String description;

    @Column(name = "link", length = 1000)
    private String link;

    @Column(name = "pub_date", columnDefinition = "timestamptz")
    private OffsetDateTime pubDate;

    @Column(name = "collected_at", columnDefinition = "timestamptz")
    private OffsetDateTime collectedAt;

    @Type(JsonType.class)
    @Column(name = "keywords", columnDefinition = "jsonb")
    private Object keywords;

    @Column(name = "sentiment", length = 20)
    private String sentiment;

    @Column(name = "newsdesk_date")
    private LocalDate newsdeskDate;

    // v2 extension fields
    @Column(name = "media_name", length = 100)
    private String mediaName;

    @Column(name = "full_content", columnDefinition = "text")
    private String fullContent;

    @Column(name = "language", length = 10)
    private String language;

    @Column(name = "coupling_status", length = 20, columnDefinition = "varchar(20) default 'uncoupled'")
    private String couplingStatus = "uncoupled";

    // Rewriter fields
    @Column(name = "original_title", length = 500)
    private String originalTitle;

    @Column(name = "rewritten", columnDefinition = "boolean default false")
    private Boolean rewritten = false;
}
