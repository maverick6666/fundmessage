package com.fundmessenger.comment.repository;

import com.fundmessenger.comment.entity.Comment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CommentRepository extends JpaRepository<Comment, Long> {

    List<Comment> findByDocumentTypeAndDocumentIdOrderByCreatedAtAsc(String documentType, Integer documentId);

    List<Comment> findByUserIdOrderByCreatedAtDesc(Long userId);
}
