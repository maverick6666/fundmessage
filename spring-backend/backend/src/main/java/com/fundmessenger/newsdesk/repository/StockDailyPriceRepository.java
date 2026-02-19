package com.fundmessenger.newsdesk.repository;

import com.fundmessenger.newsdesk.entity.StockDailyPrice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface StockDailyPriceRepository extends JpaRepository<StockDailyPrice, Long> {

    Optional<StockDailyPrice> findByStockIdAndTradeDate(Long stockId, LocalDate tradeDate);

    List<StockDailyPrice> findByStockIdAndTradeDateBetweenOrderByTradeDateAsc(
            Long stockId, LocalDate start, LocalDate end);

    List<StockDailyPrice> findByTradeDateOrderByStockId(LocalDate tradeDate);
}
