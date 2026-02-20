package com.fundmessenger.newsdesk.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fundmessenger.common.config.AppProperties;
import com.fundmessenger.newsdesk.entity.RawNews;
import com.fundmessenger.newsdesk.repository.RawNewsRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.regex.Pattern;

@Slf4j
@Service
public class NewsCollectorService {

    private static final String MARKETAUX_BASE_URL = "https://api.marketaux.com/v1/news/all";
    private static final String CRYPTOCOMPARE_BASE_URL = "https://min-api.cryptocompare.com/data/v2/news/";
    private static final String NAVER_BASE_URL = "https://openapi.naver.com/v1/search/news.json";

    private static final String MARKETAUX_INDUSTRIES = String.join(",",
            "Technology", "Financial Services", "Healthcare",
            "Energy", "Industrials", "Consumer Cyclical",
            "Basic Materials", "Communication Services",
            "Real Estate", "Utilities"
    );

    private static final List<String> NAVER_QUERIES = List.of(
            "증시 코스피 코스닥",
            "금리 환율 경제",
            "반도체 AI 엔비디아",
            "전기차 배터리 2차전지",
            "바이오 신약 제약",
            "부동산 아파트 분양",
            "원전 에너지 방산",
            "IPO 공모주 M&A"
    );

    private static final int MARKETAUX_LIMIT = 3;
    private static final int MARKETAUX_MAX_REQUESTS = 90;

    private static final Pattern HTML_TAG_PATTERN = Pattern.compile("<[^>]+>");

    private final AppProperties appProperties;
    private final RawNewsRepository rawNewsRepository;
    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    public NewsCollectorService(AppProperties appProperties,
                                RawNewsRepository rawNewsRepository,
                                WebClient.Builder webClientBuilder,
                                ObjectMapper objectMapper) {
        this.appProperties = appProperties;
        this.rawNewsRepository = rawNewsRepository;
        this.webClient = webClientBuilder
                .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(4 * 1024 * 1024))
                .build();
        this.objectMapper = objectMapper;
    }

    // ──────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────

    @Transactional
    public List<RawNews> collectAll(LocalDate targetDate) {
        Set<String> seenUrls = new HashSet<>();
        List<RawNews> allArticles = new ArrayList<>();

        // MarketAux
        try {
            List<RawNews> marketauxArticles = collectMarketaux(targetDate, seenUrls);
            allArticles.addAll(marketauxArticles);
            log.info("[Collector] MarketAux: {} articles collected", marketauxArticles.size());
        } catch (Exception e) {
            log.error("[Collector] MarketAux collection failed: {}", e.getMessage(), e);
        }

        // CryptoCompare
        try {
            List<RawNews> cryptoArticles = collectCrypto(targetDate, seenUrls);
            allArticles.addAll(cryptoArticles);
            log.info("[Collector] CryptoCompare: {} articles collected", cryptoArticles.size());
        } catch (Exception e) {
            log.error("[Collector] CryptoCompare collection failed: {}", e.getMessage(), e);
        }

        // Naver
        try {
            List<RawNews> naverArticles = collectNaver(targetDate, seenUrls);
            allArticles.addAll(naverArticles);
            log.info("[Collector] Naver: {} articles collected", naverArticles.size());
        } catch (Exception e) {
            log.error("[Collector] Naver collection failed: {}", e.getMessage(), e);
        }

        // Save all at once
        List<RawNews> saved = rawNewsRepository.saveAll(allArticles);
        log.info("[Collector] Total saved: {} articles for date {}", saved.size(), targetDate);
        return saved;
    }

    // ──────────────────────────────────────────────
    // MarketAux
    // ──────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private List<RawNews> collectMarketaux(LocalDate targetDate, Set<String> seenUrls) {
        String apiKey = appProperties.getMarketaux().getApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("[MarketAux] API key not configured, skipping");
            return List.of();
        }

        List<RawNews> articles = new ArrayList<>();
        int requestsUsed = 0;
        int page = 1;
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);

        while (requestsUsed < MARKETAUX_MAX_REQUESTS) {
            try {
                final int currentPage = page;
                Map<String, Object> response = webClient.get()
                        .uri(uriBuilder -> uriBuilder
                                .scheme("https")
                                .host("api.marketaux.com")
                                .path("/v1/news/all")
                                .queryParam("api_token", apiKey)
                                .queryParam("published_on", targetDate.toString())
                                .queryParam("language", "en")
                                .queryParam("must_have_entities", "true")
                                .queryParam("entity_types", "equity,index,etf")
                                .queryParam("industries", MARKETAUX_INDUSTRIES)
                                .queryParam("group_similar", "true")
                                .queryParam("sort", "entity_match_score")
                                .queryParam("sort_order", "desc")
                                .queryParam("limit", MARKETAUX_LIMIT)
                                .queryParam("page", currentPage)
                                .build())
                        .retrieve()
                        .bodyToMono(Map.class)
                        .block(Duration.ofSeconds(30));
                requestsUsed++;

                if (response == null) {
                    break;
                }

                List<Map<String, Object>> items = (List<Map<String, Object>>) response.get("data");
                if (items == null || items.isEmpty()) {
                    break;
                }

                for (Map<String, Object> item : items) {
                    String url = (String) item.get("url");
                    if (url == null || url.isBlank() || seenUrls.contains(url)) {
                        continue;
                    }
                    seenUrls.add(url);

                    RawNews rawNews = new RawNews();
                    rawNews.setSource("marketaux");
                    rawNews.setTitle(truncate((String) item.get("title"), 500));
                    rawNews.setDescription((String) item.get("description"));
                    rawNews.setLink(truncate(url, 1000));
                    rawNews.setPubDate(parseMarketauxDate((String) item.get("published_at")));
                    rawNews.setCollectedAt(now);
                    rawNews.setNewsdeskDate(targetDate);
                    rawNews.setLanguage("en");
                    rawNews.setCouplingStatus("uncoupled");
                    rawNews.setKeywords(extractMarketauxEntities(item));

                    articles.add(rawNews);
                }

                Map<String, Object> meta = (Map<String, Object>) response.get("meta");
                if (meta != null) {
                    int returned = toInt(meta.get("returned"));
                    int found = toInt(meta.get("found"));
                    if (returned < MARKETAUX_LIMIT || (page * MARKETAUX_LIMIT) >= found) {
                        break;
                    }
                } else {
                    break;
                }

                page++;

            } catch (WebClientResponseException e) {
                if (e.getStatusCode().value() == 429) {
                    log.warn("[MarketAux] Rate limit hit at {} requests", requestsUsed);
                } else {
                    log.error("[MarketAux] HTTP error {}: {}", e.getStatusCode().value(), e.getMessage());
                }
                break;
            } catch (Exception e) {
                log.error("[MarketAux] Error on page {}: {}", page, e.getMessage());
                break;
            }
        }

        log.info("[MarketAux] {} articles, {} API requests used", articles.size(), requestsUsed);
        return articles;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> extractMarketauxEntities(Map<String, Object> article) {
        List<Map<String, Object>> entityList = (List<Map<String, Object>>) article.get("entities");
        if (entityList == null || entityList.isEmpty()) {
            return null;
        }

        Map<String, Object> result = new LinkedHashMap<>();
        List<Map<String, Object>> tickers = new ArrayList<>();
        Set<String> industries = new LinkedHashSet<>();

        for (Map<String, Object> ent : entityList) {
            String symbol = (String) ent.get("symbol");
            if (symbol != null && !symbol.isBlank()) {
                Map<String, Object> ticker = new LinkedHashMap<>();
                ticker.put("symbol", symbol);
                ticker.put("name", ent.getOrDefault("name", ""));
                ticker.put("type", ent.getOrDefault("type", ""));
                ticker.put("industry", ent.getOrDefault("industry", ""));
                ticker.put("match_score", ent.get("match_score"));
                tickers.add(ticker);
            }
            String industry = (String) ent.get("industry");
            if (industry != null && !industry.isBlank()) {
                industries.add(industry);
            }
        }

        if (!tickers.isEmpty()) {
            result.put("tickers", tickers);
        }
        if (!industries.isEmpty()) {
            result.put("industries", new ArrayList<>(industries));
        }

        return result.isEmpty() ? null : result;
    }

    private OffsetDateTime parseMarketauxDate(String dateStr) {
        if (dateStr == null || dateStr.isBlank()) {
            return null;
        }
        try {
            // MarketAux returns ISO format like "2026-02-20T10:30:00.000Z"
            String normalized = dateStr.replace("Z", "+00:00");
            return OffsetDateTime.parse(normalized, DateTimeFormatter.ISO_OFFSET_DATE_TIME);
        } catch (DateTimeParseException e) {
            try {
                return OffsetDateTime.parse(dateStr);
            } catch (DateTimeParseException e2) {
                log.debug("[MarketAux] Failed to parse date: {}", dateStr);
                return null;
            }
        }
    }

    // ──────────────────────────────────────────────
    // CryptoCompare
    // ──────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private List<RawNews> collectCrypto(LocalDate targetDate, Set<String> seenUrls) {
        List<RawNews> articles = new ArrayList<>();
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);

        Instant dayStart = targetDate.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant dayEnd = targetDate.atTime(LocalTime.MAX).atZone(ZoneOffset.UTC).toInstant();
        long lTs = dayEnd.getEpochSecond();

        for (int loop = 0; loop < 3; loop++) {
            try {
                final long currentLts = lTs;
                Map<String, Object> response = webClient.get()
                        .uri(uriBuilder -> uriBuilder
                                .scheme("https")
                                .host("min-api.cryptocompare.com")
                                .path("/data/v2/news/")
                                .queryParam("lang", "EN")
                                .queryParam("lTs", currentLts)
                                .build())
                        .retrieve()
                        .bodyToMono(Map.class)
                        .block(Duration.ofSeconds(15));

                if (response == null) {
                    break;
                }

                List<Map<String, Object>> items = (List<Map<String, Object>>) response.get("Data");
                if (items == null || items.isEmpty()) {
                    break;
                }

                long oldestTs = lTs;

                for (Map<String, Object> item : items) {
                    long pubTs = toLong(item.get("published_on"));
                    Instant pubInstant = Instant.ofEpochSecond(pubTs);

                    if (pubInstant.isBefore(dayStart)) {
                        oldestTs = Math.min(oldestTs, pubTs);
                        continue;
                    }
                    if (pubInstant.isAfter(dayEnd)) {
                        continue;
                    }

                    String url = (String) item.get("guid");
                    if (url == null || url.isBlank()) {
                        url = (String) item.get("url");
                    }
                    if (url == null || url.isBlank() || seenUrls.contains(url)) {
                        continue;
                    }
                    seenUrls.add(url);

                    OffsetDateTime pubDate = pubInstant.atOffset(ZoneOffset.UTC);

                    // Extract tags
                    String tagsStr = (String) item.get("tags");
                    List<String> tags = (tagsStr != null && !tagsStr.isBlank())
                            ? Arrays.asList(tagsStr.split("\\|"))
                            : List.of();

                    // Build keywords JSONB
                    Map<String, Object> keywords = new LinkedHashMap<>();
                    keywords.put("categories", item.getOrDefault("categories", ""));
                    keywords.put("tags", tags);

                    // Extract source_info name
                    String mediaName = null;
                    Object sourceInfo = item.get("source_info");
                    if (sourceInfo instanceof Map) {
                        mediaName = (String) ((Map<String, Object>) sourceInfo).get("name");
                    }

                    RawNews rawNews = new RawNews();
                    rawNews.setSource("crypto");
                    rawNews.setTitle(truncate((String) item.get("title"), 500));
                    rawNews.setDescription((String) item.get("body"));
                    rawNews.setLink(truncate(url, 1000));
                    rawNews.setPubDate(pubDate);
                    rawNews.setCollectedAt(now);
                    rawNews.setNewsdeskDate(targetDate);
                    rawNews.setLanguage("en");
                    rawNews.setCouplingStatus("uncoupled");
                    rawNews.setKeywords(keywords);
                    rawNews.setMediaName(mediaName);

                    articles.add(rawNews);
                    oldestTs = Math.min(oldestTs, pubTs);
                }

                // Stop if we've gone past the target date or no progress
                if (oldestTs >= lTs) {
                    break;
                }
                Instant oldestInstant = Instant.ofEpochSecond(oldestTs);
                if (oldestInstant.isBefore(dayStart)) {
                    break;
                }
                lTs = oldestTs;

            } catch (Exception e) {
                log.error("[CryptoCompare] Error: {}", e.getMessage());
                break;
            }
        }

        return articles;
    }

    // ──────────────────────────────────────────────
    // Naver
    // ──────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private List<RawNews> collectNaver(LocalDate targetDate, Set<String> seenUrls) {
        String clientId = appProperties.getNaver().getClientId();
        String clientSecret = appProperties.getNaver().getClientSecret();

        if (clientId == null || clientId.isBlank() || clientSecret == null || clientSecret.isBlank()) {
            log.warn("[Naver] API credentials not configured, skipping");
            return List.of();
        }

        List<RawNews> articles = new ArrayList<>();
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);

        for (String query : NAVER_QUERIES) {
            try {
                Map<String, Object> response = webClient.get()
                        .uri(uriBuilder -> uriBuilder
                                .scheme("https")
                                .host("openapi.naver.com")
                                .path("/v1/search/news.json")
                                .queryParam("query", query)
                                .queryParam("display", 100)
                                .queryParam("sort", "date")
                                .build())
                        .header("X-Naver-Client-Id", clientId)
                        .header("X-Naver-Client-Secret", clientSecret)
                        .retrieve()
                        .bodyToMono(Map.class)
                        .block(Duration.ofSeconds(10));

                if (response == null) {
                    continue;
                }

                List<Map<String, Object>> items = (List<Map<String, Object>>) response.get("items");
                if (items == null) {
                    continue;
                }

                for (Map<String, Object> item : items) {
                    String link = (String) item.get("originallink");
                    if (link == null || link.isBlank()) {
                        link = (String) item.get("link");
                    }
                    if (link == null || link.isBlank() || seenUrls.contains(link)) {
                        continue;
                    }

                    // Parse pubDate and filter by target date
                    String pubDateStr = (String) item.get("pubDate");
                    OffsetDateTime pubDate = parseNaverDate(pubDateStr);
                    if (pubDate == null) {
                        continue;
                    }
                    if (!pubDate.toLocalDate().equals(targetDate)) {
                        continue;
                    }

                    seenUrls.add(link);

                    RawNews rawNews = new RawNews();
                    rawNews.setSource("naver");
                    rawNews.setTitle(truncate(cleanHtml((String) item.get("title")), 500));
                    rawNews.setDescription(cleanHtml((String) item.get("description")));
                    rawNews.setLink(truncate(link, 1000));
                    rawNews.setPubDate(pubDate);
                    rawNews.setCollectedAt(now);
                    rawNews.setNewsdeskDate(targetDate);
                    rawNews.setLanguage("ko");
                    rawNews.setCouplingStatus("uncoupled");

                    articles.add(rawNews);
                }

            } catch (Exception e) {
                log.error("[Naver] Error for query '{}': {}", query, e.getMessage());
            }
        }

        return articles;
    }

    /**
     * Parse Naver's RFC 1123 / RFC 822 date format.
     * Example: "Fri, 20 Feb 2026 09:30:00 +0900"
     */
    private OffsetDateTime parseNaverDate(String dateStr) {
        if (dateStr == null || dateStr.isBlank()) {
            return null;
        }
        try {
            return OffsetDateTime.parse(dateStr, DateTimeFormatter.RFC_1123_DATE_TIME);
        } catch (DateTimeParseException e) {
            log.debug("[Naver] Failed to parse date: {}", dateStr);
            return null;
        }
    }

    // ──────────────────────────────────────────────
    // Utility methods
    // ──────────────────────────────────────────────

    /**
     * Remove HTML tags and unescape HTML entities from text.
     */
    private String cleanHtml(String text) {
        if (text == null || text.isBlank()) {
            return "";
        }
        // Remove HTML tags
        String cleaned = HTML_TAG_PATTERN.matcher(text).replaceAll("");
        // Unescape common HTML entities
        cleaned = cleaned.replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", "\"")
                .replace("&#39;", "'")
                .replace("&apos;", "'")
                .replace("&nbsp;", " ");
        return cleaned.trim();
    }

    /**
     * Truncate string to maxLength if it exceeds.
     */
    private String truncate(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        return value.length() > maxLength ? value.substring(0, maxLength) : value;
    }

    /**
     * Safely convert an Object to int (handles Integer, Long, Number, String).
     */
    private int toInt(Object value) {
        if (value == null) return 0;
        if (value instanceof Number) return ((Number) value).intValue();
        try {
            return Integer.parseInt(value.toString());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    /**
     * Safely convert an Object to long (handles Integer, Long, Number, String).
     */
    private long toLong(Object value) {
        if (value == null) return 0L;
        if (value instanceof Number) return ((Number) value).longValue();
        try {
            return Long.parseLong(value.toString());
        } catch (NumberFormatException e) {
            return 0L;
        }
    }
}
