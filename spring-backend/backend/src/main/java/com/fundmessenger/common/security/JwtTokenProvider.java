package com.fundmessenger.common.security;

import com.fundmessenger.common.config.AppProperties;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtTokenProvider {

    private final AppProperties appProperties;

    private SecretKey getSigningKey() {
        byte[] keyBytes = appProperties.getJwt().getSecret().getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    public String createAccessToken(Long userId) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() +
                (long) appProperties.getJwt().getAccessTokenExpireMinutes() * 60 * 1000);

        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claims(Map.of("type", "access"))
                .issuedAt(now)
                .expiration(expiry)
                .signWith(getSigningKey())
                .compact();
    }

    public String createRefreshToken(Long userId) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() +
                (long) appProperties.getJwt().getRefreshTokenExpireDays() * 24 * 60 * 60 * 1000);

        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claims(Map.of("type", "refresh"))
                .issuedAt(now)
                .expiration(expiry)
                .signWith(getSigningKey())
                .compact();
    }

    public Claims parseToken(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(getSigningKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (JwtException | IllegalArgumentException e) {
            log.debug("Invalid JWT token: {}", e.getMessage());
            return null;
        }
    }

    public Long getUserIdFromToken(String token) {
        Claims claims = parseToken(token);
        if (claims == null) return null;
        try {
            return Long.parseLong(claims.getSubject());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public String getTokenType(String token) {
        Claims claims = parseToken(token);
        if (claims == null) return null;
        return (String) claims.get("type");
    }

    public boolean validateAccessToken(String token) {
        Claims claims = parseToken(token);
        return claims != null && "access".equals(claims.get("type"));
    }

    public boolean validateRefreshToken(String token) {
        Claims claims = parseToken(token);
        return claims != null && "refresh".equals(claims.get("type"));
    }
}
