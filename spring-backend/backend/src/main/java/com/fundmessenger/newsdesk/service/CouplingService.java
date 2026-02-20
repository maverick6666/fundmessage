package com.fundmessenger.newsdesk.service;

import com.fundmessenger.newsdesk.entity.MarketStock;
import com.fundmessenger.newsdesk.entity.RawNews;
import com.fundmessenger.newsdesk.entity.StockNews;
import com.fundmessenger.newsdesk.repository.MarketStockRepository;
import com.fundmessenger.newsdesk.repository.RawNewsRepository;
import com.fundmessenger.newsdesk.repository.StockNewsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CouplingService {

    private final CerebrasClient cerebrasClient;
    private final MarketStockRepository marketStockRepository;
    private final StockNewsRepository stockNewsRepository;
    private final RawNewsRepository rawNewsRepository;

    private static final int BATCH_SIZE = 10;
    private static final double TEMPERATURE = 0.2;
    private static final int MIN_SCORE = 30;
    private static final int MAX_CONTEXT_STOCKS = 20;
    private static final int MAX_RECENT_REASONS = 3;
    private static final int MAX_DESCRIPTION_LENGTH = 200;

    // ──────────────────────────────────────────────
    // Inner record for coupling result
    // ──────────────────────────────────────────────

    public record CouplingResult(int totalCouplings, int uniqueStocks) {}

    // ──────────────────────────────────────────────
    // Incremental stock context tracker
    // ──────────────────────────────────────────────

    private static class StockContext {
        String tickerName;
        String market;
        int newsCount;
        int totalScore;
        List<String> recentReasons;

        StockContext(String tickerName, String market) {
            this.tickerName = tickerName;
            this.market = market;
            this.newsCount = 0;
            this.totalScore = 0;
            this.recentReasons = new ArrayList<>();
        }

        void addOccurrence(int score, String reason) {
            this.newsCount++;
            this.totalScore += score;
            this.recentReasons.add(reason);
            if (this.recentReasons.size() > MAX_RECENT_REASONS) {
                this.recentReasons.remove(0);
            }
        }

        int averageScore() {
            return newsCount > 0 ? totalScore / newsCount : 0;
        }
    }

    // ──────────────────────────────────────────────
    // System prompt
    // ──────────────────────────────────────────────

    private static final String SYSTEM_PROMPT = """
            You are an expert financial analyst specializing in news-stock coupling.

            Your task: Given rewritten news articles, identify ALL related stocks and assign relevance scores.

            Scoring criteria (EMA-inspired):
            - Score range: 0 to 100
            - Direct mention of a company = 80-100
            - Competitor/supply chain impact = 50-79
            - Sector/industry trend impact = 30-49
            - Below 30 = too weak, do NOT include
            - RECENCY MATTERS: weigh recent events more heavily
            - ACCUMULATION: if a stock appears in multiple news items, consider cumulative significance

            For each stock:
            - ticker: Stock code (6-digit for Korean like 005930, symbol for US like AAPL, crypto like BTC)
            - ticker_name: Full name in Korean if Korean stock, English otherwise
            - market: KOSPI, KOSDAQ, NASDAQ, SP500, or CRYPTO
            - score: Relevance score (integer, 0-100)
            - reason: Brief Korean explanation

            IMPORTANT:
            - Include both directly mentioned AND indirectly affected stocks
            - For Korean news, identify Korean stock codes accurately
            - Consider upstream/downstream relationships
            - Write ALL reasons in Korean
            - Respond ONLY in the required JSON format.""";

    // ──────────────────────────────────────────────
    // JSON schema for structured output
    // ──────────────────────────────────────────────

    private static Map<String, Object> buildJsonSchema() {
        Map<String, Object> stockProperties = new LinkedHashMap<>();
        stockProperties.put("ticker", Map.of("type", "string"));
        stockProperties.put("ticker_name", Map.of("type", "string"));
        stockProperties.put("market", Map.of("type", "string"));
        stockProperties.put("score", Map.of("type", "integer"));
        stockProperties.put("reason", Map.of("type", "string"));

        Map<String, Object> stockItem = new LinkedHashMap<>();
        stockItem.put("type", "object");
        stockItem.put("properties", stockProperties);
        stockItem.put("required", List.of("ticker", "ticker_name", "market", "score", "reason"));
        stockItem.put("additionalProperties", false);

        Map<String, Object> couplingProperties = new LinkedHashMap<>();
        couplingProperties.put("news_id", Map.of("type", "integer"));
        couplingProperties.put("stocks", Map.of("type", "array", "items", stockItem));

        Map<String, Object> couplingItem = new LinkedHashMap<>();
        couplingItem.put("type", "object");
        couplingItem.put("properties", couplingProperties);
        couplingItem.put("required", List.of("news_id", "stocks"));
        couplingItem.put("additionalProperties", false);

        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object");
        schema.put("properties", Map.of(
                "couplings", Map.of("type", "array", "items", couplingItem)
        ));
        schema.put("required", List.of("couplings"));
        schema.put("additionalProperties", false);

        return schema;
    }

    // ──────────────────────────────────────────────
    // Main coupling method
    // ──────────────────────────────────────────────

    @Transactional
    @SuppressWarnings("unchecked")
    public CouplingResult coupleAll(List<RawNews> articles) {
        if (articles == null || articles.isEmpty()) {
            log.info("[Coupling] No articles to couple");
            return new CouplingResult(0, 0);
        }

        log.info("[Coupling] Starting coupling for {} articles", articles.size());

        Map<String, StockContext> contextMap = new LinkedHashMap<>();
        Map<String, Object> jsonSchema = buildJsonSchema();
        int totalCouplings = 0;
        Set<String> uniqueStockKeys = new HashSet<>();

        // Process in batches
        for (int i = 0; i < articles.size(); i += BATCH_SIZE) {
            int end = Math.min(i + BATCH_SIZE, articles.size());
            List<RawNews> batch = articles.subList(i, end);
            int batchNum = (i / BATCH_SIZE) + 1;
            int totalBatches = (int) Math.ceil((double) articles.size() / BATCH_SIZE);

            log.info("[Coupling] Processing batch {}/{} ({} articles)", batchNum, totalBatches, batch.size());

            // Build prompt with incremental context
            String prompt = buildPrompt(batch, contextMap);

            try {
                Object response = cerebrasClient.generate(prompt, SYSTEM_PROMPT, jsonSchema, TEMPERATURE);

                if (response instanceof Map<?, ?> responseMap) {
                    // Check for error
                    if (responseMap.containsKey("error")) {
                        log.error("[Coupling] AI returned error: {}", responseMap.get("error"));
                        continue;
                    }

                    List<Map<String, Object>> couplings =
                            (List<Map<String, Object>>) responseMap.get("couplings");

                    if (couplings == null) {
                        log.warn("[Coupling] No couplings in response for batch {}", batchNum);
                        continue;
                    }

                    // Process each coupling entry
                    for (Map<String, Object> coupling : couplings) {
                        Number newsIdNum = (Number) coupling.get("news_id");
                        if (newsIdNum == null) continue;
                        long newsId = newsIdNum.longValue();

                        List<Map<String, Object>> stocks =
                                (List<Map<String, Object>>) coupling.get("stocks");
                        if (stocks == null) continue;

                        // Find the corresponding RawNews from batch
                        RawNews rawNews = batch.stream()
                                .filter(a -> a.getId() != null && a.getId().equals(newsId))
                                .findFirst()
                                .orElse(null);

                        if (rawNews == null) {
                            log.warn("[Coupling] News ID {} not found in batch, skipping", newsId);
                            continue;
                        }

                        for (Map<String, Object> stockData : stocks) {
                            String ticker = (String) stockData.get("ticker");
                            String tickerName = (String) stockData.get("ticker_name");
                            String market = (String) stockData.get("market");
                            Number scoreNum = (Number) stockData.get("score");
                            String reason = (String) stockData.get("reason");

                            if (ticker == null || market == null || scoreNum == null) continue;

                            int score = scoreNum.intValue();

                            // Filter out low scores
                            if (score < MIN_SCORE) continue;

                            // Update incremental context
                            String contextKey = ticker + "/" + market;
                            contextMap.computeIfAbsent(contextKey,
                                    k -> new StockContext(tickerName, market));
                            contextMap.get(contextKey).addOccurrence(score, reason);

                            // Persist: find or create MarketStock
                            MarketStock marketStock = marketStockRepository
                                    .findByTickerAndMarket(ticker, market)
                                    .orElseGet(() -> {
                                        MarketStock newStock = new MarketStock();
                                        newStock.setTicker(ticker);
                                        newStock.setTickerName(tickerName != null ? tickerName : ticker);
                                        newStock.setMarket(market);
                                        newStock.setIsActive(true);
                                        log.info("[Coupling] Created new MarketStock: {} ({}/{})",
                                                tickerName, ticker, market);
                                        return marketStockRepository.save(newStock);
                                    });

                            // Create StockNews linking RawNews <-> MarketStock
                            StockNews stockNews = new StockNews();
                            stockNews.setNews(rawNews);
                            stockNews.setStock(marketStock);
                            stockNews.setRelevanceScore(BigDecimal.valueOf(score));
                            stockNews.setCouplingReason(reason);
                            stockNews.setCoupledBy("ai");
                            stockNewsRepository.save(stockNews);

                            totalCouplings++;
                            uniqueStockKeys.add(contextKey);
                        }

                        // Update RawNews coupling status
                        rawNews.setCouplingStatus("coupled");
                        rawNewsRepository.save(rawNews);
                    }

                    log.info("[Coupling] Batch {}/{} done: {} couplings so far, {} unique stocks",
                            batchNum, totalBatches, totalCouplings, uniqueStockKeys.size());

                } else {
                    log.warn("[Coupling] Unexpected response type from Cerebras: {}",
                            response != null ? response.getClass().getSimpleName() : "null");
                }

            } catch (Exception e) {
                log.error("[Coupling] Error processing batch {}/{}: {}", batchNum, totalBatches, e.getMessage(), e);
                // Mark articles in failed batch as uncoupled so they can be retried
                for (RawNews article : batch) {
                    if (!"coupled".equals(article.getCouplingStatus())) {
                        article.setCouplingStatus("failed");
                        rawNewsRepository.save(article);
                    }
                }
            }
        }

        log.info("[Coupling] Completed: {} total couplings, {} unique stocks",
                totalCouplings, uniqueStockKeys.size());

        return new CouplingResult(totalCouplings, uniqueStockKeys.size());
    }

    // ──────────────────────────────────────────────
    // Prompt building
    // ──────────────────────────────────────────────

    private String buildPrompt(List<RawNews> batch, Map<String, StockContext> contextMap) {
        StringBuilder sb = new StringBuilder();

        sb.append(String.format("다음 %d개의 뉴스 기사에서 관련 종목을 식별하고 관련도 점수를 매기세요.\n\n", batch.size()));

        // Incremental context: top 20 stocks by (newsCount DESC, totalScore DESC)
        if (!contextMap.isEmpty()) {
            sb.append(buildContextString(contextMap));
            sb.append("\n");
        }

        // News articles
        sb.append("뉴스 기사:\n");
        for (RawNews article : batch) {
            sb.append(String.format("[ID:%d] %s\n", article.getId(), article.getTitle()));
            if (article.getDescription() != null && !article.getDescription().isBlank()) {
                String desc = article.getDescription();
                if (desc.length() > MAX_DESCRIPTION_LENGTH) {
                    desc = desc.substring(0, MAX_DESCRIPTION_LENGTH) + "...";
                }
                sb.append(String.format("  > %s\n", desc));
            }
            sb.append("\n");
        }

        sb.append("위 뉴스 각각에 대해 관련 종목을 매핑하세요.\n");
        sb.append("이미 여러 뉴스에서 언급된 종목은 누적 맥락을 고려하여 점수를 매기세요.");

        return sb.toString();
    }

    private String buildContextString(Map<String, StockContext> contextMap) {
        // Sort by newsCount DESC, then totalScore DESC; take top 20
        List<Map.Entry<String, StockContext>> sorted = contextMap.entrySet().stream()
                .sorted(Comparator
                        .<Map.Entry<String, StockContext>>comparingInt(e -> e.getValue().newsCount)
                        .reversed()
                        .thenComparing(Comparator
                                .<Map.Entry<String, StockContext>>comparingInt(e -> e.getValue().totalScore)
                                .reversed()))
                .limit(MAX_CONTEXT_STOCKS)
                .collect(Collectors.toList());

        StringBuilder sb = new StringBuilder();
        sb.append("현재까지 식별된 종목 컨텍스트:\n");

        for (Map.Entry<String, StockContext> entry : sorted) {
            String key = entry.getKey(); // "ticker/market"
            StockContext ctx = entry.getValue();
            String[] parts = key.split("/", 2);
            String ticker = parts[0];
            String market = parts.length > 1 ? parts[1] : ctx.market;

            sb.append(String.format("  %s (%s/%s): %d건, 평균 %d점\n",
                    ctx.tickerName, ticker, market, ctx.newsCount, ctx.averageScore()));
        }

        return sb.toString();
    }
}
