package com.fundmessenger.user.controller;

import com.fundmessenger.auth.service.AuthService;
import com.fundmessenger.audit.repository.AuditLogRepository;
import com.fundmessenger.common.dto.ApiResponse;
import com.fundmessenger.common.exception.BusinessException;
import com.fundmessenger.common.exception.NotFoundException;
import com.fundmessenger.common.security.UserPrincipal;
import com.fundmessenger.decision.repository.DecisionNoteRepository;
import com.fundmessenger.discussion.repository.DiscussionRepository;
import com.fundmessenger.discussion.repository.MessageRepository;
import com.fundmessenger.notification.repository.NotificationRepository;
import com.fundmessenger.request.repository.TradeRequestRepository;
import com.fundmessenger.user.dto.UserResponse;
import com.fundmessenger.user.dto.UserRoleUpdate;
import com.fundmessenger.user.entity.User;
import com.fundmessenger.user.repository.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final AuthService authService;
    private final UserRepository userRepository;
    private final NotificationRepository notificationRepository;
    private final MessageRepository messageRepository;
    private final DecisionNoteRepository decisionNoteRepository;
    private final AuditLogRepository auditLogRepository;
    private final TradeRequestRepository tradeRequestRepository;
    private final DiscussionRepository discussionRepository;

    // ──────────────────────────────────────────────
    // GET /api/v1/users/me - current user info
    // ──────────────────────────────────────────────

    @GetMapping("/me")
    public ApiResponse<UserResponse> getCurrentUser(@AuthenticationPrincipal UserPrincipal principal) {
        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> new NotFoundException("User", principal.getId()));
        return ApiResponse.success(toUserResponse(user));
    }

    // ──────────────────────────────────────────────
    // GET /api/v1/users/team-members - active team members (basic info)
    // ──────────────────────────────────────────────

    @GetMapping("/team-members")
    public ApiResponse<Map<String, Object>> getTeamMembers() {
        List<User> activeUsers = userRepository.findByIsActiveTrue();

        List<Map<String, Object>> members = activeUsers.stream()
                .map(user -> {
                    Map<String, Object> memberMap = new LinkedHashMap<>();
                    memberMap.put("id", user.getId());
                    memberMap.put("username", user.getUsername());
                    memberMap.put("fullName", user.getFullName());
                    memberMap.put("role", user.getRole());
                    return memberMap;
                })
                .collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("members", members);
        result.put("total", members.size());

        return ApiResponse.success(result);
    }

    // ──────────────────────────────────────────────
    // GET /api/v1/users - all users with full details (manager/admin)
    // ──────────────────────────────────────────────

    @GetMapping("")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public ApiResponse<Map<String, Object>> getAllUsers(
            @RequestParam(required = false) String role,
            @RequestParam(required = false) Boolean isActive) {

        List<User> users = authService.getAllUsers(role, isActive);

        List<UserResponse> userResponses = users.stream()
                .map(this::toUserResponse)
                .collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("users", userResponses);
        result.put("total", userResponses.size());

        return ApiResponse.success(result);
    }

    // ──────────────────────────────────────────────
    // GET /api/v1/users/pending - pending users (manager/admin)
    // ──────────────────────────────────────────────

    @GetMapping("/pending")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public ApiResponse<Map<String, Object>> getPendingUsers() {
        List<User> pending = authService.getPendingUsers();

        List<UserResponse> userResponses = pending.stream()
                .map(this::toUserResponse)
                .collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("users", userResponses);
        result.put("total", userResponses.size());

        return ApiResponse.success(result);
    }

    // ──────────────────────────────────────────────
    // GET /api/v1/users/{userId} - get user by ID
    // ──────────────────────────────────────────────

    @GetMapping("/{userId}")
    public ApiResponse<UserResponse> getUserById(@PathVariable Long userId) {
        User user = authService.getUserById(userId);
        return ApiResponse.success(toUserResponse(user));
    }

    // ──────────────────────────────────────────────
    // PATCH /api/v1/users/{userId}/role - update user role (manager only)
    // ──────────────────────────────────────────────

    @PatchMapping("/{userId}/role")
    @PreAuthorize("hasRole('MANAGER')")
    @Transactional
    public ApiResponse<UserResponse> updateUserRole(
            @PathVariable Long userId,
            @Valid @RequestBody UserRoleUpdate roleUpdate) {

        // Cannot set role to manager
        if ("manager".equalsIgnoreCase(roleUpdate.getRole())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST,
                    "역할을 manager로 직접 변경할 수 없습니다. 팀장 이전 기능을 사용하세요");
        }

        User updated = authService.updateUserRole(userId, roleUpdate.getRole());
        log.info("User {} role updated to {}", userId, roleUpdate.getRole());
        return ApiResponse.success(toUserResponse(updated), "역할이 변경되었습니다");
    }

    // ──────────────────────────────────────────────
    // POST /api/v1/users/{userId}/approve - approve user (manager/admin)
    // ──────────────────────────────────────────────

    @PostMapping("/{userId}/approve")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    @Transactional
    public ApiResponse<UserResponse> approveUser(@PathVariable Long userId) {
        User approved = authService.approveUser(userId);
        log.info("User {} approved", userId);
        return ApiResponse.success(toUserResponse(approved), "사용자가 승인되었습니다");
    }

    // ──────────────────────────────────────────────
    // POST /api/v1/users/{userId}/deactivate - deactivate user (manager only)
    // ──────────────────────────────────────────────

    @PostMapping("/{userId}/deactivate")
    @PreAuthorize("hasRole('MANAGER')")
    @Transactional
    public ApiResponse<UserResponse> deactivateUser(
            @PathVariable Long userId,
            @AuthenticationPrincipal UserPrincipal principal) {

        // Cannot deactivate self
        if (principal.getId().equals(userId)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST,
                    "자기 자신을 비활성화할 수 없습니다");
        }

        User deactivated = authService.deactivateUser(userId);
        log.info("User {} deactivated by manager {}", userId, principal.getId());
        return ApiResponse.success(toUserResponse(deactivated), "사용자가 비활성화되었습니다");
    }

    // ──────────────────────────────────────────────
    // DELETE /api/v1/users/{userId} - delete user (manager only)
    // ──────────────────────────────────────────────

    @DeleteMapping("/{userId}")
    @PreAuthorize("hasRole('MANAGER')")
    @Transactional
    public ApiResponse<Map<String, String>> deleteUser(
            @PathVariable Long userId,
            @AuthenticationPrincipal UserPrincipal principal) {

        // Cannot delete self
        if (principal.getId().equals(userId)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST,
                    "자기 자신을 삭제할 수 없습니다");
        }

        User targetUser = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User", userId));

        // Cannot delete a manager
        if ("manager".equals(targetUser.getRole())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST,
                    "팀장은 삭제할 수 없습니다");
        }

        // Clean up related data
        log.info("Deleting user {} and cleaning up related data...", userId);

        // 1. Delete notifications for user
        notificationRepository.deleteByUserId(userId);

        // 2. Nullify message user_id
        messageRepository.nullifyUserByUserId(userId);

        // 3. Delete decision notes by user
        decisionNoteRepository.deleteByAuthorId(userId);

        // 4. Nullify audit log user_id
        auditLogRepository.nullifyUserByUserId(userId);

        // 5. Nullify request requester_id and approved_by
        tradeRequestRepository.nullifyRequesterByUserId(userId);
        tradeRequestRepository.nullifyApproverByUserId(userId);

        // 6. Nullify discussion opened_by and closed_by
        discussionRepository.nullifyOpenerByUserId(userId);
        discussionRepository.nullifyCloserByUserId(userId);

        // 7. Delete user
        userRepository.delete(targetUser);

        log.info("User {} deleted successfully by manager {}", userId, principal.getId());

        return ApiResponse.success(
                Map.of("message", "사용자가 삭제되었습니다"),
                "사용자가 삭제되었습니다"
        );
    }

    // ──────────────────────────────────────────────
    // POST /api/v1/users/{userId}/transfer-manager - transfer manager role (manager only)
    // ──────────────────────────────────────────────

    @PostMapping("/{userId}/transfer-manager")
    @PreAuthorize("hasRole('MANAGER')")
    @Transactional
    public ApiResponse<Map<String, Object>> transferManager(
            @PathVariable Long userId,
            @AuthenticationPrincipal UserPrincipal principal) {

        // Cannot transfer to self
        if (principal.getId().equals(userId)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST,
                    "자기 자신에게 팀장 역할을 이전할 수 없습니다");
        }

        User targetUser = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User", userId));

        User currentManager = userRepository.findById(principal.getId())
                .orElseThrow(() -> new NotFoundException("User", principal.getId()));

        // Current manager becomes admin
        currentManager.setRole("admin");
        userRepository.save(currentManager);

        // Target becomes manager
        targetUser.setRole("manager");
        userRepository.save(targetUser);

        log.info("Manager role transferred from user {} to user {}", principal.getId(), userId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("previousManager", toUserResponse(currentManager));
        result.put("newManager", toUserResponse(targetUser));

        return ApiResponse.success(result, "팀장 역할이 이전되었습니다");
    }

    // ──────────────────────────────────────────────
    // Helper: convert User entity to UserResponse DTO
    // ──────────────────────────────────────────────

    private UserResponse toUserResponse(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .username(user.getUsername())
                .fullName(user.getFullName())
                .role(user.getRole())
                .positionTitle(user.getPositionTitle())
                .universityId(user.getUniversity() != null ? user.getUniversity().getId() : null)
                .universityName(user.getUniversity() != null ? user.getUniversity().getName() : null)
                .isActive(user.getIsActive() != null && user.getIsActive())
                .attendanceShields(user.getAttendanceShields() != null ? user.getAttendanceShields() : 0)
                .createdAt(user.getCreatedAt())
                .build();
    }
}
