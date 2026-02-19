package com.fundmessenger.discussion.repository;

import com.fundmessenger.discussion.entity.Message;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface MessageRepository extends JpaRepository<Message, Long> {

    List<Message> findByDiscussionIdOrderByCreatedAtAsc(Long discussionId);

    List<Message> findByDiscussionIdAndSessionNumber(Long discussionId, Integer sessionNumber);

    Page<Message> findByDiscussionId(Long discussionId, Pageable pageable);

    long countByDiscussionId(Long discussionId);

    @Modifying
    void deleteByDiscussionId(Long discussionId);

    @Modifying
    @Query("UPDATE Message m SET m.user = null WHERE m.user.id = :userId")
    void nullifyUserByUserId(@Param("userId") Long userId);
}
