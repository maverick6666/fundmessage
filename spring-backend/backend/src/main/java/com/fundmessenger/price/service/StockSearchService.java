package com.fundmessenger.price.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class StockSearchService {

    // Popular US stocks
    private static final List<StockInfo> US_STOCKS = List.of(
            new StockInfo("AAPL", "Apple Inc.", "us"),
            new StockInfo("MSFT", "Microsoft Corporation", "us"),
            new StockInfo("GOOGL", "Alphabet Inc.", "us"),
            new StockInfo("GOOG", "Alphabet Inc. Class C", "us"),
            new StockInfo("AMZN", "Amazon.com Inc.", "us"),
            new StockInfo("NVDA", "NVIDIA Corporation", "us"),
            new StockInfo("META", "Meta Platforms Inc.", "us"),
            new StockInfo("TSLA", "Tesla Inc.", "us"),
            new StockInfo("BRK.B", "Berkshire Hathaway Inc.", "us"),
            new StockInfo("JPM", "JPMorgan Chase & Co.", "us"),
            new StockInfo("V", "Visa Inc.", "us"),
            new StockInfo("JNJ", "Johnson & Johnson", "us"),
            new StockInfo("WMT", "Walmart Inc.", "us"),
            new StockInfo("PG", "Procter & Gamble Co.", "us"),
            new StockInfo("MA", "Mastercard Inc.", "us"),
            new StockInfo("UNH", "UnitedHealth Group Inc.", "us"),
            new StockInfo("HD", "Home Depot Inc.", "us"),
            new StockInfo("DIS", "Walt Disney Co.", "us"),
            new StockInfo("NFLX", "Netflix Inc.", "us"),
            new StockInfo("ADBE", "Adobe Inc.", "us"),
            new StockInfo("CRM", "Salesforce Inc.", "us"),
            new StockInfo("PYPL", "PayPal Holdings Inc.", "us"),
            new StockInfo("INTC", "Intel Corporation", "us"),
            new StockInfo("AMD", "Advanced Micro Devices Inc.", "us"),
            new StockInfo("CSCO", "Cisco Systems Inc.", "us"),
            new StockInfo("ORCL", "Oracle Corporation", "us"),
            new StockInfo("QCOM", "Qualcomm Inc.", "us"),
            new StockInfo("BA", "Boeing Co.", "us"),
            new StockInfo("GS", "Goldman Sachs Group Inc.", "us"),
            new StockInfo("SBUX", "Starbucks Corporation", "us"),
            new StockInfo("NKE", "Nike Inc.", "us"),
            new StockInfo("MCD", "McDonald's Corporation", "us"),
            new StockInfo("PFE", "Pfizer Inc.", "us"),
            new StockInfo("ABBV", "AbbVie Inc.", "us"),
            new StockInfo("AVGO", "Broadcom Inc.", "us"),
            new StockInfo("COST", "Costco Wholesale Corp.", "us"),
            new StockInfo("TMO", "Thermo Fisher Scientific", "us"),
            new StockInfo("ACN", "Accenture plc", "us"),
            new StockInfo("LLY", "Eli Lilly and Company", "us"),
            new StockInfo("COIN", "Coinbase Global Inc.", "us"),
            new StockInfo("PLTR", "Palantir Technologies Inc.", "us"),
            new StockInfo("SOFI", "SoFi Technologies Inc.", "us"),
            new StockInfo("MSTR", "MicroStrategy Inc.", "us"),
            new StockInfo("ARM", "Arm Holdings plc", "us"),
            new StockInfo("SMCI", "Super Micro Computer Inc.", "us"),
            new StockInfo("SPY", "SPDR S&P 500 ETF Trust", "us"),
            new StockInfo("QQQ", "Invesco QQQ Trust", "us"),
            new StockInfo("IWM", "iShares Russell 2000 ETF", "us"),
            new StockInfo("ARKK", "ARK Innovation ETF", "us"),
            new StockInfo("SOXL", "Direxion Semiconductor Bull 3X", "us")
    );

    // Popular Korean stocks
    private static final List<StockInfo> KR_STOCKS = List.of(
            // KOSPI
            new StockInfo("005930", "Samsung Electronics", "kospi"),
            new StockInfo("000660", "SK Hynix", "kospi"),
            new StockInfo("005380", "Hyundai Motor", "kospi"),
            new StockInfo("035420", "NAVER", "kospi"),
            new StockInfo("000270", "Kia", "kospi"),
            new StockInfo("068270", "Celltrion", "kospi"),
            new StockInfo("051910", "LG Chem", "kospi"),
            new StockInfo("006400", "Samsung SDI", "kospi"),
            new StockInfo("003670", "POSCO Holdings", "kospi"),
            new StockInfo("055550", "Shinhan Financial Group", "kospi"),
            new StockInfo("105560", "KB Financial Group", "kospi"),
            new StockInfo("012330", "Hyundai Mobis", "kospi"),
            new StockInfo("066570", "LG Electronics", "kospi"),
            new StockInfo("096770", "SK Innovation", "kospi"),
            new StockInfo("034730", "SK Inc.", "kospi"),
            new StockInfo("028260", "Samsung C&T", "kospi"),
            new StockInfo("015760", "Korea Electric Power", "kospi"),
            new StockInfo("003550", "LG Corp", "kospi"),
            new StockInfo("032830", "Samsung Life Insurance", "kospi"),
            new StockInfo("009150", "Samsung Electro-Mechanics", "kospi"),
            // KOSDAQ
            new StockInfo("247540", "Ecopro BM", "kosdaq"),
            new StockInfo("086520", "Ecopro", "kosdaq"),
            new StockInfo("263750", "Pearl Abyss", "kosdaq"),
            new StockInfo("293490", "Kakao Games", "kosdaq"),
            new StockInfo("035900", "JYP Entertainment", "kosdaq"),
            new StockInfo("041510", "SM Entertainment", "kosdaq"),
            new StockInfo("035720", "Kakao", "kosdaq"),
            new StockInfo("352820", "HYBE", "kosdaq"),
            new StockInfo("112040", "Wemade", "kosdaq"),
            new StockInfo("328130", "Lutronic", "kosdaq")
    );

    // Popular crypto
    private static final List<StockInfo> CRYPTO_LIST = List.of(
            new StockInfo("BTC", "Bitcoin", "crypto"),
            new StockInfo("ETH", "Ethereum", "crypto"),
            new StockInfo("BNB", "BNB", "crypto"),
            new StockInfo("XRP", "Ripple", "crypto"),
            new StockInfo("SOL", "Solana", "crypto"),
            new StockInfo("ADA", "Cardano", "crypto"),
            new StockInfo("DOGE", "Dogecoin", "crypto"),
            new StockInfo("AVAX", "Avalanche", "crypto"),
            new StockInfo("DOT", "Polkadot", "crypto"),
            new StockInfo("MATIC", "Polygon", "crypto"),
            new StockInfo("LINK", "Chainlink", "crypto"),
            new StockInfo("UNI", "Uniswap", "crypto"),
            new StockInfo("ATOM", "Cosmos", "crypto"),
            new StockInfo("LTC", "Litecoin", "crypto"),
            new StockInfo("FIL", "Filecoin", "crypto"),
            new StockInfo("NEAR", "NEAR Protocol", "crypto"),
            new StockInfo("APT", "Aptos", "crypto"),
            new StockInfo("ARB", "Arbitrum", "crypto"),
            new StockInfo("OP", "Optimism", "crypto"),
            new StockInfo("SUI", "Sui", "crypto"),
            new StockInfo("SEI", "Sei", "crypto"),
            new StockInfo("TIA", "Celestia", "crypto"),
            new StockInfo("PEPE", "Pepe", "crypto"),
            new StockInfo("SHIB", "Shiba Inu", "crypto"),
            new StockInfo("WIF", "dogwifhat", "crypto"),
            new StockInfo("RENDER", "Render", "crypto"),
            new StockInfo("FET", "Fetch.ai", "crypto"),
            new StockInfo("INJ", "Injective", "crypto"),
            new StockInfo("STX", "Stacks", "crypto"),
            new StockInfo("IMX", "Immutable X", "crypto")
    );

    /**
     * Search stocks by query string with simple contains/startsWith matching.
     *
     * @param query  search keyword (ticker or name)
     * @param market filter by market: "us", "kospi", "kosdaq", "crypto", or null/empty for all
     * @param limit  max results to return
     * @return list of matching stocks
     */
    public List<Map<String, Object>> searchStocks(String query, String market, int limit) {
        if (query == null || query.isBlank()) {
            return List.of();
        }

        String q = query.trim().toLowerCase();
        String marketLower = market != null ? market.toLowerCase() : "";

        // Collect candidate lists based on market filter
        List<StockInfo> candidates = new ArrayList<>();
        if (marketLower.isEmpty() || "all".equals(marketLower)) {
            candidates.addAll(US_STOCKS);
            candidates.addAll(KR_STOCKS);
            candidates.addAll(CRYPTO_LIST);
        } else if ("us".equals(marketLower)) {
            candidates.addAll(US_STOCKS);
        } else if ("kospi".equals(marketLower) || "kosdaq".equals(marketLower)) {
            candidates.addAll(KR_STOCKS.stream()
                    .filter(s -> marketLower.equals(s.market()))
                    .toList());
        } else if ("kr".equals(marketLower) || "korea".equals(marketLower)) {
            candidates.addAll(KR_STOCKS);
        } else if ("crypto".equals(marketLower)) {
            candidates.addAll(CRYPTO_LIST);
        } else {
            // Unknown market - search all
            candidates.addAll(US_STOCKS);
            candidates.addAll(KR_STOCKS);
            candidates.addAll(CRYPTO_LIST);
        }

        // Score and filter matches
        List<ScoredStock> scored = candidates.stream()
                .map(stock -> {
                    int score = calculateMatchScore(stock, q);
                    return score > 0 ? new ScoredStock(stock, score) : null;
                })
                .filter(Objects::nonNull)
                .sorted(Comparator.comparingInt(ScoredStock::score).reversed())
                .limit(limit)
                .toList();

        return scored.stream()
                .map(s -> {
                    Map<String, Object> map = new LinkedHashMap<>();
                    map.put("ticker", s.stock().ticker());
                    map.put("name", s.stock().name());
                    map.put("market", s.stock().market());
                    return map;
                })
                .collect(Collectors.toList());
    }

    /**
     * Calculate a match score for a stock against a query.
     * Higher score = better match.
     */
    private int calculateMatchScore(StockInfo stock, String query) {
        String tickerLower = stock.ticker().toLowerCase();
        String nameLower = stock.name().toLowerCase();

        // Exact ticker match
        if (tickerLower.equals(query)) {
            return 100;
        }

        // Ticker starts with query
        if (tickerLower.startsWith(query)) {
            return 80;
        }

        // Ticker contains query
        if (tickerLower.contains(query)) {
            return 60;
        }

        // Name starts with query
        if (nameLower.startsWith(query)) {
            return 50;
        }

        // Name contains query
        if (nameLower.contains(query)) {
            return 30;
        }

        // Individual words in name match
        String[] words = nameLower.split("\\s+");
        for (String word : words) {
            if (word.startsWith(query)) {
                return 40;
            }
        }

        return 0;
    }

    // Record types for internal use
    private record StockInfo(String ticker, String name, String market) {}
    private record ScoredStock(StockInfo stock, int score) {}
}
