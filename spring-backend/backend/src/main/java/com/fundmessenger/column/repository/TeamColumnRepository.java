package com.fundmessenger.column.repository;

import com.fundmessenger.column.entity.TeamColumn;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TeamColumnRepository extends JpaRepository<TeamColumn, Long> {

    List<TeamColumn> findByAuthorIdOrderByCreatedAtDesc(Long authorId);

    List<TeamColumn> findAllByOrderByCreatedAtDesc();
}
