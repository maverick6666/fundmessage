package com.fundmessenger.request.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class SellRequestCreate {

    @NotNull
    private Long positionId;

    @NotNull
    private BigDecimal sellQuantity;

    private BigDecimal sellPrice;

    private String sellReason;

    private String targetTicker;
}
