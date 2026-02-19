package com.fundmessenger.request.repository;

import com.fundmessenger.request.entity.TradeRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface TradeRequestRepository extends JpaRepository<TradeRequest, Long> {

    List<TradeRequest> findByPositionId(Long positionId);

    List<TradeRequest> findByRequesterId(Long requesterId);

    List<TradeRequest> findByStatus(String status);

    List<TradeRequest> findAllByOrderByCreatedAtDesc();

    Page<TradeRequest> findByStatus(String status, Pageable pageable);

    Page<TradeRequest> findByRequesterId(Long requesterId, Pageable pageable);

    Page<TradeRequest> findByRequesterIdAndStatus(Long requesterId, String status, Pageable pageable);

    Page<TradeRequest> findByRequestType(String requestType, Pageable pageable);

    Page<TradeRequest> findByStatusAndRequestType(String status, String requestType, Pageable pageable);

    Page<TradeRequest> findByStatusAndRequesterId(String status, Long requesterId, Pageable pageable);

    Page<TradeRequest> findByRequestTypeAndRequesterId(String requestType, Long requesterId, Pageable pageable);

    Page<TradeRequest> findByStatusAndRequestTypeAndRequesterId(
            String status, String requestType, Long requesterId, Pageable pageable);

    @Modifying
    @Query("UPDATE TradeRequest r SET r.requester = null WHERE r.requester.id = :userId")
    void nullifyRequesterByUserId(@Param("userId") Long userId);

    @Modifying
    @Query("UPDATE TradeRequest r SET r.approver = null WHERE r.approver.id = :userId")
    void nullifyApproverByUserId(@Param("userId") Long userId);
}
