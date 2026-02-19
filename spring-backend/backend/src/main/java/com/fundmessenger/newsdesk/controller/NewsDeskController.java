package com.fundmessenger.newsdesk.controller;

import com.fundmessenger.asset.entity.AssetSnapshot;
import com.fundmessenger.asset.repository.AssetSnapshotRepository;
import com.fundmessenger.common.dto.ApiResponse;
import com.fundmessenger.common.security.UserPrincipal;
import com.fundmessenger.newsdesk.dto.*;
import com.fundmessenger.newsdesk.entity.NewsDesk;
import com.fundmessenger.newsdesk.repository.NewsDeskRepository;
import com.fundmessenger.newsdesk.service.NewsDeskV2Service;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;

@Slf4j
@RestController
@RequestMapping("/api/v1/newsdesk")
@RequiredArgsConstructor
public class NewsDeskController {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final NewsDeskRepository newsDeskRepository;
    private final AssetSnapshotRepository assetSnapshotRepository;
    private final WebClient webClient;
    private final NewsDeskV2Service newsDeskV2Service;

    // ──────────────────────────────────────────────
    // Today's newsdesk
    // ──────────────────────────────────────────────

    /**
     * GET /api/v1/newsdesk/today - Get today's newsdesk (KST date).
     */
    @GetMapping("/today")
    public ApiResponse<NewsDeskResponse> getTodayNewsDesk(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        LocalDate today = LocalDate.now(KST);
        Optional<NewsDesk> optDesk = newsDeskRepository.findByPublishDate(today);

        if (optDesk.isEmpty()) {
            return ApiResponse.success(null, "No newsdesk available for today");
        }

        return ApiResponse.success(toResponse(optDesk.get()));
    }

    // ──────────────────────────────────────────────
    // Benchmarks
    // ──────────────────────────────────────────────

    /**
     * GET /api/v1/newsdesk/benchmarks - Benchmark index data with optional period.
     * Fetches KOSPI (^KS11), NASDAQ (^IXIC), S&P500 (^GSPC) from Yahoo Finance,
     * plus fund asset snapshot data.
     */
    @GetMapping("/benchmarks")
    public ApiResponse<Map<String, Object>> getBenchmarks(
            @RequestParam(defaultValue = "1M") String period,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Map<String, Object> result = new LinkedHashMap<>();

        // Fetch benchmark data from Yahoo Finance for each index
        String[] symbols = {"^KS11", "^IXIC", "^GSPC"};
        String[] names = {"KOSPI", "NASDAQ", "S&P 500"};

        List<Map<String, Object>> benchmarks = new ArrayList<>();
        for (int i = 0; i < symbols.length; i++) {
            Map<String, Object> benchmark = fetchYahooBenchmark(symbols[i], names[i], period);
            benchmarks.add(benchmark);
        }
        result.put("benchmarks", benchmarks);

        // Fetch fund data from AssetSnapshot
        LocalDate endDate = LocalDate.now(KST);
        LocalDate startDate = calculateStartDate(endDate, period);

        List<AssetSnapshot> snapshots = assetSnapshotRepository
                .findBySnapshotDateBetweenOrderBySnapshotDateAsc(startDate, endDate);

        List<Map<String, Object>> fundData = new ArrayList<>();
        for (AssetSnapshot snap : snapshots) {
            Map<String, Object> point = new LinkedHashMap<>();
            point.put("date", snap.getSnapshotDate());
            point.put("total_krw", snap.getTotalKrw());
            point.put("realized_pnl", snap.getRealizedPnl());
            point.put("unrealized_pnl", snap.getUnrealizedPnl());
            point.put("exchange_rate", snap.getExchangeRate());
            fundData.add(point);
        }
        result.put("fund_data", fundData);

        return ApiResponse.success(result);
    }

    // ──────────────────────────────────────────────
    // History
    // ──────────────────────────────────────────────

    /**
     * GET /api/v1/newsdesk/history - Recent newsdesks (default last 7 days).
     */
    @GetMapping("/history")
    public ApiResponse<List<NewsDeskResponse>> getHistory(
            @RequestParam(defaultValue = "7") int days,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        LocalDate endDate = LocalDate.now(KST);
        LocalDate startDate = endDate.minusDays(days);

        List<NewsDesk> desks = newsDeskRepository.findByPublishDateBetween(startDate, endDate);

        // Sort by publish_date descending
        desks.sort(Comparator.comparing(NewsDesk::getPublishDate).reversed());

        List<NewsDeskResponse> responses = desks.stream()
                .map(this::toResponse)
                .toList();

        return ApiResponse.success(responses);
    }

    // ──────────────────────────────────────────────
    // By date
    // ──────────────────────────────────────────────

    /**
     * GET /api/v1/newsdesk/{targetDate} - Get newsdesk by specific date (YYYY-MM-DD).
     */
    @GetMapping("/{targetDate}")
    public ApiResponse<NewsDeskResponse> getNewsDeskByDate(
            @PathVariable LocalDate targetDate,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Optional<NewsDesk> optDesk = newsDeskRepository.findByPublishDate(targetDate);

        if (optDesk.isEmpty()) {
            return ApiResponse.success(null, "No newsdesk available for " + targetDate);
        }

        return ApiResponse.success(toResponse(optDesk.get()));
    }

    // ──────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private NewsDeskResponse toResponse(NewsDesk desk) {
        return NewsDeskResponse.builder()
                .id(desk.getId())
                .publishDate(desk.getPublishDate())
                .status(desk.getStatus())
                .columns(desk.getColumns() instanceof List ? (List<Map<String, Object>>) desk.getColumns() : null)
                .newsCards(desk.getNewsCards() instanceof List ? (List<Map<String, Object>>) desk.getNewsCards() : null)
                .keywords(desk.getKeywords() instanceof List ? (List<String>) desk.getKeywords() : null)
                .sentiment(desk.getSentiment() instanceof Map ? (Map<String, Object>) desk.getSentiment() : null)
                .topStocks(desk.getTopStocks() instanceof List ? (List<Map<String, Object>>) desk.getTopStocks() : null)
                .rawNewsCount(desk.getRawNewsCount())
                .createdAt(desk.getCreatedAt())
                .updatedAt(desk.getUpdatedAt())
                .build();
    }

    /**
     * Fetches benchmark data from Yahoo Finance v8 chart API.
     */
    private Map<String, Object> fetchYahooBenchmark(String symbol, String name, String period) {
        Map<String, Object> benchmark = new LinkedHashMap<>();
        benchmark.put("symbol", symbol);
        benchmark.put("name", name);

        try {
            String range = convertPeriodToRange(period);
            String interval = convertPeriodToInterval(period);

            String url = String.format(
                    "https://query1.finance.yahoo.com/v8/finance/chart/%s?range=%s&interval=%s",
                    symbol, range, interval
            );

            @SuppressWarnings("unchecked")
            Map<String, Object> response = webClient.get()
                    .uri(url)
                    .header("User-Agent", "Mozilla/5.0")
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (response != null) {
                benchmark.put("data", response);
            } else {
                benchmark.put("data", null);
                benchmark.put("error", "No data received");
            }
        } catch (Exception e) {
            log.warn("Failed to fetch Yahoo Finance data for {}: {}", symbol, e.getMessage());
            benchmark.put("data", null);
            benchmark.put("error", e.getMessage());
        }

        return benchmark;
    }

    private String convertPeriodToRange(String period) {
        return switch (period.toUpperCase()) {
            case "1W" -> "5d";
            case "1M" -> "1mo";
            case "3M" -> "3mo";
            case "6M" -> "6mo";
            case "1Y" -> "1y";
            case "YTD" -> "ytd";
            default -> "1mo";
        };
    }

    private String convertPeriodToInterval(String period) {
        return switch (period.toUpperCase()) {
            case "1W" -> "1d";
            case "1M", "3M" -> "1d";
            case "6M", "1Y", "YTD" -> "1wk";
            default -> "1d";
        };
    }

    // ══════════════════════════════════════════════
    // V2 APIs
    // ══════════════════════════════════════════════

    /**
     * GET /api/v1/newsdesk/v2/market-summary - Get market summary for all markets on a date.
     */
    @GetMapping("/v2/market-summary")
    public ApiResponse<List<MarketSummaryResponse>> getV2MarketSummary(
            @RequestParam(required = false) String date,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        LocalDate targetDate = date != null ? LocalDate.parse(date) : LocalDate.now(KST);
        List<MarketSummaryResponse> summaries = newsDeskV2Service.getMarketSummary(targetDate);
        return ApiResponse.success(summaries);
    }

    /**
     * GET /api/v1/newsdesk/v2/market-summary/{market} - Get market summary for a specific market.
     */
    @GetMapping("/v2/market-summary/{market}")
    public ApiResponse<MarketSummaryResponse> getV2MarketSummaryByMarket(
            @PathVariable String market,
            @RequestParam(required = false) String date,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        LocalDate targetDate = date != null ? LocalDate.parse(date) : LocalDate.now(KST);
        MarketSummaryResponse summary = newsDeskV2Service.getMarketSummaryByMarket(market, targetDate);
        return ApiResponse.success(summary);
    }

    /**
     * GET /api/v1/newsdesk/v2/heatmap/{market} - Get sector heatmap data.
     */
    @GetMapping("/v2/heatmap/{market}")
    public ApiResponse<List<Map<String, Object>>> getV2Heatmap(
            @PathVariable String market,
            @RequestParam(required = false) String date,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        LocalDate targetDate = date != null ? LocalDate.parse(date) : LocalDate.now(KST);
        List<Map<String, Object>> heatmap = newsDeskV2Service.getHeatmap(market, targetDate);
        return ApiResponse.success(heatmap);
    }

    /**
     * GET /api/v1/newsdesk/v2/stock/{ticker} - Get stock detail with today's price.
     */
    @GetMapping("/v2/stock/{ticker}")
    public ApiResponse<Map<String, Object>> getV2StockDetail(
            @PathVariable String ticker,
            @RequestParam(required = false) String date,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        LocalDate targetDate = date != null ? LocalDate.parse(date) : LocalDate.now(KST);
        Map<String, Object> detail = newsDeskV2Service.getStockDetail(ticker, targetDate);
        return ApiResponse.success(detail);
    }

    /**
     * GET /api/v1/newsdesk/v2/stock/{ticker}/news - Get news coupled to a stock.
     */
    @GetMapping("/v2/stock/{ticker}/news")
    public ApiResponse<List<StockNewsResponse>> getV2StockNews(
            @PathVariable String ticker,
            @RequestParam(required = false) String date,
            @RequestParam(defaultValue = "20") int limit,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        LocalDate targetDate = date != null ? LocalDate.parse(date) : LocalDate.now(KST);
        List<StockNewsResponse> news = newsDeskV2Service.getStockNews(ticker, targetDate, limit);
        return ApiResponse.success(news);
    }

    /**
     * POST /api/v1/newsdesk/v2/upload/news - Upload raw news from newsdesk center.
     */
    @PostMapping("/v2/upload/news")
    public ApiResponse<Map<String, Object>> uploadNews(
            @RequestBody NewsDeskUploadRequest.NewsUpload request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Map<String, Object> result = newsDeskV2Service.uploadNews(request);
        return ApiResponse.success(result, "News uploaded successfully");
    }

    /**
     * POST /api/v1/newsdesk/v2/upload/coupling - Upload news-stock coupling results.
     */
    @PostMapping("/v2/upload/coupling")
    public ApiResponse<Map<String, Object>> uploadCoupling(
            @RequestBody NewsDeskUploadRequest.CouplingUpload request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Map<String, Object> result = newsDeskV2Service.uploadCoupling(request);
        return ApiResponse.success(result, "Coupling data uploaded successfully");
    }

    /**
     * POST /api/v1/newsdesk/v2/upload/market-summary - Upload AI market summary.
     */
    @PostMapping("/v2/upload/market-summary")
    public ApiResponse<MarketSummaryResponse> uploadMarketSummary(
            @RequestBody NewsDeskUploadRequest.MarketSummaryUpload request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        MarketSummaryResponse result = newsDeskV2Service.uploadMarketSummary(request);
        return ApiResponse.success(result, "Market summary uploaded successfully");
    }

    private LocalDate calculateStartDate(LocalDate endDate, String period) {
        return switch (period.toUpperCase()) {
            case "1W" -> endDate.minusWeeks(1);
            case "1M" -> endDate.minusMonths(1);
            case "3M" -> endDate.minusMonths(3);
            case "6M" -> endDate.minusMonths(6);
            case "1Y" -> endDate.minusYears(1);
            case "YTD" -> endDate.withDayOfYear(1);
            default -> endDate.minusMonths(1);
        };
    }
}
