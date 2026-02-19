package com.fundmessenger.websocket;

import com.fundmessenger.common.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class WebSocketAuthInterceptor implements HandshakeInterceptor {

    private final JwtTokenProvider jwtTokenProvider;

    @Override
    public boolean beforeHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Map<String, Object> attributes
    ) {
        URI uri = request.getURI();
        String token = UriComponentsBuilder.fromUri(uri)
                .build()
                .getQueryParams()
                .getFirst("token");

        if (token == null || token.isBlank()) {
            log.warn("WebSocket handshake rejected: missing token");
            return false;
        }

        if (!jwtTokenProvider.validateAccessToken(token)) {
            log.warn("WebSocket handshake rejected: invalid token");
            return false;
        }

        Long userId = jwtTokenProvider.getUserIdFromToken(token);
        if (userId == null) {
            log.warn("WebSocket handshake rejected: could not extract user ID");
            return false;
        }

        attributes.put("user_id", userId);
        log.debug("WebSocket handshake accepted for user {}", userId);
        return true;
    }

    @Override
    public void afterHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Exception exception
    ) {
        // No-op
    }
}
