package com.fundmessenger.websocket;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fundmessenger.discussion.dto.MessageCreate;
import com.fundmessenger.discussion.dto.MessageResponse;
import com.fundmessenger.discussion.entity.Message;
import com.fundmessenger.discussion.service.DiscussionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class FundWebSocketHandler extends TextWebSocketHandler {

    private final ConnectionManager connectionManager;
    private final DiscussionService discussionService;
    private final ObjectMapper objectMapper;

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        Long userId = getUserId(session);
        if (userId == null) {
            log.warn("WebSocket connection without user_id attribute, closing");
            try {
                session.close(CloseStatus.POLICY_VIOLATION);
            } catch (Exception e) {
                log.error("Error closing session", e);
            }
            return;
        }

        connectionManager.connect(userId, session);

        // Send connection confirmation
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("type", "connected");
        response.put("user_id", userId);
        connectionManager.sendPersonalMessage(userId, response);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Long userId = getUserId(session);
        if (userId != null) {
            connectionManager.disconnect(userId, session);
        }
    }

    @Override
    @SuppressWarnings("unchecked")
    protected void handleTextMessage(WebSocketSession session, TextMessage textMessage) {
        Long userId = getUserId(session);
        if (userId == null) {
            return;
        }

        try {
            Map<String, Object> raw = objectMapper.readValue(
                    textMessage.getPayload(), new TypeReference<>() {});

            String type = (String) raw.get("type");
            if (type == null) {
                sendError(session, "Missing 'type' field");
                return;
            }

            // Frontend sends { type, data: { ... } } — unwrap the data field.
            // Also support flat format { type, discussion_id, ... } for backwards compat.
            Map<String, Object> payload;
            Object dataField = raw.get("data");
            if (dataField instanceof Map) {
                payload = (Map<String, Object>) dataField;
            } else {
                payload = raw;
            }

            switch (type) {
                case "join_discussion" -> handleJoinDiscussion(userId, payload);
                case "leave_discussion" -> handleLeaveDiscussion(userId, payload);
                case "send_message" -> handleSendMessage(userId, payload);
                case "subscribe_price" -> handleSubscribePrice(userId, payload);
                case "unsubscribe_price" -> handleUnsubscribePrice(userId, payload);
                default -> sendError(session, "Unknown message type: " + type);
            }
        } catch (Exception e) {
            log.error("Error handling WebSocket message from user {}", userId, e);
            sendError(session, "Invalid message format");
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        Long userId = getUserId(session);
        log.error("WebSocket transport error for user {}: {}", userId, exception.getMessage());
    }

    // ──────────────────────────────────────────────
    // Message handlers
    // ──────────────────────────────────────────────

    private void handleJoinDiscussion(Long userId, Map<String, Object> payload) {
        Long discussionId = toLong(payload.get("discussion_id"));
        if (discussionId == null) {
            log.warn("join_discussion missing discussion_id from user {}", userId);
            return;
        }

        connectionManager.joinDiscussion(discussionId, userId);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("type", "joined_discussion");
        response.put("discussion_id", discussionId);
        connectionManager.sendPersonalMessage(userId, response);
    }

    private void handleLeaveDiscussion(Long userId, Map<String, Object> payload) {
        Long discussionId = toLong(payload.get("discussion_id"));
        if (discussionId == null) {
            log.warn("leave_discussion missing discussion_id from user {}", userId);
            return;
        }

        connectionManager.leaveDiscussion(discussionId, userId);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("type", "left_discussion");
        response.put("discussion_id", discussionId);
        connectionManager.sendPersonalMessage(userId, response);
    }

    @SuppressWarnings("unchecked")
    private void handleSendMessage(Long userId, Map<String, Object> payload) {
        Long discussionId = toLong(payload.get("discussion_id"));
        String content = (String) payload.get("content");
        String messageType = (String) payload.getOrDefault("message_type", "text");
        Map<String, Object> chartData = payload.get("chart_data") instanceof Map
                ? (Map<String, Object>) payload.get("chart_data") : null;

        if (discussionId == null || content == null || content.isBlank()) {
            log.warn("send_message missing required fields from user {}", userId);
            return;
        }

        try {
            MessageCreate msgCreate = MessageCreate.builder()
                    .content(content)
                    .messageType(messageType)
                    .chartData(chartData)
                    .build();

            Message message = discussionService.createMessage(discussionId, msgCreate, userId);
            MessageResponse msgResponse = discussionService.toMessageResponse(message);

            // Build broadcast payload
            Map<String, Object> broadcastPayload = new LinkedHashMap<>();
            broadcastPayload.put("type", "new_message");
            broadcastPayload.put("discussion_id", discussionId);
            broadcastPayload.put("message", objectMapper.convertValue(
                    msgResponse, new TypeReference<Map<String, Object>>() {}));

            connectionManager.broadcastToDiscussion(discussionId, broadcastPayload);
        } catch (Exception e) {
            log.error("Error saving message from user {} in discussion {}", userId, discussionId, e);

            Map<String, Object> errorResponse = new LinkedHashMap<>();
            errorResponse.put("type", "error");
            errorResponse.put("message", e.getMessage());
            connectionManager.sendPersonalMessage(userId, errorResponse);
        }
    }

    private void handleSubscribePrice(Long userId, Map<String, Object> payload) {
        String ticker = (String) payload.get("ticker");
        if (ticker == null || ticker.isBlank()) {
            log.warn("subscribe_price missing ticker from user {}", userId);
            return;
        }

        connectionManager.subscribePrice(ticker, userId);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("type", "subscribed_price");
        response.put("ticker", ticker);
        connectionManager.sendPersonalMessage(userId, response);
    }

    private void handleUnsubscribePrice(Long userId, Map<String, Object> payload) {
        String ticker = (String) payload.get("ticker");
        if (ticker == null || ticker.isBlank()) {
            log.warn("unsubscribe_price missing ticker from user {}", userId);
            return;
        }

        connectionManager.unsubscribePrice(ticker, userId);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("type", "unsubscribed_price");
        response.put("ticker", ticker);
        connectionManager.sendPersonalMessage(userId, response);
    }

    // ──────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────

    private Long getUserId(WebSocketSession session) {
        Object userIdAttr = session.getAttributes().get("user_id");
        if (userIdAttr instanceof Long) {
            return (Long) userIdAttr;
        }
        if (userIdAttr instanceof Number) {
            return ((Number) userIdAttr).longValue();
        }
        return null;
    }

    private Long toLong(Object value) {
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        if (value instanceof String) {
            try {
                return Long.parseLong((String) value);
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    private void sendError(WebSocketSession session, String message) {
        try {
            Map<String, Object> error = new LinkedHashMap<>();
            error.put("type", "error");
            error.put("message", message);
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(error)));
        } catch (Exception e) {
            log.error("Failed to send error message to session {}", session.getId(), e);
        }
    }
}
