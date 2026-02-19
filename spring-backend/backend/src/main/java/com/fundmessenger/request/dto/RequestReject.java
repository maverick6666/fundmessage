package com.fundmessenger.request.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RequestReject {

    @NotBlank
    private String rejectionReason;
}
