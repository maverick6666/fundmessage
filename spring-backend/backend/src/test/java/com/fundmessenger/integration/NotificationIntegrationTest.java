package com.fundmessenger.integration;

import com.fundmessenger.notification.entity.Notification;
import com.fundmessenger.notification.repository.NotificationRepository;
import com.fundmessenger.user.entity.User;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;

import java.time.LocalDateTime;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * ============================================================================
 * 알림 모듈 통합 테스트 (Notification Module Integration Tests)
 * ============================================================================
 *
 * 알림의 조회, 읽음 처리, 삭제 등을 테스트합니다.
 *
 * [테스트 대상 API]
 * - GET    /api/v1/notifications            → 내 알림 목록 조회
 * - GET    /api/v1/notifications/unread-count → 읽지 않은 알림 수
 * - PATCH  /api/v1/notifications/read        → 특정 알림 읽음 처리
 * - PATCH  /api/v1/notifications/read-all    → 전체 읽음 처리
 * - DELETE /api/v1/notifications/{id}        → 알림 삭제
 *
 * [알림 종류 (notification_type)]
 * - "request_approved": 요청 승인됨
 * - "request_rejected": 요청 거부됨
 * - "discussion_opened": 토론 개시됨
 * - "new_user": 새 팀원 가입 (팀장에게 전송)
 * - "discussion_request": 토론 요청 (팀장에게 전송)
 *
 * [격리 규칙]
 * 각 사용자는 자신의 알림만 조회/수정/삭제할 수 있습니다.
 * 다른 사용자의 알림에 접근할 수 없습니다.
 */
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class NotificationIntegrationTest extends BaseIntegrationTest {

    @Autowired
    private NotificationRepository notificationRepository;

    /**
     * 테스트용 알림 생성 헬퍼 메서드
     *
     * @param user   알림 수신 사용자
     * @param type   알림 종류 (예: "request_approved")
     * @param title  알림 제목
     * @param isRead 읽음 여부 (true=이미 읽음, false=읽지 않음)
     * @return 저장된 Notification 엔티티
     */
    private Notification createTestNotification(User user, String type, String title, boolean isRead) {
        Notification notification = new Notification();
        notification.setUser(user);
        notification.setNotificationType(type);
        notification.setTitle(title);
        notification.setMessage("Test message");
        notification.setIsRead(isRead);
        notification.setCreatedAt(LocalDateTime.now());
        return notificationRepository.save(notification);
    }

    /**
     * [테스트] 알림 목록 조회 - 내 알림 목록과 읽지 않은 알림 수 반환
     *
     * 응답 구조:
     * {
     *   "data": {
     *     "notifications": [...],  // 알림 목록
     *     "unread_count": 2        // 읽지 않은 알림 수
     *   }
     * }
     */
    @Test
    @DisplayName("GET /api/v1/notifications - 내 알림 목록 조회")
    void getNotifications_authenticated_returnsList() throws Exception {
        User user = createMember("user@test.com", "User");

        // 읽지 않은 알림 2개 생성
        createTestNotification(user, "request_approved", "Request Approved", false);
        createTestNotification(user, "discussion_opened", "Discussion Started", false);

        mockMvc.perform(get("/api/v1/notifications")
                        .header("Authorization", bearerToken(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.notifications", hasSize(2)))
                .andExpect(jsonPath("$.data.unread_count").value(2));
    }

    /**
     * [테스트] 읽지 않은 알림 수 조회 (GET /unread-count)
     *
     * 읽지 않은 알림(is_read = false)의 개수만 반환합니다.
     * 이미 읽은 알림(is_read = true)은 카운트에 포함되지 않습니다.
     */
    @Test
    @DisplayName("GET /api/v1/notifications/unread-count - 읽지 않은 알림 수 반환")
    void getUnreadCount_returnsCount() throws Exception {
        User user = createMember("user@test.com", "User");

        createTestNotification(user, "request_approved", "Approved", false);   // 읽지 않음
        createTestNotification(user, "request_rejected", "Rejected", false);   // 읽지 않음
        createTestNotification(user, "discussion_opened", "Discussion", true); // 이미 읽음

        mockMvc.perform(get("/api/v1/notifications/unread-count")
                        .header("Authorization", bearerToken(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.unread_count").value(2));  // 읽지 않은 것만 2개
    }

    /**
     * [테스트] 특정 알림 읽음 처리 (PATCH /read)
     *
     * notification_ids 배열에 포함된 알림만 is_read = true로 변경합니다.
     */
    @Test
    @DisplayName("PATCH /api/v1/notifications/read - 특정 알림 읽음 처리")
    void markAsRead_success() throws Exception {
        User user = createMember("user@test.com", "User");
        Notification n1 = createTestNotification(user, "request_approved", "N1", false);
        Notification n2 = createTestNotification(user, "request_rejected", "N2", false);

        mockMvc.perform(patch("/api/v1/notifications/read")
                        .header("Authorization", bearerToken(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "notification_ids", new long[]{n1.getId(), n2.getId()}
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    /**
     * [테스트] 전체 알림 읽음 처리 (PATCH /read-all)
     *
     * 현재 사용자의 모든 알림을 is_read = true로 변경합니다.
     */
    @Test
    @DisplayName("PATCH /api/v1/notifications/read-all - 전체 읽음 처리")
    void markAllAsRead_success() throws Exception {
        User user = createMember("user@test.com", "User");
        createTestNotification(user, "request_approved", "N1", false);
        createTestNotification(user, "request_approved", "N2", false);

        mockMvc.perform(patch("/api/v1/notifications/read-all")
                        .header("Authorization", bearerToken(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    /**
     * [테스트] 알림 삭제 (DELETE /{id})
     *
     * 특정 알림을 삭제합니다.
     * 삭제 후 DB에서 해당 알림이 없어진 것을 검증합니다.
     */
    @Test
    @DisplayName("DELETE /api/v1/notifications/{id} - 알림 삭제")
    void deleteNotification_success() throws Exception {
        User user = createMember("user@test.com", "User");
        Notification n = createTestNotification(user, "request_approved", "Delete me", false);

        mockMvc.perform(delete("/api/v1/notifications/" + n.getId())
                        .header("Authorization", bearerToken(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // DB 확인: 알림이 삭제되었는지 검증
        Assertions.assertFalse(notificationRepository.findById(n.getId()).isPresent());
    }

    /**
     * [테스트] 알림 격리 - 다른 사용자의 알림은 조회 불가
     *
     * user1의 알림을 user2가 조회하면 빈 목록이 반환됩니다.
     * 각 사용자는 자신의 알림만 볼 수 있습니다.
     */
    @Test
    @DisplayName("GET /api/v1/notifications - 다른 사용자의 알림은 보이지 않음")
    void getNotifications_otherUser_seesEmpty() throws Exception {
        User user1 = createMember("user1@test.com", "User1");
        User user2 = createMember("user2@test.com", "User2");

        // user1에게 알림 생성
        createTestNotification(user1, "request_approved", "User1's notification", false);

        // user2로 조회 → 빈 목록이어야 함
        mockMvc.perform(get("/api/v1/notifications")
                        .header("Authorization", bearerToken(user2)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.notifications", hasSize(0)));
    }
}
