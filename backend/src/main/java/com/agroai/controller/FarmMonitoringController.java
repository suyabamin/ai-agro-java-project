package com.agroai.controller;

import com.agroai.dto.ApiResponse;
import com.agroai.security.FirebaseUserDetails;
import com.agroai.service.AgriculturalAnalysisService;
import com.agroai.service.DiseaseAnalysisService;
import com.agroai.service.SoilTelemetryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Farm-level monitoring aggregation controller.
 * Provides high-efficiency batch retrieval of latest field-wise telemetry, AI agronomic decisions,
 * and disease analyses, avoiding N+1 requests from dashboard clients.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/monitoring")
public class FarmMonitoringController {

    private final AgriculturalAnalysisService agriculturalAnalysis;
    private final SoilTelemetryService telemetry;
    private final DiseaseAnalysisService diseaseAnalysis;

    public FarmMonitoringController(AgriculturalAnalysisService agriculturalAnalysis,
                                    SoilTelemetryService telemetry) {
        this(agriculturalAnalysis, telemetry, null);
    }

    @Autowired
    public FarmMonitoringController(AgriculturalAnalysisService agriculturalAnalysis,
                                    SoilTelemetryService telemetry,
                                    DiseaseAnalysisService diseaseAnalysis) {
        this.agriculturalAnalysis = agriculturalAnalysis;
        this.telemetry = telemetry;
        this.diseaseAnalysis = diseaseAnalysis;
    }

    /**
     * Retrieves the latest persisted agricultural AI decision for each active field under this farm.
     * Accessible to active farm members (owners, managers, assigned farmers).
     */
    @GetMapping("/agricultural-analyses/latest")
    public ResponseEntity<ApiResponse<Map<String, Map<String, Object>>>> getLatestAgriculturalAnalyses(
            @PathVariable String farmId,
            @AuthenticationPrincipal FirebaseUserDetails user) {
        Map<String, Map<String, Object>> latest = agriculturalAnalysis.getLatestForFarm(farmId, user.getUid());
        return ResponseEntity.ok(ApiResponse.success(latest, "Latest agricultural analyses retrieved"));
    }

    /**
     * Retrieves the latest persisted crop leaf disease analysis for each active field under this farm.
     * Accessible to active farm members (owners, managers, assigned farmers).
     */
    @GetMapping("/disease-analyses/latest")
    public ResponseEntity<ApiResponse<Map<String, Map<String, Object>>>> getLatestDiseaseAnalyses(
            @PathVariable String farmId,
            @AuthenticationPrincipal FirebaseUserDetails user) {
        Map<String, Map<String, Object>> latest = diseaseAnalysis != null
                ? diseaseAnalysis.getLatestForFarm(farmId, user.getUid())
                : Map.of();
        return ResponseEntity.ok(ApiResponse.success(latest, "Latest disease analyses retrieved"));
    }

    /**
     * Retrieves the latest telemetry readings for each active field under this farm.
     * Accessible to active farm members (owners, managers, assigned farmers).
     */
    @GetMapping("/telemetry/latest")
    public ResponseEntity<ApiResponse<Map<String, List<Map<String, Object>>>>> getLatestFarmTelemetry(
            @PathVariable String farmId,
            @AuthenticationPrincipal FirebaseUserDetails user) {
        Map<String, List<Map<String, Object>>> latest = telemetry.latestForFarm(farmId, user.getUid());
        return ResponseEntity.ok(ApiResponse.success(latest, "Latest farm telemetry retrieved"));
    }
}
