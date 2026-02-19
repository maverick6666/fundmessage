package com.fundmessenger.newsdesk.repository;

import com.fundmessenger.newsdesk.entity.MarketStock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface MarketStockRepository extends JpaRepository<MarketStock, Long> {

    Optional<MarketStock> findByTickerAndMarket(String ticker, String market);

    List<MarketStock> findByMarket(String market);

    List<MarketStock> findByIsActiveTrue();

    List<MarketStock> findBySectorCode(String sectorCode);

    @Query("SELECT ms FROM MarketStock ms WHERE ms.ticker = :ticker")
    List<MarketStock> findByTicker(String ticker);
}
