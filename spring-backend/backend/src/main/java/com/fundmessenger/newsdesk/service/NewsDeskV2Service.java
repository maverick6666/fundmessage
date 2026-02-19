package com.fundmessenger.newsdesk.service;

import com.fundmessenger.newsdesk.dto.*;
import com.fundmessenger.newsdesk.entity.*;
import com.fundmessenger.newsdesk.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class NewsDeskV2Service {

    private final MarketStockRepository marketStockRepository;
    private final StockDailyPriceRepository stockDailyPriceRepository;
    private final StockNewsRepository stockNewsRepository;
    private final MarketSummaryRepository marketSummaryRepository;
    private final RawNewsRepository rawNewsRepository;

    // ──────────────────────────────────────────────
    // Market Summary
    // ──────────────────────────────────────────────

    public List<MarketSummaryResponse> getMarketSummary(LocalDate date) {
        List<MarketSummary> summaries = marketSummaryRepository.findBySummaryDate(date);
        return summaries.stream().map(this::toSummaryResponse).toList();
    }

    public MarketSummaryResponse getMarketSummaryByMarket(String market, LocalDate date) {
        return marketSummaryRepository.findBySummaryDateAndMarket(date, market.toUpperCase())
                .map(this::toSummaryResponse)
                .orElse(null);
    }

    // ──────────────────────────────────────────────
    // Heatmap
    // ──────────────────────────────────────────────

    public List<Map<String, Object>> getHeatmap(String market, LocalDate date) {
        List<MarketStock> stocks = marketStockRepository.findByMarket(market.toUpperCase());

        Map<String, List<MarketStock>> bySector = stocks.stream()
                .filter(s -> s.getSectorCode() != null)
                .collect(Collectors.groupingBy(MarketStock::getSectorCode));

        List<Map<String, Object>> sectors = new ArrayList<>();

        for (var entry : bySector.entrySet()) {
            Map<String, Object> sector = new LinkedHashMap<>();
            sector.put("sector_code", entry.getKey());
            sector.put("sector_name", entry.getValue().get(0).getSectorName());

            List<Map<String, Object>> stockList = new ArrayList<>();
            BigDecimal sectorChangeSum = BigDecimal.ZERO;
            int count = 0;

            for (MarketStock ms : entry.getValue()) {
                Optional<StockDailyPrice> priceOpt = stockDailyPriceRepository
                        .findByStockIdAndTradeDate(ms.getId(), date);
                if (priceOpt.isPresent()) {
                    StockDailyPrice price = priceOpt.get();
                    Map<String, Object> stockData = new LinkedHashMap<>();
                    stockData.put("ticker", ms.getTicker());
                    stockData.put("ticker_name", ms.getTickerName());
                    stockData.put("close_price", price.getClosePrice());
                    stockData.put("change_rate", price.getChangeRate());
                    stockData.put("volume", price.getVolume());
                    stockData.put("market_cap", price.getMarketCap());
                    stockList.add(stockData);

                    if (price.getChangeRate() != null) {
                        sectorChangeSum = sectorChangeSum.add(price.getChangeRate());
                        count++;
                    }
                }
            }

            sector.put("avg_change_rate", count > 0
                    ? sectorChangeSum.divide(BigDecimal.valueOf(count), 4, java.math.RoundingMode.HALF_UP)
                    : BigDecimal.ZERO);
            sector.put("stock_count", stockList.size());
            sector.put("stocks", stockList);
            sectors.add(sector);
        }

        // Sort by avg_change_rate descending
        sectors.sort((a, b) -> {
            BigDecimal ra = (BigDecimal) a.get("avg_change_rate");
            BigDecimal rb = (BigDecimal) b.get("avg_change_rate");
            return rb.compareTo(ra);
        });

        return sectors;
    }

    // ──────────────────────────────────────────────
    // Stock Detail
    // ──────────────────────────────────────────────

    public Map<String, Object> getStockDetail(String ticker, LocalDate date) {
        List<MarketStock> stocks = marketStockRepository.findByTicker(ticker);
        if (stocks.isEmpty()) return null;

        MarketStock stock = stocks.get(0);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", stock.getId());
        result.put("ticker", stock.getTicker());
        result.put("ticker_name", stock.getTickerName());
        result.put("market", stock.getMarket());
        result.put("sector_code", stock.getSectorCode());
        result.put("sector_name", stock.getSectorName());
        result.put("market_cap", stock.getMarketCap());

        // Today's price
        stockDailyPriceRepository.findByStockIdAndTradeDate(stock.getId(), date)
                .ifPresent(price -> {
                    result.put("open_price", price.getOpenPrice());
                    result.put("high_price", price.getHighPrice());
                    result.put("low_price", price.getLowPrice());
                    result.put("close_price", price.getClosePrice());
                    result.put("volume", price.getVolume());
                    result.put("change_rate", price.getChangeRate());
                });

        return result;
    }

    // ──────────────────────────────────────────────
    // Stock News
    // ──────────────────────────────────────────────

    public List<StockNewsResponse> getStockNews(String ticker, LocalDate date, int limit) {
        List<MarketStock> stocks = marketStockRepository.findByTicker(ticker);
        if (stocks.isEmpty()) return List.of();

        MarketStock stock = stocks.get(0);
        List<StockNews> newsList = stockNewsRepository.findByStockIdOrderByRelevanceScoreDesc(stock.getId());

        return newsList.stream()
                .limit(limit)
                .map(sn -> StockNewsResponse.builder()
                        .id(sn.getId())
                        .newsId(sn.getNews().getId())
                        .title(sn.getNews().getTitle())
                        .description(sn.getNews().getDescription())
                        .link(sn.getNews().getLink())
                        .source(sn.getNews().getSource())
                        .pubDate(sn.getNews().getPubDate())
                        .relevanceScore(sn.getRelevanceScore())
                        .couplingReason(sn.getCouplingReason())
                        .coupledBy(sn.getCoupledBy())
                        .coupledAt(sn.getCoupledAt())
                        .build())
                .toList();
    }

    // ──────────────────────────────────────────────
    // Upload: News
    // ──────────────────────────────────────────────

    @Transactional
    public Map<String, Object> uploadNews(NewsDeskUploadRequest.NewsUpload request) {
        int created = 0;
        List<Long> newsIds = new ArrayList<>();

        for (NewsDeskUploadRequest.NewsItem item : request.getNews()) {
            RawNews rawNews = new RawNews();
            rawNews.setTitle(item.getTitle());
            rawNews.setDescription(item.getDescription());
            rawNews.setLink(item.getLink());
            rawNews.setPubDate(item.getPubDate());
            rawNews.setSource(item.getSource());
            rawNews.setCollectedAt(java.time.OffsetDateTime.now());
            if (item.getNewsdeskDate() != null) {
                rawNews.setNewsdeskDate(LocalDate.parse(item.getNewsdeskDate()));
            }
            RawNews saved = rawNewsRepository.save(rawNews);
            newsIds.add(saved.getId());
            created++;
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("created", created);
        result.put("news_ids", newsIds);
        return result;
    }

    // ──────────────────────────────────────────────
    // Upload: Coupling
    // ──────────────────────────────────────────────

    @Transactional
    public Map<String, Object> uploadCoupling(NewsDeskUploadRequest.CouplingUpload request) {
        int created = 0;
        int skipped = 0;

        for (NewsDeskUploadRequest.CouplingItem item : request.getCouplings()) {
            // Find the stock by ticker + market
            Optional<MarketStock> stockOpt = marketStockRepository
                    .findByTickerAndMarket(item.getTicker(), item.getMarket());
            if (stockOpt.isEmpty()) {
                log.warn("Stock not found: {} / {}", item.getTicker(), item.getMarket());
                skipped++;
                continue;
            }

            // Find the news
            Optional<RawNews> newsOpt = rawNewsRepository.findById(item.getNewsId());
            if (newsOpt.isEmpty()) {
                log.warn("News not found: {}", item.getNewsId());
                skipped++;
                continue;
            }

            StockNews sn = new StockNews();
            sn.setNews(newsOpt.get());
            sn.setStock(stockOpt.get());
            sn.setRelevanceScore(item.getRelevanceScore());
            sn.setCouplingReason(item.getReason());
            sn.setCoupledBy(item.getCoupledBy() != null ? item.getCoupledBy() : "ai");
            stockNewsRepository.save(sn);
            created++;
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("created", created);
        result.put("skipped", skipped);
        return result;
    }

    // ──────────────────────────────────────────────
    // Upload: Market Summary
    // ──────────────────────────────────────────────

    @Transactional
    public MarketSummaryResponse uploadMarketSummary(NewsDeskUploadRequest.MarketSummaryUpload request) {
        LocalDate date = LocalDate.parse(request.getDate());
        String market = request.getMarket().toUpperCase();

        MarketSummary summary = marketSummaryRepository
                .findBySummaryDateAndMarket(date, market)
                .orElseGet(() -> {
                    MarketSummary ms = new MarketSummary();
                    ms.setSummaryDate(date);
                    ms.setMarket(market);
                    return ms;
                });

        summary.setAiSummary(request.getAiSummary());
        MarketSummary saved = marketSummaryRepository.save(summary);
        return toSummaryResponse(saved);
    }

    // ──────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────

    private MarketSummaryResponse toSummaryResponse(MarketSummary ms) {
        return MarketSummaryResponse.builder()
                .id(ms.getId())
                .summaryDate(ms.getSummaryDate())
                .market(ms.getMarket())
                .indexValue(ms.getIndexValue())
                .indexChange(ms.getIndexChange())
                .indexChangeRate(ms.getIndexChangeRate())
                .totalVolume(ms.getTotalVolume())
                .totalTradeAmount(ms.getTotalTradeAmount())
                .advanceCount(ms.getAdvanceCount())
                .declineCount(ms.getDeclineCount())
                .unchangedCount(ms.getUnchangedCount())
                .sectorPerformance(ms.getSectorPerformance())
                .aiSummary(ms.getAiSummary())
                .build();
    }
}
