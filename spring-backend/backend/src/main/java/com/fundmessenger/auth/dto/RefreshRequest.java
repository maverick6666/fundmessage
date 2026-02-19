package com.fundmessenger.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RefreshRequest {

    @NotBlank(message = "refresh token을 입력해주세요")
    private String refreshToken;
}
