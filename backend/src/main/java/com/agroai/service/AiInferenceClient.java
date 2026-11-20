package com.agroai.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.Map;

/** Backend-only, authenticated AI service call. The AI service never writes Firestore. */
@Service
public class AiInferenceClient {
    private final RestTemplate restTemplate;
    private final String endpoint;
    private final String serviceKey;

    public AiInferenceClient(RestTemplateBuilder builder,
            @Value("${agroai.ai-service.base-url:http://localhost:8000}") String baseUrl,
            @Value("${agroai.ai-service.inference-timeout-ms:20000}") int timeoutMs,
            @Value("${agroai.ai-service.service-key:${AGROAI_AI_SERVICE_KEY:}}") String serviceKey) {
        this.endpoint = baseUrl.replaceAll("/+$", "") + "/api/v1/inference/disease";
        this.serviceKey = serviceKey;
        this.restTemplate = builder.setConnectTimeout(Duration.ofMillis(timeoutMs))
                .setReadTimeout(Duration.ofMillis(timeoutMs)).build();
    }

    public Map<String, Object> inferDisease(byte[] imageBytes, String contentType) {
        if (serviceKey == null || serviceKey.isBlank()) throw new IllegalStateException("AI service authentication is not configured");
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(contentType));
        headers.set("X-AI-Service-Key", serviceKey);
        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(endpoint,
                    new HttpEntity<>(imageBytes, headers), Map.class);
            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new IllegalStateException("AI service returned an invalid response");
            }
            @SuppressWarnings("unchecked") Map<String, Object> result = response.getBody();
            return result;
        } catch (RestClientException e) {
            throw new IllegalStateException("AI service request failed or timed out", e);
        }
    }

    public Map<String, Object> inferTabular(Map<String, Object> features) {
        if (serviceKey == null || serviceKey.isBlank()) throw new IllegalStateException("AI service authentication is not configured");
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-AI-Service-Key", serviceKey);
        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(
                    endpoint.replace("/inference/disease", "/inference/tabular"),
                    new HttpEntity<>(features, headers), Map.class);
            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new IllegalStateException("AI service returned an invalid response for tabular inference");
            }
            @SuppressWarnings("unchecked") Map<String, Object> result = response.getBody();
            return result;
        } catch (RestClientException e) {
            throw new IllegalStateException("AI service tabular request failed or timed out", e);
        }
    }

    public Map<String, Object> availability() {
        if (serviceKey == null || serviceKey.isBlank()) throw new IllegalStateException("AI service authentication is not configured");
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-AI-Service-Key", serviceKey);
        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    endpoint.replace("/inference/disease", "/inference/availability"), HttpMethod.GET,
                    new HttpEntity<>(headers), Map.class);
            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) throw new IllegalStateException("AI availability response is invalid");
            @SuppressWarnings("unchecked") Map<String, Object> result = response.getBody();
            return result;
        } catch (RestClientException e) {
            throw new IllegalStateException("AI availability request failed or timed out", e);
        }
    }
}
