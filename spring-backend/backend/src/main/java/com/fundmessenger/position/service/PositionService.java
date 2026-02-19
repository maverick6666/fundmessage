package com.fundmessenger.position.service;

import com.fundmessenger.audit.service.AuditService;
import com.fundmessenger.common.exception.BusinessException;
import com.fundmessenger.common.exception.NotFoundException;
import com.fundmessenger.common.util.TargetConverter;
import com.fundmessenger.position.dto.*;
import com.fundmessenger.position.entity.Position;
import com.fundmessenger.position.repository.PositionRepository;
import com.fundmessenger.user.entity.User;
import com.fundmessenger.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class PositionService {

    private final PositionRepository positionRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;

    // ========================
    // Read operations
    // ========================

    @Transactional(readOnly = true)
    public Position getPositionById(Long positionId) {
        return positionRepository.findById(positionId)
                .orElseThrow(() -> new NotFoundException("Position", positionId));
    }

    @Transactional(readOnly = true)
    public Optional<Position> getOpenPositionByTicker(String ticker, String market) {
        return positionRepository.findFirstByTickerAndMarketAndStatus(ticker, market, "open");
    }

    @Transactional(readOnly = true)
    public PositionListResult getPositions(String status, String ticker, Long openedBy, int page, int limit) {
        PageRequest pageRequest = PageRequest.of(page - 1, limit, Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<Position> positionPage;

        if (status != null && ticker != null && openedBy != null) {
            positionPage = positionRepository.findByStatusAndTickerAndOpenerId(status, ticker, openedBy, pageRequest);
        } else if (status != null && ticker != null) {
            positionPage = positionRepository.findByStatusAndTicker(status, ticker, pageRequest);
        } else if (status != null && openedBy != null) {
            positionPage = positionRepository.findByStatusAndOpenerId(status, openedBy, pageRequest);
        } else if (ticker != null && openedBy != null) {
            positionPage = positionRepository.findByTickerAndOpenerId(ticker, openedBy, pageRequest);
        } else if (status != null) {
            positionPage = positionRepository.findByStatus(status, pageRequest);
        } else if (ticker != null) {
            positionPage = positionRepository.findByTicker(ticker, pageRequest);
        } else if (openedBy != null) {
            positionPage = positionRepository.findByOpenerId(openedBy, pageRequest);
        } else {
            positionPage = positionRepository.findAll(pageRequest);
        }

        return new PositionListResult(positionPage.getContent(), positionPage.getTotalElements());
    }

    // ========================
    // Write operations
    // ========================

    /**
     * Create a new position directly (with info already confirmed).
     */
    @Transactional
    public Position createPosition(
            String ticker,
            String tickerName,
            String market,
            BigDecimal averageBuyPrice,
            BigDecimal totalQuantity,
            BigDecimal totalBuyAmount,
            List<Map<String, Object>> takeProfitTargets,
            List<Map<String, Object>> stopLossTargets,
            User openedByUser
    ) {
        getOpenPositionByTicker(ticker, market).ifPresent(existing -> {
            throw new BusinessException(HttpStatus.CONFLICT,
                    "Open position for " + ticker + " already exists");
        });

        Position position = new Position();
        position.setTicker(ticker);
        position.setTickerName(tickerName);
        position.setMarket(market);
        position.setStatus("open");
        position.setAverageBuyPrice(averageBuyPrice);
        position.setTotalQuantity(totalQuantity);
        position.setTotalBuyAmount(totalBuyAmount);
        position.setTakeProfitTargets(TargetConverter.convertTargets(takeProfitTargets));
        position.setStopLossTargets(TargetConverter.convertTargets(stopLossTargets));
        position.setOpenedAt(OffsetDateTime.now());
        position.setOpener(openedByUser);

        Position saved = positionRepository.save(position);
        log.info("Position created: {} ({}) id={}", ticker, market, saved.getId());
        return saved;
    }

    /**
     * Create a new position from an approved buy request.
     * The position is created with is_info_confirmed = false (pending manager confirmation).
     */
    @Transactional
    public Position createPositionFromRequest(
            String ticker,
            String tickerName,
            String market,
            BigDecimal buyPrice,
            BigDecimal quantity,
            List<Map<String, Object>> buyPlan,
            List<Map<String, Object>> takeProfitTargets,
            List<Map<String, Object>> stopLossTargets,
            Long openedById
    ) {
        getOpenPositionByTicker(ticker, market).ifPresent(existing -> {
            throw new BusinessException(HttpStatus.CONFLICT,
                    "Open position for " + ticker + " already exists");
        });

        User opener = userRepository.findById(openedById)
                .orElseThrow(() -> new NotFoundException("User", openedById));

        Position position = new Position();
        position.setTicker(ticker);
        position.setTickerName(tickerName);
        position.setMarket(market);
        position.setStatus("open");
        position.setIsInfoConfirmed(false);
        position.setAverageBuyPrice(buyPrice);
        position.setTotalQuantity(quantity);
        position.setTotalBuyAmount(buyPrice.multiply(quantity));
        position.setBuyPlan(buyPlan);
        position.setTakeProfitTargets(takeProfitTargets);
        position.setStopLossTargets(stopLossTargets);
        position.setOpenedAt(OffsetDateTime.now());
        position.setOpener(opener);

        Position saved = positionRepository.save(position);
        log.info("Position created from request: {} ({}) id={}", ticker, market, saved.getId());
        return saved;
    }

    /**
     * Add to an existing open position (additional buy).
     * Recalculates average price and total amounts.
     */
    @Transactional
    @SuppressWarnings("unchecked")
    public Position addToPosition(
            Position position,
            BigDecimal additionalQuantity,
            BigDecimal additionalPrice,
            List<Map<String, Object>> takeProfitTargets,
            List<Map<String, Object>> stopLossTargets,
            List<Map<String, Object>> buyPlan
    ) {
        BigDecimal oldTotal = position.getTotalBuyAmount() != null
                ? position.getTotalBuyAmount() : BigDecimal.ZERO;
        BigDecimal additionalAmount = additionalQuantity.multiply(additionalPrice);
        BigDecimal newTotalAmount = oldTotal.add(additionalAmount);
        BigDecimal newTotalQuantity = (position.getTotalQuantity() != null
                ? position.getTotalQuantity() : BigDecimal.ZERO).add(additionalQuantity);

        position.setAverageBuyPrice(newTotalAmount.divide(newTotalQuantity, 4, RoundingMode.HALF_UP));
        position.setTotalQuantity(newTotalQuantity);
        position.setTotalBuyAmount(newTotalAmount);
        position.setIsInfoConfirmed(false);

        // Merge buy plan (existing + new)
        if (buyPlan != null && !buyPlan.isEmpty()) {
            List<Map<String, Object>> existingPlan = position.getBuyPlan() != null
                    ? new ArrayList<>((List<Map<String, Object>>) position.getBuyPlan())
                    : new ArrayList<>();
            existingPlan.addAll(buyPlan);
            position.setBuyPlan(existingPlan);
        }

        // Merge take-profit targets
        if (takeProfitTargets != null && !takeProfitTargets.isEmpty()) {
            List<Map<String, Object>> existingTp = position.getTakeProfitTargets() != null
                    ? new ArrayList<>((List<Map<String, Object>>) position.getTakeProfitTargets())
                    : new ArrayList<>();
            existingTp.addAll(takeProfitTargets);
            position.setTakeProfitTargets(existingTp);
        }

        // Merge stop-loss targets
        if (stopLossTargets != null && !stopLossTargets.isEmpty()) {
            List<Map<String, Object>> existingSl = position.getStopLossTargets() != null
                    ? new ArrayList<>((List<Map<String, Object>>) position.getStopLossTargets())
                    : new ArrayList<>();
            existingSl.addAll(stopLossTargets);
            position.setStopLossTargets(existingSl);
        }

        Position saved = positionRepository.save(position);
        log.info("Position {} updated with additional buy: qty={}, price={}",
                position.getId(), additionalQuantity, additionalPrice);
        return saved;
    }

    /**
     * Update position fields (partial update).
     */
    @Transactional
    public Position updatePosition(Long positionId, PositionUpdate updateData) {
        Position position = getPositionById(positionId);

        if (updateData.getTickerName() != null) {
            position.setTickerName(updateData.getTickerName());
        }
        if (updateData.getAverageBuyPrice() != null) {
            position.setAverageBuyPrice(updateData.getAverageBuyPrice());
        }
        if (updateData.getTotalQuantity() != null) {
            position.setTotalQuantity(updateData.getTotalQuantity());
        }
        if (updateData.getTotalBuyAmount() != null) {
            position.setTotalBuyAmount(updateData.getTotalBuyAmount());
        }
        if (updateData.getTakeProfitTargets() != null) {
            position.setTakeProfitTargets(TargetConverter.convertTargets(updateData.getTakeProfitTargets()));
        }
        if (updateData.getStopLossTargets() != null) {
            position.setStopLossTargets(TargetConverter.convertTargets(updateData.getStopLossTargets()));
        }

        return positionRepository.save(position);
    }

    /**
     * Close a position with actual sell amounts. Calculates profit/loss and holding period.
     */
    @Transactional
    public Position closePosition(Long positionId, PositionClose closeData, User closedByUser) {
        Position position = getPositionById(positionId);

        if ("closed".equals(position.getStatus())) {
            throw new BusinessException(HttpStatus.CONFLICT, "이미 종료된 포지션입니다");
        }

        position.setStatus("closed");
        position.setTotalSellAmount(closeData.getTotalSellAmount());
        position.setClosedAt(closeData.getClosedAt() != null ? closeData.getClosedAt() : OffsetDateTime.now());
        position.setCloser(closedByUser);

        // Calculate average sell price
        if (closeData.getAverageSellPrice() != null) {
            position.setAverageSellPrice(closeData.getAverageSellPrice());
        } else if (position.getTotalQuantity() != null
                && position.getTotalQuantity().compareTo(BigDecimal.ZERO) > 0) {
            position.setAverageSellPrice(
                    closeData.getTotalSellAmount().divide(position.getTotalQuantity(), 4, RoundingMode.HALF_UP));
        }

        // Calculate P&L
        BigDecimal buyAmount = position.getTotalBuyAmount() != null
                ? position.getTotalBuyAmount() : BigDecimal.ZERO;
        position.setProfitLoss(closeData.getTotalSellAmount().subtract(buyAmount));

        if (buyAmount.compareTo(BigDecimal.ZERO) > 0) {
            position.setProfitRate(
                    position.getProfitLoss().divide(buyAmount, 4, RoundingMode.HALF_UP));
        }

        // Calculate holding period
        if (position.getOpenedAt() != null) {
            Duration duration = Duration.between(position.getOpenedAt(), position.getClosedAt());
            position.setHoldingPeriodHours((int) duration.toHours());
        }

        Position saved = positionRepository.save(position);
        log.info("Position {} closed, P&L={}, rate={}", positionId, saved.getProfitLoss(), saved.getProfitRate());
        return saved;
    }

    /**
     * Reduce a position's quantity (partial sell).
     */
    @Transactional
    public Position reducePosition(Position position, BigDecimal sellQuantity) {
        BigDecimal currentQty = position.getTotalQuantity() != null
                ? position.getTotalQuantity() : BigDecimal.ZERO;

        if (sellQuantity.compareTo(currentQty) > 0) {
            throw new BusinessException("Sell quantity exceeds position quantity");
        }

        position.setTotalQuantity(currentQty.subtract(sellQuantity));

        if (position.getAverageBuyPrice() != null) {
            position.setTotalBuyAmount(
                    position.getTotalQuantity().multiply(position.getAverageBuyPrice()));
        }

        Position saved = positionRepository.save(position);
        log.info("Position {} reduced by {}, remaining={}",
                position.getId(), sellQuantity, saved.getTotalQuantity());
        return saved;
    }

    /**
     * Toggle a plan item's completed state.
     * - Buy check: increases quantity and recalculates average price
     * - Take profit / stop loss check: decreases quantity and calculates realized PnL
     * - Unchecking completed items is not allowed
     */
    @Transactional
    @SuppressWarnings("unchecked")
    public Position togglePlanItem(Long positionId, String planType, int index, boolean completed, Long userId) {
        Position position = getPositionById(positionId);

        if ("closed".equals(position.getStatus())) {
            throw new BusinessException("종료된 포지션은 수정할 수 없습니다");
        }

        String fieldName = null;
        Object oldValue = null;
        Object newValue = null;
        Map<String, Map<String, Object>> changes = new LinkedHashMap<>();

        if ("buy".equals(planType)) {
            List<Map<String, Object>> buyPlan = (List<Map<String, Object>>) position.getBuyPlan();

            if (buyPlan != null && index < buyPlan.size()) {
                Map<String, Object> item = buyPlan.get(index);
                boolean oldCompleted = Boolean.TRUE.equals(item.get("completed"));

                if (oldCompleted == completed) {
                    return position;
                }

                // Buy check: increase quantity, recalculate average price
                if (completed && !oldCompleted) {
                    BigDecimal buyPrice = toBigDecimal(item.get("price"));
                    BigDecimal buyQuantity = toBigDecimal(item.get("quantity"));

                    if (buyPrice.compareTo(BigDecimal.ZERO) > 0 && buyQuantity.compareTo(BigDecimal.ZERO) > 0) {
                        BigDecimal oldQty = position.getTotalQuantity() != null ? position.getTotalQuantity() : BigDecimal.ZERO;
                        BigDecimal oldAmount = position.getTotalBuyAmount() != null ? position.getTotalBuyAmount() : BigDecimal.ZERO;
                        BigDecimal additionalAmount = buyPrice.multiply(buyQuantity);

                        position.setTotalQuantity(oldQty.add(buyQuantity));
                        position.setTotalBuyAmount(oldAmount.add(additionalAmount));

                        if (position.getTotalQuantity().compareTo(BigDecimal.ZERO) > 0) {
                            position.setAverageBuyPrice(
                                    position.getTotalBuyAmount().divide(position.getTotalQuantity(), 4, RoundingMode.HALF_UP));
                        }

                        Map<String, Object> qtyChange = new LinkedHashMap<>();
                        qtyChange.put("old", oldQty.doubleValue());
                        qtyChange.put("new", position.getTotalQuantity().doubleValue());
                        changes.put("total_quantity", qtyChange);

                        Map<String, Object> priceChange = new LinkedHashMap<>();
                        priceChange.put("old", position.getAverageBuyPrice() != null ? position.getAverageBuyPrice().doubleValue() : 0);
                        priceChange.put("new", position.getAverageBuyPrice().doubleValue());
                        changes.put("average_buy_price", priceChange);
                    }
                }
                // Unchecking a completed buy is not allowed
                else if (!completed && oldCompleted) {
                    throw new BusinessException("체결된 매수는 취소할 수 없습니다. 매도 계획을 사용하세요.");
                }

                item.put("completed", completed);
                oldValue = oldCompleted;
                newValue = completed;
                fieldName = "buy_plan[" + index + "].completed";
                position.setBuyPlan(buyPlan); // Trigger JPA dirty check
            }

        } else if ("take_profit".equals(planType) || "stop_loss".equals(planType)) {
            boolean isTakeProfit = "take_profit".equals(planType);
            String targetName = isTakeProfit ? "take_profit_targets" : "stop_loss_targets";
            String label = isTakeProfit ? "익절" : "손절";

            List<Map<String, Object>> targets = isTakeProfit
                    ? (List<Map<String, Object>>) position.getTakeProfitTargets()
                    : (List<Map<String, Object>>) position.getStopLossTargets();

            if (targets != null && index < targets.size()) {
                Map<String, Object> item = targets.get(index);
                boolean oldCompleted = Boolean.TRUE.equals(item.get("completed"));

                if (oldCompleted == completed) {
                    return position;
                }

                // Take profit / stop loss check: decrease quantity, calculate realized PnL
                if (completed && !oldCompleted) {
                    BigDecimal sellPrice = toBigDecimal(item.get("price"));
                    BigDecimal sellQuantity = toBigDecimal(item.get("quantity"));

                    if (sellPrice.compareTo(BigDecimal.ZERO) > 0 && sellQuantity.compareTo(BigDecimal.ZERO) > 0) {
                        BigDecimal currentQty = position.getTotalQuantity() != null ? position.getTotalQuantity() : BigDecimal.ZERO;

                        if (sellQuantity.compareTo(currentQty) > 0) {
                            throw new BusinessException(
                                    label + " 수량(" + sellQuantity + ")이 보유 수량(" + currentQty + ")보다 많습니다");
                        }

                        BigDecimal avgBuy = position.getAverageBuyPrice() != null ? position.getAverageBuyPrice() : BigDecimal.ZERO;
                        BigDecimal realizedPnl = sellPrice.subtract(avgBuy).multiply(sellQuantity);

                        double oldQtyVal = currentQty.doubleValue();
                        double oldRealized = position.getRealizedProfitLoss() != null
                                ? position.getRealizedProfitLoss().doubleValue() : 0;

                        position.setTotalQuantity(currentQty.subtract(sellQuantity));
                        position.setTotalBuyAmount(position.getTotalQuantity().multiply(avgBuy));
                        position.setRealizedProfitLoss(
                                (position.getRealizedProfitLoss() != null ? position.getRealizedProfitLoss() : BigDecimal.ZERO)
                                        .add(realizedPnl));

                        Map<String, Object> qtyChange = new LinkedHashMap<>();
                        qtyChange.put("old", oldQtyVal);
                        qtyChange.put("new", position.getTotalQuantity().doubleValue());
                        changes.put("total_quantity", qtyChange);

                        Map<String, Object> realizedChange = new LinkedHashMap<>();
                        realizedChange.put("old", oldRealized);
                        realizedChange.put("new", position.getRealizedProfitLoss().doubleValue());
                        changes.put("realized_profit_loss", realizedChange);
                    }
                }
                // Unchecking a completed sell is not allowed
                else if (!completed && oldCompleted) {
                    throw new BusinessException("체결된 " + label + "은 취소할 수 없습니다");
                }

                item.put("completed", completed);
                oldValue = oldCompleted;
                newValue = completed;
                fieldName = targetName + "[" + index + "].completed";

                if (isTakeProfit) {
                    position.setTakeProfitTargets(targets);
                } else {
                    position.setStopLossTargets(targets);
                }
            }
        }

        position = positionRepository.save(position);

        // Audit log
        if (userId != null && fieldName != null) {
            if (!changes.isEmpty()) {
                auditService.logMultipleChanges("position", positionId.intValue(), userId, changes);
            } else {
                auditService.logChange("position", positionId.intValue(), "toggle", userId,
                        fieldName, oldValue, newValue, null);
            }
        }

        return position;
    }

    /**
     * Update trading plans (buy plan, take profit targets, stop loss targets).
     * Compares old and new plans and optionally logs changes.
     */
    @Transactional
    @SuppressWarnings("unchecked")
    public Position updatePlans(
            Long positionId,
            List<Map<String, Object>> buyPlan,
            List<Map<String, Object>> takeProfitTargets,
            List<Map<String, Object>> stopLossTargets,
            Long userId,
            boolean skipAudit
    ) {
        Position position = getPositionById(positionId);

        List<String> changeDescriptions = new ArrayList<>();

        if (buyPlan != null) {
            List<Map<String, Object>> oldPlan = (List<Map<String, Object>>) position.getBuyPlan();
            changeDescriptions.addAll(comparePlans(oldPlan, buyPlan, "매수계획"));
            position.setBuyPlan(TargetConverter.convertTargets(buyPlan));
        }

        if (takeProfitTargets != null) {
            List<Map<String, Object>> oldTargets = (List<Map<String, Object>>) position.getTakeProfitTargets();
            changeDescriptions.addAll(comparePlans(oldTargets, takeProfitTargets, "익절계획"));
            position.setTakeProfitTargets(TargetConverter.convertTargets(takeProfitTargets));
        }

        if (stopLossTargets != null) {
            List<Map<String, Object>> oldTargets = (List<Map<String, Object>>) position.getStopLossTargets();
            changeDescriptions.addAll(comparePlans(oldTargets, stopLossTargets, "손절계획"));
            position.setStopLossTargets(TargetConverter.convertTargets(stopLossTargets));
        }

        position = positionRepository.save(position);

        // Audit log (skip by default for individual edits; log once when saving trading plan)
        if (!skipAudit && userId != null && !changeDescriptions.isEmpty()) {
            auditService.logChange("position", positionId.intValue(),
                    String.join(", ", changeDescriptions), userId);
        }

        return position;
    }

    /**
     * Convenience overload defaulting skipAudit to true.
     */
    @Transactional
    public Position updatePlans(
            Long positionId,
            List<Map<String, Object>> buyPlan,
            List<Map<String, Object>> takeProfitTargets,
            List<Map<String, Object>> stopLossTargets,
            Long userId
    ) {
        return updatePlans(positionId, buyPlan, takeProfitTargets, stopLossTargets, userId, true);
    }

    /**
     * Manager confirms position info (update actual execution details).
     * Can also be used on closed positions for record-keeping purposes.
     */
    @Transactional
    public Position confirmPositionInfo(Long positionId, PositionConfirmInfo confirmData, Long userId) {
        Position position = getPositionById(positionId);

        Map<String, Map<String, Object>> changes = new LinkedHashMap<>();

        if (position.getAverageBuyPrice() == null
                || position.getAverageBuyPrice().compareTo(confirmData.getAverageBuyPrice()) != 0) {
            Map<String, Object> change = new LinkedHashMap<>();
            change.put("old", position.getAverageBuyPrice());
            change.put("new", confirmData.getAverageBuyPrice());
            changes.put("average_buy_price", change);
        }

        if (position.getTotalQuantity() == null
                || position.getTotalQuantity().compareTo(confirmData.getTotalQuantity()) != 0) {
            Map<String, Object> change = new LinkedHashMap<>();
            change.put("old", position.getTotalQuantity());
            change.put("new", confirmData.getTotalQuantity());
            changes.put("total_quantity", change);
        }

        if (confirmData.getTickerName() != null
                && !confirmData.getTickerName().equals(position.getTickerName())) {
            Map<String, Object> change = new LinkedHashMap<>();
            change.put("old", position.getTickerName());
            change.put("new", confirmData.getTickerName());
            changes.put("ticker_name", change);
        }

        // Update fields
        position.setAverageBuyPrice(confirmData.getAverageBuyPrice());
        position.setTotalQuantity(confirmData.getTotalQuantity());

        // Calculate buy amount
        BigDecimal newBuyAmount = confirmData.getTotalBuyAmount() != null
                ? confirmData.getTotalBuyAmount()
                : confirmData.getAverageBuyPrice().multiply(confirmData.getTotalQuantity());

        if (position.getTotalBuyAmount() == null
                || position.getTotalBuyAmount().compareTo(newBuyAmount) != 0) {
            Map<String, Object> change = new LinkedHashMap<>();
            change.put("old", position.getTotalBuyAmount());
            change.put("new", newBuyAmount);
            changes.put("total_buy_amount", change);
        }
        position.setTotalBuyAmount(newBuyAmount);

        // Update ticker name
        if (confirmData.getTickerName() != null) {
            position.setTickerName(confirmData.getTickerName());
        }

        // Mark as confirmed
        if (!Boolean.TRUE.equals(position.getIsInfoConfirmed())) {
            Map<String, Object> change = new LinkedHashMap<>();
            change.put("old", false);
            change.put("new", true);
            changes.put("is_info_confirmed", change);
        }
        position.setIsInfoConfirmed(true);

        position = positionRepository.save(position);

        // Audit log
        if (userId != null && !changes.isEmpty()) {
            auditService.logMultipleChanges("position", positionId.intValue(), userId, changes);
        }

        return position;
    }

    /**
     * Delete a position (typically only for cleanup by manager/admin).
     */
    @Transactional
    public void deletePosition(Long positionId) {
        Position position = getPositionById(positionId);
        positionRepository.delete(position);
        log.info("Position {} deleted", positionId);
    }

    // ========================
    // Status info computation
    // ========================

    /**
     * Computes the status info for a position (alerts for manager attention).
     */
    public PositionStatusInfo getPositionStatusInfo(Position position) {
        if ("closed".equals(position.getStatus())) {
            return PositionStatusInfo.builder()
                    .status("closed")
                    .alert(null)
                    .build();
        }

        double currentQty = position.getTotalQuantity() != null ? position.getTotalQuantity().doubleValue() : 0;

        int pendingTp = countPendingItems(asListOfMaps(position.getTakeProfitTargets()));
        int pendingSl = countPendingItems(asListOfMaps(position.getStopLossTargets()));
        int completedTp = countCompletedItems(asListOfMaps(position.getTakeProfitTargets()));
        int completedSl = countCompletedItems(asListOfMaps(position.getStopLossTargets()));

        // Case 1: Quantity is 0 but position is still open -> needs close
        if (currentQty <= 0) {
            return PositionStatusInfo.builder()
                    .status("needs_close")
                    .alert("danger")
                    .message("잔량 0 - 포지션 종료 필요")
                    .build();
        }

        // Case 2: Has quantity but all sell plans completed -> needs new plan
        if (pendingTp == 0 && pendingSl == 0 && (completedTp > 0 || completedSl > 0)) {
            return PositionStatusInfo.builder()
                    .status("no_plan")
                    .alert("warning")
                    .message("매도 계획 없음")
                    .build();
        }

        // Case 3: Has quantity but no sell plans at all -> needs plan
        int totalValidTp = countValidItems(asListOfMaps(position.getTakeProfitTargets()));
        int totalValidSl = countValidItems(asListOfMaps(position.getStopLossTargets()));
        if (totalValidTp == 0 && totalValidSl == 0) {
            return PositionStatusInfo.builder()
                    .status("no_plan")
                    .alert("warning")
                    .message("매도 계획 없음")
                    .build();
        }

        // Normal
        return PositionStatusInfo.builder()
                .status("normal")
                .alert(null)
                .build();
    }

    // ========================
    // Remaining count helpers (public for controller mapping)
    // ========================

    public int countRemainingItems(Object items) {
        return countPendingItems(asListOfMaps(items));
    }

    // ========================
    // Private helpers
    // ========================

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> asListOfMaps(Object obj) {
        if (obj instanceof List) {
            return (List<Map<String, Object>>) obj;
        }
        return Collections.emptyList();
    }

    private int countValidItems(List<Map<String, Object>> items) {
        if (items == null || items.isEmpty()) return 0;
        return (int) items.stream()
                .filter(i -> hasValue(i.get("price")) && hasValue(i.get("quantity")))
                .count();
    }

    private int countCompletedItems(List<Map<String, Object>> items) {
        if (items == null || items.isEmpty()) return 0;
        return (int) items.stream()
                .filter(i -> hasValue(i.get("price")) && hasValue(i.get("quantity"))
                        && Boolean.TRUE.equals(i.get("completed")))
                .count();
    }

    private int countPendingItems(List<Map<String, Object>> items) {
        if (items == null || items.isEmpty()) return 0;
        return (int) items.stream()
                .filter(i -> hasValue(i.get("price")) && hasValue(i.get("quantity"))
                        && !Boolean.TRUE.equals(i.get("completed")))
                .count();
    }

    private boolean hasValue(Object value) {
        if (value == null) return false;
        if (value instanceof Number) return ((Number) value).doubleValue() != 0.0;
        if (value instanceof String) {
            try {
                return Double.parseDouble((String) value) != 0.0;
            } catch (NumberFormatException e) {
                return false;
            }
        }
        return false;
    }

    private BigDecimal toBigDecimal(Object value) {
        if (value == null) return BigDecimal.ZERO;
        if (value instanceof BigDecimal) return (BigDecimal) value;
        if (value instanceof Number) return BigDecimal.valueOf(((Number) value).doubleValue());
        if (value instanceof String) {
            try {
                return new BigDecimal((String) value);
            } catch (NumberFormatException e) {
                return BigDecimal.ZERO;
            }
        }
        return BigDecimal.ZERO;
    }

    private Map<String, Object> normalizePlanItem(Map<String, Object> item) {
        Map<String, Object> normalized = new LinkedHashMap<>();
        normalized.put("price", toDouble(item.get("price")));
        normalized.put("quantity", toDouble(item.get("quantity")));
        normalized.put("completed", Boolean.TRUE.equals(item.get("completed")));
        return normalized;
    }

    private boolean isValidPlanItem(Map<String, Object> item) {
        return hasValue(item.get("price")) && hasValue(item.get("quantity"));
    }

    private double toDouble(Object value) {
        if (value == null) return 0.0;
        if (value instanceof Number) return ((Number) value).doubleValue();
        try {
            return Double.parseDouble(String.valueOf(value));
        } catch (NumberFormatException e) {
            return 0.0;
        }
    }

    private List<String> comparePlans(List<Map<String, Object>> oldList, List<Map<String, Object>> newList, String planName) {
        List<String> changeDescs = new ArrayList<>();
        List<Map<String, Object>> safeOld = oldList != null ? oldList : Collections.emptyList();
        List<Map<String, Object>> safeNew = newList != null ? newList : Collections.emptyList();

        List<Map<String, Object>> oldValid = safeOld.stream()
                .filter(this::isValidPlanItem)
                .map(this::normalizePlanItem)
                .toList();
        List<Map<String, Object>> newValid = safeNew.stream()
                .filter(this::isValidPlanItem)
                .map(this::normalizePlanItem)
                .toList();

        // Added items
        if (newValid.size() > oldValid.size()) {
            List<Map<String, Object>> added = newValid.subList(oldValid.size(), newValid.size());
            for (Map<String, Object> item : added) {
                changeDescs.add(String.format("%s 추가: %,.0f x %.2g",
                        planName, (double) item.get("price"), (double) item.get("quantity")));
            }
        }
        // Removed items
        else if (newValid.size() < oldValid.size()) {
            List<Map<String, Object>> removed = oldValid.subList(newValid.size(), oldValid.size());
            for (Map<String, Object> item : removed) {
                changeDescs.add(String.format("%s 삭제: %,.0f x %.2g",
                        planName, (double) item.get("price"), (double) item.get("quantity")));
            }
        }

        // Modified items
        int minSize = Math.min(oldValid.size(), newValid.size());
        for (int i = 0; i < minSize; i++) {
            Map<String, Object> oldItem = oldValid.get(i);
            Map<String, Object> newItem = newValid.get(i);

            double oldPrice = (double) oldItem.get("price");
            double newPrice = (double) newItem.get("price");
            double oldQty = (double) oldItem.get("quantity");
            double newQty = (double) newItem.get("quantity");

            if (oldPrice != newPrice || oldQty != newQty) {
                changeDescs.add(String.format("%s %d번 수정: %,.0f x %.2g -> %,.0f x %.2g",
                        planName, i + 1, oldPrice, oldQty, newPrice, newQty));
            }
        }

        return changeDescs;
    }

    // ========================
    // Inner class for list result
    // ========================

    public record PositionListResult(List<Position> positions, long total) {
    }
}
