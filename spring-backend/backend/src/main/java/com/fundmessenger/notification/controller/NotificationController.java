package com.fundmessenger.notification.controller;

import com.fundmessenger.common.config.AppProperties;
import com.fundmessenger.common.dto.ApiResponse;
import com.fundmessenger.common.security.UserPrincipal;
import com.fundmessenger.notification.dto.*;
import com.fundmessenger.notification.service.NotificationService;
import com.fundmessenger.notification.service.PushService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    private final PushService pushService;
    private final AppProperties appProperties;

    @GetMapping("")
    public ResponseEntity<ApiResponse<NotificationListResponse>> getNotifications(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(name = "unread_only", defaultValue = "false") boolean unreadOnly,
            @RequestParam(name = "limit", defaultValue = "50") int limit,
            @RequestParam(name = "offset", defaultValue = "0") int offset) {

        NotificationListResponse response = notificationService.getNotifications(
                principal.getId(), unreadOnly, limit, offset);

        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<ApiResponse<Map<String, Long>>> getUnreadCount(
            @AuthenticationPrincipal UserPrincipal principal) {

        long count = notificationService.getUnreadCount(principal.getId());
        return ResponseEntity.ok(ApiResponse.success(Map.of("unread_count", count)));
    }

    @PatchMapping("/read")
    public ResponseEntity<ApiResponse<Map<String, Object>>> markAsRead(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody NotificationMarkRead request) {

        int updated = notificationService.markAsRead(request.getNotificationIds(), principal.getId());
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "updated", updated,
                "message", "Notifications marked as read"
        )));
    }

    @PatchMapping("/read-all")
    public ResponseEntity<ApiResponse<Map<String, Object>>> markAllAsRead(
            @AuthenticationPrincipal UserPrincipal principal) {

        int updated = notificationService.markAllAsRead(principal.getId());
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "updated", updated,
                "message", "All notifications marked as read"
        )));
    }

    @DeleteMapping("/{notificationId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> deleteNotification(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long notificationId) {

        boolean deleted = notificationService.deleteNotification(notificationId, principal.getId());
        if (!deleted) {
            return ResponseEntity.status(404).body(ApiResponse.error("Notification not found"));
        }
        return ResponseEntity.ok(ApiResponse.success(Map.of("message", "Notification deleted")));
    }

    @DeleteMapping("")
    public ResponseEntity<ApiResponse<Map<String, Object>>> deleteAllNotifications(
            @AuthenticationPrincipal UserPrincipal principal) {

        int deleted = notificationService.deleteAllNotifications(principal.getId());
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "deleted", deleted,
                "message", "All notifications deleted"
        )));
    }

    @GetMapping("/vapid-key")
    public ResponseEntity<ApiResponse<Map<String, String>>> getVapidKey(
            @AuthenticationPrincipal UserPrincipal principal) {

        String publicKey = appProperties.getVapid().getPublicKey();
        return ResponseEntity.ok(ApiResponse.success(Map.of("public_key", publicKey != null ? publicKey : "")));
    }

    @PostMapping("/push/subscribe")
    public ResponseEntity<ApiResponse<Map<String, String>>> subscribePush(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody PushSubscribeRequest request) {

        String p256dh = request.getKeys() != null ? request.getKeys().get("p256dh") : null;
        String auth = request.getKeys() != null ? request.getKeys().get("auth") : null;

        if (request.getEndpoint() == null || p256dh == null || auth == null) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Missing required push subscription fields"));
        }

        pushService.subscribe(principal.getId(), request.getEndpoint(), p256dh, auth);
        return ResponseEntity.ok(ApiResponse.success(Map.of("message", "Push subscription created")));
    }

    @PostMapping("/push/unsubscribe")
    public ResponseEntity<ApiResponse<Map<String, String>>> unsubscribePush(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody PushUnsubscribeRequest request) {

        if (request.getEndpoint() == null) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Missing endpoint"));
        }

        pushService.unsubscribe(principal.getId(), request.getEndpoint());
        return ResponseEntity.ok(ApiResponse.success(Map.of("message", "Push subscription removed")));
    }
}
