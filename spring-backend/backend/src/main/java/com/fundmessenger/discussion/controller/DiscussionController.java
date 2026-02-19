package com.fundmessenger.discussion.controller;

import com.fundmessenger.common.dto.ApiResponse;
import com.fundmessenger.common.exception.ForbiddenException;
import com.fundmessenger.common.security.UserPrincipal;
import com.fundmessenger.discussion.dto.*;
import com.fundmessenger.discussion.entity.Discussion;
import com.fundmessenger.discussion.entity.Message;
import com.fundmessenger.discussion.service.DiscussionService;
import com.fundmessenger.notification.entity.Notification;
import com.fundmessenger.notification.repository.NotificationRepository;
import com.fundmessenger.user.entity.User;
import com.fundmessenger.user.repository.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/v1/discussions")
@RequiredArgsConstructor
public class DiscussionController {

    private final DiscussionService discussionService;
    private final UserRepository userRepository;
    private final NotificationRepository notificationRepository;

    // ──────────────────────────────────────────────
    // List discussions
    // ──────────────────────────────────────────────

    /**
     * GET /api/v1/discussions - Get all discussions with optional status filter.
     */
    @GetMapping("")
    public ApiResponse<Map<String, Object>> getDiscussions(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(defaultValue = "0") int offset,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        List<Discussion> discussions = discussionService.getAllDiscussions(status, limit, offset);
        long total = discussionService.countDiscussions(status);

        List<Map<String, Object>> items = new ArrayList<>();
        for (Discussion discussion : discussions) {
            Map<String, Object> item = new LinkedHashMap<>();
            DiscussionResponse response = discussionService.toResponse(discussion);
            item.put("id", response.getId());
            item.put("request_id", response.getRequestId());
            item.put("position_id", response.getPositionId());
            item.put("title", response.getTitle());
            item.put("status", response.getStatus());
            item.put("summary", response.getSummary());
            item.put("session_count", response.getSessionCount());
            item.put("current_agenda", response.getCurrentAgenda());
            item.put("opened_by", response.getOpenedBy());
            item.put("closed_by", response.getClosedBy());
            item.put("opened_at", response.getOpenedAt());
            item.put("closed_at", response.getClosedAt());
            item.put("message_count", response.getMessageCount());

            // Enrich with position/request info
            if (discussion.getPosition() != null) {
                item.put("ticker_name", discussion.getPosition().getTickerName());
                item.put("ticker", discussion.getPosition().getTicker());
            } else if (discussion.getRequest() != null) {
                item.put("ticker_name", discussion.getRequest().getTickerName());
                item.put("ticker", discussion.getRequest().getTargetTicker());
            }

            // Requester from request
            if (discussion.getRequest() != null && discussion.getRequest().getRequester() != null) {
                User requester = discussion.getRequest().getRequester();
                Map<String, Object> requesterMap = new LinkedHashMap<>();
                requesterMap.put("id", requester.getId());
                requesterMap.put("username", requester.getUsername());
                requesterMap.put("full_name", requester.getFullName());
                item.put("requester", requesterMap);
            }

            // Last message
            Message lastMessage = discussionService.getLastMessage(discussion.getId());
            if (lastMessage != null) {
                Map<String, Object> lastMsgMap = new LinkedHashMap<>();
                lastMsgMap.put("content", lastMessage.getContent());
                lastMsgMap.put("message_type", lastMessage.getMessageType());
                lastMsgMap.put("created_at", lastMessage.getCreatedAt());
                if (lastMessage.getUser() != null) {
                    lastMsgMap.put("username", lastMessage.getUser().getUsername());
                }
                item.put("last_message", lastMsgMap);
            }

            items.add(item);
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("discussions", items);
        data.put("total", total);
        data.put("limit", limit);
        data.put("offset", offset);
        return ApiResponse.success(data);
    }

    // ──────────────────────────────────────────────
    // Create discussion
    // ──────────────────────────────────────────────

    /**
     * POST /api/v1/discussions - Create a new discussion (manager/admin only).
     */
    @PostMapping("")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<DiscussionResponse> createDiscussion(
            @Valid @RequestBody DiscussionCreate data,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        requireManagerOrAdmin(principal);
        Discussion discussion = discussionService.createDiscussion(data, principal.getId());
        return ApiResponse.success(discussionService.toResponse(discussion), "Discussion created");
    }

    // ──────────────────────────────────────────────
    // Get discussions by position
    // ──────────────────────────────────────────────

    /**
     * GET /api/v1/discussions/position/{positionId} - Get discussions for a position.
     */
    @GetMapping("/position/{positionId}")
    public ApiResponse<List<DiscussionResponse>> getDiscussionsByPosition(
            @PathVariable Long positionId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        List<Discussion> discussions = discussionService.getDiscussionsByPositionId(positionId);
        List<DiscussionResponse> responses = discussions.stream()
                .map(discussionService::toResponse)
                .collect(Collectors.toList());
        return ApiResponse.success(responses);
    }

    // ──────────────────────────────────────────────
    // Get single discussion
    // ──────────────────────────────────────────────

    /**
     * GET /api/v1/discussions/{discussionId} - Get discussion detail.
     */
    @GetMapping("/{discussionId}")
    public ApiResponse<DiscussionResponse> getDiscussion(
            @PathVariable Long discussionId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Discussion discussion = discussionService.getDiscussionById(discussionId);
        return ApiResponse.success(discussionService.toResponse(discussion));
    }

    // ──────────────────────────────────────────────
    // Messages
    // ──────────────────────────────────────────────

    /**
     * GET /api/v1/discussions/{discussionId}/messages - Get messages with pagination.
     */
    @GetMapping("/{discussionId}/messages")
    public ApiResponse<DiscussionMessagesResponse> getMessages(
            @PathVariable Long discussionId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int limit,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Page<Message> messagePage = discussionService.getMessages(discussionId, page, limit);

        List<MessageResponse> messageResponses = messagePage.getContent().stream()
                .map(discussionService::toMessageResponse)
                .collect(Collectors.toList());

        DiscussionMessagesResponse response = DiscussionMessagesResponse.builder()
                .messages(messageResponses)
                .total(messagePage.getTotalElements())
                .page(page)
                .limit(limit)
                .build();

        return ApiResponse.success(response);
    }

    /**
     * POST /api/v1/discussions/{discussionId}/messages - Create a message.
     */
    @PostMapping("/{discussionId}/messages")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<MessageResponse> createMessage(
            @PathVariable Long discussionId,
            @RequestBody MessageCreate data,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Message message = discussionService.createMessage(discussionId, data, principal.getId());
        return ApiResponse.success(discussionService.toMessageResponse(message), "Message sent");
    }

    // ──────────────────────────────────────────────
    // Discussion lifecycle
    // ──────────────────────────────────────────────

    /**
     * POST /api/v1/discussions/{discussionId}/close - Close a discussion (manager/admin).
     */
    @PostMapping("/{discussionId}/close")
    public ApiResponse<DiscussionResponse> closeDiscussion(
            @PathVariable Long discussionId,
            @RequestBody(required = false) DiscussionClose data,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        requireManagerOrAdmin(principal);
        Discussion discussion = discussionService.closeDiscussion(discussionId, data, principal.getId());
        return ApiResponse.success(discussionService.toResponse(discussion), "Discussion closed");
    }

    /**
     * POST /api/v1/discussions/{discussionId}/reopen - Reopen a discussion (manager/admin).
     */
    @PostMapping("/{discussionId}/reopen")
    public ApiResponse<DiscussionResponse> reopenDiscussion(
            @PathVariable Long discussionId,
            @Valid @RequestBody DiscussionReopen data,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        requireManagerOrAdmin(principal);
        Discussion discussion = discussionService.reopenDiscussion(discussionId, principal.getId(), data);
        return ApiResponse.success(discussionService.toResponse(discussion), "Discussion reopened");
    }

    /**
     * PATCH /api/v1/discussions/{discussionId} - Update discussion (manager/admin).
     */
    @PatchMapping("/{discussionId}")
    public ApiResponse<DiscussionResponse> updateDiscussion(
            @PathVariable Long discussionId,
            @RequestBody DiscussionUpdate data,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        requireManagerOrAdmin(principal);
        Discussion discussion = discussionService.updateDiscussion(discussionId, data, principal.getId());
        return ApiResponse.success(discussionService.toResponse(discussion), "Discussion updated");
    }

    // ──────────────────────────────────────────────
    // Request reopen (member)
    // ──────────────────────────────────────────────

    /**
     * POST /api/v1/discussions/{discussionId}/request-reopen
     * A member requests that a closed discussion be reopened.
     * Sends notification to all managers.
     */
    @PostMapping("/{discussionId}/request-reopen")
    public ApiResponse<Void> requestReopen(
            @PathVariable Long discussionId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Discussion discussion = discussionService.getDiscussionById(discussionId);

        // Notify all managers
        List<User> managers = userRepository.findByRole("manager");
        for (User manager : managers) {
            Notification notification = new Notification();
            notification.setUser(manager);
            notification.setNotificationType("discussion_reopen_request");
            notification.setTitle("Discussion reopen requested");
            notification.setMessage(principal.getUser().getUsername() + " requested reopening discussion: "
                    + discussion.getTitle());
            notification.setRelatedType("discussion");
            notification.setRelatedId(discussion.getId().intValue());
            notification.setIsRead(false);
            notificationRepository.save(notification);
        }

        return ApiResponse.success(null, "Reopen request sent to managers");
    }

    // ──────────────────────────────────────────────
    // Export
    // ──────────────────────────────────────────────

    /**
     * GET /api/v1/discussions/{discussionId}/export - Export as JSON.
     */
    @GetMapping("/{discussionId}/export")
    public ApiResponse<Map<String, Object>> exportDiscussion(
            @PathVariable Long discussionId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Map<String, Object> exportData = discussionService.getDiscussionExport(discussionId);
        return ApiResponse.success(exportData);
    }

    /**
     * GET /api/v1/discussions/{discussionId}/sessions - Get session list.
     */
    @GetMapping("/{discussionId}/sessions")
    public ApiResponse<List<Map<String, Object>>> getSessions(
            @PathVariable Long discussionId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        List<Map<String, Object>> sessions = discussionService.getSessionsWithInfo(discussionId);
        return ApiResponse.success(sessions);
    }

    /**
     * GET /api/v1/discussions/{discussionId}/export-txt - Export as plain text.
     */
    @GetMapping("/{discussionId}/export-txt")
    public ApiResponse<Map<String, String>> exportDiscussionTxt(
            @PathVariable Long discussionId,
            @RequestParam(required = false) String sessions,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        List<Integer> sessionNumbers = null;
        if (sessions != null && !sessions.isBlank()) {
            sessionNumbers = Arrays.stream(sessions.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .map(Integer::parseInt)
                    .collect(Collectors.toList());
        }

        String text = discussionService.exportDiscussionTxt(discussionId, sessionNumbers);
        Map<String, String> data = new LinkedHashMap<>();
        data.put("content", text);
        return ApiResponse.success(data);
    }

    // ──────────────────────────────────────────────
    // Delete
    // ──────────────────────────────────────────────

    /**
     * DELETE /api/v1/discussions/{discussionId} - Delete discussion (manager/admin).
     */
    @DeleteMapping("/{discussionId}")
    public ApiResponse<Void> deleteDiscussion(
            @PathVariable Long discussionId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        requireManagerOrAdmin(principal);
        discussionService.deleteDiscussion(discussionId);
        return ApiResponse.success(null, "Discussion deleted");
    }

    /**
     * DELETE /api/v1/discussions/{discussionId}/sessions/{sessionNumber}
     * Delete all messages in a specific session (manager/admin).
     */
    @DeleteMapping("/{discussionId}/sessions/{sessionNumber}")
    public ApiResponse<Void> deleteSession(
            @PathVariable Long discussionId,
            @PathVariable int sessionNumber,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        requireManagerOrAdmin(principal);
        discussionService.deleteSession(discussionId, sessionNumber, principal.getId());
        return ApiResponse.success(null, "Session " + sessionNumber + " deleted");
    }

    // ──────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────

    private void requireManagerOrAdmin(UserPrincipal principal) {
        if (!principal.getUser().isManagerOrAdmin()) {
            throw new ForbiddenException("Manager or admin role required");
        }
    }
}
