package com.fundmessenger.position.controller;

import com.fundmessenger.audit.entity.AuditLog;
import com.fundmessenger.audit.service.AuditService;
import com.fundmessenger.common.dto.ApiResponse;
import com.fundmessenger.common.exception.BusinessException;
import com.fundmessenger.common.exception.ForbiddenException;
import com.fundmessenger.common.exception.NotFoundException;
import com.fundmessenger.common.security.UserPrincipal;
import com.fundmessenger.notification.entity.Notification;
import com.fundmessenger.notification.repository.NotificationRepository;
import com.fundmessenger.position.dto.*;
import com.fundmessenger.position.entity.Position;
import com.fundmessenger.position.entity.TeamSettings;
import com.fundmessenger.position.repository.TeamSettingsRepository;
import com.fundmessenger.position.service.PositionService;
import com.fundmessenger.user.dto.UserBrief;
import com.fundmessenger.user.entity.User;
import com.fundmessenger.user.repository.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/v1/positions")
@RequiredArgsConstructor
public class PositionController {

    private final PositionService positionService;
    private final AuditService auditService;
    private final TeamSettingsRepository teamSettingsRepository;
    private final UserRepository userRepository;
    private final NotificationRepository notificationRepository;

    // ========================
    // Team Settings endpoints
    // ========================

    @GetMapping("/settings/team")
    public ApiResponse<TeamSettingsResponse> getTeamSettings() {
        TeamSettings settings = getOrCreateTeamSettings();
        return ApiResponse.success(toTeamSettingsResponse(settings));
    }

    @PutMapping("/settings/team")
    @PreAuthorize("hasRole('MANAGER')")
    public ApiResponse<TeamSettingsResponse> updateTeamSettings(
            @RequestBody TeamSettingsUpdate update,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        TeamSettings settings = getOrCreateTeamSettings();

        if (update.getInitialCapitalKrw() != null) {
            settings.setInitialCapitalKrw(update.getInitialCapitalKrw());
        }
        if (update.getInitialCapitalUsd() != null) {
            settings.setInitialCapitalUsd(update.getInitialCapitalUsd());
        }
        if (update.getDescription() != null) {
            settings.setDescription(update.getDescription());
        }

        TeamSettings saved = teamSettingsRepository.save(settings);
        return ApiResponse.success(toTeamSettingsResponse(saved));
    }

    @PostMapping("/settings/team/exchange")
    @PreAuthorize("hasRole('MANAGER')")
    @SuppressWarnings("unchecked")
    public ApiResponse<TeamSettingsResponse> currencyExchange(
            @Valid @RequestBody CurrencyExchange exchange,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        TeamSettings settings = getOrCreateTeamSettings();

        // Adjust capital based on exchange direction
        if ("KRW".equalsIgnoreCase(exchange.getFromCurrency())) {
            settings.setInitialCapitalKrw(
                    settings.getInitialCapitalKrw().subtract(exchange.getFromAmount()));
        } else if ("USD".equalsIgnoreCase(exchange.getFromCurrency())) {
            settings.setInitialCapitalUsd(
                    settings.getInitialCapitalUsd().subtract(exchange.getFromAmount()));
        }

        if ("KRW".equalsIgnoreCase(exchange.getToCurrency())) {
            settings.setInitialCapitalKrw(
                    settings.getInitialCapitalKrw().add(exchange.getToAmount()));
        } else if ("USD".equalsIgnoreCase(exchange.getToCurrency())) {
            settings.setInitialCapitalUsd(
                    settings.getInitialCapitalUsd().add(exchange.getToAmount()));
        }

        // Add to exchange history
        List<Map<String, Object>> history = settings.getExchangeHistory() != null
                ? new ArrayList<>((List<Map<String, Object>>) settings.getExchangeHistory())
                : new ArrayList<>();

        Map<String, Object> record = new LinkedHashMap<>();
        record.put("fromCurrency", exchange.getFromCurrency());
        record.put("toCurrency", exchange.getToCurrency());
        record.put("fromAmount", exchange.getFromAmount().doubleValue());
        record.put("toAmount", exchange.getToAmount().doubleValue());
        if (exchange.getExchangeRate() != null) {
            record.put("exchangeRate", exchange.getExchangeRate().doubleValue());
        }
        if (exchange.getMemo() != null) {
            record.put("memo", exchange.getMemo());
        }
        record.put("date", OffsetDateTime.now().toString());
        record.put("userId", principal.getId());
        history.add(record);

        settings.setExchangeHistory(history);
        TeamSettings saved = teamSettingsRepository.save(settings);

        return ApiResponse.success(toTeamSettingsResponse(saved));
    }

    // ========================
    // Position CRUD endpoints
    // ========================

    @GetMapping("")
    public ApiResponse<Map<String, Object>> listPositions(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String ticker,
            @RequestParam(required = false) Long openedBy,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int limit
    ) {
        PositionService.PositionListResult result = positionService.getPositions(status, ticker, openedBy, page, limit);

        List<PositionResponse> responses = result.positions().stream()
                .map(this::positionToResponse)
                .collect(Collectors.toList());

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("positions", responses);
        data.put("total", result.total());
        data.put("page", page);
        data.put("limit", limit);

        return ApiResponse.success(data);
    }

    @GetMapping("/{positionId}")
    public ApiResponse<PositionResponse> getPosition(@PathVariable Long positionId) {
        Position position = positionService.getPositionById(positionId);
        return ApiResponse.success(positionToResponse(position));
    }

    @PatchMapping("/{positionId}")
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN')")
    public ApiResponse<PositionResponse> updatePosition(
            @PathVariable Long positionId,
            @RequestBody PositionUpdate updateData
    ) {
        Position position = positionService.updatePosition(positionId, updateData);
        return ApiResponse.success(positionToResponse(position));
    }

    @PostMapping("/{positionId}/close")
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN')")
    public ApiResponse<PositionResponse> closePosition(
            @PathVariable Long positionId,
            @Valid @RequestBody PositionClose closeData,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Position position = positionService.closePosition(positionId, closeData, principal.getUser());
        return ApiResponse.success(positionToResponse(position));
    }

    @PostMapping("/{positionId}/confirm")
    @PreAuthorize("hasRole('MANAGER')")
    public ApiResponse<PositionResponse> confirmPositionInfo(
            @PathVariable Long positionId,
            @Valid @RequestBody PositionConfirmInfo confirmData,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Position position = positionService.confirmPositionInfo(positionId, confirmData, principal.getId());
        return ApiResponse.success(positionToResponse(position));
    }

    @PostMapping("/{positionId}/toggle-plan")
    @PreAuthorize("hasRole('MANAGER')")
    public ApiResponse<PositionResponse> togglePlanItem(
            @PathVariable Long positionId,
            @Valid @RequestBody TogglePlanItem toggleData,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Position position = positionService.togglePlanItem(
                positionId,
                toggleData.getPlanType(),
                toggleData.getIndex(),
                toggleData.isCompleted(),
                principal.getId()
        );
        return ApiResponse.success(positionToResponse(position));
    }

    @PatchMapping("/{positionId}/plans")
    public ApiResponse<PositionResponse> updatePlans(
            @PathVariable Long positionId,
            @RequestBody UpdatePlans plansData,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Position position = positionService.updatePlans(
                positionId,
                plansData.getBuyPlan(),
                plansData.getTakeProfitTargets(),
                plansData.getStopLossTargets(),
                principal.getId()
        );
        return ApiResponse.success(positionToResponse(position));
    }

    @GetMapping("/{positionId}/audit-logs")
    public ApiResponse<List<AuditLog>> getAuditLogs(
            @PathVariable Long positionId,
            @RequestParam(defaultValue = "50") int limit
    ) {
        // Verify position exists
        positionService.getPositionById(positionId);

        List<AuditLog> logs = auditService.getLogsForEntity("position", positionId.intValue(), limit);
        return ApiResponse.success(logs);
    }

    @PostMapping("/{positionId}/request-discussion")
    public ApiResponse<String> requestDiscussion(
            @PathVariable Long positionId,
            @RequestBody(required = false) Map<String, String> body,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Position position = positionService.getPositionById(positionId);
        String memo = body != null ? body.get("memo") : null;

        // Send notification to all managers
        List<User> managers = userRepository.findByRole("manager");
        String tickerDisplay = position.getTickerName() != null
                ? position.getTickerName() + " (" + position.getTicker() + ")"
                : position.getTicker();

        for (User manager : managers) {
            Notification notification = new Notification();
            notification.setUser(manager);
            notification.setNotificationType("discussion_request");
            notification.setTitle("토론 요청: " + tickerDisplay);
            notification.setMessage(principal.getUser().getUsername() + "님이 토론을 요청했습니다."
                    + (memo != null ? " 사유: " + memo : ""));
            notification.setRelatedType("position");
            notification.setRelatedId(positionId.intValue());
            notificationRepository.save(notification);
        }

        return ApiResponse.success("토론 요청이 전송되었습니다");
    }

    @PostMapping("/{positionId}/request-early-close")
    public ApiResponse<String> requestEarlyClose(
            @PathVariable Long positionId,
            @RequestBody(required = false) Map<String, String> body,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Position position = positionService.getPositionById(positionId);
        String memo = body != null ? body.get("memo") : null;

        // Send notification to all managers
        List<User> managers = userRepository.findByRole("manager");
        String tickerDisplay = position.getTickerName() != null
                ? position.getTickerName() + " (" + position.getTicker() + ")"
                : position.getTicker();

        for (User manager : managers) {
            Notification notification = new Notification();
            notification.setUser(manager);
            notification.setNotificationType("early_close_request");
            notification.setTitle("조기 종료 요청: " + tickerDisplay);
            notification.setMessage(principal.getUser().getUsername() + "님이 조기 종료를 요청했습니다."
                    + (memo != null ? " 사유: " + memo : ""));
            notification.setRelatedType("position");
            notification.setRelatedId(positionId.intValue());
            notificationRepository.save(notification);
        }

        return ApiResponse.success("조기 종료 요청이 전송되었습니다");
    }

    @DeleteMapping("/{positionId}")
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN')")
    public ApiResponse<String> deletePosition(
            @PathVariable Long positionId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        positionService.deletePosition(positionId);
        return ApiResponse.success("포지션이 삭제되었습니다");
    }

    // ========================
    // Helper: Position -> PositionResponse
    // ========================

    @SuppressWarnings("unchecked")
    private PositionResponse positionToResponse(Position position) {
        // Build UserBrief for opener
        UserBrief openedBy = null;
        if (position.getOpener() != null) {
            User opener = position.getOpener();
            openedBy = UserBrief.builder()
                    .id(opener.getId())
                    .username(opener.getUsername())
                    .fullName(opener.getFullName())
                    .build();
        }

        // Build UserBrief for closer
        UserBrief closedBy = null;
        if (position.getCloser() != null) {
            User closer = position.getCloser();
            closedBy = UserBrief.builder()
                    .id(closer.getId())
                    .username(closer.getUsername())
                    .fullName(closer.getFullName())
                    .build();
        }

        // Compute remaining counts
        int remainingBuys = positionService.countRemainingItems(position.getBuyPlan());
        int remainingTakeProfits = positionService.countRemainingItems(position.getTakeProfitTargets());
        int remainingStopLosses = positionService.countRemainingItems(position.getStopLossTargets());

        // Compute status info
        PositionStatusInfo statusInfo = positionService.getPositionStatusInfo(position);

        // Convert JSON fields to typed lists
        List<Map<String, Object>> buyPlan = position.getBuyPlan() != null
                ? (List<Map<String, Object>>) position.getBuyPlan()
                : null;
        List<Map<String, Object>> takeProfitTargets = position.getTakeProfitTargets() != null
                ? (List<Map<String, Object>>) position.getTakeProfitTargets()
                : null;
        List<Map<String, Object>> stopLossTargets = position.getStopLossTargets() != null
                ? (List<Map<String, Object>>) position.getStopLossTargets()
                : null;

        return PositionResponse.builder()
                .id(position.getId())
                .ticker(position.getTicker())
                .tickerName(position.getTickerName())
                .market(position.getMarket())
                .status(position.getStatus())
                .isInfoConfirmed(Boolean.TRUE.equals(position.getIsInfoConfirmed()))
                .averageBuyPrice(position.getAverageBuyPrice())
                .totalQuantity(position.getTotalQuantity())
                .totalBuyAmount(position.getTotalBuyAmount())
                .buyPlan(buyPlan)
                .takeProfitTargets(takeProfitTargets)
                .stopLossTargets(stopLossTargets)
                .remainingBuys(remainingBuys)
                .remainingTakeProfits(remainingTakeProfits)
                .remainingStopLosses(remainingStopLosses)
                .averageSellPrice(position.getAverageSellPrice())
                .totalSellAmount(position.getTotalSellAmount())
                .profitLoss(position.getProfitLoss())
                .profitRate(position.getProfitRate())
                .realizedProfitLoss(position.getRealizedProfitLoss())
                .holdingPeriodHours(position.getHoldingPeriodHours())
                .openedAt(position.getOpenedAt())
                .closedAt(position.getClosedAt())
                .openedBy(openedBy)
                .closedBy(closedBy)
                .createdAt(position.getCreatedAt())
                .statusInfo(statusInfo)
                .build();
    }

    // ========================
    // Helper: Team Settings
    // ========================

    private TeamSettings getOrCreateTeamSettings() {
        List<TeamSettings> all = teamSettingsRepository.findAll();
        if (all.isEmpty()) {
            TeamSettings settings = new TeamSettings();
            settings.setInitialCapitalKrw(BigDecimal.ZERO);
            settings.setInitialCapitalUsd(BigDecimal.ZERO);
            return teamSettingsRepository.save(settings);
        }
        return all.get(0);
    }

    @SuppressWarnings("unchecked")
    private TeamSettingsResponse toTeamSettingsResponse(TeamSettings settings) {
        List<Map<String, Object>> exchangeHistory = settings.getExchangeHistory() != null
                ? (List<Map<String, Object>>) settings.getExchangeHistory()
                : null;

        return TeamSettingsResponse.builder()
                .id(settings.getId())
                .initialCapitalKrw(settings.getInitialCapitalKrw())
                .initialCapitalUsd(settings.getInitialCapitalUsd())
                .exchangeHistory(exchangeHistory)
                .description(settings.getDescription())
                .updatedAt(settings.getUpdatedAt())
                .build();
    }
}
