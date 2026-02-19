package com.fundmessenger.discussion.repository;

import com.fundmessenger.discussion.entity.Discussion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface DiscussionRepository extends JpaRepository<Discussion, Long> {

    List<Discussion> findByRequestId(Long requestId);

    List<Discussion> findByPositionId(Long positionId);

    List<Discussion> findByStatus(String status);

    List<Discussion> findAllByOrderByCreatedAtDesc();

    @Modifying
    @Query("UPDATE Discussion d SET d.opener = null WHERE d.opener.id = :userId")
    void nullifyOpenerByUserId(@Param("userId") Long userId);

    @Modifying
    @Query("UPDATE Discussion d SET d.closer = null WHERE d.closer.id = :userId")
    void nullifyCloserByUserId(@Param("userId") Long userId);
}
