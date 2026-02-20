package com.fundmessenger.newsdesk.service;

import com.fundmessenger.newsdesk.entity.RawNews;
import com.fundmessenger.newsdesk.repository.RawNewsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class NewsDeskPipelineService {

    private final NewsCollectorService newsCollectorService;
    private final RewriterService rewriterService;
    private final CouplingService couplingService;
    private final MarketSummaryService marketSummaryService;
    private final RawNewsRepository rawNewsRepository;

    public record PipelineResult(
            int collected,
            int rewritten,
            int couplings,
            int uniqueStocks,
            int marketSummaries,
            long durationMs,
            String error
    ) {
        static PipelineResult success(int collected, int rewritten, int couplings, int uniqueStocks, int marketSummaries, long durationMs) {
            return new PipelineResult(collected, rewritten, couplings, uniqueStocks, marketSummaries, durationMs, null);
        }

        static PipelineResult failure(String error, long durationMs) {
            return new PipelineResult(0, 0, 0, 0, 0, durationMs, error);
        }
    }

    /**
     * Run the full newsdesk pipeline for a target date.
     *
     * @param targetDate  the date to collect/process news for
     * @param skipCollect if true, skip news collection and use existing data from DB
     */
    public PipelineResult runPipeline(LocalDate targetDate, boolean skipCollect) {
        long startTime = System.currentTimeMillis();
        log.info("========================================");
        log.info("[Pipeline] Starting for date: {} (skipCollect={})", targetDate, skipCollect);
        log.info("========================================");

        try {
            // ── Step 1: Collect ──
            List<RawNews> articles;
            if (skipCollect) {
                articles = rawNewsRepository.findByNewsdeskDate(targetDate);
                log.info("[Pipeline] Step 1/4 SKIP - Using {} existing articles from DB", articles.size());
            } else {
                log.info("[Pipeline] Step 1/4 - Collecting news...");
                articles = newsCollectorService.collectAll(targetDate);
                log.info("[Pipeline] Step 1/4 DONE - Collected {} articles", articles.size());
            }

            if (articles.isEmpty()) {
                log.warn("[Pipeline] No articles found, aborting pipeline");
                return PipelineResult.success(0, 0, 0, 0, 0, elapsed(startTime));
            }

            // ── Step 2: Rewrite ──
            log.info("[Pipeline] Step 2/4 - Rewriting {} articles...", articles.size());
            int rewritten = rewriterService.rewriteAll(articles);
            log.info("[Pipeline] Step 2/4 DONE - Rewritten {}/{}", rewritten, articles.size());

            // Reload articles after rewrite (titles/descriptions updated)
            articles = rawNewsRepository.findByNewsdeskDate(targetDate);

            // ── Step 3: Coupling ──
            log.info("[Pipeline] Step 3/4 - Coupling {} articles with stocks...", articles.size());
            CouplingService.CouplingResult couplingResult = couplingService.coupleAll(articles);
            log.info("[Pipeline] Step 3/4 DONE - {} couplings, {} unique stocks",
                    couplingResult.totalCouplings(), couplingResult.uniqueStocks());

            // ── Step 4: Market Summary ──
            log.info("[Pipeline] Step 4/4 - Generating market summaries...");
            int summaries = marketSummaryService.generateSummaries(targetDate);
            log.info("[Pipeline] Step 4/4 DONE - {} market summaries generated", summaries);

            long duration = elapsed(startTime);
            log.info("========================================");
            log.info("[Pipeline] COMPLETED in {}s", duration / 1000);
            log.info("[Pipeline] Results: {} collected, {} rewritten, {} couplings, {} stocks, {} summaries",
                    articles.size(), rewritten, couplingResult.totalCouplings(),
                    couplingResult.uniqueStocks(), summaries);
            log.info("========================================");

            return PipelineResult.success(
                    articles.size(), rewritten,
                    couplingResult.totalCouplings(), couplingResult.uniqueStocks(),
                    summaries, duration
            );

        } catch (Exception e) {
            long duration = elapsed(startTime);
            log.error("[Pipeline] FAILED after {}s: {}", duration / 1000, e.getMessage(), e);
            return PipelineResult.failure(e.getMessage(), duration);
        }
    }

    /**
     * Run pipeline asynchronously.
     */
    @Async
    public void runPipelineAsync(LocalDate targetDate, boolean skipCollect) {
        runPipeline(targetDate, skipCollect);
    }

    private long elapsed(long startTime) {
        return System.currentTimeMillis() - startTime;
    }
}
