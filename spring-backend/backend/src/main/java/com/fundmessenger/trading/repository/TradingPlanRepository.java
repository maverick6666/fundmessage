package com.fundmessenger.trading.repository;

import com.fundmessenger.trading.entity.TradingPlan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TradingPlanRepository extends JpaRepository<TradingPlan, Long> {

    List<TradingPlan> findByPositionIdOrderByCreatedAtDesc(Long positionId);

    List<TradingPlan> findByPositionIdOrderByVersionDesc(Long positionId);

    List<TradingPlan> findByPositionIdAndRecordType(Long positionId, String recordType);
}
