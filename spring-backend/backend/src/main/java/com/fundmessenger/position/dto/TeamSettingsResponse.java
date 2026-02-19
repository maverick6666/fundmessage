package com.fundmessenger.position.dto;

import lombok.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TeamSettingsResponse {
    private Long id;
    private BigDecimal initialCapitalKrw;
    private BigDecimal initialCapitalUsd;
    private List<Map<String, Object>> exchangeHistory;
    private String description;
    private OffsetDateTime updatedAt;
}
