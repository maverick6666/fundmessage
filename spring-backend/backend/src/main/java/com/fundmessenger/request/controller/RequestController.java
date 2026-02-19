package com.fundmessenger.request.controller;

import com.fundmessenger.common.dto.ApiResponse;
import com.fundmessenger.common.exception.BusinessException;
import com.fundmessenger.common.exception.ForbiddenException;
import com.fundmessenger.common.exception.NotFoundException;
import com.fundmessenger.common.security.UserPrincipal;
import com.fundmessenger.discussion.entity.Discussion;
import com.fundmessenger.discussion.repository.DiscussionRepository;
import com.fundmessenger.discussion.repository.MessageRepository;
import com.fundmessenger.position.dto.PositionBrief;
import com.fundmessenger.position.entity.Position;
import com.fundmessenger.request.dto.*;
import com.fundmessenger.request.entity.TradeRequest;
import com.fundmessenger.request.repository.TradeRequestRepository;
import com.fundmessenger.request.service.RequestService;
import com.fundmessenger.user.dto.UserBrief;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1/requests")
@RequiredArgsConstructor
public class RequestController {

    private final RequestService requestService;
    private final TradeRequestRepository tradeRequestRepository;
    private final DiscussionRepository discussionRepository;
    private final MessageRepository messageRepository;

    // ──────────────────────────────────────────────
    // Create requests
    // ──────────────────────────────────────────────

    /**
     * POST /api/v1/requests/buy - Create a buy request (any authenticated member).
     */
    @PostMapping("/buy")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Map<String, Object>> createBuyRequest(
            @Valid @RequestBody BuyRequestCreate dto,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        TradeRequest request = requestService.createBuyRequest(dto, principal.getUser());

        // TODO: Phase 8 - NotificationService.notifyNewRequest(...)

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("request", requestToResponse(request));
        return ApiResponse.success(data, "Buy request created successfully");
    }

    /**
     * POST /api/v1/requests/sell - Create a sell request (any authenticated member).
     */
    @PostMapping("/sell")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Map<String, Object>> createSellRequest(
            @Valid @RequestBody SellRequestCreate dto,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        TradeRequest request = requestService.createSellRequest(dto, principal.getUser());

        // TODO: Phase 8 - NotificationService.notifyNewRequest(...)

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("request", requestToResponse(request));
        return ApiResponse.success(data, "Sell request created successfully");
    }

    // ──────────────────────────────────────────────
    // Read requests
    // ──────────────────────────────────────────────

    /**
     * GET /api/v1/requests - List requests with optional filters.
     */
    @GetMapping("")
    public ApiResponse<Map<String, Object>> getRequests(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String requestType,
            @RequestParam(required = false) Long requesterId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int limit,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Page<TradeRequest> requestPage = requestService.getRequests(
                status, requestType, requesterId, page, limit);

        List<RequestResponse> responses = requestPage.getContent().stream()
                .map(this::requestToResponse)
                .toList();

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("requests", responses);
        data.put("total", requestPage.getTotalElements());
        data.put("page", page);
        data.put("limit", limit);
        return ApiResponse.success(data);
    }

    /**
     * GET /api/v1/requests/{requestId} - Get request detail.
     */
    @GetMapping("/{requestId}")
    public ApiResponse<RequestResponse> getRequest(
            @PathVariable Long requestId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        TradeRequest request = requestService.getRequestById(requestId);
        return ApiResponse.success(requestToResponse(request));
    }

    // ──────────────────────────────────────────────
    // Manager actions
    // ──────────────────────────────────────────────

    /**
     * POST /api/v1/requests/{requestId}/approve - Approve a request (manager/admin).
     */
    @PostMapping("/{requestId}/approve")
    public ApiResponse<Map<String, Object>> approveRequest(
            @PathVariable Long requestId,
            @RequestBody RequestApprove approveData,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        requireManagerOrAdmin(principal);

        Object[] result = requestService.approveRequest(requestId, approveData, principal.getUser());
        TradeRequest request = (TradeRequest) result[0];
        Position position = (Position) result[1];

        // TODO: Phase 8 - NotificationService.notifyRequestApproved(...)

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("request", requestToResponse(request));

        if (position != null) {
            Map<String, Object> posData = new LinkedHashMap<>();
            posData.put("id", position.getId());
            posData.put("ticker", position.getTicker());
            posData.put("status", position.getStatus());
            posData.put("average_buy_price",
                    position.getAverageBuyPrice() != null ? position.getAverageBuyPrice() : null);
            posData.put("total_quantity",
                    position.getTotalQuantity() != null ? position.getTotalQuantity() : null);
            data.put("position", posData);
        }

        return ApiResponse.success(data, "Request approved and position updated");
    }

    /**
     * POST /api/v1/requests/{requestId}/reject - Reject a request (manager/admin).
     */
    @PostMapping("/{requestId}/reject")
    public ApiResponse<Map<String, Object>> rejectRequest(
            @PathVariable Long requestId,
            @Valid @RequestBody RequestReject rejectData,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        requireManagerOrAdmin(principal);

        TradeRequest request = requestService.rejectRequest(
                requestId, rejectData.getRejectionReason(), principal.getUser());

        // TODO: Phase 8 - NotificationService.notifyRequestRejected(...)

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("request", requestToResponse(request));
        return ApiResponse.success(data, "Request rejected");
    }

    /**
     * POST /api/v1/requests/{requestId}/discuss - Start a discussion (manager/admin).
     * Creates a Discussion entity and updates request status to "discussion".
     */
    @PostMapping("/{requestId}/discuss")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public ApiResponse<Map<String, Object>> startDiscussion(
            @PathVariable Long requestId,
            @Valid @RequestBody RequestDiscuss discussData,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        requireManagerOrAdmin(principal);

        // Update request status to discussion
        requestService.startDiscussion(requestId);

        // Create discussion entity
        TradeRequest request = requestService.getRequestById(requestId);

        Discussion discussion = new Discussion();
        discussion.setRequest(request);
        discussion.setPosition(request.getPosition());
        discussion.setTitle(discussData.getTitle());
        discussion.setCurrentAgenda(discussData.getAgenda());
        discussion.setStatus("open");
        discussion.setOpener(principal.getUser());
        discussion.setOpenedAt(java.time.OffsetDateTime.now());

        Discussion savedDiscussion = discussionRepository.save(discussion);

        // TODO: Phase 8 - NotificationService.notifyDiscussionOpened(...)

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("request", requestToResponse(request));

        Map<String, Object> discData = new LinkedHashMap<>();
        discData.put("id", savedDiscussion.getId());
        discData.put("request_id", requestId);
        discData.put("title", savedDiscussion.getTitle());
        discData.put("status", savedDiscussion.getStatus());
        discData.put("opened_by", principal.getId());
        discData.put("opened_at", savedDiscussion.getOpenedAt());
        data.put("discussion", discData);

        return ApiResponse.success(data, "Discussion session started");
    }

    /**
     * POST /api/v1/requests/{requestId}/request-discussion
     * Team member requests a discussion for their own pending request.
     */
    @PostMapping("/{requestId}/request-discussion")
    public ApiResponse<Void> requestDiscussion(
            @PathVariable Long requestId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        TradeRequest request = requestService.getRequestById(requestId);

        // Only the request owner can request a discussion
        if (!request.getRequester().getId().equals(principal.getId())) {
            throw new ForbiddenException("Can only request discussion for your own requests");
        }

        // Only pending requests can have discussion requested
        if (!"pending".equals(request.getStatus())) {
            throw new BusinessException("Can only request discussion for pending requests");
        }

        // TODO: Phase 8 - NotificationService.notifyDiscussionRequested(...)

        return ApiResponse.success(null, "Discussion request sent to managers (토론 요청이 매니저에게 전송되었습니다)");
    }

    /**
     * DELETE /api/v1/requests/{requestId} - Delete a request with cascade (manager/admin).
     */
    @DeleteMapping("/{requestId}")
    @Transactional
    public ApiResponse<Void> deleteRequest(
            @PathVariable Long requestId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        requireManagerOrAdmin(principal);

        TradeRequest request = tradeRequestRepository.findById(requestId)
                .orElseThrow(() -> new NotFoundException("Request", requestId));

        String ticker = request.getTargetTicker();

        // Delete associated discussions and their messages
        List<Discussion> discussions = discussionRepository.findByRequestId(requestId);
        for (Discussion disc : discussions) {
            messageRepository.deleteByDiscussionId(disc.getId());
            discussionRepository.delete(disc);
        }

        // Delete the request
        tradeRequestRepository.delete(request);

        log.info("Request {} ({}) deleted by {}", requestId, ticker, principal.getEmail());
        return ApiResponse.success(null,
                "Request '" + ticker + "' has been deleted (요청 '" + ticker + "'이(가) 삭제되었습니다)");
    }

    // ──────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────

    /**
     * Converts a TradeRequest entity to a RequestResponse DTO,
     * including related position info and discussion ID.
     */
    @SuppressWarnings("unchecked")
    private RequestResponse requestToResponse(TradeRequest request) {
        // Build requester brief
        UserBrief requesterBrief = null;
        if (request.getRequester() != null) {
            requesterBrief = UserBrief.builder()
                    .id(request.getRequester().getId())
                    .username(request.getRequester().getUsername())
                    .fullName(request.getRequester().getFullName())
                    .build();
        }

        // Build approver brief
        UserBrief approverBrief = null;
        if (request.getApprover() != null) {
            approverBrief = UserBrief.builder()
                    .id(request.getApprover().getId())
                    .username(request.getApprover().getUsername())
                    .fullName(request.getApprover().getFullName())
                    .build();
        }

        // Build position brief
        PositionBrief positionBrief = null;
        if (request.getPosition() != null) {
            Position pos = request.getPosition();

            int remainingBuys = countRemaining(pos.getBuyPlan());
            int remainingTps = countRemaining(pos.getTakeProfitTargets());
            int remainingSls = countRemaining(pos.getStopLossTargets());

            positionBrief = PositionBrief.builder()
                    .id(pos.getId())
                    .ticker(pos.getTicker())
                    .tickerName(pos.getTickerName())
                    .market(pos.getMarket())
                    .status(pos.getStatus())
                    .isInfoConfirmed(Boolean.TRUE.equals(pos.getIsInfoConfirmed()))
                    .averageBuyPrice(pos.getAverageBuyPrice())
                    .totalQuantity(pos.getTotalQuantity())
                    .totalBuyAmount(pos.getTotalBuyAmount())
                    .remainingBuys(remainingBuys)
                    .remainingTakeProfits(remainingTps)
                    .remainingStopLosses(remainingSls)
                    .build();
        }

        // Find the most recent discussion ID for this request
        Long discussionId = findLatestDiscussionId(request.getId());

        return RequestResponse.builder()
                .id(request.getId())
                .positionId(request.getPosition() != null ? request.getPosition().getId() : null)
                .requestType(request.getRequestType())
                .targetTicker(request.getTargetTicker())
                .tickerName(request.getTickerName())
                .targetMarket(request.getTargetMarket())
                .orderType(request.getOrderType())
                .orderAmount(request.getOrderAmount())
                .orderQuantity(request.getOrderQuantity())
                .buyPrice(request.getBuyPrice())
                .buyOrders(request.getBuyOrders() instanceof List
                        ? (List<Map<String, Object>>) request.getBuyOrders() : null)
                .targetRatio(request.getTargetRatio())
                .takeProfitTargets(request.getTakeProfitTargets() instanceof List
                        ? (List<Map<String, Object>>) request.getTakeProfitTargets() : null)
                .stopLossTargets(request.getStopLossTargets() instanceof List
                        ? (List<Map<String, Object>>) request.getStopLossTargets() : null)
                .memo(request.getMemo())
                .sellQuantity(request.getSellQuantity())
                .sellPrice(request.getSellPrice())
                .sellReason(request.getSellReason())
                .status(request.getStatus())
                .requester(requesterBrief)
                .approvedBy(approverBrief)
                .approvedAt(request.getApprovedAt())
                .rejectionReason(request.getRejectionReason())
                .executedPrice(request.getExecutedPrice())
                .executedQuantity(request.getExecutedQuantity())
                .executedAt(request.getExecutedAt())
                .createdAt(request.getCreatedAt())
                .position(positionBrief)
                .discussionId(discussionId)
                .build();
    }

    /**
     * Counts remaining (not completed) items in a plan/target list.
     */
    @SuppressWarnings("unchecked")
    private int countRemaining(Object planObj) {
        if (!(planObj instanceof List)) {
            return 0;
        }
        List<Map<String, Object>> plan = (List<Map<String, Object>>) planObj;
        return (int) plan.stream()
                .filter(item -> !Boolean.TRUE.equals(item.get("completed")))
                .count();
    }

    /**
     * Finds the latest discussion ID for a given request.
     * Prefers open discussions; falls back to the most recent closed one.
     */
    private Long findLatestDiscussionId(Long requestId) {
        List<Discussion> discussions = discussionRepository.findByRequestId(requestId);
        if (discussions.isEmpty()) {
            return null;
        }

        // Prefer open discussions
        return discussions.stream()
                .filter(d -> "open".equals(d.getStatus()))
                .reduce((first, second) -> second)  // last open
                .map(Discussion::getId)
                .orElseGet(() -> discussions.get(discussions.size() - 1).getId());
    }

    /**
     * Ensures the current user has manager or admin role.
     */
    private void requireManagerOrAdmin(UserPrincipal principal) {
        if (!principal.getUser().isManagerOrAdmin()) {
            throw new ForbiddenException("Manager or admin role required");
        }
    }
}
