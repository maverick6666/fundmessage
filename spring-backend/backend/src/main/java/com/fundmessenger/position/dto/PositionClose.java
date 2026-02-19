package com.fundmessenger.position.dto;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PositionClose {

    @NotNull(message = "총 매도금액은 필수입니다")
    private BigDecimal totalSellAmount;

    private BigDecimal averageSellPrice;

    private OffsetDateTime closedAt;
}
