package com.fundmessenger.comment.controller;

import com.fundmessenger.comment.dto.CommentCreate;
import com.fundmessenger.comment.dto.CommentUpdate;
import com.fundmessenger.comment.service.CommentService;
import com.fundmessenger.common.dto.ApiResponse;
import com.fundmessenger.common.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1/comments")
@RequiredArgsConstructor
public class CommentController {

    private final CommentService commentService;

    // ──────────────────────────────────────────────
    // GET /api/v1/comments
    // ──────────────────────────────────────────────

    @GetMapping("")
    public ApiResponse<Map<String, Object>> getComments(
            @RequestParam(name = "document_type") String documentType,
            @RequestParam(name = "document_id") Long documentId,
            @RequestParam(defaultValue = "0") int skip,
            @RequestParam(defaultValue = "50") int limit
    ) {
        Map<String, Object> data = commentService.getComments(documentType, documentId, skip, limit);
        return ApiResponse.success(data);
    }

    // ──────────────────────────────────────────────
    // POST /api/v1/comments
    // ──────────────────────────────────────────────

    @PostMapping("")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Map<String, Object>> createComment(
            @RequestBody CommentCreate commentData,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Map<String, Object> data = commentService.createComment(commentData, principal.getId());
        return ApiResponse.success(data, "댓글이 작성되었습니다");
    }

    // ──────────────────────────────────────────────
    // PUT /api/v1/comments/{commentId} (author only)
    // ──────────────────────────────────────────────

    @PutMapping("/{commentId}")
    public ApiResponse<Map<String, Object>> updateComment(
            @PathVariable Long commentId,
            @RequestBody CommentUpdate commentData,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Map<String, Object> data = commentService.updateComment(commentId, commentData, principal.getId());
        return ApiResponse.success(data, "댓글이 수정되었습니다");
    }

    // ──────────────────────────────────────────────
    // DELETE /api/v1/comments/{commentId} (author or manager)
    // ──────────────────────────────────────────────

    @DeleteMapping("/{commentId}")
    public ApiResponse<Void> deleteComment(
            @PathVariable Long commentId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        commentService.deleteComment(commentId, principal.getId(), principal.getRole());
        return ApiResponse.success(null, "댓글이 삭제되었습니다");
    }
}
