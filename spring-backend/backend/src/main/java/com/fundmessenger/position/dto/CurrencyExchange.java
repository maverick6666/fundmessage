package com.fundmessenger.position.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CurrencyExchange {

    @NotBlank(message = "출발 통화는 필수입니다")
    private String fromCurrency;

    @NotBlank(message = "도착 통화는 필수입니다")
    private String toCurrency;

    @NotNull(message = "출발 금액은 필수입니다")
    private BigDecimal fromAmount;

    @NotNull(message = "도착 금액은 필수입니다")
    private BigDecimal toAmount;

    private BigDecimal exchangeRate;

    private String memo;
}
