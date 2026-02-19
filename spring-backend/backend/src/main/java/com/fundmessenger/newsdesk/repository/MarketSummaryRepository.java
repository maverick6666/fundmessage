package com.fundmessenger.newsdesk.repository;

import com.fundmessenger.newsdesk.entity.MarketSummary;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface MarketSummaryRepository extends JpaRepository<MarketSummary, Long> {

    Optional<MarketSummary> findBySummaryDateAndMarket(LocalDate summaryDate, String market);

    List<MarketSummary> findBySummaryDate(LocalDate summaryDate);

    List<MarketSummary> findBySummaryDateBetweenAndMarketOrderBySummaryDateAsc(
            LocalDate start, LocalDate end, String market);
}
