package com.fundmessenger.newsdesk.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fundmessenger.common.config.AppProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.Duration;
import java.util.*;

@Slf4j
@Service
public class CerebrasClient {

    private final AppProperties.Cerebras config;
    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    public CerebrasClient(AppProperties appProperties, WebClient.Builder webClientBuilder, ObjectMapper objectMapper) {
        this.config = appProperties.getCerebras();
        this.webClient = webClientBuilder
                .baseUrl(config.getBaseUrl())
                .defaultHeader("Content-Type", "application/json")
                .codecs(c -> c.defaultCodecs().maxInMemorySize(4 * 1024 * 1024))
                .build();
        this.objectMapper = objectMapper;
    }

    /**
     * Cerebras chat/completions API 호출.
     * jsonSchema가 주어지면 structured output으로 JSON을 강제한다.
     *
     * @return 파싱된 Map (jsonSchema 사용 시) 또는 raw String
     */
    @SuppressWarnings("unchecked")
    public Object generate(String prompt, String system, Map<String, Object> jsonSchema, double temperature) {
        List<Map<String, String>> messages = new ArrayList<>();
        if (system != null && !system.isBlank()) {
            messages.add(Map.of("role", "system", "content", system));
        }
        messages.add(Map.of("role", "user", "content", prompt));

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", config.getModel());
        payload.put("messages", messages);
        payload.put("temperature", temperature);
        payload.put("max_completion_tokens", config.getMaxCompletionTokens());

        if (jsonSchema != null) {
            payload.put("response_format", Map.of(
                    "type", "json_schema",
                    "json_schema", Map.of(
                            "name", "structured_output",
                            "strict", true,
                            "schema", jsonSchema
                    )
            ));
        }

        int maxRetries = 2;
        Exception lastError = null;

        for (int attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                Map<String, Object> response = webClient.post()
                        .uri("/chat/completions")
                        .header("Authorization", "Bearer " + config.getApiKey())
                        .bodyValue(payload)
                        .retrieve()
                        .bodyToMono(Map.class)
                        .block(Duration.ofSeconds(120));

                if (response == null) {
                    throw new RuntimeException("Cerebras API returned null response");
                }

                // 응답 파싱
                List<Map<String, Object>> choices = (List<Map<String, Object>>) response.get("choices");
                Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
                String content = (String) message.get("content");

                // 토큰 로깅
                Map<String, Object> usage = (Map<String, Object>) response.get("usage");
                if (usage != null) {
                    log.info("[Cerebras] tokens: in={} out={} total={}",
                            usage.get("prompt_tokens"), usage.get("completion_tokens"), usage.get("total_tokens"));
                }

                if (jsonSchema != null && content != null) {
                    try {
                        return objectMapper.readValue(content, Map.class);
                    } catch (JsonProcessingException e) {
                        log.warn("[Cerebras] JSON parse failed: {}", content.substring(0, Math.min(200, content.length())));
                        Map<String, Object> errorResult = new LinkedHashMap<>();
                        errorResult.put("error", "Failed to parse JSON");
                        errorResult.put("raw", content);
                        return errorResult;
                    }
                }

                return content != null ? content : "";

            } catch (WebClientResponseException e) {
                lastError = e;
                if (e.getStatusCode().value() == 429) {
                    String retryAfter = e.getHeaders().getFirst("retry-after");
                    long waitSec = retryAfter != null ? Long.parseLong(retryAfter) : 5;
                    log.warn("[Cerebras] Rate limited, waiting {}s...", waitSec);
                    sleep(waitSec * 1000);
                    continue;
                }
                if (e.getStatusCode().is5xxServerError()) {
                    log.warn("[Cerebras] Server error {}, retrying...", e.getStatusCode().value());
                    sleep((long) Math.pow(2, attempt) * 1000);
                    continue;
                }
                log.error("[Cerebras] HTTP {}: {}", e.getStatusCode().value(),
                        e.getResponseBodyAsString().substring(0, Math.min(200, e.getResponseBodyAsString().length())));
                throw new RuntimeException("Cerebras API error: " + e.getStatusCode(), e);
            } catch (Exception e) {
                lastError = e;
                if (attempt < maxRetries) {
                    log.warn("[Cerebras] Error on attempt {}: {}", attempt + 1, e.getMessage());
                    sleep(1000);
                    continue;
                }
            }
        }

        throw new RuntimeException("Cerebras API failed after retries", lastError);
    }

    public boolean isAvailable() {
        if (config.getApiKey() == null || config.getApiKey().isBlank()) return false;
        try {
            webClient.get()
                    .uri("/models")
                    .header("Authorization", "Bearer " + config.getApiKey())
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block(Duration.ofSeconds(10));
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private void sleep(long ms) {
        try { Thread.sleep(ms); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
    }
}
