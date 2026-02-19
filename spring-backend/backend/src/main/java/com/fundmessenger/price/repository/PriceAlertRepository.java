package com.fundmessenger.price.repository;

import com.fundmessenger.price.entity.PriceAlert;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PriceAlertRepository extends JpaRepository<PriceAlert, Long> {

    List<PriceAlert> findByPositionIdOrderByCreatedAtDesc(Long positionId);

    List<PriceAlert> findByIsReadFalseOrderByCreatedAtDesc();
}
