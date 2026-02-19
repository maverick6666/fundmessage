package com.fundmessenger.price.service;

import com.fundmessenger.position.entity.Position;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class PriceService {

    private final WebClient webClient;
    private final StockSearchService stockSearchService;

    // Simple cache: key -> {data, timestamp}
    private final ConcurrentHashMap<String, CacheEntry> cache = new ConcurrentHashMap<>();
    private static final long CACHE_TTL_MS = 60_000; // 1 minute

    // ──────────────────────────────────────────────
    // Quote
    // ──────────────────────────────────────────────

    /**
     * Get a price quote for a ticker.
     * Routes to Yahoo Finance or Binance depending on the market.
     */
    public Map<String, Object> getQuote(String ticker, String market) {
        String cacheKey = "quote:" + ticker + ":" + market;
        Map<String, Object> cached = getFromCache(cacheKey);
        if (cached != null) {
            return cached;
        }

        Map<String, Object> result;
        String marketLower = market != null ? market.toLowerCase() : "";

        if ("crypto".equals(marketLower)) {
            result = getBinanceQuote(ticker);
        } else {
            String symbol = toYahooSymbol(ticker, marketLower);
            result = getYahooQuote(symbol);
        }

        result.put("ticker", ticker);
        result.put("market", market);
        putInCache(cacheKey, result);
        return result;
    }

    // ──────────────────────────────────────────────
    // Candles
    // ──────────────────────────────────────────────

    /**
     * Get candle (OHLCV) data for a ticker.
     * @param before Unix timestamp — return only candles before this time (for lazy loading)
     */
    public List<Map<String, Object>> getCandles(String ticker, String market, String interval, int count, Long before) {
        String cacheKey = "candles:" + ticker + ":" + market + ":" + interval + ":" + count + ":" + before;
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> cached = (List<Map<String, Object>>) getFromCacheRaw(cacheKey);
        if (cached != null) {
            return cached;
        }

        List<Map<String, Object>> result;
        String marketLower = market != null ? market.toLowerCase() : "";

        if ("crypto".equals(marketLower)) {
            result = getBinanceCandles(ticker, interval, count);
        } else {
            String symbol = toYahooSymbol(ticker, marketLower);
            result = getYahooCandles(symbol, interval, count);
        }

        // Filter by before timestamp if specified
        if (before != null && !result.isEmpty()) {
            result = result.stream()
                    .filter(c -> {
                        Object time = c.get("time");
                        return time instanceof Number && ((Number) time).longValue() < before;
                    })
                    .toList();
        }

        putInCacheRaw(cacheKey, result);
        return result;
    }

    // ──────────────────────────────────────────────
    // Search
    // ──────────────────────────────────────────────

    /**
     * Delegates to StockSearchService.
     */
    public List<Map<String, Object>> searchStocks(String query, String market, int limit) {
        return stockSearchService.searchStocks(query, market, limit);
    }

    // ──────────────────────────────────────────────
    // Positions with prices
    // ──────────────────────────────────────────────

    /**
     * Fetch current prices for a list of positions and attach them.
     */
    public List<Map<String, Object>> getPositionsWithPrices(List<Position> positions) {
        List<Map<String, Object>> result = new ArrayList<>();

        for (Position pos : positions) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("id", pos.getId());
            entry.put("ticker", pos.getTicker());
            entry.put("ticker_name", pos.getTickerName());
            entry.put("market", pos.getMarket());
            entry.put("status", pos.getStatus());
            entry.put("average_buy_price", pos.getAverageBuyPrice());
            entry.put("total_quantity", pos.getTotalQuantity());
            entry.put("total_buy_amount", pos.getTotalBuyAmount());

            try {
                Map<String, Object> quote = getQuote(pos.getTicker(), pos.getMarket());
                entry.put("current_price", quote.get("price"));
                entry.put("change_percent", quote.get("change_percent"));
            } catch (Exception e) {
                log.warn("Failed to fetch price for {}: {}", pos.getTicker(), e.getMessage());
                entry.put("current_price", null);
                entry.put("change_percent", null);
            }

            result.add(entry);
        }

        return result;
    }

    // ──────────────────────────────────────────────
    // Yahoo Finance
    // ──────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Map<String, Object> getYahooQuote(String symbol) {
        Map<String, Object> result = new LinkedHashMap<>();
        try {
            String url = "https://query1.finance.yahoo.com/v8/finance/chart/" + symbol
                    + "?interval=1d&range=1d";

            Map<?, ?> response = webClient.get()
                    .uri(url)
                    .header("User-Agent", "Mozilla/5.0")
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (response != null) {
                Map<String, Object> chart = (Map<String, Object>) response.get("chart");
                if (chart != null) {
                    List<Map<String, Object>> resultList = (List<Map<String, Object>>) chart.get("result");
                    if (resultList != null && !resultList.isEmpty()) {
                        Map<String, Object> firstResult = resultList.get(0);
                        Map<String, Object> meta = (Map<String, Object>) firstResult.get("meta");
                        if (meta != null) {
                            result.put("price", meta.get("regularMarketPrice"));
                            result.put("previous_close", meta.get("previousClose"));
                            result.put("currency", meta.get("currency"));
                            result.put("exchange", meta.get("exchangeName"));
                            result.put("symbol", meta.get("symbol"));

                            Object price = meta.get("regularMarketPrice");
                            Object prevClose = meta.get("previousClose");
                            if (price instanceof Number && prevClose instanceof Number) {
                                double p = ((Number) price).doubleValue();
                                double pc = ((Number) prevClose).doubleValue();
                                if (pc != 0) {
                                    double changePct = (p - pc) / pc * 100;
                                    result.put("change_percent", Math.round(changePct * 100.0) / 100.0);
                                    result.put("change", Math.round((p - pc) * 100.0) / 100.0);
                                }
                            }
                        }
                    }
                }
            }
        } catch (WebClientResponseException e) {
            log.warn("Yahoo Finance API error for {}: {} {}", symbol, e.getStatusCode(), e.getMessage());
            result.put("error", "Failed to fetch quote from Yahoo Finance");
        } catch (Exception e) {
            log.warn("Yahoo Finance error for {}: {}", symbol, e.getMessage());
            result.put("error", "Failed to fetch quote");
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> getYahooCandles(String symbol, String interval, int count) {
        List<Map<String, Object>> candles = new ArrayList<>();
        try {
            // Map interval to Yahoo Finance format
            String yahooInterval = mapToYahooInterval(interval);
            String range = mapCountToRange(interval, count);

            String url = "https://query1.finance.yahoo.com/v8/finance/chart/" + symbol
                    + "?interval=" + yahooInterval + "&range=" + range;

            Map<?, ?> response = webClient.get()
                    .uri(url)
                    .header("User-Agent", "Mozilla/5.0")
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (response != null) {
                Map<String, Object> chart = (Map<String, Object>) response.get("chart");
                if (chart != null) {
                    List<Map<String, Object>> resultList = (List<Map<String, Object>>) chart.get("result");
                    if (resultList != null && !resultList.isEmpty()) {
                        Map<String, Object> firstResult = resultList.get(0);
                        List<Number> timestamps = (List<Number>) firstResult.get("timestamp");
                        Map<String, Object> indicators = (Map<String, Object>) firstResult.get("indicators");

                        if (timestamps != null && indicators != null) {
                            List<Map<String, Object>> quoteList = (List<Map<String, Object>>) indicators.get("quote");
                            if (quoteList != null && !quoteList.isEmpty()) {
                                Map<String, Object> quote = quoteList.get(0);
                                List<Number> opens = (List<Number>) quote.get("open");
                                List<Number> highs = (List<Number>) quote.get("high");
                                List<Number> lows = (List<Number>) quote.get("low");
                                List<Number> closes = (List<Number>) quote.get("close");
                                List<Number> volumes = (List<Number>) quote.get("volume");

                                int size = Math.min(timestamps.size(), count);
                                int startIdx = Math.max(0, timestamps.size() - size);

                                for (int i = startIdx; i < timestamps.size(); i++) {
                                    Map<String, Object> candle = new LinkedHashMap<>();
                                    candle.put("time", timestamps.get(i) != null ? timestamps.get(i).longValue() : null);
                                    candle.put("open", opens != null && i < opens.size() ? opens.get(i) : null);
                                    candle.put("high", highs != null && i < highs.size() ? highs.get(i) : null);
                                    candle.put("low", lows != null && i < lows.size() ? lows.get(i) : null);
                                    candle.put("close", closes != null && i < closes.size() ? closes.get(i) : null);
                                    candle.put("volume", volumes != null && i < volumes.size() ? volumes.get(i) : null);
                                    candles.add(candle);
                                }
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Yahoo Finance candles error for {}: {}", symbol, e.getMessage());
        }
        return candles;
    }

    // ──────────────────────────────────────────────
    // Binance
    // ──────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Map<String, Object> getBinanceQuote(String ticker) {
        Map<String, Object> result = new LinkedHashMap<>();
        try {
            String symbol = ticker.toUpperCase();
            if (!symbol.endsWith("USDT")) {
                symbol = symbol + "USDT";
            }

            // Get 24hr ticker for price + change info
            String url = "https://api.binance.com/api/v3/ticker/24hr?symbol=" + symbol;

            Map<?, ?> response = webClient.get()
                    .uri(url)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (response != null) {
                result.put("price", parseDouble(response.get("lastPrice")));
                result.put("change", parseDouble(response.get("priceChange")));
                result.put("change_percent", parseDouble(response.get("priceChangePercent")));
                result.put("high_24h", parseDouble(response.get("highPrice")));
                result.put("low_24h", parseDouble(response.get("lowPrice")));
                result.put("volume_24h", parseDouble(response.get("volume")));
                result.put("symbol", response.get("symbol"));
                result.put("currency", "USDT");
            }
        } catch (WebClientResponseException e) {
            log.warn("Binance API error for {}: {} {}", ticker, e.getStatusCode(), e.getMessage());
            result.put("error", "Failed to fetch quote from Binance");
        } catch (Exception e) {
            log.warn("Binance error for {}: {}", ticker, e.getMessage());
            result.put("error", "Failed to fetch quote");
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> getBinanceCandles(String ticker, String interval, int count) {
        List<Map<String, Object>> candles = new ArrayList<>();
        try {
            String symbol = ticker.toUpperCase();
            if (!symbol.endsWith("USDT")) {
                symbol = symbol + "USDT";
            }

            String binanceInterval = mapToBinanceInterval(interval);
            String url = "https://api.binance.com/api/v3/klines?symbol=" + symbol
                    + "&interval=" + binanceInterval + "&limit=" + count;

            List<?> response = webClient.get()
                    .uri(url)
                    .retrieve()
                    .bodyToMono(List.class)
                    .block();

            if (response != null) {
                for (Object item : response) {
                    if (item instanceof List) {
                        List<Object> kline = (List<Object>) item;
                        if (kline.size() >= 6) {
                            Map<String, Object> candle = new LinkedHashMap<>();
                            candle.put("time", kline.get(0) instanceof Number
                                    ? ((Number) kline.get(0)).longValue() / 1000 : null);
                            candle.put("open", parseDouble(kline.get(1)));
                            candle.put("high", parseDouble(kline.get(2)));
                            candle.put("low", parseDouble(kline.get(3)));
                            candle.put("close", parseDouble(kline.get(4)));
                            candle.put("volume", parseDouble(kline.get(5)));
                            candles.add(candle);
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Binance candles error for {}: {}", ticker, e.getMessage());
        }
        return candles;
    }

    // ──────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────

    /**
     * Convert a ticker + market to a Yahoo Finance symbol.
     * Korean stocks: KOSPI -> .KS suffix, KOSDAQ -> .KQ suffix.
     */
    private String toYahooSymbol(String ticker, String market) {
        if ("kospi".equals(market)) {
            return ticker + ".KS";
        } else if ("kosdaq".equals(market)) {
            return ticker + ".KQ";
        }
        // US stocks, etc. - use ticker as-is
        return ticker;
    }

    /**
     * Map a generic interval string to Yahoo Finance interval format.
     */
    private String mapToYahooInterval(String interval) {
        if (interval == null) return "1d";
        return switch (interval.toLowerCase()) {
            case "1m" -> "1m";
            case "5m" -> "5m";
            case "15m" -> "15m";
            case "30m" -> "30m";
            case "1h", "60m" -> "1h";
            case "4h" -> "1h";  // Yahoo doesn't support 4h natively
            case "1d", "d", "daily" -> "1d";
            case "1w", "w", "weekly" -> "1wk";
            case "1mo", "mo", "monthly" -> "1mo";
            default -> "1d";
        };
    }

    /**
     * Map a generic interval string to Binance kline interval format.
     */
    private String mapToBinanceInterval(String interval) {
        if (interval == null) return "1d";
        return switch (interval.toLowerCase()) {
            case "1m" -> "1m";
            case "5m" -> "5m";
            case "15m" -> "15m";
            case "30m" -> "30m";
            case "1h", "60m" -> "1h";
            case "4h" -> "4h";
            case "1d", "d", "daily" -> "1d";
            case "1w", "w", "weekly" -> "1w";
            case "1mo", "mo", "monthly" -> "1M";
            default -> "1d";
        };
    }

    /**
     * Map interval + count to a Yahoo Finance range string.
     */
    private String mapCountToRange(String interval, int count) {
        if (interval == null) interval = "1d";
        return switch (interval.toLowerCase()) {
            case "1m", "5m" -> count <= 60 ? "1d" : "5d";
            case "15m", "30m" -> count <= 100 ? "5d" : "1mo";
            case "1h", "60m", "4h" -> count <= 168 ? "1mo" : "6mo";
            case "1d", "d", "daily" -> count <= 30 ? "1mo" : count <= 180 ? "6mo" : count <= 365 ? "1y" : "5y";
            case "1w", "w", "weekly" -> count <= 52 ? "1y" : "5y";
            case "1mo", "mo", "monthly" -> count <= 60 ? "5y" : "max";
            default -> "6mo";
        };
    }

    private Double parseDouble(Object value) {
        if (value == null) return null;
        if (value instanceof Number) return ((Number) value).doubleValue();
        try {
            return Double.parseDouble(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    // ──────────────────────────────────────────────
    // Cache
    // ──────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Map<String, Object> getFromCache(String key) {
        CacheEntry entry = cache.get(key);
        if (entry != null && !entry.isExpired()) {
            return (Map<String, Object>) entry.data;
        }
        if (entry != null) {
            cache.remove(key);
        }
        return null;
    }

    private Object getFromCacheRaw(String key) {
        CacheEntry entry = cache.get(key);
        if (entry != null && !entry.isExpired()) {
            return entry.data;
        }
        if (entry != null) {
            cache.remove(key);
        }
        return null;
    }

    private void putInCache(String key, Map<String, Object> data) {
        cache.put(key, new CacheEntry(data));
    }

    private void putInCacheRaw(String key, Object data) {
        cache.put(key, new CacheEntry(data));
    }

    private static class CacheEntry {
        final Object data;
        final long timestamp;

        CacheEntry(Object data) {
            this.data = data;
            this.timestamp = System.currentTimeMillis();
        }

        boolean isExpired() {
            return System.currentTimeMillis() - timestamp > CACHE_TTL_MS;
        }
    }
}
