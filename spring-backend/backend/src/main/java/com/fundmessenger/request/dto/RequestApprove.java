package com.fundmessenger.request.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Getter
@Setter
public class RequestApprove {

    private BigDecimal executedPrice;

    private BigDecimal executedQuantity;

    private OffsetDateTime executedAt;
}
