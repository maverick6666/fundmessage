package com.fundmessenger.decision.service;

import com.fundmessenger.audit.service.AuditService;
import com.fundmessenger.common.exception.ForbiddenException;
import com.fundmessenger.common.exception.NotFoundException;
import com.fundmessenger.decision.dto.DecisionNoteCreate;
import com.fundmessenger.decision.dto.DecisionNoteUpdate;
import com.fundmessenger.decision.entity.DecisionNote;
import com.fundmessenger.decision.repository.DecisionNoteRepository;
import com.fundmessenger.position.entity.Position;
import com.fundmessenger.position.repository.PositionRepository;
import com.fundmessenger.user.entity.User;
import com.fundmessenger.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class DecisionNoteService {

    private final DecisionNoteRepository decisionNoteRepository;
    private final PositionRepository positionRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;

    /**
     * List all decision notes for a position, ordered by created_at desc.
     */
    @Transactional(readOnly = true)
    public List<DecisionNote> getPositionNotes(Long positionId) {
        // Validate position exists
        positionRepository.findById(positionId)
                .orElseThrow(() -> new NotFoundException("Position", positionId));

        return decisionNoteRepository.findByPositionIdOrderByCreatedAtDesc(positionId);
    }

    /**
     * Get a single decision note.
     */
    @Transactional(readOnly = true)
    public DecisionNote getNote(Long positionId, Long noteId) {
        DecisionNote note = decisionNoteRepository.findById(noteId)
                .orElseThrow(() -> new NotFoundException("DecisionNote", noteId));

        if (!note.getPosition().getId().equals(positionId)) {
            throw new NotFoundException("DecisionNote", noteId);
        }

        return note;
    }

    /**
     * Create a new decision note for a position.
     */
    @Transactional
    public DecisionNote createNote(Long positionId, DecisionNoteCreate data, Long userId) {
        Position position = positionRepository.findById(positionId)
                .orElseThrow(() -> new NotFoundException("Position", positionId));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User", userId));

        DecisionNote note = new DecisionNote();
        note.setPosition(position);
        note.setTitle(data.getTitle() != null ? data.getTitle() : "");
        note.setContent(data.getContent() != null ? data.getContent() : "");
        note.setBlocks(data.getBlocks());
        note.setNoteType(data.getNoteType() != null ? data.getNoteType() : "decision");
        note.setAuthor(user);

        DecisionNote saved = decisionNoteRepository.save(note);

        auditService.logChange(
                "decision_note",
                saved.getId().intValue(),
                "create",
                userId,
                null, null, null, null
        );

        log.info("Decision note {} created for position {} by user {}",
                saved.getId(), positionId, userId);

        return saved;
    }

    /**
     * Update an existing decision note.
     */
    @Transactional
    public DecisionNote updateNote(Long positionId, Long noteId, DecisionNoteUpdate data, Long userId) {
        DecisionNote note = getNote(positionId, noteId);

        if (data.getTitle() != null) {
            note.setTitle(data.getTitle());
        }
        if (data.getContent() != null) {
            note.setContent(data.getContent());
        }
        if (data.getBlocks() != null) {
            note.setBlocks(data.getBlocks());
        }

        DecisionNote saved = decisionNoteRepository.save(note);

        auditService.logChange(
                "decision_note",
                saved.getId().intValue(),
                "update",
                userId,
                null, null, null, null
        );

        log.info("Decision note {} updated by user {}", noteId, userId);

        return saved;
    }

    /**
     * Delete a decision note.
     */
    @Transactional
    public void deleteNote(Long positionId, Long noteId, Long userId, boolean isManager) {
        DecisionNote note = getNote(positionId, noteId);

        // Only the author or a manager can delete
        if (!note.getAuthor().getId().equals(userId) && !isManager) {
            throw new ForbiddenException("Only the author or a manager can delete this note");
        }

        auditService.logChange(
                "decision_note",
                noteId.intValue(),
                "delete",
                userId,
                null, null, null, null
        );

        decisionNoteRepository.delete(note);

        log.info("Decision note {} deleted by user {}", noteId, userId);
    }
}
