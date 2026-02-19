package com.fundmessenger.report.controller;

import com.fundmessenger.common.dto.ApiResponse;
import com.fundmessenger.common.exception.NotFoundException;
import com.fundmessenger.common.security.UserPrincipal;
import com.fundmessenger.decision.entity.DecisionNote;
import com.fundmessenger.decision.repository.DecisionNoteRepository;
import com.fundmessenger.discussion.entity.Discussion;
import com.fundmessenger.discussion.repository.DiscussionRepository;
import com.fundmessenger.position.entity.Position;
import com.fundmessenger.position.repository.PositionRepository;
import com.fundmessenger.user.dto.UserBrief;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
public class ReportController {

    private final PositionRepository positionRepository;
    private final DecisionNoteRepository decisionNoteRepository;
    private final DiscussionRepository discussionRepository;

    // ──────────────────────────────────────────────
    // Report list (positions grouped by DecisionNote)
    // ──────────────────────────────────────────────

    /**
     * GET /api/v1/reports - Report list grouped by position with note_count and latest_note_at.
     */
    @GetMapping("")
    public ApiResponse<List<Map<String, Object>>> getReportList(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        List<Position> positions = positionRepository.findAllByOrderByCreatedAtDesc();
        List<Map<String, Object>> results = new ArrayList<>();

        for (Position pos : positions) {
            List<DecisionNote> notes = decisionNoteRepository.findByPositionIdOrderByCreatedAtDesc(pos.getId());

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", pos.getId());
            item.put("ticker", pos.getTicker());
            item.put("ticker_name", pos.getTickerName());
            item.put("market", pos.getMarket());
            item.put("status", pos.getStatus());
            item.put("note_count", notes.size());

            OffsetDateTime latestNoteAt = notes.stream()
                    .map(DecisionNote::getCreatedAt)
                    .filter(Objects::nonNull)
                    .max(OffsetDateTime::compareTo)
                    .orElse(null);
            item.put("latest_note_at", latestNoteAt);

            item.put("created_at", pos.getCreatedAt());

            results.add(item);
        }

        return ApiResponse.success(results);
    }

    // ──────────────────────────────────────────────
    // Positions for report (with note_count, discussion_count)
    // ──────────────────────────────────────────────

    /**
     * GET /api/v1/reports/positions - Positions with note and discussion counts.
     */
    @GetMapping("/positions")
    public ApiResponse<List<Map<String, Object>>> getReportPositions(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        List<Position> positions = positionRepository.findAllByOrderByCreatedAtDesc();
        List<Map<String, Object>> results = new ArrayList<>();

        for (Position pos : positions) {
            List<DecisionNote> notes = decisionNoteRepository.findByPositionIdOrderByCreatedAtDesc(pos.getId());
            List<Discussion> discussions = discussionRepository.findByPositionId(pos.getId());

            Map<String, Object> item = buildPositionBrief(pos);
            item.put("note_count", notes.size());
            item.put("discussion_count", discussions.size());

            results.add(item);
        }

        return ApiResponse.success(results);
    }

    // ──────────────────────────────────────────────
    // Operation reports (note_type='report')
    // ──────────────────────────────────────────────

    /**
     * GET /api/v1/reports/operation-reports - DecisionNotes with note_type='report'.
     */
    @GetMapping("/operation-reports")
    public ApiResponse<List<Map<String, Object>>> getOperationReports(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        List<DecisionNote> allNotes = decisionNoteRepository.findAll();

        List<Map<String, Object>> results = allNotes.stream()
                .filter(note -> "report".equals(note.getNoteType()))
                .sorted(Comparator.comparing(DecisionNote::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::noteToResponse)
                .collect(Collectors.toList());

        return ApiResponse.success(results);
    }

    // ──────────────────────────────────────────────
    // All decision notes (note_type='decision' or null)
    // ──────────────────────────────────────────────

    /**
     * GET /api/v1/reports/decision-notes - All decision-type notes.
     */
    @GetMapping("/decision-notes")
    public ApiResponse<List<Map<String, Object>>> getDecisionNotes(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        List<DecisionNote> allNotes = decisionNoteRepository.findAll();

        List<Map<String, Object>> results = allNotes.stream()
                .filter(note -> note.getNoteType() == null || "decision".equals(note.getNoteType()))
                .sorted(Comparator.comparing(DecisionNote::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::noteToResponse)
                .collect(Collectors.toList());

        return ApiResponse.success(results);
    }

    // ──────────────────────────────────────────────
    // Position report detail
    // ──────────────────────────────────────────────

    /**
     * GET /api/v1/reports/position/{positionId} - Position detail with all notes.
     */
    @GetMapping("/position/{positionId}")
    public ApiResponse<Map<String, Object>> getPositionReport(
            @PathVariable Long positionId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Position pos = positionRepository.findById(positionId)
                .orElseThrow(() -> new NotFoundException("Position", positionId));

        List<DecisionNote> notes = decisionNoteRepository.findByPositionIdOrderByCreatedAtDesc(positionId);
        List<Discussion> discussions = discussionRepository.findByPositionId(positionId);

        Map<String, Object> data = buildPositionBrief(pos);

        // Add full position details
        data.put("average_buy_price", pos.getAverageBuyPrice());
        data.put("total_quantity", pos.getTotalQuantity());
        data.put("total_buy_amount", pos.getTotalBuyAmount());
        data.put("buy_plan", pos.getBuyPlan());
        data.put("take_profit_targets", pos.getTakeProfitTargets());
        data.put("stop_loss_targets", pos.getStopLossTargets());
        data.put("profit_loss", pos.getProfitLoss());
        data.put("profit_rate", pos.getProfitRate());
        data.put("realized_profit_loss", pos.getRealizedProfitLoss());
        data.put("is_info_confirmed", pos.getIsInfoConfirmed());
        data.put("opened_at", pos.getOpenedAt());
        data.put("closed_at", pos.getClosedAt());

        // Add notes
        List<Map<String, Object>> noteResponses = notes.stream()
                .map(this::noteToResponse)
                .toList();
        data.put("notes", noteResponses);

        // Add discussion count
        data.put("discussion_count", discussions.size());

        return ApiResponse.success(data);
    }

    // ──────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────

    private Map<String, Object> buildPositionBrief(Position pos) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", pos.getId());
        item.put("ticker", pos.getTicker());
        item.put("ticker_name", pos.getTickerName());
        item.put("market", pos.getMarket());
        item.put("status", pos.getStatus());
        item.put("created_at", pos.getCreatedAt());
        item.put("updated_at", pos.getUpdatedAt());

        // Opener brief
        if (pos.getOpener() != null) {
            UserBrief opener = UserBrief.builder()
                    .id(pos.getOpener().getId())
                    .username(pos.getOpener().getUsername())
                    .fullName(pos.getOpener().getFullName())
                    .build();
            item.put("opener", opener);
        } else {
            item.put("opener", null);
        }

        return item;
    }

    private Map<String, Object> noteToResponse(DecisionNote note) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", note.getId());
        map.put("position_id", note.getPosition().getId());
        map.put("title", note.getTitle());
        map.put("content", note.getContent());
        map.put("blocks", note.getBlocks());
        map.put("note_type", note.getNoteType());

        if (note.getAuthor() != null) {
            UserBrief author = UserBrief.builder()
                    .id(note.getAuthor().getId())
                    .username(note.getAuthor().getUsername())
                    .fullName(note.getAuthor().getFullName())
                    .build();
            map.put("author", author);
            map.put("author_id", note.getAuthor().getId());
        } else {
            map.put("author", null);
            map.put("author_id", null);
        }

        map.put("updated_at", note.getUpdatedAt());
        map.put("created_at", note.getCreatedAt());

        // Add position brief info
        if (note.getPosition() != null) {
            Map<String, Object> posBrief = new LinkedHashMap<>();
            posBrief.put("id", note.getPosition().getId());
            posBrief.put("ticker", note.getPosition().getTicker());
            posBrief.put("ticker_name", note.getPosition().getTickerName());
            posBrief.put("market", note.getPosition().getMarket());
            posBrief.put("status", note.getPosition().getStatus());
            map.put("position", posBrief);
        }

        return map;
    }
}
