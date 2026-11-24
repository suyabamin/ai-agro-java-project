package com.agroai.controller;

import com.agroai.dto.ApiResponse;
import com.agroai.dto.CursorPageResponse;
import com.agroai.dto.SubmitTelemetryBatchRequest;
import com.agroai.dto.SubmitTelemetryRequest;
import com.agroai.dto.UpdateIrrigationPlanStatusRequest;
import com.agroai.monitoring.CropImageService;
import com.agroai.monitoring.ImageStorage;
import com.agroai.repository.CursorPage;
import com.agroai.security.FirebaseUserDetails;
import com.agroai.security.RequiresRevocationCheck;
import com.agroai.service.AgriculturalAnalysisService;
import com.agroai.service.DiseaseAnalysisService;
import com.agroai.service.DiseaseResearchService;
import com.agroai.service.FieldHistoryService;
import com.agroai.service.IrrigationPlanningService;
import com.agroai.service.SoilTelemetryService;
import jakarta.validation.Valid;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/farms/{farmId}/fields/{fieldId}/monitoring")
public class FieldMonitoringController {
    private final CropImageService images;
    private final SoilTelemetryService telemetry;
    private final DiseaseAnalysisService disease;
    private final AgriculturalAnalysisService agriculturalAnalysis;
    private final DiseaseResearchService diseaseResearch;
    private final IrrigationPlanningService irrigation;
    private final FieldHistoryService history;

    public FieldMonitoringController(CropImageService images, SoilTelemetryService telemetry,
            DiseaseAnalysisService disease, AgriculturalAnalysisService agriculturalAnalysis,
            IrrigationPlanningService irrigation, FieldHistoryService history) {
        this(images, telemetry, disease, agriculturalAnalysis, null, irrigation, history);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public FieldMonitoringController(CropImageService images, SoilTelemetryService telemetry,
            DiseaseAnalysisService disease, AgriculturalAnalysisService agriculturalAnalysis,
            DiseaseResearchService diseaseResearch,
            IrrigationPlanningService irrigation, FieldHistoryService history) {
        this.images = images;
        this.telemetry = telemetry;
        this.disease = disease;
        this.agriculturalAnalysis = agriculturalAnalysis;
        this.diseaseResearch = diseaseResearch;
        this.irrigation = irrigation;
        this.history = history;
    }

    @RequiresRevocationCheck
    @PostMapping(value = "/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> uploadImage(@PathVariable String farmId,
            @PathVariable String fieldId, @RequestPart("file") MultipartFile file,
            @RequestParam(defaultValue = "CROP") String category,
            @AuthenticationPrincipal FirebaseUserDetails user) {
        return ResponseEntity.status(201).body(ApiResponse.success(images.upload(farmId, fieldId, user.getUid(), file, category), "Image uploaded"));
    }

    @GetMapping("/images")
    public ResponseEntity<ApiResponse<CursorPageResponse<Map<String, Object>>>> listImages(@PathVariable String farmId,
            @PathVariable String fieldId, @RequestParam(required = false) String cursor,
            @RequestParam(required = false) Integer size, @AuthenticationPrincipal FirebaseUserDetails user) {
        return ResponseEntity.ok(ApiResponse.success(response(images.list(farmId, fieldId, user.getUid(), cursor, size), size), "Images retrieved"));
    }

    @GetMapping("/images/{imageId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getImage(@PathVariable String farmId,
            @PathVariable String fieldId, @PathVariable String imageId, @AuthenticationPrincipal FirebaseUserDetails user) {
        return ResponseEntity.ok(ApiResponse.success(images.get(farmId, fieldId, imageId, user.getUid()), "Image metadata retrieved"));
    }

    @GetMapping("/images/{imageId}/content")
    public ResponseEntity<ByteArrayResource> imageContent(@PathVariable String farmId, @PathVariable String fieldId,
            @PathVariable String imageId, @AuthenticationPrincipal FirebaseUserDetails user) {
        ImageStorage.StoredImage image = images.content(farmId, fieldId, imageId, user.getUid());
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(image.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + imageId + "\"")
                .header("X-Content-Type-Options", "nosniff").body(new ByteArrayResource(image.content()));
    }

    @RequiresRevocationCheck
    @DeleteMapping("/images/{imageId}")
    public ResponseEntity<ApiResponse<Void>> deleteImage(@PathVariable String farmId, @PathVariable String fieldId,
            @PathVariable String imageId, @AuthenticationPrincipal FirebaseUserDetails user) {
        images.delete(farmId, fieldId, imageId, user.getUid());
        return ResponseEntity.ok(ApiResponse.success(null, "Image deleted"));
    }

    @RequiresRevocationCheck
    @PostMapping("/telemetry")
    public ResponseEntity<ApiResponse<Map<String, Object>>> submitTelemetry(@PathVariable String farmId,
            @PathVariable String fieldId, @Valid @RequestBody SubmitTelemetryRequest request,
            @AuthenticationPrincipal FirebaseUserDetails user) {
        return ResponseEntity.status(201).body(ApiResponse.success(telemetry.submit(farmId, fieldId, user.getUid(), request), "Telemetry recorded"));
    }

    @RequiresRevocationCheck
    @PostMapping("/telemetry/batch")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> submitTelemetryBatch(@PathVariable String farmId,
            @PathVariable String fieldId, @Valid @RequestBody SubmitTelemetryBatchRequest request,
            @AuthenticationPrincipal FirebaseUserDetails user) {
        return ResponseEntity.status(201).body(ApiResponse.success(telemetry.submitBatch(farmId, fieldId, user.getUid(), request.readings()), "Telemetry batch recorded"));
    }

    @GetMapping("/telemetry/latest")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> latestTelemetry(@PathVariable String farmId,
            @PathVariable String fieldId, @AuthenticationPrincipal FirebaseUserDetails user) {
        return ResponseEntity.ok(ApiResponse.success(telemetry.latest(farmId, fieldId, user.getUid()), "Latest telemetry retrieved"));
    }

    @GetMapping("/telemetry")
    public ResponseEntity<ApiResponse<CursorPageResponse<Map<String, Object>>>> telemetryHistory(@PathVariable String farmId,
            @PathVariable String fieldId, @RequestParam(required = false) String cursor, @RequestParam(required = false) Integer size,
            @RequestParam(required = false) String measurementType, @RequestParam(required = false) Long fromEpochMs,
            @RequestParam(required = false) Long toEpochMs, @AuthenticationPrincipal FirebaseUserDetails user) {
        return ResponseEntity.ok(ApiResponse.success(response(telemetry.history(farmId, fieldId, user.getUid(), cursor, size,
                measurementType, fromEpochMs, toEpochMs), size), "Telemetry history retrieved"));
    }

    @RequiresRevocationCheck
    @PostMapping("/disease-analyses")
    public ResponseEntity<ApiResponse<Map<String, Object>>> requestDiseaseAnalysis(@PathVariable String farmId,
            @PathVariable String fieldId, @RequestParam String imageId,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @AuthenticationPrincipal FirebaseUserDetails user) {
        return ResponseEntity.status(201).body(ApiResponse.success(disease.submit(farmId, fieldId, imageId, user.getUid(), idempotencyKey), "Disease analysis request processed"));
    }

    @GetMapping("/disease-analyses")
    public ResponseEntity<ApiResponse<CursorPageResponse<Map<String, Object>>>> listDiseaseAnalyses(@PathVariable String farmId,
            @PathVariable String fieldId, @RequestParam(required = false) String cursor, @RequestParam(required = false) Integer size,
            @AuthenticationPrincipal FirebaseUserDetails user) {
        return ResponseEntity.ok(ApiResponse.success(response(disease.list(farmId, fieldId, user.getUid(), cursor, size), size), "Disease analyses retrieved"));
    }

    @GetMapping("/disease-availability")
    public ResponseEntity<ApiResponse<Map<String, Object>>> diseaseAvailability(@PathVariable String farmId,
            @PathVariable String fieldId, @AuthenticationPrincipal FirebaseUserDetails user) {
        return ResponseEntity.ok(ApiResponse.success(disease.availability(farmId, fieldId, user.getUid()), "Disease model availability retrieved"));
    }

    @GetMapping("/disease-analyses/{analysisId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getDiseaseAnalysis(@PathVariable String farmId,
            @PathVariable String fieldId, @PathVariable String analysisId, @AuthenticationPrincipal FirebaseUserDetails user) {
        return ResponseEntity.ok(ApiResponse.success(disease.get(farmId, fieldId, analysisId, user.getUid()), "Disease analysis retrieved"));
    }

    @RequiresRevocationCheck
    @PostMapping("/disease-analyses/{analysisId}/research")
    public ResponseEntity<ApiResponse<Map<String, Object>>> triggerDiseaseResearch(@PathVariable String farmId,
            @PathVariable String fieldId, @PathVariable String analysisId, @AuthenticationPrincipal FirebaseUserDetails user) {
        Map<String, Object> result = diseaseResearch != null
                ? diseaseResearch.triggerAsync(farmId, fieldId, analysisId, user.getUid())
                : Map.of("researchStatus", "UNAVAILABLE");
        return ResponseEntity.accepted().body(ApiResponse.success(result, "Disease research request accepted"));
    }

    @GetMapping("/disease-analyses/{analysisId}/research")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getDiseaseResearch(@PathVariable String farmId,
            @PathVariable String fieldId, @PathVariable String analysisId, @AuthenticationPrincipal FirebaseUserDetails user) {
        List<Map<String, Object>> reports = diseaseResearch != null
                ? diseaseResearch.listForAnalysis(farmId, fieldId, analysisId, user.getUid())
                : List.of();
        return ResponseEntity.ok(ApiResponse.success(reports, "Disease research reports retrieved"));
    }

    @RequiresRevocationCheck
    @PostMapping("/agricultural-analyses")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createAgriculturalAnalysis(@PathVariable String farmId,
            @PathVariable String fieldId,
            @RequestParam(defaultValue = "false") boolean async,
            @AuthenticationPrincipal FirebaseUserDetails user) {
        return ResponseEntity.status(201).body(ApiResponse.success(agriculturalAnalysis.create(farmId, fieldId, user.getUid(), async), "Agricultural evidence summary created"));
    }

    @GetMapping("/agricultural-analyses/{analysisId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getAgriculturalAnalysis(@PathVariable String farmId,
            @PathVariable String fieldId, @PathVariable String analysisId, @AuthenticationPrincipal FirebaseUserDetails user) {
        return ResponseEntity.ok(ApiResponse.success(agriculturalAnalysis.get(farmId, fieldId, analysisId, user.getUid()), "Agricultural analysis retrieved"));
    }

    @GetMapping("/agricultural-analyses")
    public ResponseEntity<ApiResponse<CursorPageResponse<Map<String, Object>>>> listAgriculturalAnalyses(@PathVariable String farmId,
            @PathVariable String fieldId, @RequestParam(required = false) String cursor, @RequestParam(required = false) Integer size,
            @AuthenticationPrincipal FirebaseUserDetails user) {
        return ResponseEntity.ok(ApiResponse.success(response(agriculturalAnalysis.list(farmId, fieldId, user.getUid(), cursor, size), size), "Agricultural analyses retrieved"));
    }

    @RequiresRevocationCheck
    @PostMapping("/irrigation-plans")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createIrrigationPlan(@PathVariable String farmId,
            @PathVariable String fieldId, @AuthenticationPrincipal FirebaseUserDetails user) {
        return ResponseEntity.status(201).body(ApiResponse.success(irrigation.create(farmId, fieldId, user.getUid()), "Irrigation plan created"));
    }

    @GetMapping("/irrigation-plans")
    public ResponseEntity<ApiResponse<CursorPageResponse<Map<String, Object>>>> listIrrigationPlans(@PathVariable String farmId,
            @PathVariable String fieldId, @RequestParam(required = false) String cursor, @RequestParam(required = false) Integer size,
            @AuthenticationPrincipal FirebaseUserDetails user) {
        return ResponseEntity.ok(ApiResponse.success(response(irrigation.list(farmId, fieldId, user.getUid(), cursor, size), size), "Irrigation plans retrieved"));
    }

    @GetMapping("/irrigation-plans/{planId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getIrrigationPlan(@PathVariable String farmId,
            @PathVariable String fieldId, @PathVariable String planId, @AuthenticationPrincipal FirebaseUserDetails user) {
        return ResponseEntity.ok(ApiResponse.success(irrigation.get(farmId, fieldId, planId, user.getUid()), "Irrigation plan retrieved"));
    }

    @RequiresRevocationCheck
    @PatchMapping("/irrigation-plans/{planId}/status")
    public ResponseEntity<ApiResponse<Map<String, Object>>> updateIrrigationStatus(@PathVariable String farmId,
            @PathVariable String fieldId, @PathVariable String planId,
            @Valid @RequestBody UpdateIrrigationPlanStatusRequest request,
            @AuthenticationPrincipal FirebaseUserDetails user) {
        return ResponseEntity.ok(ApiResponse.success(irrigation.updateStatus(farmId, fieldId, planId, user.getUid(), request), "Irrigation plan updated"));
    }

    @GetMapping("/history")
    public ResponseEntity<ApiResponse<CursorPageResponse<Map<String, Object>>>> history(@PathVariable String farmId,
            @PathVariable String fieldId, @RequestParam(required = false) String cursor, @RequestParam(required = false) Integer size,
            @RequestParam(required = false) String eventType, @RequestParam(required = false) Long fromEpochMs,
            @RequestParam(required = false) Long toEpochMs,
            @AuthenticationPrincipal FirebaseUserDetails user) {
        return ResponseEntity.ok(ApiResponse.success(response(history.list(farmId, fieldId, user.getUid(), cursor, size,
                eventType, fromEpochMs, toEpochMs), size), "Field activity retrieved"));
    }

    @GetMapping("/history/{activityId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> historyItem(@PathVariable String farmId,
            @PathVariable String fieldId, @PathVariable String activityId, @AuthenticationPrincipal FirebaseUserDetails user) {
        return ResponseEntity.ok(ApiResponse.success(history.get(farmId, fieldId, activityId, user.getUid()), "Field activity retrieved"));
    }

    private static <T> CursorPageResponse<T> response(CursorPage<T> page, Integer requestedSize) {
        int size = com.agroai.util.CursorPagination.validatePageSize(requestedSize);
        return CursorPageResponse.map(page, size, value -> value, com.agroai.util.CursorPagination::encode);
    }
}
