package com.fundmessenger.scheduler;

import com.fundmessenger.newsdesk.entity.NewsDesk;
import com.fundmessenger.newsdesk.repository.NewsDeskRepository;
import com.fundmessenger.stats.service.AssetService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneId;

@Slf4j
@Component
@RequiredArgsConstructor
public class ScheduledTasks {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final NewsDeskRepository newsDeskRepository;
    private final AssetService assetService;

    /**
     * NewsDesk auto-generation at 05:30 KST daily.
     * Creates a placeholder NewsDesk entry if one doesn't exist for today.
     * The actual AI generation would be triggered separately.
     */
    @Scheduled(cron = "0 30 5 * * *", zone = "Asia/Seoul")
    public void generateNewsDeskJob() {
        log.info("Starting scheduled newsdesk generation...");

        try {
            LocalDate targetDate = LocalDate.now(KST);

            // Skip if already exists and ready
            boolean exists = newsDeskRepository.findByPublishDate(targetDate)
                    .filter(desk -> "ready".equals(desk.getStatus()))
                    .isPresent();

            if (exists) {
                log.info("NewsDesk for {} already exists, skipping", targetDate);
                return;
            }

            // Create or update placeholder
            NewsDesk newsDesk = newsDeskRepository.findByPublishDate(targetDate)
                    .orElseGet(() -> {
                        NewsDesk desk = new NewsDesk();
                        desk.setPublishDate(targetDate);
                        return desk;
                    });

            newsDesk.setStatus("generating");
            newsDeskRepository.save(newsDesk);

            log.info("NewsDesk placeholder created for {}", targetDate);
            // Note: Full news crawling + AI analysis would be implemented
            // as separate services (NewsCrawlerService, NewsDeskAiService)

        } catch (Exception e) {
            log.error("Scheduled newsdesk generation failed: {}", e.getMessage(), e);
        }
    }

    /**
     * Daily asset snapshot at 09:00 KST (market open).
     */
    @Scheduled(cron = "0 0 9 * * *", zone = "Asia/Seoul")
    public void createAssetSnapshotJob() {
        log.info("Starting daily asset snapshot creation...");

        try {
            // Create snapshot without specific user context (system-level)
            assetService.createSnapshot(null);
            log.info("Asset snapshot created for {}", LocalDate.now(KST));
        } catch (Exception e) {
            log.error("Failed to create asset snapshot: {}", e.getMessage(), e);
        }
    }
}
