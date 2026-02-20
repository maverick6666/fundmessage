package com.fundmessenger.newsdesk.service;

import com.fundmessenger.newsdesk.entity.RawNews;
import com.fundmessenger.newsdesk.repository.RawNewsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class RewriterService {

    private final CerebrasClient cerebrasClient;
    private final RawNewsRepository rawNewsRepository;

    private static final int BATCH_SIZE = 10;
    private static final double TEMPERATURE = 0.4;

    private static final String SYSTEM_PROMPT = """
            You are a professional financial news editor.
            Your job is to rewrite news articles while preserving all factual information.

            Rules:
            1. COMPLETELY rephrase the sentences — different structure, different wording
            2. PRESERVE all facts: company names, stock tickers, numbers, dates, events
            3. Write a concise title (1 line) and summary (2-3 sentences)
            4. If the original is in English, rewrite in Korean
            5. If the original is in Korean, rewrite in Korean with different phrasing
            6. Remove any promotional or opinion language — keep it neutral and factual
            7. Do NOT add information that wasn't in the original

            Respond ONLY in the required JSON format.""";

    private static final Map<String, Object> JSON_SCHEMA = buildJsonSchema();

    @Transactional
    public int rewriteAll(List<RawNews> articles) {
        if (articles == null || articles.isEmpty()) {
            log.info("[Rewriter] No articles to rewrite");
            return 0;
        }

        int totalSuccess = 0;

        // Process in batches of BATCH_SIZE
        for (int i = 0; i < articles.size(); i += BATCH_SIZE) {
            int end = Math.min(i + BATCH_SIZE, articles.size());
            List<RawNews> batch = articles.subList(i, end);
            int batchNum = (i / BATCH_SIZE) + 1;
            int totalBatches = (int) Math.ceil((double) articles.size() / BATCH_SIZE);

            log.info("[Rewriter] Processing batch {}/{} ({} articles)", batchNum, totalBatches, batch.size());

            try {
                int success = processBatch(batch);
                totalSuccess += success;
                log.info("[Rewriter] Batch {}/{} completed: {}/{} articles rewritten",
                        batchNum, totalBatches, success, batch.size());
            } catch (Exception e) {
                log.error("[Rewriter] Batch {}/{} failed, skipping: {}", batchNum, totalBatches, e.getMessage(), e);
                // Skip this batch and continue with others
            }
        }

        log.info("[Rewriter] Rewrite completed: {}/{} articles total", totalSuccess, articles.size());
        return totalSuccess;
    }

    @SuppressWarnings("unchecked")
    private int processBatch(List<RawNews> batch) {
        // Build the prompt
        String prompt = buildPrompt(batch);

        // Call Cerebras AI
        Object result = cerebrasClient.generate(prompt, SYSTEM_PROMPT, JSON_SCHEMA, TEMPERATURE);

        // Parse the response
        Map<String, Object> responseMap = (Map<String, Object>) result;

        // Check for error
        if (responseMap.containsKey("error")) {
            log.warn("[Rewriter] AI returned parse error: {}", responseMap.get("error"));
            return 0;
        }

        List<Map<String, Object>> rewrittenArticles = (List<Map<String, Object>>) responseMap.get("articles");
        if (rewrittenArticles == null || rewrittenArticles.isEmpty()) {
            log.warn("[Rewriter] AI returned empty articles list");
            return 0;
        }

        // Build a lookup map from batch: id -> RawNews
        Map<Long, RawNews> articleMap = new LinkedHashMap<>();
        for (RawNews article : batch) {
            articleMap.put(article.getId(), article);
        }

        int success = 0;

        for (Map<String, Object> rewritten : rewrittenArticles) {
            try {
                // The id could come back as Integer or Long depending on Jackson parsing
                Long articleId = ((Number) rewritten.get("id")).longValue();
                String newTitle = (String) rewritten.get("title");
                String newSummary = (String) rewritten.get("summary");

                RawNews article = articleMap.get(articleId);
                if (article == null) {
                    log.warn("[Rewriter] AI returned unknown article id: {}", articleId);
                    continue;
                }

                if (newTitle == null || newTitle.isBlank() || newSummary == null || newSummary.isBlank()) {
                    log.warn("[Rewriter] AI returned empty title/summary for article id: {}", articleId);
                    continue;
                }

                // Save original title before overwriting
                article.setOriginalTitle(article.getTitle());

                // Apply rewritten content
                article.setTitle(newTitle);
                article.setDescription(newSummary);
                article.setRewritten(true);

                rawNewsRepository.save(article);
                success++;
            } catch (Exception e) {
                log.warn("[Rewriter] Failed to apply rewrite for article: {}", e.getMessage());
            }
        }

        return success;
    }

    private String buildPrompt(List<RawNews> batch) {
        StringBuilder sb = new StringBuilder();
        sb.append("다음 ").append(batch.size()).append("개의 뉴스 기사를 재작성하세요.\n");
        sb.append("각 기사의 ID를 유지하고, 새로운 제목(title)과 요약(summary)을 작성하세요.\n\n");

        for (RawNews article : batch) {
            sb.append("[ID:").append(article.getId()).append("] ");
            sb.append("(").append(article.getSource() != null ? article.getSource() : "unknown").append(")\n");
            sb.append("  제목: ").append(article.getTitle() != null ? article.getTitle() : "").append("\n");

            String desc = article.getDescription() != null ? article.getDescription() : "";
            if (desc.length() > 300) {
                desc = desc.substring(0, 300);
            }
            sb.append("  내용: ").append(desc).append("\n\n");
        }

        return sb.toString();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> buildJsonSchema() {
        // Item properties
        Map<String, Object> idProp = Map.of("type", "integer");
        Map<String, Object> titleProp = Map.of("type", "string");
        Map<String, Object> summaryProp = Map.of("type", "string");

        Map<String, Object> itemProperties = new LinkedHashMap<>();
        itemProperties.put("id", idProp);
        itemProperties.put("title", titleProp);
        itemProperties.put("summary", summaryProp);

        Map<String, Object> itemSchema = new LinkedHashMap<>();
        itemSchema.put("type", "object");
        itemSchema.put("properties", itemProperties);
        itemSchema.put("required", List.of("id", "title", "summary"));
        itemSchema.put("additionalProperties", false);

        // Articles array
        Map<String, Object> articlesProp = new LinkedHashMap<>();
        articlesProp.put("type", "array");
        articlesProp.put("items", itemSchema);

        // Root schema
        Map<String, Object> rootProperties = new LinkedHashMap<>();
        rootProperties.put("articles", articlesProp);

        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("type", "object");
        schema.put("properties", rootProperties);
        schema.put("required", List.of("articles"));
        schema.put("additionalProperties", false);

        return schema;
    }
}
