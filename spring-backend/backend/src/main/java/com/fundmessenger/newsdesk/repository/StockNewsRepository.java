package com.fundmessenger.newsdesk.repository;

import com.fundmessenger.newsdesk.entity.StockNews;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface StockNewsRepository extends JpaRepository<StockNews, Long> {

    List<StockNews> findByStockIdOrderByRelevanceScoreDesc(Long stockId);

    List<StockNews> findByNewsIdOrderByRelevanceScoreDesc(Long newsId);

    @Query("SELECT sn FROM StockNews sn WHERE sn.stock.id = :stockId ORDER BY sn.coupledAt DESC, sn.relevanceScore DESC")
    List<StockNews> findByStockIdOrderByRecent(Long stockId);

    long countByStockId(Long stockId);
}
