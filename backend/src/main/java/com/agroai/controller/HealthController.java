package com.agroai.controller;

import com.agroai.dto.ApiResponse;
import com.agroai.service.AiServiceHealthClient;
import com.agroai.service.FirebaseHealthService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/health")
public class HealthController {

    private final FirebaseHealthService firebaseHealthService;
    private final AiServiceHealthClient aiServiceHealthClient;

    public HealthController(FirebaseHealthService firebaseHealthService,
                            AiServiceHealthClient aiServiceHealthClient) {
        this.firebaseHealthService = firebaseHealthService;
        this.aiServiceHealthClient = aiServiceHealthClient;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> getHealth() {
        Map<String, Object> healthData = Map.of(
                "status", "UP",
                "service", "agroai-backend",
                "version", "0.0.1-SNAPSHOT"
        );
        return ResponseEntity.ok(ApiResponse.success(healthData, "Service is healthy"));
    }

    @GetMapping("/firebase")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getFirebaseHealth() {
        Map<String, Object> diagnostics = firebaseHealthService.getFirebaseDiagnostics();
        return ResponseEntity.ok(ApiResponse.success(diagnostics, "Firebase health diagnostics completed"));
    }

    @GetMapping("/ai")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getAiHealth() {
        Map<String, Object> aiDiagnostics = aiServiceHealthClient.checkAiServiceHealth();
        return ResponseEntity.ok(ApiResponse.success(aiDiagnostics, "AI service health check completed"));
    }
}
