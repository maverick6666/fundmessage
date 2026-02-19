package com.fundmessenger.notification.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fundmessenger.notification.dto.NotificationListResponse;
import com.fundmessenger.notification.dto.NotificationResponse;
import com.fundmessenger.notification.entity.Notification;
import com.fundmessenger.notification.repository.NotificationRepository;
import com.fundmessenger.user.entity.User;
import com.fundmessenger.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Autowired(required = false)
    @Lazy
    private PushService pushService;

    @Autowired(required = false)
    @Lazy
    private SimpMessagingTemplate messagingTemplate;

    // ---- Core CRUD ----

    @Transactional
    public Notification createNotification(Long userId, String type, String title,
                                           String message, String relatedType, Long relatedId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        Notification notification = new Notification();
        notification.setUser(user);
        notification.setNotificationType(type);
        notification.setTitle(title);
        notification.setMessage(message);
        notification.setRelatedType(relatedType);
        notification.setRelatedId(relatedId != null ? relatedId.intValue() : null);
        notification.setIsRead(false);

        Notification saved = notificationRepository.save(notification);

        // Broadcast via WebSocket (best-effort)
        broadcastNotification(userId, saved);

        // Send web push (best-effort)
        sendPushNotification(userId, title, message, type, relatedType, relatedId);

        return saved;
    }

    @Transactional
    public void createNotificationForManagers(String type, String title, String message,
                                              String relatedType, Long relatedId, Long excludeUserId) {
        List<User> managersAndAdmins = userRepository.findByIsActiveTrue().stream()
                .filter(User::isManagerOrAdmin)
                .filter(u -> !u.getId().equals(excludeUserId))
                .collect(Collectors.toList());

        for (User user : managersAndAdmins) {
            try {
                createNotification(user.getId(), type, title, message, relatedType, relatedId);
            } catch (Exception e) {
                log.error("Failed to create notification for manager {}: {}", user.getId(), e.getMessage());
            }
        }
    }

    @Transactional(readOnly = true)
    public NotificationListResponse getNotifications(Long userId, boolean unreadOnly, int limit, int offset) {
        Pageable pageable = PageRequest.of(
                offset / Math.max(limit, 1),
                Math.max(limit, 1),
                Sort.by(Sort.Direction.DESC, "createdAt")
        );

        Page<Notification> page;
        long total;

        if (unreadOnly) {
            page = notificationRepository.findByUserIdAndIsReadFalse(userId, pageable);
            total = notificationRepository.countByUserIdAndIsReadFalse(userId);
        } else {
            page = notificationRepository.findByUserId(userId, pageable);
            total = notificationRepository.countByUserId(userId);
        }

        long unreadCount = notificationRepository.countByUserIdAndIsReadFalse(userId);

        List<NotificationResponse> responses = page.getContent().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());

        return NotificationListResponse.builder()
                .notifications(responses)
                .total(total)
                .unreadCount(unreadCount)
                .build();
    }

    @Transactional(readOnly = true)
    public long getUnreadCount(Long userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }

    @Transactional
    public int markAsRead(List<Long> notificationIds, Long userId) {
        if (notificationIds == null || notificationIds.isEmpty()) {
            return 0;
        }
        return notificationRepository.markAsReadByIdsAndUserId(notificationIds, userId);
    }

    @Transactional
    public int markAllAsRead(Long userId) {
        return notificationRepository.markAllAsReadByUserId(userId);
    }

    @Transactional
    public boolean deleteNotification(Long notificationId, Long userId) {
        long deleted = notificationRepository.deleteByIdAndUserId(notificationId, userId);
        return deleted > 0;
    }

    @Transactional
    public int deleteAllNotifications(Long userId) {
        return notificationRepository.deleteAllByUserId(userId);
    }

    // ---- Convenience methods ----

    public void notifyRequestApproved(Long userId, String requesterName, String ticker, Long requestId) {
        String title = "요청 승인";
        String message = String.format("%s님의 %s 요청이 승인되었습니다.", requesterName, ticker);
        createNotification(userId, "request_approved", title, message, "request", requestId);
    }

    public void notifyRequestRejected(Long userId, String requesterName, String ticker,
                                      Long requestId, String reason) {
        String title = "요청 거부";
        String message = String.format("%s님의 %s 요청이 거부되었습니다. 사유: %s",
                requesterName, ticker, reason != null ? reason : "");
        createNotification(userId, "request_rejected", title, message, "request", requestId);
    }

    public void notifyDiscussionOpened(Long userId, String ticker, Long discussionId) {
        String title = "토론 개시";
        String message = String.format("%s 관련 토론이 시작되었습니다.", ticker);
        createNotification(userId, "discussion_opened", title, message, "discussion", discussionId);
    }

    public void notifyDiscussionRequested(Long userId, String requesterName, String ticker, Long discussionId) {
        String title = "토론 요청";
        String message = String.format("%s님이 %s 관련 토론을 요청했습니다.", requesterName, ticker);
        createNotification(userId, "discussion_requested", title, message, "discussion", discussionId);
    }

    public void notifyNewRequest(Long excludeUserId, String requesterName, String ticker,
                                 String requestType, Long requestId) {
        String typeLabel = "buy".equals(requestType) ? "매수" : "매도";
        String title = "새 요청";
        String message = String.format("%s님이 %s %s 요청을 제출했습니다.", requesterName, ticker, typeLabel);
        createNotificationForManagers("new_request", title, message, "request", requestId, excludeUserId);
    }

    // ---- Private helpers ----

    private NotificationResponse toResponse(Notification notification) {
        return NotificationResponse.builder()
                .id(notification.getId())
                .notificationType(notification.getNotificationType())
                .title(notification.getTitle())
                .message(notification.getMessage())
                .relatedType(notification.getRelatedType())
                .relatedId(notification.getRelatedId() != null ? notification.getRelatedId().longValue() : null)
                .isRead(notification.getIsRead())
                .createdAt(notification.getCreatedAt())
                .build();
    }

    private void broadcastNotification(Long userId, Notification notification) {
        if (messagingTemplate == null) {
            log.debug("SimpMessagingTemplate not available, skipping WebSocket broadcast.");
            return;
        }

        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("type", "notification");

            Map<String, Object> data = new HashMap<>();
            data.put("id", notification.getId());
            data.put("notification_type", notification.getNotificationType());
            data.put("title", notification.getTitle());
            data.put("message", notification.getMessage());
            data.put("related_type", notification.getRelatedType());
            data.put("related_id", notification.getRelatedId());
            data.put("is_read", notification.getIsRead());
            data.put("created_at", notification.getCreatedAt() != null
                    ? notification.getCreatedAt().toString() : null);
            payload.put("data", data);

            messagingTemplate.convertAndSendToUser(
                    userId.toString(),
                    "/queue/notifications",
                    payload
            );
            log.debug("WebSocket notification broadcast to user {}", userId);
        } catch (Exception e) {
            log.warn("Failed to broadcast notification via WebSocket for user {}: {}", userId, e.getMessage());
        }
    }

    private void sendPushNotification(Long userId, String title, String message,
                                      String notificationType, String relatedType, Long relatedId) {
        if (pushService == null) {
            log.debug("PushService not available, skipping push notification.");
            return;
        }

        try {
            String url = buildNotificationUrl(relatedType, relatedId);
            pushService.sendPush(userId, title, message, url, notificationType, relatedType, relatedId);
        } catch (Exception e) {
            log.warn("Failed to send push notification to user {}: {}", userId, e.getMessage());
        }
    }

    private String buildNotificationUrl(String relatedType, Long relatedId) {
        if (relatedType == null || relatedId == null) {
            return "/notifications";
        }
        return switch (relatedType) {
            case "request" -> "/requests";
            case "discussion" -> "/discussions/" + relatedId;
            case "position" -> "/positions/" + relatedId;
            default -> "/notifications";
        };
    }
}
