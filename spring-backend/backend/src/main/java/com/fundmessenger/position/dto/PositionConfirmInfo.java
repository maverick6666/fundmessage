package com.fundmessenger.position.dto;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PositionConfirmInfo {

    @NotNull(message = "평균매입가는 필수입니다")
    private BigDecimal averageBuyPrice;

    @NotNull(message = "총수량은 필수입니다")
    private BigDecimal totalQuantity;

    private BigDecimal totalBuyAmount;

    private String tickerName;
}
