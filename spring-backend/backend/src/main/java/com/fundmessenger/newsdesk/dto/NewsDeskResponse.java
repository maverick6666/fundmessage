package com.fundmessenger.newsdesk.dto;

import lombok.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NewsDeskResponse {

    private Long id;
    private LocalDate publishDate;
    private String status;
    private List<Map<String, Object>> columns;
    private List<Map<String, Object>> newsCards;
    private List<String> keywords;
    private Map<String, Object> sentiment;
    private List<Map<String, Object>> topStocks;
    private Integer rawNewsCount;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
}
