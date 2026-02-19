package com.fundmessenger.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TokenRefreshResponse {

    private String accessToken;
    private String refreshToken;
    private String tokenType;
    private int expiresIn;
}
