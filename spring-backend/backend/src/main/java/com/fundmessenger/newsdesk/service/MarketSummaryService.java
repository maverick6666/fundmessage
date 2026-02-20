package com.fundmessenger.newsdesk.service;

import com.fundmessenger.newsdesk.entity.MarketSummary;
import com.fundmessenger.newsdesk.entity.StockNews;
import com.fundmessenger.newsdesk.repository.MarketSummaryRepository;
import com.fundmessenger.newsdesk.repository.StockNewsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class MarketSummaryService {

    private final CerebrasClient cerebrasClient;
    private final StockNewsRepository stockNewsRepository;
    private final MarketSummaryRepository marketSummaryRepository;

    private static final int MIN_STOCKS_PER_MARKET = 2;
    private static final int MAX_STOCKS_PER_MARKET = 15;
    private static final double TEMPERATURE = 0.3;

    private static final String SYSTEM_PROMPT = """
            You are a senior financial market analyst writing a daily market briefing for Korean investors.

            Given today's news-stock coupling data, write a comprehensive market summary.

            Your summary must:
            1. Start with the overall market tone (1 sentence)
            2. Highlight top 3-5 key themes/events with specific stock impacts
            3. Note sector trends (which sectors are hot/cold)
            4. End with a forward-looking remark

            IMPORTANT:
            - Write entirely in Korean
            - Be specific with company names, tickers, percentages
            - Keep it concise but informative (3-5 paragraphs)
            - Focus on actionable insights for investors""";

    private static final Map<String, Object> JSON_SCHEMA = buildJsonSchema();

    // ──────────────────────────────────────────────
    // Inner record for stock aggregation
    // ──────────────────────────────────────────────

    private record StockAggregate(
            String ticker,
            String tickerName,
            String market,
            int newsCount,
            int totalScore,
            List<NewsRef> newsRefs
    ) {
        int averageScore() {
            return newsCount > 0 ? totalScore / newsCount : 0;
        }
    }

    private record NewsRef(long newsId, String title, int score, String reason) {}

    // ──────────────────────────────────────────────
    // Main method
    // ──────────────────────────────────────────────

    @Transactional
    @SuppressWarnings("unchecked")
    public int generateSummaries(LocalDate targetDate) {
        // Query all StockNews for the target date
        List<StockNews> allCouplings = stockNewsRepository.findByNewsNewsdeskDate(targetDate);
        if (allCouplings.isEmpty()) {
            log.info("[MarketSummary] No coupling data for {}", targetDate);
            return 0;
        }

        log.info("[MarketSummary] Found {} couplings for {}", allCouplings.size(), targetDate);

        // Aggregate by market -> ticker
        Map<String, Map<String, StockAggregate>> marketStocks = aggregateByMarket(allCouplings);

        int generated = 0;

        for (Map.Entry<String, Map<String, StockAggregate>> entry : marketStocks.entrySet()) {
            String market = entry.getKey();
            Map<String, StockAggregate> stocks = entry.getValue();

            if (stocks.size() < MIN_STOCKS_PER_MARKET) {
                log.info("[MarketSummary] Skipping {} ({} stocks < {})", market, stocks.size(), MIN_STOCKS_PER_MARKET);
                continue;
            }

            log.info("[MarketSummary] Generating {} summary ({} stocks)...", market, stocks.size());

            try {
                Map<String, Object> summaryData = generateMarketSummary(market, stocks);

                // Save to DB
                MarketSummary summary = marketSummaryRepository
                        .findBySummaryDateAndMarket(targetDate, market)
                        .orElseGet(() -> {
                            MarketSummary s = new MarketSummary();
                            s.setSummaryDate(targetDate);
                            s.setMarket(market);
                            return s;
                        });

                summary.setAiSummary((String) summaryData.get("summary"));

                // Store themes in sectorPerformance as JSONB
                List<Map<String, Object>> themes = (List<Map<String, Object>>) summaryData.get("top_themes");
                List<String> hotSectors = (List<String>) summaryData.get("hot_sectors");
                List<String> coldSectors = (List<String>) summaryData.get("cold_sectors");

                List<Map<String, Object>> sectorData = new ArrayList<>();
                if (themes != null) {
                    Map<String, Object> themesEntry = new LinkedHashMap<>();
                    themesEntry.put("type", "themes");
                    themesEntry.put("data", themes);
                    sectorData.add(themesEntry);
                }
                if (hotSectors != null && !hotSectors.isEmpty()) {
                    Map<String, Object> hotEntry = new LinkedHashMap<>();
                    hotEntry.put("type", "hot_sectors");
                    hotEntry.put("data", hotSectors);
                    sectorData.add(hotEntry);
                }
                if (coldSectors != null && !coldSectors.isEmpty()) {
                    Map<String, Object> coldEntry = new LinkedHashMap<>();
                    coldEntry.put("type", "cold_sectors");
                    coldEntry.put("data", coldSectors);
                    sectorData.add(coldEntry);
                }
                summary.setSectorPerformance(sectorData);

                marketSummaryRepository.save(summary);
                generated++;
                log.info("[MarketSummary] {} summary saved", market);

            } catch (Exception e) {
                log.error("[MarketSummary] Failed to generate {} summary: {}", market, e.getMessage(), e);
            }
        }

        log.info("[MarketSummary] Generated {} market summaries for {}", generated, targetDate);
        return generated;
    }

    // ──────────────────────────────────────────────
    // Aggregation
    // ──────────────────────────────────────────────

    private Map<String, Map<String, StockAggregate>> aggregateByMarket(List<StockNews> couplings) {
        Map<String, Map<String, List<StockNews>>> grouped = new LinkedHashMap<>();

        for (StockNews sn : couplings) {
            String market = sn.getStock().getMarket();
            String ticker = sn.getStock().getTicker();
            grouped.computeIfAbsent(market, k -> new LinkedHashMap<>())
                    .computeIfAbsent(ticker, k -> new ArrayList<>())
                    .add(sn);
        }

        Map<String, Map<String, StockAggregate>> result = new LinkedHashMap<>();

        for (Map.Entry<String, Map<String, List<StockNews>>> marketEntry : grouped.entrySet()) {
            String market = marketEntry.getKey();
            Map<String, StockAggregate> stockAggregates = new LinkedHashMap<>();

            for (Map.Entry<String, List<StockNews>> tickerEntry : marketEntry.getValue().entrySet()) {
                String ticker = tickerEntry.getKey();
                List<StockNews> stockNewsList = tickerEntry.getValue();

                List<NewsRef> newsRefs = new ArrayList<>();
                int totalScore = 0;

                for (StockNews sn : stockNewsList) {
                    int score = sn.getRelevanceScore().intValue();
                    totalScore += score;
                    newsRefs.add(new NewsRef(
                            sn.getNews().getId(),
                            sn.getNews().getTitle(),
                            score,
                            sn.getCouplingReason()
                    ));
                }

                // Sort news by score descending
                newsRefs.sort(Comparator.comparingInt(NewsRef::score).reversed());

                String tickerName = stockNewsList.get(0).getStock().getTickerName();
                stockAggregates.put(ticker, new StockAggregate(
                        ticker, tickerName, market,
                        stockNewsList.size(), totalScore, newsRefs
                ));
            }

            result.put(market, stockAggregates);
        }

        return result;
    }

    // ──────────────────────────────────────────────
    // AI summary generation
    // ──────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Map<String, Object> generateMarketSummary(String market, Map<String, StockAggregate> stocks) {
        String context = buildContext(market, stocks);

        String prompt = String.format("""
                오늘 %s 시장의 뉴스-종목 커플링 분석 결과입니다:

                %s

                위 데이터를 바탕으로 %s 시장의 일일 브리핑을 작성하세요.""",
                market, context, market);

        Object result = cerebrasClient.generate(prompt, SYSTEM_PROMPT, JSON_SCHEMA, TEMPERATURE);

        if (result instanceof Map<?, ?> responseMap) {
            if (responseMap.containsKey("error")) {
                throw new RuntimeException("AI summary error: " + responseMap.get("error"));
            }
            return (Map<String, Object>) result;
        }

        throw new RuntimeException("Unexpected response type: " + (result != null ? result.getClass() : "null"));
    }

    private String buildContext(String market, Map<String, StockAggregate> stocks) {
        // Sort by totalScore descending, take top MAX_STOCKS_PER_MARKET
        List<StockAggregate> sorted = stocks.values().stream()
                .sorted(Comparator.comparingInt(StockAggregate::totalScore).reversed())
                .limit(MAX_STOCKS_PER_MARKET)
                .toList();

        StringBuilder sb = new StringBuilder();

        for (StockAggregate stock : sorted) {
            sb.append(String.format("\n### %s (%s)\n", stock.tickerName(), stock.ticker()));
            sb.append(String.format("  뉴스 %d건, 평균점수 %d\n", stock.newsCount(), stock.averageScore()));

            // Top 3 news refs
            for (int i = 0; i < Math.min(3, stock.newsRefs().size()); i++) {
                NewsRef ref = stock.newsRefs().get(i);
                sb.append(String.format("  - [%d점] %s\n", ref.score(), ref.title()));
                sb.append(String.format("    -> %s\n", ref.reason()));
            }
        }

        return sb.toString();
    }

    // ──────────────────────────────────────────────
    // JSON schema
    // ──────────────────────────────────────────────

    private static Map<String, Object> buildJsonSchema() {
        // Theme item
        Map<String, Object> themeProperties = new LinkedHashMap<>();
        themeProperties.put("theme", Map.of("type", "string"));
        themeProperties.put("impact", Map.of("type", "string", "enum", List.of("positive", "negative", "mixed")));
        themeProperties.put("tickers", Map.of("type", "array", "items", Map.of("type", "string")));

        Map<String, Object> themeItem = new LinkedHashMap<>();
        themeItem.put("type", "object");
        themeItem.put("properties", themeProperties);
        themeItem.put("required", List.of("theme", "impact", "tickers"));
        themeItem.put("additionalProperties", false);

        // Root properties
        Map<String, Object> rootProperties = new LinkedHashMap<>();
        rootProperties.put("summary", Map.of("type", "string"));
        rootProperties.put("top_themes", Map.of("type", "array", "items", themeItem));
        rootProperties.put("hot_sectors", Map.of("type", "array", "items", Map.of("type", "string")));
        rootProperties.put("cold_sectors", Map.of("type", "array", "items", Map.of("type", "string")));

        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object");
        schema.put("properties", rootProperties);
        schema.put("required", List.of("summary", "top_themes", "hot_sectors", "cold_sectors"));
        schema.put("additionalProperties", false);

        return schema;
    }
}
