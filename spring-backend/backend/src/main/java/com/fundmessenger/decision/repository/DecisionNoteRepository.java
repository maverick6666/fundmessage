package com.fundmessenger.decision.repository;

import com.fundmessenger.decision.entity.DecisionNote;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DecisionNoteRepository extends JpaRepository<DecisionNote, Long> {

    List<DecisionNote> findByPositionIdOrderByCreatedAtDesc(Long positionId);

    void deleteByAuthorId(Long authorId);
}
