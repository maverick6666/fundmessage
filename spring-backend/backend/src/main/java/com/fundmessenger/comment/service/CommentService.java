package com.fundmessenger.comment.service;

import com.fundmessenger.comment.dto.CommentCreate;
import com.fundmessenger.comment.dto.CommentUpdate;
import com.fundmessenger.comment.entity.Comment;
import com.fundmessenger.comment.repository.CommentRepository;
import com.fundmessenger.common.exception.BusinessException;
import com.fundmessenger.common.exception.ForbiddenException;
import com.fundmessenger.common.exception.NotFoundException;
import com.fundmessenger.common.util.KstUtil;
import com.fundmessenger.user.entity.User;
import com.fundmessenger.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CommentService {

    private final CommentRepository commentRepository;
    private final UserRepository userRepository;

    private static final Set<String> VALID_DOCUMENT_TYPES = Set.of(
            "decision_note", "report", "column", "ai_column", "news"
    );

    // ──────────────────────────────────────────────
    // Get comments
    // ──────────────────────────────────────────────

    /**
     * Get comments for a specific document with user info.
     */
    public Map<String, Object> getComments(String documentType, Long documentId, int skip, int limit) {
        List<Comment> allComments = commentRepository
                .findByDocumentTypeAndDocumentIdOrderByCreatedAtAsc(documentType, documentId.intValue());

        int total = allComments.size();

        List<Comment> paged = allComments.stream()
                .skip(skip)
                .limit(limit)
                .toList();

        List<Map<String, Object>> commentList = paged.stream()
                .map(this::commentToMap)
                .collect(Collectors.toList());

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("comments", commentList);
        data.put("total", total);
        data.put("skip", skip);
        data.put("limit", limit);
        return data;
    }

    // ──────────────────────────────────────────────
    // Create comment
    // ──────────────────────────────────────────────

    /**
     * Create a new comment. Validates the document type.
     */
    @Transactional
    public Map<String, Object> createComment(CommentCreate data, Long userId) {
        // Validate document type
        if (!VALID_DOCUMENT_TYPES.contains(data.getDocumentType())) {
            throw new BusinessException("Invalid document type: " + data.getDocumentType()
                    + ". Valid types: " + VALID_DOCUMENT_TYPES);
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User", userId));

        Comment comment = new Comment();
        comment.setUser(user);
        comment.setDocumentType(data.getDocumentType());
        comment.setDocumentId(data.getDocumentId().intValue());
        comment.setContent(data.getContent());
        comment.setCreatedAt(KstUtil.nowKst());
        comment.setUpdatedAt(KstUtil.nowKst());

        Comment saved = commentRepository.save(comment);
        log.info("Comment created: id={}, documentType={}, documentId={}, userId={}",
                saved.getId(), data.getDocumentType(), data.getDocumentId(), userId);
        return commentToMap(saved);
    }

    // ──────────────────────────────────────────────
    // Update comment (author only)
    // ──────────────────────────────────────────────

    /**
     * Update a comment. Only the author can update.
     */
    @Transactional
    public Map<String, Object> updateComment(Long commentId, CommentUpdate data, Long userId) {
        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new NotFoundException("Comment", commentId));

        if (!comment.getUserId().equals(userId)) {
            throw new ForbiddenException("작성자만 수정할 수 있습니다");
        }

        comment.setContent(data.getContent());
        comment.setUpdatedAt(KstUtil.nowKst());

        log.info("Comment updated: id={}, userId={}", commentId, userId);
        return commentToMap(comment);
    }

    // ──────────────────────────────────────────────
    // Delete comment (author or manager)
    // ──────────────────────────────────────────────

    /**
     * Delete a comment. Author or manager can delete.
     */
    @Transactional
    public void deleteComment(Long commentId, Long userId, String userRole) {
        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new NotFoundException("Comment", commentId));

        boolean isAuthor = comment.getUserId().equals(userId);
        boolean isManager = "manager".equals(userRole);

        if (!isAuthor && !isManager) {
            throw new ForbiddenException("작성자 또는 팀장만 삭제할 수 있습니다");
        }

        commentRepository.delete(comment);
        log.info("Comment deleted: id={}, by userId={}", commentId, userId);
    }

    // ──────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────

    private Map<String, Object> commentToMap(Comment comment) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", comment.getId());
        map.put("user_id", comment.getUserId());
        map.put("document_type", comment.getDocumentType());
        map.put("document_id", comment.getDocumentId());
        map.put("content", comment.getContent());
        map.put("created_at", comment.getCreatedAt() != null ? comment.getCreatedAt().toString() : null);
        map.put("updated_at", comment.getUpdatedAt() != null ? comment.getUpdatedAt().toString() : null);

        // Add user info
        User user = comment.getUser();
        if (user != null) {
            Map<String, Object> userMap = new LinkedHashMap<>();
            userMap.put("id", user.getId());
            userMap.put("username", user.getUsername());
            userMap.put("full_name", user.getFullName());
            map.put("user", userMap);
        } else {
            map.put("user", null);
        }

        return map;
    }
}
