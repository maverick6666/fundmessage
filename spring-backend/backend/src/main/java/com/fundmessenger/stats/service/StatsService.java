package com.fundmessenger.stats.service;

import com.fundmessenger.attendance.repository.AttendanceRepository;
import com.fundmessenger.asset.repository.AssetSnapshotRepository;
import com.fundmessenger.position.entity.Position;
import com.fundmessenger.position.repository.PositionRepository;
import com.fundmessenger.user.entity.User;
import com.fundmessenger.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class StatsService {

    private final PositionRepository positionRepository;
    private final UserRepository userRepository;
    private final AttendanceRepository attendanceRepository;
    private final AssetSnapshotRepository assetSnapshotRepository;
    private final WebClient webClient;

    /**
     * Get statistics for a specific user.
     */
    public Map<String, Object> getUserStats(Long userId) {
        List<Position> allPositions = positionRepository.findByOpenerId(userId);
        List<Position> openPositions = allPositions.stream()
                .filter(p -> "open".equals(p.getStatus()))
                .toList();
        List<Position> closedPositions = allPositions.stream()
                .filter(p -> "closed".equals(p.getStatus()))
                .toList();

        long winCount = closedPositions.stream()
                .filter(p -> p.getProfitRate() != null && p.getProfitRate().compareTo(BigDecimal.ZERO) > 0)
                .count();
        long lossCount = closedPositions.stream()
                .filter(p -> p.getProfitRate() != null && p.getProfitRate().compareTo(BigDecimal.ZERO) <= 0)
                .count();

        BigDecimal totalProfitRate = BigDecimal.ZERO;
        if (!closedPositions.isEmpty()) {
            BigDecimal sum = closedPositions.stream()
                    .map(p -> p.getProfitRate() != null ? p.getProfitRate() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            totalProfitRate = sum.divide(BigDecimal.valueOf(closedPositions.size()), 4, RoundingMode.HALF_UP);
        }

        BigDecimal totalBuyAmount = allPositions.stream()
                .map(p -> p.getTotalBuyAmount() != null ? p.getTotalBuyAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        double winRate = closedPositions.isEmpty() ? 0.0
                : (double) winCount / closedPositions.size() * 100;

        double attendanceRate = calculateAttendanceRate(userId);

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("total_positions", allPositions.size());
        stats.put("open_positions", openPositions.size());
        stats.put("closed_positions", closedPositions.size());
        stats.put("total_profit_rate", totalProfitRate);
        stats.put("win_count", winCount);
        stats.put("loss_count", lossCount);
        stats.put("win_rate", BigDecimal.valueOf(winRate).setScale(2, RoundingMode.HALF_UP));
        stats.put("total_buy_amount", totalBuyAmount);
        stats.put("attendance_rate", BigDecimal.valueOf(attendanceRate).setScale(2, RoundingMode.HALF_UP));
        return stats;
    }

    /**
     * Get team-wide statistics.
     */
    public Map<String, Object> getTeamStats() {
        List<Position> allPositions = positionRepository.findAll();
        List<Position> openPositions = allPositions.stream()
                .filter(p -> "open".equals(p.getStatus()))
                .toList();
        List<Position> closedPositions = allPositions.stream()
                .filter(p -> "closed".equals(p.getStatus()))
                .toList();

        BigDecimal avgProfitRate = BigDecimal.ZERO;
        BigDecimal totalProfitAmount = BigDecimal.ZERO;
        if (!closedPositions.isEmpty()) {
            BigDecimal sumRate = closedPositions.stream()
                    .map(p -> p.getProfitRate() != null ? p.getProfitRate() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            avgProfitRate = sumRate.divide(BigDecimal.valueOf(closedPositions.size()), 4, RoundingMode.HALF_UP);

            totalProfitAmount = closedPositions.stream()
                    .map(p -> p.getProfitLoss() != null ? p.getProfitLoss() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
        }

        BigDecimal totalInvestment = allPositions.stream()
                .map(p -> p.getTotalBuyAmount() != null ? p.getTotalBuyAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        long totalMembers = userRepository.countByIsActiveTrue();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("total_positions", allPositions.size());
        stats.put("open_positions", openPositions.size());
        stats.put("closed_positions", closedPositions.size());
        stats.put("avg_profit_rate", avgProfitRate);
        stats.put("total_profit_amount", totalProfitAmount);
        stats.put("total_investment", totalInvestment);
        stats.put("total_members", totalMembers);
        return stats;
    }

    /**
     * Get current USD/KRW exchange rate.
     * Falls back to a default value if the external API call fails.
     */
    public Map<String, Object> getExchangeRate() {
        Map<String, Object> result = new LinkedHashMap<>();
        try {
            String url = "https://open.er-api.com/v6/latest/USD";
            Map<?, ?> response = webClient.get()
                    .uri(url)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (response != null && "success".equals(response.get("result"))) {
                @SuppressWarnings("unchecked")
                Map<String, Object> rates = (Map<String, Object>) response.get("rates");
                if (rates != null && rates.containsKey("KRW")) {
                    Object krwRate = rates.get("KRW");
                    result.put("usd_to_krw", krwRate);
                    result.put("source", "open.er-api.com");
                    return result;
                }
            }
        } catch (Exception e) {
            log.warn("Failed to fetch exchange rate from external API: {}", e.getMessage());
        }

        // Fallback
        result.put("usd_to_krw", 1350.0);
        result.put("source", "fallback");
        return result;
    }

    /**
     * Get team ranking sorted by profit rate.
     */
    public List<Map<String, Object>> getTeamRanking() {
        List<User> activeUsers = userRepository.findByIsActiveTrue();
        List<Position> allPositions = positionRepository.findAll();

        // Group closed positions by opener
        Map<Long, List<Position>> closedByUser = allPositions.stream()
                .filter(p -> "closed".equals(p.getStatus()) && p.getOpener() != null)
                .collect(Collectors.groupingBy(p -> p.getOpener().getId()));

        List<Map<String, Object>> rankings = new ArrayList<>();

        for (User user : activeUsers) {
            List<Position> userClosed = closedByUser.getOrDefault(user.getId(), List.of());
            int tradeCount = userClosed.size();

            BigDecimal avgProfitRate = BigDecimal.ZERO;
            long winCount = 0;
            double winRate = 0.0;

            if (!userClosed.isEmpty()) {
                BigDecimal sumRate = userClosed.stream()
                        .map(p -> p.getProfitRate() != null ? p.getProfitRate() : BigDecimal.ZERO)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                avgProfitRate = sumRate.divide(BigDecimal.valueOf(tradeCount), 4, RoundingMode.HALF_UP);

                winCount = userClosed.stream()
                        .filter(p -> p.getProfitRate() != null && p.getProfitRate().compareTo(BigDecimal.ZERO) > 0)
                        .count();
                winRate = (double) winCount / tradeCount * 100;
            }

            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("user_id", user.getId());
            entry.put("username", user.getUsername());
            entry.put("full_name", user.getFullName());
            entry.put("profit_rate", avgProfitRate);
            entry.put("win_rate", BigDecimal.valueOf(winRate).setScale(2, RoundingMode.HALF_UP));
            entry.put("win_count", winCount);
            entry.put("trade_count", tradeCount);
            rankings.add(entry);
        }

        // Sort by profit_rate descending
        rankings.sort((a, b) -> {
            BigDecimal rateA = (BigDecimal) a.get("profit_rate");
            BigDecimal rateB = (BigDecimal) b.get("profit_rate");
            return rateB.compareTo(rateA);
        });

        // Add rank
        for (int i = 0; i < rankings.size(); i++) {
            rankings.get(i).put("rank", i + 1);
        }

        return rankings;
    }

    /**
     * Calculate attendance rate for a user over the last 30 weekdays.
     */
    private double calculateAttendanceRate(Long userId) {
        LocalDate today = LocalDate.now();
        LocalDate start = today.minusDays(30);

        // Count weekdays in range
        long weekdays = 0;
        LocalDate d = start;
        while (!d.isAfter(today)) {
            DayOfWeek dow = d.getDayOfWeek();
            if (dow != DayOfWeek.SATURDAY && dow != DayOfWeek.SUNDAY) {
                weekdays++;
            }
            d = d.plusDays(1);
        }
        if (weekdays == 0) {
            return 100.0;
        }

        // Count attendance records for this user in range
        var attendances = attendanceRepository.findByUserIdOrderByDateDesc(userId);
        long attended = attendances.stream()
                .filter(a -> !a.getDate().isBefore(start) && !a.getDate().isAfter(today))
                .count();

        return (double) attended / weekdays * 100;
    }
}
