package com.fundmessenger.ai.service;

import com.fundmessenger.common.config.AppProperties;
import com.fundmessenger.common.exception.BusinessException;
import com.fundmessenger.common.exception.NotFoundException;
import com.fundmessenger.decision.entity.DecisionNote;
import com.fundmessenger.decision.repository.DecisionNoteRepository;
import com.fundmessenger.discussion.entity.Discussion;
import com.fundmessenger.discussion.entity.Message;
import com.fundmessenger.discussion.repository.DiscussionRepository;
import com.fundmessenger.discussion.repository.MessageRepository;
import com.fundmessenger.position.entity.Position;
import com.fundmessenger.position.entity.TeamSettings;
import com.fundmessenger.position.repository.PositionRepository;
import com.fundmessenger.position.repository.TeamSettingsRepository;
import com.fundmessenger.trading.entity.TradingPlan;
import com.fundmessenger.trading.repository.TradingPlanRepository;
import com.fundmessenger.user.entity.User;
import com.fundmessenger.user.repository.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.LocalDate;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiService {

    private final WebClient webClient;
    private final AppProperties appProperties;
    private final PositionRepository positionRepository;
    private final UserRepository userRepository;
    private final TeamSettingsRepository teamSettingsRepository;
    private final DecisionNoteRepository decisionNoteRepository;
    private final DiscussionRepository discussionRepository;
    private final MessageRepository messageRepository;
    private final TradingPlanRepository tradingPlanRepository;
    private final EntityManager entityManager;

    // ──────────────────────────────────────────────
    // Status
    // ──────────────────────────────────────────────

    /**
     * Get AI usage status for the team (daily limit and remaining uses).
     */
    public Map<String, Object> getStatus(Long userId) {
        TeamSettings settings = getTeamSettings();
        resetDailyUsageIfNeeded(settings);

        int dailyLimit = settings.getAiDailyLimit() != null ? settings.getAiDailyLimit() : 3;
        int usageCount = settings.getAiUsageCount() != null ? settings.getAiUsageCount() : 0;
        int remaining = Math.max(0, dailyLimit - usageCount);

        Map<String, Object> status = new LinkedHashMap<>();
        status.put("daily_limit", dailyLimit);
        status.put("usage_count", usageCount);
        status.put("remaining", remaining);
        status.put("reset_date", settings.getAiUsageResetDate());
        return status;
    }

    // ──────────────────────────────────────────────
    // Generate Decision Note
    // ──────────────────────────────────────────────

    /**
     * Generate an AI decision note for a position.
     */
    @Transactional
    public Map<String, Object> generateDecisionNote(Long positionId, Long userId, String verbosity) {
        Position position = positionRepository.findById(positionId)
                .orElseThrow(() -> new NotFoundException("Position", positionId));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User", userId));

        reserveUsage();

        Map<String, Object> positionData = getPositionData(positionId);
        String prompt = buildDecisionNotePrompt(positionData, verbosity);

        String aiContent = callOpenAi(prompt, "decision");

        // Save as DecisionNote
        DecisionNote note = new DecisionNote();
        note.setPosition(position);
        note.setTitle("AI Decision Note - " + position.getTicker());
        note.setContent(aiContent);
        note.setBlocks(buildBlocks(aiContent));
        note.setNoteType("decision");
        note.setAuthor(user);
        DecisionNote saved = decisionNoteRepository.save(note);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("note_id", saved.getId());
        result.put("title", saved.getTitle());
        result.put("content", aiContent);
        result.put("note_type", "decision");
        result.put("created_at", saved.getCreatedAt());
        return result;
    }

    // ──────────────────────────────────────────────
    // Generate Operation Report
    // ──────────────────────────────────────────────

    /**
     * Generate an AI operation report for a position.
     */
    @Transactional
    public Map<String, Object> generateOperationReport(Long positionId, Long userId, String verbosity) {
        Position position = positionRepository.findById(positionId)
                .orElseThrow(() -> new NotFoundException("Position", positionId));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User", userId));

        reserveUsage();

        Map<String, Object> positionData = getPositionData(positionId);
        String prompt = buildOperationReportPrompt(positionData, verbosity);

        String aiContent = callOpenAi(prompt, "report");

        // Save as DecisionNote with report type
        DecisionNote note = new DecisionNote();
        note.setPosition(position);
        note.setTitle("AI Operation Report - " + position.getTicker());
        note.setContent(aiContent);
        note.setBlocks(buildBlocks(aiContent));
        note.setNoteType("report");
        note.setAuthor(user);
        DecisionNote saved = decisionNoteRepository.save(note);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("note_id", saved.getId());
        result.put("title", saved.getTitle());
        result.put("content", aiContent);
        result.put("note_type", "report");
        result.put("created_at", saved.getCreatedAt());
        return result;
    }

    // ──────────────────────────────────────────────
    // Position Data
    // ──────────────────────────────────────────────

    /**
     * Get comprehensive position data for AI generation.
     */
    public Map<String, Object> getPositionData(Long positionId) {
        Position position = positionRepository.findById(positionId)
                .orElseThrow(() -> new NotFoundException("Position", positionId));

        // Basic position info
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("position_id", position.getId());
        data.put("ticker", position.getTicker());
        data.put("ticker_name", position.getTickerName());
        data.put("market", position.getMarket());
        data.put("status", position.getStatus());
        data.put("average_buy_price", position.getAverageBuyPrice());
        data.put("total_quantity", position.getTotalQuantity());
        data.put("total_buy_amount", position.getTotalBuyAmount());
        data.put("buy_plan", position.getBuyPlan());
        data.put("take_profit_targets", position.getTakeProfitTargets());
        data.put("stop_loss_targets", position.getStopLossTargets());
        data.put("profit_rate", position.getProfitRate());
        data.put("profit_loss", position.getProfitLoss());
        data.put("opened_at", position.getOpenedAt());
        data.put("closed_at", position.getClosedAt());

        if (position.getOpener() != null) {
            Map<String, Object> opener = new LinkedHashMap<>();
            opener.put("id", position.getOpener().getId());
            opener.put("username", position.getOpener().getUsername());
            data.put("opener", opener);
        }

        // Discussions
        List<Discussion> discussions = discussionRepository.findByPositionId(positionId);
        List<Map<String, Object>> discussionData = new ArrayList<>();
        for (Discussion disc : discussions) {
            Map<String, Object> discMap = new LinkedHashMap<>();
            discMap.put("id", disc.getId());
            discMap.put("title", disc.getTitle());
            discMap.put("status", disc.getStatus());
            discMap.put("summary", disc.getSummary());
            discMap.put("current_agenda", disc.getCurrentAgenda());

            // Messages for this discussion
            List<Message> messages = messageRepository.findByDiscussionIdOrderByCreatedAtAsc(disc.getId());
            List<Map<String, Object>> messageData = new ArrayList<>();
            for (Message msg : messages) {
                Map<String, Object> msgMap = new LinkedHashMap<>();
                msgMap.put("content", msg.getContent());
                msgMap.put("message_type", msg.getMessageType());
                msgMap.put("created_at", msg.getCreatedAt());
                if (msg.getUser() != null) {
                    msgMap.put("username", msg.getUser().getUsername());
                }
                messageData.add(msgMap);
            }
            discMap.put("messages", messageData);
            discussionData.add(discMap);
        }
        data.put("discussions", discussionData);

        // Trading plans
        List<TradingPlan> plans = tradingPlanRepository.findByPositionIdOrderByCreatedAtDesc(positionId);
        List<Map<String, Object>> planData = new ArrayList<>();
        for (TradingPlan plan : plans) {
            Map<String, Object> planMap = new LinkedHashMap<>();
            planMap.put("id", plan.getId());
            planMap.put("version", plan.getVersion());
            planMap.put("record_type", plan.getRecordType());
            planMap.put("buy_plan", plan.getBuyPlan());
            planMap.put("take_profit_targets", plan.getTakeProfitTargets());
            planMap.put("stop_loss_targets", plan.getStopLossTargets());
            planMap.put("memo", plan.getMemo());
            planMap.put("changes", plan.getChanges());
            planMap.put("plan_type", plan.getPlanType());
            planMap.put("target_price", plan.getTargetPrice());
            planMap.put("executed_price", plan.getExecutedPrice());
            planMap.put("profit_loss", plan.getProfitLoss());
            planMap.put("profit_rate", plan.getProfitRate());
            planMap.put("status", plan.getStatus());
            planMap.put("created_at", plan.getCreatedAt());
            planData.add(planMap);
        }
        data.put("trading_plans", planData);

        return data;
    }

    // ──────────────────────────────────────────────
    // Usage reservation with row-level locking
    // ──────────────────────────────────────────────

    private void reserveUsage() {
        TeamSettings settings = teamSettingsRepository.findFirstByOrderByIdAsc()
                .orElseThrow(() -> new BusinessException("Team settings not found"));

        // Row-level lock
        entityManager.lock(settings, LockModeType.PESSIMISTIC_WRITE);

        resetDailyUsageIfNeeded(settings);

        int dailyLimit = settings.getAiDailyLimit() != null ? settings.getAiDailyLimit() : 3;
        int usageCount = settings.getAiUsageCount() != null ? settings.getAiUsageCount() : 0;

        if (usageCount >= dailyLimit) {
            throw new BusinessException(HttpStatus.TOO_MANY_REQUESTS,
                    "Daily AI usage limit reached (" + dailyLimit + "). Try again tomorrow.");
        }

        settings.setAiUsageCount(usageCount + 1);
        teamSettingsRepository.save(settings);
    }

    private void resetDailyUsageIfNeeded(TeamSettings settings) {
        LocalDate today = LocalDate.now();
        if (settings.getAiUsageResetDate() == null || !settings.getAiUsageResetDate().equals(today)) {
            settings.setAiUsageCount(0);
            settings.setAiUsageResetDate(today);
            teamSettingsRepository.save(settings);
        }
    }

    // ──────────────────────────────────────────────
    // OpenAI API call
    // ──────────────────────────────────────────────

    /**
     * Call OpenAI API. Tries the Responses API first, falls back to Chat Completions.
     */
    @SuppressWarnings("unchecked")
    private String callOpenAi(String userPrompt, String noteType) {
        String apiKey = appProperties.getOpenai().getApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            throw new BusinessException("OpenAI API key is not configured");
        }

        String model = appProperties.getOpenai().getModel();
        double temperature = appProperties.getOpenai().getTemperature();

        // Determine config based on note type
        AppProperties.AiConfig config = "report".equals(noteType)
                ? appProperties.getReport()
                : appProperties.getDecision();

        int maxTokens = config.getMaxTokens();

        String systemPrompt = buildSystemPrompt(noteType);

        // Try Responses API first
        try {
            return callResponsesApi(apiKey, model, systemPrompt, userPrompt, maxTokens);
        } catch (Exception e) {
            log.warn("Responses API failed, falling back to Chat Completions: {}", e.getMessage());
        }

        // Fallback to Chat Completions API
        return callChatCompletionsApi(apiKey, model, temperature, systemPrompt, userPrompt, maxTokens);
    }

    @SuppressWarnings("unchecked")
    private String callResponsesApi(String apiKey, String model, String systemPrompt, String userPrompt, int maxTokens) {
        Map<String, Object> requestBody = new LinkedHashMap<>();
        requestBody.put("model", model);

        List<Map<String, Object>> input = new ArrayList<>();

        Map<String, Object> systemMsg = new LinkedHashMap<>();
        systemMsg.put("role", "system");
        systemMsg.put("content", systemPrompt);
        input.add(systemMsg);

        Map<String, Object> userMsg = new LinkedHashMap<>();
        userMsg.put("role", "user");
        userMsg.put("content", userPrompt);
        input.add(userMsg);

        requestBody.put("input", input);

        Map<String, Object> response = webClient.post()
                .uri("https://api.openai.com/v1/responses")
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        if (response == null) {
            throw new BusinessException("Empty response from OpenAI Responses API");
        }

        // Extract text from Responses API output
        Object output = response.get("output");
        if (output instanceof List) {
            List<Map<String, Object>> outputList = (List<Map<String, Object>>) output;
            for (Map<String, Object> item : outputList) {
                if ("message".equals(item.get("type"))) {
                    Object content = item.get("content");
                    if (content instanceof List) {
                        List<Map<String, Object>> contentList = (List<Map<String, Object>>) content;
                        for (Map<String, Object> contentItem : contentList) {
                            if ("output_text".equals(contentItem.get("type"))) {
                                return (String) contentItem.get("text");
                            }
                        }
                    }
                }
            }
        }

        // Fallback: try output_text at top level
        if (response.containsKey("output_text")) {
            return (String) response.get("output_text");
        }

        throw new BusinessException("Could not extract text from OpenAI Responses API");
    }

    @SuppressWarnings("unchecked")
    private String callChatCompletionsApi(String apiKey, String model, double temperature,
                                          String systemPrompt, String userPrompt, int maxTokens) {
        Map<String, Object> requestBody = new LinkedHashMap<>();
        requestBody.put("model", model);
        requestBody.put("temperature", temperature);
        requestBody.put("max_tokens", maxTokens);

        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", systemPrompt));
        messages.add(Map.of("role", "user", "content", userPrompt));
        requestBody.put("messages", messages);

        try {
            Map<String, Object> response = webClient.post()
                    .uri("https://api.openai.com/v1/chat/completions")
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (response != null && response.containsKey("choices")) {
                List<Map<String, Object>> choices = (List<Map<String, Object>>) response.get("choices");
                if (!choices.isEmpty()) {
                    Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
                    if (message != null) {
                        return (String) message.get("content");
                    }
                }
            }
        } catch (WebClientResponseException e) {
            log.error("OpenAI Chat Completions API error: {} {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new BusinessException("OpenAI API error: " + e.getStatusCode());
        }

        throw new BusinessException("Failed to generate AI content");
    }

    // ──────────────────────────────────────────────
    // Prompt builders
    // ──────────────────────────────────────────────

    private String buildSystemPrompt(String noteType) {
        if ("report".equals(noteType)) {
            return """
                You are a professional fund operations analyst. Generate a comprehensive operation report \
                for a trading position. Write in Korean. The report should include:
                1. Position overview and current status
                2. Entry rationale analysis
                3. Trading plan evaluation (buy plans, take-profit, stop-loss targets)
                4. Discussion summary and key decisions
                5. Risk assessment
                6. Recommendations for next steps

                Format the output as clean, structured markdown with headers and bullet points.
                """;
        }
        return """
            You are a professional fund analyst. Generate a concise decision note \
            for a trading position. Write in Korean. The note should include:
            1. Investment thesis summary
            2. Key entry/exit rationale
            3. Risk factors
            4. Trading plan summary
            5. Key discussion points (if any)

            Format the output as clean, structured markdown with headers and bullet points. \
            Keep it focused and actionable.
            """;
    }

    private String buildDecisionNotePrompt(Map<String, Object> positionData, String verbosity) {
        StringBuilder sb = new StringBuilder();
        sb.append("Generate a decision note for the following position:\n\n");
        sb.append("Position Data:\n");
        sb.append(formatPositionDataForPrompt(positionData));

        if ("low".equals(verbosity)) {
            sb.append("\n\nKeep the note brief and concise (under 500 words).");
        } else if ("high".equals(verbosity)) {
            sb.append("\n\nProvide a detailed and comprehensive note with thorough analysis.");
        } else {
            sb.append("\n\nProvide a moderately detailed note.");
        }

        return sb.toString();
    }

    private String buildOperationReportPrompt(Map<String, Object> positionData, String verbosity) {
        StringBuilder sb = new StringBuilder();
        sb.append("Generate an operation report for the following position:\n\n");
        sb.append("Position Data:\n");
        sb.append(formatPositionDataForPrompt(positionData));

        if ("low".equals(verbosity)) {
            sb.append("\n\nKeep the report concise (under 800 words).");
        } else if ("high".equals(verbosity)) {
            sb.append("\n\nProvide a comprehensive and detailed report with thorough analysis.");
        } else {
            sb.append("\n\nProvide a moderately detailed report.");
        }

        return sb.toString();
    }

    @SuppressWarnings("unchecked")
    private String formatPositionDataForPrompt(Map<String, Object> data) {
        StringBuilder sb = new StringBuilder();
        sb.append("- Ticker: ").append(data.get("ticker")).append("\n");
        sb.append("- Name: ").append(data.get("ticker_name")).append("\n");
        sb.append("- Market: ").append(data.get("market")).append("\n");
        sb.append("- Status: ").append(data.get("status")).append("\n");
        sb.append("- Average Buy Price: ").append(data.get("average_buy_price")).append("\n");
        sb.append("- Total Quantity: ").append(data.get("total_quantity")).append("\n");
        sb.append("- Total Buy Amount: ").append(data.get("total_buy_amount")).append("\n");
        sb.append("- Profit Rate: ").append(data.get("profit_rate")).append("\n");
        sb.append("- Profit/Loss: ").append(data.get("profit_loss")).append("\n");
        sb.append("- Opened At: ").append(data.get("opened_at")).append("\n");

        if (data.get("buy_plan") != null) {
            sb.append("- Buy Plan: ").append(data.get("buy_plan")).append("\n");
        }
        if (data.get("take_profit_targets") != null) {
            sb.append("- Take Profit Targets: ").append(data.get("take_profit_targets")).append("\n");
        }
        if (data.get("stop_loss_targets") != null) {
            sb.append("- Stop Loss Targets: ").append(data.get("stop_loss_targets")).append("\n");
        }

        // Add discussion summaries
        Object discussions = data.get("discussions");
        if (discussions instanceof List) {
            List<Map<String, Object>> discList = (List<Map<String, Object>>) discussions;
            if (!discList.isEmpty()) {
                sb.append("\nDiscussions:\n");
                for (Map<String, Object> disc : discList) {
                    sb.append("  - Title: ").append(disc.get("title")).append("\n");
                    sb.append("    Status: ").append(disc.get("status")).append("\n");
                    if (disc.get("summary") != null) {
                        sb.append("    Summary: ").append(disc.get("summary")).append("\n");
                    }

                    Object messages = disc.get("messages");
                    if (messages instanceof List) {
                        List<Map<String, Object>> msgList = (List<Map<String, Object>>) messages;
                        // Include last 10 messages max to avoid token overflow
                        int start = Math.max(0, msgList.size() - 10);
                        if (!msgList.isEmpty()) {
                            sb.append("    Recent messages:\n");
                            for (int i = start; i < msgList.size(); i++) {
                                Map<String, Object> msg = msgList.get(i);
                                String user = msg.get("username") != null ? msg.get("username").toString() : "Unknown";
                                sb.append("      [").append(user).append("]: ").append(msg.get("content")).append("\n");
                            }
                        }
                    }
                }
            }
        }

        // Add trading plan summaries
        Object plans = data.get("trading_plans");
        if (plans instanceof List) {
            List<Map<String, Object>> planList = (List<Map<String, Object>>) plans;
            if (!planList.isEmpty()) {
                sb.append("\nTrading Plans:\n");
                // Include last 5 plans max
                int start = Math.max(0, planList.size() - 5);
                for (int i = start; i < planList.size(); i++) {
                    Map<String, Object> plan = planList.get(i);
                    sb.append("  - Version: ").append(plan.get("version"));
                    sb.append(", Type: ").append(plan.get("record_type"));
                    if (plan.get("memo") != null) {
                        sb.append(", Memo: ").append(plan.get("memo"));
                    }
                    sb.append("\n");
                }
            }
        }

        return sb.toString();
    }

    /**
     * Build a simple blocks structure from markdown content.
     * Creates an Editor.js-compatible blocks array.
     */
    private List<Map<String, Object>> buildBlocks(String content) {
        List<Map<String, Object>> blocks = new ArrayList<>();
        if (content == null || content.isBlank()) {
            return blocks;
        }

        String[] lines = content.split("\n");
        for (String line : lines) {
            if (line.isBlank()) continue;

            Map<String, Object> block = new LinkedHashMap<>();
            if (line.startsWith("### ")) {
                block.put("type", "header");
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("text", line.substring(4).trim());
                data.put("level", 3);
                block.put("data", data);
            } else if (line.startsWith("## ")) {
                block.put("type", "header");
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("text", line.substring(3).trim());
                data.put("level", 2);
                block.put("data", data);
            } else if (line.startsWith("# ")) {
                block.put("type", "header");
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("text", line.substring(2).trim());
                data.put("level", 1);
                block.put("data", data);
            } else if (line.startsWith("- ") || line.startsWith("* ")) {
                block.put("type", "list");
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("style", "unordered");
                data.put("items", List.of(line.substring(2).trim()));
                block.put("data", data);
            } else {
                block.put("type", "paragraph");
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("text", line.trim());
                block.put("data", data);
            }

            block.put("id", UUID.randomUUID().toString().substring(0, 10));
            blocks.add(block);
        }

        return blocks;
    }

    private TeamSettings getTeamSettings() {
        return teamSettingsRepository.findFirstByOrderByIdAsc()
                .orElseThrow(() -> new BusinessException("Team settings not found"));
    }
}
