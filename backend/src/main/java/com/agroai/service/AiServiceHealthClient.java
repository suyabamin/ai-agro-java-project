package com.agroai.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class AiServiceHealthClient {

    private static final Logger log = LoggerFactory.getLogger(AiServiceHealthClient.class);

    private final RestTemplate restTemplate;
    private final String aiServiceBaseUrl;

    public AiServiceHealthClient(
            RestTemplateBuilder restTemplateBuilder,
            @Value("${agroai.ai-service.base-url:http://localhost:8000}") String aiServiceBaseUrl,
            @Value("${agroai.ai-service.timeout-ms:5000}") int timeoutMs) {

        this.aiServiceBaseUrl = aiServiceBaseUrl.replaceAll("/+$", "");
        this.restTemplate = restTemplateBuilder
                .setConnectTimeout(Duration.ofMillis(timeoutMs))
                .setReadTimeout(Duration.ofMillis(timeoutMs))
                .build();
    }

    public Map<String, Object> checkAiServiceHealth() {
        Map<String, Object> result = new LinkedHashMap<>();
        String healthUrl = aiServiceBaseUrl + "/api/v1/health";
        long startTime = System.currentTimeMillis();

        try {
            ResponseEntity<Map> response = restTemplate.getForEntity(healthUrl, Map.class);
            long elapsedMs = System.currentTimeMillis() - startTime;

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                result.put("status", "UP");
                result.put("remoteService", response.getBody().get("service"));
                result.put("remoteVersion", response.getBody().get("version"));
                result.put("responseTimeMs", elapsedMs);
                result.put("endpoint", "/api/v1/health");
                return result;
            } else {
                result.put("status", "DEGRADED");
                result.put("httpStatus", response.getStatusCode().value());
                result.put("responseTimeMs", elapsedMs);
                return result;
            }
        } catch (ResourceAccessException ex) {
            long elapsedMs = System.currentTimeMillis() - startTime;
            log.warn("AI service unreachable at {} ({}ms): {}", healthUrl, elapsedMs, ex.getMessage());
            result.put("status", "DOWN");
            result.put("error", "AI service connection timed out or refused");
            result.put("targetUrl", aiServiceBaseUrl);
            result.put("responseTimeMs", elapsedMs);
            return result;
        } catch (RestClientException ex) {
            long elapsedMs = System.currentTimeMillis() - startTime;
            log.error("Error communicating with AI service at {}: {}", healthUrl, ex.getMessage());
            result.put("status", "ERROR");
            result.put("error", "HTTP error communicating with AI service");
            result.put("responseTimeMs", elapsedMs);
            return result;
        }
    }
}
