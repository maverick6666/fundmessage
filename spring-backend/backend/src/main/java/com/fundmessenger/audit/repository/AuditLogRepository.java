package com.fundmessenger.audit.repository;

import com.fundmessenger.audit.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    List<AuditLog> findByEntityTypeAndEntityIdOrderByCreatedAtDesc(String entityType, Integer entityId);

    List<AuditLog> findByUserIdOrderByCreatedAtDesc(Long userId);

    @Modifying
    @Query(value = "UPDATE audit_logs SET user_id = NULL WHERE user_id = :userId", nativeQuery = true)
    void nullifyUserByUserId(@Param("userId") Long userId);
}
