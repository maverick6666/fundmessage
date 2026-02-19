package com.fundmessenger.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Slf4j
@Component
@RequiredArgsConstructor
public class ConnectionManager {

    private final ObjectMapper objectMapper;

    /**
     * Active connections: userId -> list of WebSocket sessions.
     * A single user may have multiple connections (e.g. multiple browser tabs).
     */
    private final Map<Long, List<WebSocketSession>> activeConnections = new ConcurrentHashMap<>();

    /**
     * Discussion rooms: discussionId -> set of userIds in the room.
     */
    private final Map<Long, Set<Long>> discussionRooms = new ConcurrentHashMap<>();

    /**
     * Price subscriptions: ticker -> set of userIds subscribed.
     */
    private final Map<String, Set<Long>> priceSubscriptions = new ConcurrentHashMap<>();

    // ──────────────────────────────────────────────
    // Connection management
    // ──────────────────────────────────────────────

    /**
     * Register a new WebSocket connection.
     */
    public void connect(Long userId, WebSocketSession session) {
        activeConnections.computeIfAbsent(userId, k -> new CopyOnWriteArrayList<>()).add(session);
        log.info("User {} connected. Total sessions for user: {}", userId,
                activeConnections.get(userId).size());
    }

    /**
     * Remove a WebSocket connection and clean up rooms/subscriptions.
     */
    public void disconnect(Long userId, WebSocketSession session) {
        List<WebSocketSession> sessions = activeConnections.get(userId);
        if (sessions != null) {
            sessions.remove(session);
            if (sessions.isEmpty()) {
                activeConnections.remove(userId);

                // Clean up discussion rooms
                discussionRooms.values().forEach(userIds -> userIds.remove(userId));

                // Clean up price subscriptions
                priceSubscriptions.values().forEach(userIds -> userIds.remove(userId));
                priceSubscriptions.entrySet().removeIf(entry -> entry.getValue().isEmpty());
            }
        }
        log.info("User {} disconnected. Remaining sessions: {}",
                userId, sessions != null ? sessions.size() : 0);
    }

    // ──────────────────────────────────────────────
    // Personal messaging
    // ──────────────────────────────────────────────

    /**
     * Send a message to a specific user (all their sessions).
     */
    public void sendPersonalMessage(Long userId, Map<String, Object> message) {
        List<WebSocketSession> sessions = activeConnections.get(userId);
        if (sessions == null || sessions.isEmpty()) {
            return;
        }
        String json = toJson(message);
        if (json == null) return;

        for (WebSocketSession session : sessions) {
            sendText(session, json);
        }
    }

    /**
     * Broadcast a message to all connected users.
     */
    public void broadcast(Map<String, Object> message) {
        String json = toJson(message);
        if (json == null) return;

        for (List<WebSocketSession> sessions : activeConnections.values()) {
            for (WebSocketSession session : sessions) {
                sendText(session, json);
            }
        }
    }

    // ──────────────────────────────────────────────
    // Discussion rooms
    // ──────────────────────────────────────────────

    /**
     * Join a discussion room.
     */
    public void joinDiscussion(Long discussionId, Long userId) {
        discussionRooms.computeIfAbsent(discussionId, k -> ConcurrentHashMap.newKeySet()).add(userId);
        log.debug("User {} joined discussion {}", userId, discussionId);
    }

    /**
     * Leave a discussion room.
     */
    public void leaveDiscussion(Long discussionId, Long userId) {
        Set<Long> users = discussionRooms.get(discussionId);
        if (users != null) {
            users.remove(userId);
            if (users.isEmpty()) {
                discussionRooms.remove(discussionId);
            }
        }
        log.debug("User {} left discussion {}", userId, discussionId);
    }

    /**
     * Broadcast a message to all users in a discussion room.
     */
    public void broadcastToDiscussion(Long discussionId, Map<String, Object> message) {
        Set<Long> userIds = discussionRooms.get(discussionId);
        if (userIds == null || userIds.isEmpty()) {
            return;
        }

        String json = toJson(message);
        if (json == null) return;

        for (Long userId : userIds) {
            List<WebSocketSession> sessions = activeConnections.get(userId);
            if (sessions != null) {
                for (WebSocketSession session : sessions) {
                    sendText(session, json);
                }
            }
        }
    }

    // ──────────────────────────────────────────────
    // Price subscriptions
    // ──────────────────────────────────────────────

    /**
     * Subscribe a user to price updates for a ticker.
     */
    public void subscribePrice(String ticker, Long userId) {
        priceSubscriptions.computeIfAbsent(ticker, k -> ConcurrentHashMap.newKeySet()).add(userId);
        log.debug("User {} subscribed to price updates for {}", userId, ticker);
    }

    /**
     * Unsubscribe a user from price updates for a ticker.
     */
    public void unsubscribePrice(String ticker, Long userId) {
        Set<Long> users = priceSubscriptions.get(ticker);
        if (users != null) {
            users.remove(userId);
            if (users.isEmpty()) {
                priceSubscriptions.remove(ticker);
            }
        }
        log.debug("User {} unsubscribed from price updates for {}", userId, ticker);
    }

    /**
     * Broadcast a price update to all users subscribed to a ticker.
     */
    public void broadcastPriceUpdate(String ticker, Map<String, Object> priceData) {
        Set<Long> userIds = priceSubscriptions.get(ticker);
        if (userIds == null || userIds.isEmpty()) {
            return;
        }

        Map<String, Object> message = new LinkedHashMap<>();
        message.put("type", "price_update");
        message.put("ticker", ticker);
        message.put("data", priceData);

        String json = toJson(message);
        if (json == null) return;

        for (Long userId : userIds) {
            List<WebSocketSession> sessions = activeConnections.get(userId);
            if (sessions != null) {
                for (WebSocketSession session : sessions) {
                    sendText(session, json);
                }
            }
        }
    }

    /**
     * Get all tickers with at least one subscriber.
     */
    public Set<String> getSubscribedTickers() {
        return Collections.unmodifiableSet(priceSubscriptions.keySet());
    }

    // ──────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            log.error("Failed to serialize WebSocket message", e);
            return null;
        }
    }

    private void sendText(WebSocketSession session, String text) {
        if (session.isOpen()) {
            try {
                session.sendMessage(new TextMessage(text));
            } catch (IOException e) {
                log.error("Failed to send WebSocket message to session {}", session.getId(), e);
            }
        }
    }
}
