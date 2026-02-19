package com.fundmessenger.position.dto;

import lombok.*;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TeamSettingsUpdate {
    private BigDecimal initialCapitalKrw;
    private BigDecimal initialCapitalUsd;
    private String description;
}
