package com.fundmessenger.notification.repository;

import com.fundmessenger.notification.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<Notification> findByUserIdAndIsReadFalse(Long userId);

    Page<Notification> findByUserId(Long userId, Pageable pageable);

    Page<Notification> findByUserIdAndIsReadFalse(Long userId, Pageable pageable);

    long countByUserId(Long userId);

    long countByUserIdAndIsReadFalse(Long userId);

    @Modifying
    @Query("UPDATE Notification n SET n.isRead = true WHERE n.id IN :ids AND n.user.id = :userId")
    int markAsReadByIdsAndUserId(@Param("ids") List<Long> ids, @Param("userId") Long userId);

    @Modifying
    @Query("UPDATE Notification n SET n.isRead = true WHERE n.user.id = :userId AND n.isRead = false")
    int markAllAsReadByUserId(@Param("userId") Long userId);

    long deleteByIdAndUserId(Long id, Long userId);

    @Modifying
    @Query("DELETE FROM Notification n WHERE n.user.id = :userId")
    int deleteAllByUserId(@Param("userId") Long userId);

    void deleteByUserId(Long userId);
}
