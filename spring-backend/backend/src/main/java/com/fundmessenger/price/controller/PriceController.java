package com.fundmessenger.price.controller;

import com.fundmessenger.common.dto.ApiResponse;
import com.fundmessenger.common.security.UserPrincipal;
import com.fundmessenger.position.entity.Position;
import com.fundmessenger.position.repository.PositionRepository;
import com.fundmessenger.price.service.PriceService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/prices")
@RequiredArgsConstructor
public class PriceController {

    private final PriceService priceService;
    private final PositionRepository positionRepository;

    /**
     * GET /api/v1/prices/search - Search for stocks/crypto by keyword.
     */
    @GetMapping("/search")
    public ApiResponse<List<Map<String, Object>>> searchStocks(
            @RequestParam("q") String query,
            @RequestParam(required = false, defaultValue = "") String market,
            @RequestParam(defaultValue = "20") int limit,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        List<Map<String, Object>> results = priceService.searchStocks(query, market, limit);
        return ApiResponse.success(results);
    }

    /**
     * GET /api/v1/prices/quote - Get a price quote for a ticker.
     */
    @GetMapping("/quote")
    public ApiResponse<Map<String, Object>> getQuote(
            @RequestParam String ticker,
            @RequestParam(defaultValue = "us") String market,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Map<String, Object> quote = priceService.getQuote(ticker, market);
        return ApiResponse.success(quote);
    }

    /**
     * GET /api/v1/prices/lookup - Alias for quote endpoint.
     */
    @GetMapping("/lookup")
    public ApiResponse<Map<String, Object>> lookup(
            @RequestParam String ticker,
            @RequestParam(defaultValue = "us") String market,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Map<String, Object> quote = priceService.getQuote(ticker, market);
        return ApiResponse.success(quote);
    }

    /**
     * GET /api/v1/prices/candles - Get OHLCV candle data for a ticker.
     * Frontend sends: timeframe, limit, before (Unix timestamp for lazy loading).
     */
    @GetMapping("/candles")
    public ApiResponse<List<Map<String, Object>>> getCandles(
            @RequestParam String ticker,
            @RequestParam(defaultValue = "us") String market,
            @RequestParam(defaultValue = "1d") String timeframe,
            @RequestParam(defaultValue = "300") int limit,
            @RequestParam(required = false) Long before,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        List<Map<String, Object>> candles = priceService.getCandles(ticker, market, timeframe, limit, before);
        return ApiResponse.success(candles);
    }

    /**
     * GET /api/v1/prices/positions - Get open positions with current prices.
     */
    @GetMapping("/positions")
    public ApiResponse<List<Map<String, Object>>> getPositionsWithPrices(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        List<Position> openPositions = positionRepository.findByStatus("open");
        List<Map<String, Object>> result = priceService.getPositionsWithPrices(openPositions);
        return ApiResponse.success(result);
    }
}
