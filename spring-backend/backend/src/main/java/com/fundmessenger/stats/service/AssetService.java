package com.fundmessenger.stats.service;

import com.fundmessenger.asset.entity.AssetSnapshot;
import com.fundmessenger.asset.repository.AssetSnapshotRepository;
import com.fundmessenger.common.exception.BusinessException;
import com.fundmessenger.common.exception.NotFoundException;
import com.fundmessenger.position.entity.Position;
import com.fundmessenger.position.repository.PositionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class AssetService {

    private final AssetSnapshotRepository assetSnapshotRepository;
    private final PositionRepository positionRepository;
    private final StatsService statsService;

    /**
     * Get asset history for the last N days.
     */
    public List<AssetSnapshot> getAssetHistory(int days) {
        LocalDate end = LocalDate.now();
        LocalDate start = end.minusDays(days);
        return assetSnapshotRepository.findBySnapshotDateBetweenOrderBySnapshotDateAsc(start, end);
    }

    /**
     * Get a single snapshot by ID.
     */
    public AssetSnapshot getSnapshotDetail(Long snapshotId) {
        return assetSnapshotRepository.findById(snapshotId)
                .orElseThrow(() -> new NotFoundException("AssetSnapshot", snapshotId));
    }

    /**
     * Get a single snapshot by date.
     */
    public AssetSnapshot getSnapshotByDate(LocalDate date) {
        return assetSnapshotRepository.findBySnapshotDate(date)
                .orElseThrow(() -> new NotFoundException("AssetSnapshot for date " + date));
    }

    /**
     * Create a new asset snapshot from current open positions.
     * Calculates total KRW and USD values based on position data.
     */
    @Transactional
    public AssetSnapshot createSnapshot(Long userId) {
        LocalDate today = LocalDate.now();

        // Check if snapshot already exists for today
        Optional<AssetSnapshot> existing = assetSnapshotRepository.findBySnapshotDate(today);
        if (existing.isPresent()) {
            throw new BusinessException("Snapshot already exists for today. Use the existing one.");
        }

        List<Position> openPositions = positionRepository.findByStatus("open");

        BigDecimal krwEvaluation = BigDecimal.ZERO;
        BigDecimal usdEvaluation = BigDecimal.ZERO;
        BigDecimal usdtEvaluation = BigDecimal.ZERO;
        List<Map<String, Object>> positionDetails = new ArrayList<>();

        for (Position pos : openPositions) {
            BigDecimal amount = pos.getTotalBuyAmount() != null ? pos.getTotalBuyAmount() : BigDecimal.ZERO;
            String market = pos.getMarket() != null ? pos.getMarket().toLowerCase() : "";

            Map<String, Object> detail = new LinkedHashMap<>();
            detail.put("position_id", pos.getId());
            detail.put("ticker", pos.getTicker());
            detail.put("ticker_name", pos.getTickerName());
            detail.put("market", pos.getMarket());
            detail.put("total_buy_amount", amount);
            detail.put("average_buy_price", pos.getAverageBuyPrice());
            detail.put("total_quantity", pos.getTotalQuantity());
            positionDetails.add(detail);

            if ("kospi".equals(market) || "kosdaq".equals(market)) {
                krwEvaluation = krwEvaluation.add(amount);
            } else if ("crypto".equals(market)) {
                usdtEvaluation = usdtEvaluation.add(amount);
            } else {
                // US stocks and others default to USD
                usdEvaluation = usdEvaluation.add(amount);
            }
        }

        // Get exchange rate for total KRW calculation
        Map<String, Object> exchangeData = statsService.getExchangeRate();
        Object rateObj = exchangeData.get("usd_to_krw");
        BigDecimal exchangeRate = rateObj instanceof Number
                ? BigDecimal.valueOf(((Number) rateObj).doubleValue())
                : BigDecimal.valueOf(1350.0);

        // Total KRW = KRW positions + (USD positions * rate) + (USDT positions * rate)
        BigDecimal totalKrw = krwEvaluation
                .add(usdEvaluation.multiply(exchangeRate))
                .add(usdtEvaluation.multiply(exchangeRate));

        AssetSnapshot snapshot = new AssetSnapshot();
        snapshot.setSnapshotDate(today);
        snapshot.setKrwCash(BigDecimal.ZERO);
        snapshot.setKrwEvaluation(krwEvaluation);
        snapshot.setUsdCash(BigDecimal.ZERO);
        snapshot.setUsdEvaluation(usdEvaluation);
        snapshot.setUsdtEvaluation(usdtEvaluation);
        snapshot.setTotalKrw(totalKrw);
        snapshot.setExchangeRate(exchangeRate);
        snapshot.setRealizedPnl(BigDecimal.ZERO);
        snapshot.setUnrealizedPnl(BigDecimal.ZERO);
        snapshot.setPositionDetails(positionDetails);
        snapshot.setCreatedAt(OffsetDateTime.now());

        AssetSnapshot saved = assetSnapshotRepository.save(snapshot);
        log.info("Created asset snapshot for {} with {} open positions", today, openPositions.size());
        return saved;
    }
}
