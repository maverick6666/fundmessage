package com.fundmessenger.position.repository;

import com.fundmessenger.position.entity.Position;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PositionRepository extends JpaRepository<Position, Long> {

    List<Position> findByStatus(String status);

    List<Position> findByStatusOrderByCreatedAtDesc(String status);

    Optional<Position> findFirstByTickerAndMarketAndStatus(String ticker, String market, String status);

    List<Position> findByTickerAndMarketAndStatus(String ticker, String market, String status);

    List<Position> findByOpenerId(Long openerId);

    List<Position> findAllByOrderByCreatedAtDesc();

    // Paginated queries for dynamic filtering
    Page<Position> findByStatus(String status, Pageable pageable);

    Page<Position> findByTicker(String ticker, Pageable pageable);

    Page<Position> findByOpenerId(Long openerId, Pageable pageable);

    Page<Position> findByStatusAndTicker(String status, String ticker, Pageable pageable);

    Page<Position> findByStatusAndOpenerId(String status, Long openerId, Pageable pageable);

    Page<Position> findByTickerAndOpenerId(String ticker, Long openerId, Pageable pageable);

    Page<Position> findByStatusAndTickerAndOpenerId(String status, String ticker, Long openerId, Pageable pageable);
}
