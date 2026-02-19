package com.fundmessenger.decision.controller;

import com.fundmessenger.common.dto.ApiResponse;
import com.fundmessenger.common.security.UserPrincipal;
import com.fundmessenger.decision.dto.DecisionNoteCreate;
import com.fundmessenger.decision.dto.DecisionNoteUpdate;
import com.fundmessenger.decision.entity.DecisionNote;
import com.fundmessenger.decision.service.DecisionNoteService;
import com.fundmessenger.user.dto.UserBrief;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/positions")
@RequiredArgsConstructor
public class DecisionNoteController {

    private final DecisionNoteService decisionNoteService;

    // ──────────────────────────────────────────────
    // List & Get
    // ──────────────────────────────────────────────

    /**
     * GET /api/v1/positions/{positionId}/notes - List decision notes for a position.
     */
    @GetMapping("/{positionId}/notes")
    public ApiResponse<List<Map<String, Object>>> getPositionNotes(
            @PathVariable Long positionId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        List<DecisionNote> notes = decisionNoteService.getPositionNotes(positionId);
        List<Map<String, Object>> data = notes.stream()
                .map(this::noteToResponse)
                .toList();
        return ApiResponse.success(data);
    }

    /**
     * GET /api/v1/positions/{positionId}/notes/{noteId} - Get a single decision note.
     */
    @GetMapping("/{positionId}/notes/{noteId}")
    public ApiResponse<Map<String, Object>> getNote(
            @PathVariable Long positionId,
            @PathVariable Long noteId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        DecisionNote note = decisionNoteService.getNote(positionId, noteId);
        return ApiResponse.success(noteToResponse(note));
    }

    // ──────────────────────────────────────────────
    // Create / Update / Delete (manager only)
    // ──────────────────────────────────────────────

    /**
     * POST /api/v1/positions/{positionId}/notes - Create a decision note.
     */
    @PostMapping("/{positionId}/notes")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN')")
    public ApiResponse<Map<String, Object>> createNote(
            @PathVariable Long positionId,
            @RequestBody DecisionNoteCreate dto,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        DecisionNote note = decisionNoteService.createNote(positionId, dto, principal.getId());
        return ApiResponse.success(noteToResponse(note), "Decision note created");
    }

    /**
     * PATCH /api/v1/positions/{positionId}/notes/{noteId} - Update a decision note.
     */
    @PatchMapping("/{positionId}/notes/{noteId}")
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN')")
    public ApiResponse<Map<String, Object>> updateNote(
            @PathVariable Long positionId,
            @PathVariable Long noteId,
            @RequestBody DecisionNoteUpdate dto,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        DecisionNote note = decisionNoteService.updateNote(positionId, noteId, dto, principal.getId());
        return ApiResponse.success(noteToResponse(note), "Decision note updated");
    }

    /**
     * DELETE /api/v1/positions/{positionId}/notes/{noteId} - Delete a decision note.
     */
    @DeleteMapping("/{positionId}/notes/{noteId}")
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN')")
    public ApiResponse<Void> deleteNote(
            @PathVariable Long positionId,
            @PathVariable Long noteId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        boolean isManager = principal.getUser().isManagerOrAdmin();
        decisionNoteService.deleteNote(positionId, noteId, principal.getId(), isManager);
        return ApiResponse.success(null, "Decision note deleted");
    }

    // ──────────────────────────────────────────────
    // Response builder
    // ──────────────────────────────────────────────

    private Map<String, Object> noteToResponse(DecisionNote note) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", note.getId());
        map.put("position_id", note.getPosition().getId());
        map.put("title", note.getTitle());
        map.put("content", note.getContent());
        map.put("blocks", note.getBlocks());
        map.put("note_type", note.getNoteType());

        // Author brief
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
        return map;
    }
}
