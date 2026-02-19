package com.fundmessenger.trading.dto;

import lombok.*;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ExecutionCreate {

    private String planType;          // buy, take_profit, stop_loss
    private Integer executionIndex;
    private BigDecimal targetPrice;
    private BigDecimal targetQuantity;
    private BigDecimal executedPrice;
    private BigDecimal executedQuantity;
}
