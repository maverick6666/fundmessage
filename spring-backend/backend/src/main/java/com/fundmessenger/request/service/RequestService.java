package com.fundmessenger.request.service;

import com.fundmessenger.common.exception.BusinessException;
import com.fundmessenger.common.exception.NotFoundException;
import com.fundmessenger.common.util.TargetConverter;
import com.fundmessenger.position.dto.PositionClose;
import com.fundmessenger.position.entity.Position;
import com.fundmessenger.position.service.PositionService;
import com.fundmessenger.request.dto.BuyRequestCreate;
import com.fundmessenger.request.dto.RequestApprove;
import com.fundmessenger.request.dto.SellRequestCreate;
import com.fundmessenger.request.entity.TradeRequest;
import com.fundmessenger.request.repository.TradeRequestRepository;
import com.fundmessenger.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class RequestService {

    private final TradeRequestRepository tradeRequestRepository;
    private final PositionService positionService;

    // ──────────────────────────────────────────────
    // Read operations
    // ──────────────────────────────────────────────

    /**
     * Get a single request by ID.
     */
    public TradeRequest getRequestById(Long requestId) {
        return tradeRequestRepository.findById(requestId)
                .orElseThrow(() -> new NotFoundException("Request", requestId));
    }

    /**
     * Get paginated and filtered request list.
     */
    public Page<TradeRequest> getRequests(
            String status,
            String requestType,
            Long requesterId,
            int page,
            int limit
    ) {
        PageRequest pageable = PageRequest.of(page - 1, limit, Sort.by(Sort.Direction.DESC, "createdAt"));

        // Use specification-style filtering via repository
        if (status != null && requestType != null && requesterId != null) {
            return tradeRequestRepository.findByStatusAndRequestTypeAndRequesterId(
                    status, requestType, requesterId, pageable);
        } else if (status != null && requestType != null) {
            return tradeRequestRepository.findByStatusAndRequestType(status, requestType, pageable);
        } else if (status != null && requesterId != null) {
            return tradeRequestRepository.findByStatusAndRequesterId(status, requesterId, pageable);
        } else if (requestType != null && requesterId != null) {
            return tradeRequestRepository.findByRequestTypeAndRequesterId(requestType, requesterId, pageable);
        } else if (status != null) {
            return tradeRequestRepository.findByStatus(status, pageable);
        } else if (requestType != null) {
            return tradeRequestRepository.findByRequestType(requestType, pageable);
        } else if (requesterId != null) {
            return tradeRequestRepository.findByRequesterId(requesterId, pageable);
        } else {
            return tradeRequestRepository.findAll(pageable);
        }
    }

    // ──────────────────────────────────────────────
    // Create operations
    // ──────────────────────────────────────────────

    /**
     * Create a buy request.
     */
    @Transactional
    public TradeRequest createBuyRequest(BuyRequestCreate dto, User requester) {
        TradeRequest request = new TradeRequest();
        request.setRequester(requester);
        request.setRequestType("buy");
        request.setTargetTicker(dto.getTargetTicker());
        request.setTickerName(dto.getTickerName());
        request.setTargetMarket(dto.getTargetMarket());
        request.setOrderType(dto.getOrderType());
        request.setOrderAmount(dto.getOrderAmount());
        request.setOrderQuantity(dto.getOrderQuantity());
        request.setBuyPrice(dto.getBuyPrice());
        request.setBuyOrders(null); // Legacy field - not used
        request.setTargetRatio(dto.getTargetRatio());
        request.setTakeProfitTargets(TargetConverter.convertTargets(dto.getTakeProfitTargets()));
        request.setStopLossTargets(TargetConverter.convertTargets(dto.getStopLossTargets()));
        request.setMemo(dto.getMemo());
        request.setStatus("pending");

        TradeRequest saved = tradeRequestRepository.save(request);
        log.info("Buy request created: id={}, ticker={}, by={}",
                saved.getId(), dto.getTargetTicker(), requester.getUsername());
        return saved;
    }

    /**
     * Create a sell request. Validates that the position exists and is open.
     */
    @Transactional
    public TradeRequest createSellRequest(SellRequestCreate dto, User requester) {
        Position position = positionService.getPositionById(dto.getPositionId());

        if (!"open".equals(position.getStatus())) {
            throw new BusinessException("Position is not open");
        }

        TradeRequest request = new TradeRequest();
        request.setRequester(requester);
        request.setPosition(position);
        request.setRequestType("sell");
        request.setTargetTicker(position.getTicker());
        request.setTargetMarket(position.getMarket());
        request.setSellQuantity(dto.getSellQuantity());
        request.setSellPrice(dto.getSellPrice());
        request.setSellReason(dto.getSellReason());
        request.setStatus("pending");

        TradeRequest saved = tradeRequestRepository.save(request);
        log.info("Sell request created: id={}, ticker={}, qty={}, by={}",
                saved.getId(), position.getTicker(), dto.getSellQuantity(), requester.getUsername());
        return saved;
    }

    // ──────────────────────────────────────────────
    // Approval / Rejection / Discussion
    // ──────────────────────────────────────────────

    /**
     * Approve a request. For buy requests, creates or adds to a position.
     * For sell requests, reduces or closes a position.
     *
     * @return a two-element array: [TradeRequest, Position (may be null for edge cases)]
     */
    @Transactional
    public Object[] approveRequest(Long requestId, RequestApprove approveData, User approver) {
        TradeRequest request = getRequestById(requestId);

        if (!"pending".equals(request.getStatus()) && !"discussion".equals(request.getStatus())) {
            throw new BusinessException(
                    "Request cannot be approved (current status: " + request.getStatus() + ")");
        }

        // Fall back to requester's desired price/quantity if manager didn't provide overrides
        BigDecimal executedPrice = approveData.getExecutedPrice() != null
                ? approveData.getExecutedPrice() : request.getBuyPrice();
        BigDecimal executedQuantity = approveData.getExecutedQuantity() != null
                ? approveData.getExecutedQuantity() : request.getOrderQuantity();

        // For buy requests, price and quantity are mandatory
        if ("buy".equals(request.getRequestType())) {
            if (executedPrice == null || executedQuantity == null) {
                throw new BusinessException("Buy price and quantity are required (매수 가격과 수량이 필요합니다)");
            }
        }

        // Update request status
        request.setStatus("approved");
        request.setApprover(approver);
        request.setApprovedAt(OffsetDateTime.now());
        request.setExecutedPrice(executedPrice);
        request.setExecutedQuantity(executedQuantity);
        request.setExecutedAt(approveData.getExecutedAt() != null
                ? approveData.getExecutedAt() : OffsetDateTime.now());

        Position position = null;

        if ("buy".equals(request.getRequestType())) {
            position = handleBuyApproval(request, executedPrice, executedQuantity);
        } else if ("sell".equals(request.getRequestType())) {
            position = handleSellApproval(request, approveData, approver);
        }

        TradeRequest saved = tradeRequestRepository.save(request);
        return new Object[]{saved, position};
    }

    /**
     * Reject a request.
     */
    @Transactional
    public TradeRequest rejectRequest(Long requestId, String rejectionReason, User rejector) {
        TradeRequest request = getRequestById(requestId);

        if (!"pending".equals(request.getStatus()) && !"discussion".equals(request.getStatus())) {
            throw new BusinessException(
                    "Request cannot be rejected (current status: " + request.getStatus() + ")");
        }

        request.setStatus("rejected");
        request.setApprover(rejector);
        request.setApprovedAt(OffsetDateTime.now());
        request.setRejectionReason(rejectionReason);

        TradeRequest saved = tradeRequestRepository.save(request);
        log.info("Request {} rejected by {}, reason: {}",
                requestId, rejector.getUsername(), rejectionReason);
        return saved;
    }

    /**
     * Update request status to "discussion".
     */
    @Transactional
    public TradeRequest startDiscussion(Long requestId) {
        TradeRequest request = getRequestById(requestId);

        if (!"pending".equals(request.getStatus())) {
            throw new BusinessException(
                    "Discussion cannot be started (current status: " + request.getStatus() + ")");
        }

        request.setStatus("discussion");
        TradeRequest saved = tradeRequestRepository.save(request);
        log.info("Request {} status changed to discussion", requestId);
        return saved;
    }

    // ──────────────────────────────────────────────
    // Private helpers
    // ──────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Position handleBuyApproval(
            TradeRequest request,
            BigDecimal executedPrice,
            BigDecimal executedQuantity
    ) {
        // Check for existing open position
        Position existingPosition = positionService.getOpenPositionByTicker(
                request.getTargetTicker(), request.getTargetMarket()).orElse(null);

        // Add completed flag to targets (all uncompleted)
        List<Map<String, Object>> tpTargets = addCompletedFlagToTargets(
                (List<Map<String, Object>>) request.getTakeProfitTargets(), false);
        List<Map<String, Object>> slTargets = addCompletedFlagToTargets(
                (List<Map<String, Object>>) request.getStopLossTargets(), false);

        // Create buy plan from request
        List<Map<String, Object>> buyPlan = createBuyPlan(request);

        Position position;
        if (existingPosition != null) {
            // Add to existing position
            position = positionService.addToPosition(
                    existingPosition, executedQuantity, executedPrice,
                    tpTargets, slTargets, buyPlan);
        } else {
            // Create new position
            position = positionService.createPositionFromRequest(
                    request.getTargetTicker(),
                    request.getTickerName(),
                    request.getTargetMarket(),
                    executedPrice,
                    executedQuantity,
                    buyPlan,
                    tpTargets,
                    slTargets,
                    request.getRequester().getId());
        }

        request.setPosition(position);
        return position;
    }

    private Position handleSellApproval(
            TradeRequest request,
            RequestApprove approveData,
            User approver
    ) {
        Position position = request.getPosition() != null
                ? positionService.getPositionById(request.getPosition().getId())
                : null;

        BigDecimal sellPrice = approveData.getExecutedPrice() != null
                ? approveData.getExecutedPrice() : request.getSellPrice();
        BigDecimal sellQuantity = approveData.getExecutedQuantity() != null
                ? approveData.getExecutedQuantity() : request.getSellQuantity();

        if (sellQuantity == null) {
            throw new BusinessException("Sell quantity is required (매도 수량이 필요합니다)");
        }

        if (position != null) {
            BigDecimal remainingQuantity = (position.getTotalQuantity() != null
                    ? position.getTotalQuantity() : BigDecimal.ZERO).subtract(sellQuantity);

            if (remainingQuantity.compareTo(BigDecimal.ZERO) <= 0) {
                // Close position completely
                BigDecimal totalSellAmount = sellPrice != null
                        ? sellPrice.multiply(sellQuantity)
                        : sellQuantity.multiply(
                        position.getAverageBuyPrice() != null
                                ? position.getAverageBuyPrice() : BigDecimal.ZERO);

                PositionClose closeData = new PositionClose();
                closeData.setTotalSellAmount(totalSellAmount);
                closeData.setAverageSellPrice(sellPrice);
                closeData.setClosedAt(approveData.getExecutedAt());
                position = positionService.closePosition(
                        position.getId(), closeData, approver);
            } else {
                // Reduce position
                position = positionService.reducePosition(position, sellQuantity);
            }
        }

        return position;
    }

    /**
     * Adds a "completed" flag to each target entry.
     */
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> addCompletedFlagToTargets(
            List<Map<String, Object>> targets,
            boolean allCompleted
    ) {
        if (targets == null || targets.isEmpty()) {
            return null;
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> t : targets) {
            Map<String, Object> copy = new LinkedHashMap<>(t);
            copy.put("completed", allCompleted);
            result.add(copy);
        }
        return result;
    }

    /**
     * Creates a buy plan from the request's buy orders or single buy info.
     * First entry is marked as completed.
     */
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> createBuyPlan(TradeRequest request) {
        List<Map<String, Object>> buyPlan = new ArrayList<>();

        // Split buy orders (분할 매수 계획)
        Object rawBuyOrders = request.getBuyOrders();
        if (rawBuyOrders instanceof List && !((List<?>) rawBuyOrders).isEmpty()) {
            List<Map<String, Object>> buyOrders = (List<Map<String, Object>>) rawBuyOrders;
            for (int i = 0; i < buyOrders.size(); i++) {
                Map<String, Object> order = buyOrders.get(i);
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("price", toDouble(order.get("price")));
                entry.put("ratio", toDouble(order.get("ratio")));
                entry.put("completed", i == 0); // First one completed
                buyPlan.add(entry);
            }
        }
        // Single buy
        else if (request.getBuyPrice() != null && request.getOrderQuantity() != null) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("price", request.getBuyPrice().doubleValue());
            entry.put("quantity", request.getOrderQuantity().doubleValue());
            entry.put("completed", true); // Single buy is completed
            buyPlan.add(entry);
        }

        return buyPlan.isEmpty() ? null : buyPlan;
    }

    private double toDouble(Object value) {
        if (value == null) return 0.0;
        if (value instanceof Number) return ((Number) value).doubleValue();
        try {
            return Double.parseDouble(value.toString());
        } catch (NumberFormatException e) {
            return 0.0;
        }
    }
}
