package com.fundmessenger.trading.service;

import com.fundmessenger.audit.service.AuditService;
import com.fundmessenger.common.exception.BusinessException;
import com.fundmessenger.common.exception.ForbiddenException;
import com.fundmessenger.common.exception.NotFoundException;
import com.fundmessenger.position.entity.Position;
import com.fundmessenger.position.repository.PositionRepository;
import com.fundmessenger.trading.dto.ExecutionCreate;
import com.fundmessenger.trading.dto.TradingPlanCreate;
import com.fundmessenger.trading.entity.TradingPlan;
import com.fundmessenger.trading.repository.TradingPlanRepository;
import com.fundmessenger.user.entity.User;
import com.fundmessenger.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class TradingPlanService {

    private final TradingPlanRepository tradingPlanRepository;
    private final PositionRepository positionRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;

    /**
     * List all trading plans for a position, ordered by created_at desc.
     */
    @Transactional(readOnly = true)
    public List<TradingPlan> getPositionPlans(Long positionId) {
        positionRepository.findById(positionId)
                .orElseThrow(() -> new NotFoundException("Position", positionId));

        return tradingPlanRepository.findByPositionIdOrderByCreatedAtDesc(positionId);
    }

    /**
     * Get a single trading plan by ID.
     */
    @Transactional(readOnly = true)
    public TradingPlan getPlan(Long positionId, Long planId) {
        TradingPlan plan = tradingPlanRepository.findById(planId)
                .orElseThrow(() -> new NotFoundException("TradingPlan", planId));

        if (!plan.getPosition().getId().equals(positionId)) {
            throw new NotFoundException("TradingPlan", planId);
        }

        return plan;
    }

    /**
     * Create a new trading plan (plan_saved record).
     * Auto-increments version based on existing plans for this position.
     */
    @Transactional
    public TradingPlan createPlan(Long positionId, TradingPlanCreate data, Long userId) {
        Position position = positionRepository.findById(positionId)
                .orElseThrow(() -> new NotFoundException("Position", positionId));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User", userId));

        // Calculate next version
        List<TradingPlan> existingPlans = tradingPlanRepository.findByPositionIdOrderByVersionDesc(positionId);
        int nextVersion = existingPlans.isEmpty() ? 1 : existingPlans.get(0).getVersion() + 1;

        TradingPlan plan = new TradingPlan();
        plan.setPosition(position);
        plan.setUser(user);
        plan.setVersion(nextVersion);
        plan.setRecordType("plan_saved");
        plan.setBuyPlan(data.getBuyPlan());
        plan.setTakeProfitTargets(data.getTakeProfitTargets());
        plan.setStopLossTargets(data.getStopLossTargets());
        plan.setMemo(data.getMemo());
        plan.setChanges(data.getChanges());
        plan.setStatus("submitted");

        TradingPlan saved = tradingPlanRepository.save(plan);

        // Build human-readable audit description
        List<String> descriptions = new ArrayList<>();
        if (data.getBuyPlan() != null) {
            descriptions.add("Buy plan with " + data.getBuyPlan().size() + " entries");
        }
        if (data.getTakeProfitTargets() != null) {
            descriptions.add("Take-profit targets: " + data.getTakeProfitTargets().size());
        }
        if (data.getStopLossTargets() != null) {
            descriptions.add("Stop-loss targets: " + data.getStopLossTargets().size());
        }

        Map<String, Object> auditChanges = new LinkedHashMap<>();
        auditChanges.put("description", String.join(", ", descriptions));
        auditChanges.put("version", nextVersion);

        auditService.logChange(
                "trading_plan",
                saved.getId().intValue(),
                "create",
                userId,
                "plan_saved",
                null,
                String.join(", ", descriptions),
                auditChanges
        );

        log.info("Trading plan {} (v{}) created for position {} by user {}",
                saved.getId(), nextVersion, positionId, userId);

        return saved;
    }

    /**
     * Submit a draft plan (set status to 'submitted').
     */
    @Transactional
    public TradingPlan submitPlan(Long positionId, Long planId, Long userId) {
        TradingPlan plan = getPlan(positionId, planId);

        plan.setStatus("submitted");
        plan.setSubmittedAt(OffsetDateTime.now());

        TradingPlan saved = tradingPlanRepository.save(plan);

        auditService.logChange(
                "trading_plan",
                saved.getId().intValue(),
                "submit",
                userId,
                "status",
                "draft",
                "submitted",
                null
        );

        log.info("Trading plan {} submitted for position {}", planId, positionId);

        return saved;
    }

    /**
     * Delete a trading plan. Only draft plans can be deleted, and only by the author or a manager.
     */
    @Transactional
    public void deletePlan(Long positionId, Long planId, Long userId, boolean isManager) {
        TradingPlan plan = getPlan(positionId, planId);

        // Only draft plans can be deleted
        if (!"draft".equals(plan.getStatus())) {
            throw new BusinessException("Only draft plans can be deleted");
        }

        // Only author or manager can delete
        if (!plan.getUser().getId().equals(userId) && !isManager) {
            throw new ForbiddenException("Only the author or a manager can delete this plan");
        }

        auditService.logChange(
                "trading_plan",
                planId.intValue(),
                "delete",
                userId,
                null, null, null, null
        );

        tradingPlanRepository.delete(plan);

        log.info("Trading plan {} deleted by user {}", planId, userId);
    }

    /**
     * Create an execution record for a position.
     * Updates the position's plan items (marks completed), recalculates average price/quantity,
     * and accumulates realized_profit_loss for sell executions.
     */
    @Transactional
    @SuppressWarnings("unchecked")
    public TradingPlan createExecution(Long positionId, ExecutionCreate data, Long userId) {
        Position position = positionRepository.findById(positionId)
                .orElseThrow(() -> new NotFoundException("Position", positionId));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User", userId));

        // Calculate next version
        List<TradingPlan> existingPlans = tradingPlanRepository.findByPositionIdOrderByVersionDesc(positionId);
        int nextVersion = existingPlans.isEmpty() ? 1 : existingPlans.get(0).getVersion() + 1;

        // Calculate executed amount
        BigDecimal executedAmount = null;
        if (data.getExecutedPrice() != null && data.getExecutedQuantity() != null) {
            executedAmount = data.getExecutedPrice().multiply(data.getExecutedQuantity());
        }

        // Calculate profit/loss for sell-type executions
        BigDecimal profitLoss = null;
        BigDecimal profitRate = null;
        boolean isSell = "take_profit".equals(data.getPlanType()) || "stop_loss".equals(data.getPlanType());

        if (isSell && data.getExecutedPrice() != null && data.getExecutedQuantity() != null
                && position.getAverageBuyPrice() != null) {
            BigDecimal costBasis = position.getAverageBuyPrice().multiply(data.getExecutedQuantity());
            profitLoss = executedAmount.subtract(costBasis);
            if (costBasis.compareTo(BigDecimal.ZERO) > 0) {
                profitRate = profitLoss.divide(costBasis, 6, RoundingMode.HALF_UP);
            }
        }

        // Create execution record
        TradingPlan execution = new TradingPlan();
        execution.setPosition(position);
        execution.setUser(user);
        execution.setVersion(nextVersion);
        execution.setRecordType("execution");
        execution.setPlanType(data.getPlanType());
        execution.setExecutionIndex(data.getExecutionIndex());
        execution.setTargetPrice(data.getTargetPrice());
        execution.setTargetQuantity(data.getTargetQuantity());
        execution.setExecutedPrice(data.getExecutedPrice());
        execution.setExecutedQuantity(data.getExecutedQuantity());
        execution.setExecutedAmount(executedAmount);
        execution.setProfitLoss(profitLoss);
        execution.setProfitRate(profitRate);
        execution.setStatus("executed");

        // Copy current plan state from position to the execution snapshot
        execution.setBuyPlan(position.getBuyPlan());
        execution.setTakeProfitTargets(position.getTakeProfitTargets());
        execution.setStopLossTargets(position.getStopLossTargets());

        TradingPlan saved = tradingPlanRepository.save(execution);

        // Update position's plan items - mark the executed item as completed
        if (data.getExecutionIndex() != null) {
            markPlanItemCompleted(position, data.getPlanType(), data.getExecutionIndex());
        }

        // Update position quantities and averages
        if ("buy".equals(data.getPlanType()) && data.getExecutedPrice() != null && data.getExecutedQuantity() != null) {
            // Buy execution: update average buy price and total quantity
            BigDecimal currentQty = position.getTotalQuantity() != null ? position.getTotalQuantity() : BigDecimal.ZERO;
            BigDecimal currentAmount = position.getTotalBuyAmount() != null ? position.getTotalBuyAmount() : BigDecimal.ZERO;

            BigDecimal newTotalQty = currentQty.add(data.getExecutedQuantity());
            BigDecimal newTotalAmount = currentAmount.add(executedAmount);

            position.setTotalQuantity(newTotalQty);
            position.setTotalBuyAmount(newTotalAmount);

            if (newTotalQty.compareTo(BigDecimal.ZERO) > 0) {
                position.setAverageBuyPrice(
                        newTotalAmount.divide(newTotalQty, 4, RoundingMode.HALF_UP));
            }
        } else if (isSell && data.getExecutedQuantity() != null) {
            // Sell execution: deduct quantity, accumulate realized P&L
            BigDecimal currentQty = position.getTotalQuantity() != null ? position.getTotalQuantity() : BigDecimal.ZERO;
            position.setTotalQuantity(currentQty.subtract(data.getExecutedQuantity()));

            if (profitLoss != null) {
                BigDecimal currentRealizedPnl = position.getRealizedProfitLoss() != null
                        ? position.getRealizedProfitLoss() : BigDecimal.ZERO;
                position.setRealizedProfitLoss(currentRealizedPnl.add(profitLoss));
            }
        }

        positionRepository.save(position);

        // Audit log
        Map<String, Object> auditChanges = new LinkedHashMap<>();
        auditChanges.put("plan_type", data.getPlanType());
        auditChanges.put("execution_index", data.getExecutionIndex());
        auditChanges.put("executed_price", data.getExecutedPrice());
        auditChanges.put("executed_quantity", data.getExecutedQuantity());
        auditChanges.put("executed_amount", executedAmount);
        if (profitLoss != null) {
            auditChanges.put("profit_loss", profitLoss);
        }

        auditService.logChange(
                "trading_plan",
                saved.getId().intValue(),
                "execution",
                userId,
                data.getPlanType(),
                null,
                "Executed " + data.getPlanType() + " #" + data.getExecutionIndex(),
                auditChanges
        );

        log.info("Execution record {} created for position {} ({} #{}) by user {}",
                saved.getId(), positionId, data.getPlanType(), data.getExecutionIndex(), userId);

        return saved;
    }

    /**
     * Marks a specific plan item as completed in the position's plan/target arrays.
     */
    @SuppressWarnings("unchecked")
    private void markPlanItemCompleted(Position position, String planType, int index) {
        Object planObj;
        switch (planType) {
            case "buy" -> planObj = position.getBuyPlan();
            case "take_profit" -> planObj = position.getTakeProfitTargets();
            case "stop_loss" -> planObj = position.getStopLossTargets();
            default -> {
                return;
            }
        }

        if (!(planObj instanceof List<?> planList)) {
            return;
        }

        List<Map<String, Object>> items = (List<Map<String, Object>>) planList;
        if (index >= 0 && index < items.size()) {
            Map<String, Object> item = new LinkedHashMap<>(items.get(index));
            item.put("completed", true);
            items.set(index, item);

            // Write back to position
            switch (planType) {
                case "buy" -> position.setBuyPlan(items);
                case "take_profit" -> position.setTakeProfitTargets(items);
                case "stop_loss" -> position.setStopLossTargets(items);
            }
        }
    }
}
