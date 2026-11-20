package com.agroai.service;

import com.agroai.exception.FieldNotFoundException;
import com.agroai.exception.MonitoringServiceUnavailableException;
import com.agroai.monitoring.CropImageService;
import com.agroai.monitoring.ImageStorage;
import com.agroai.monitoring.MonitoringActivity;
import com.agroai.monitoring.MonitoringAuthorizationService;
import com.agroai.repository.CursorPage;
import com.agroai.repository.FieldMonitoringRepository;
import com.agroai.util.CursorPagination;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class DiseaseAnalysisService {
    private final FieldMonitoringRepository repository;
    private final CropImageService images;
    private final MonitoringAuthorizationService authorization;
    private final AiInferenceClient aiClient;

    public DiseaseAnalysisService(FieldMonitoringRepository repository, CropImageService images,
            MonitoringAuthorizationService authorization, AiInferenceClient aiClient) {
        this.repository = repository;
        this.images = images;
        this.authorization = authorization;
        this.aiClient = aiClient;
    }

    public Map<String, Object> submit(String farmId, String fieldId, String imageId, String uid, String idempotencyKey) {
        authorization.requireWriteAccess(farmId, fieldId, uid);
        Map<String, Object> image = images.get(farmId, fieldId, imageId, uid);
        if (idempotencyKey != null && !idempotencyKey.isBlank() && !idempotencyKey.matches("[A-Za-z0-9._:-]{1,100}")) {
            throw new IllegalArgumentException("Idempotency key contains unsupported characters");
        }
        String analysisId = idempotencyKey == null || idempotencyKey.isBlank() ? "analysis_" + UUID.randomUUID()
                : "analysis_" + UUID.nameUUIDFromBytes((farmId + "|" + fieldId + "|" + uid + "|" + idempotencyKey).getBytes(java.nio.charset.StandardCharsets.UTF_8));
        var existing = repository.find("ai_analysis_results", analysisId);
        if (existing.isPresent()) {
            Map<String, Object> prior = existing.get();
            if (!imageId.equals(prior.get("imageId")) || !uid.equals(prior.get("initiatedByUid"))) {
                throw new IllegalArgumentException("Idempotency key was already used for another analysis");
            }
            return prior;
        }
        Instant now = Instant.now();
        Map<String, Object> analysis = new LinkedHashMap<>();
        analysis.put("analysisId", analysisId);
        analysis.put("analysisType", "DISEASE_DETECTION");
        analysis.put("farmId", farmId);
        analysis.put("fieldId", fieldId);
        analysis.put("imageId", imageId);
        analysis.put("initiatedByUid", uid);
        analysis.put("status", "PENDING");
        analysis.put("predictedClass", null);
        analysis.put("predictedClassId", null);
        analysis.put("confidenceScore", null);
        analysis.put("modelName", null);
        analysis.put("modelVersion", null);
        analysis.put("isMock", false);
        analysis.put("createdAt", now.toString());
        analysis.put("createdAtEpochMs", now.toEpochMilli());
        repository.createWithActivity("ai_analysis_results", analysisId, analysis,
                MonitoringActivity.create(farmId, fieldId, uid, "DISEASE_ANALYSIS_REQUESTED", "ANALYSIS", analysisId, "Disease analysis requested"));

        analysis.put("status", "PROCESSING");
        analysis.put("updatedAt", Instant.now().toString());
        repository.updateWithActivity("ai_analysis_results", analysisId, analysis,
                MonitoringActivity.create(farmId, fieldId, uid, "DISEASE_ANALYSIS_PROCESSING", "ANALYSIS", analysisId, "Disease analysis processing started"));
        try {
            ImageStorage.StoredImage content = images.content(farmId, fieldId, imageId, uid);
            Map<String, Object> result = aiClient.inferDisease(content.content(), content.contentType());
            applyValidatedResult(analysis, result);
        } catch (Exception e) {
            analysis.put("status", "FAILED");
            analysis.put("errorCode", e instanceof MonitoringServiceUnavailableException ? "IMAGE_STORAGE_UNAVAILABLE" :
                    (e instanceof IllegalStateException && e.getMessage() != null && e.getMessage().contains("not configured")
                            ? "AI_SERVICE_AUTH_NOT_CONFIGURED" : "AI_SERVICE_UNAVAILABLE"));
            analysis.put("errorMessage", "Disease analysis could not be completed because the inference service is unavailable.");
            analysis.put("limitations", java.util.List.of("No disease prediction or confidence was produced."));
        }
        analysis.put("updatedAt", Instant.now().toString());
        analysis.put("updatedAtEpochMs", Instant.now().toEpochMilli());
        repository.updateWithActivity("ai_analysis_results", analysisId, analysis,
                MonitoringActivity.create(farmId, fieldId, uid, "DISEASE_ANALYSIS_" + analysis.get("status"), "ANALYSIS", analysisId,
                        "Disease analysis status: " + analysis.get("status")));

        image.put("analysisId", analysisId);
        image.put("processingStatus", analysis.get("status"));
        repository.updateWithActivity("field_images", imageId, image,
                MonitoringActivity.create(farmId, fieldId, uid, "CROP_IMAGE_ANALYSIS_LINKED", "IMAGE", imageId, "Image linked to analysis"));
        analysis.put("id", analysisId);
        return analysis;
    }

    private static void applyValidatedResult(Map<String, Object> analysis, Map<String, Object> result) {
        Object status = result.get("status");
        if ("MODEL_UNAVAILABLE".equals(status)) {
            if (result.get("predicted_class") != null || result.get("predicted_class_id") != null ||
                    result.get("confidence_score") != null || Boolean.TRUE.equals(result.get("is_mock"))) {
                throw new IllegalStateException("AI service returned a contradictory unavailable response");
            }
            analysis.put("status", "MODEL_UNAVAILABLE");
            analysis.put("errorCode", result.getOrDefault("error_code", "MODEL_UNAVAILABLE"));
            analysis.put("errorMessage", result.getOrDefault("message", "A trained, evaluated model must be supplied before disease inference is available."));
            analysis.put("limitations", result.getOrDefault("limitations", java.util.List.of("No disease prediction or confidence was produced.")));
            analysis.put("modelName", result.get("model_name"));
            analysis.put("modelVersion", result.get("model_version"));
            return;
        }
        if (!"COMPLETED".equals(status) || Boolean.TRUE.equals(result.get("is_mock"))) throw new IllegalStateException("AI response status is invalid");
        String predictedClass = String.valueOf(result.get("predicted_class"));
        String modelName = String.valueOf(result.get("model_name"));
        String modelVersion = String.valueOf(result.get("model_version"));
        Object score = result.get("confidence_score");
        if (predictedClass.isBlank() || "null".equals(predictedClass) || modelName.isBlank() || "null".equals(modelName) ||
                modelVersion.isBlank() || "null".equals(modelVersion) || !(score instanceof Number number) ||
                !Double.isFinite(number.doubleValue()) || number.doubleValue() < 0 || number.doubleValue() > 1) {
            throw new IllegalStateException("AI response omitted required result fields");
        }
        analysis.put("status", "COMPLETED");
        analysis.put("predictedClass", predictedClass);
        analysis.put("predictedClassId", result.get("predicted_class_id"));
        analysis.put("confidenceScore", number.doubleValue());
        analysis.put("confidenceSemantics", result.get("confidence_semantics"));
        analysis.put("alternatives", result.getOrDefault("alternatives", java.util.List.of()));
        analysis.put("modelName", modelName);
        analysis.put("modelVersion", modelVersion);
        analysis.put("limitations", result.getOrDefault("limitations", java.util.List.of()));
        analysis.put("errorCode", null);
        analysis.put("errorMessage", null);
    }

    public Map<String, Object> get(String farmId, String fieldId, String analysisId, String uid) {
        authorization.requireReadAccess(farmId, fieldId, uid);
        Map<String, Object> result = repository.find("ai_analysis_results", analysisId).orElseThrow(() -> new FieldNotFoundException(analysisId));
        if (!farmId.equals(result.get("farmId")) || !fieldId.equals(result.get("fieldId"))) throw new FieldNotFoundException(analysisId);
        return result;
    }

    public CursorPage<Map<String, Object>> list(String farmId, String fieldId, String uid, String cursor, Integer size) {
        authorization.requireReadAccess(farmId, fieldId, uid);
        return repository.page("ai_analysis_results", farmId, fieldId, CursorPagination.decode(cursor),
                CursorPagination.validatePageSize(size), Map.of(), null, null);
    }

    public Map<String, Object> availability(String farmId, String fieldId, String uid) {
        authorization.requireReadAccess(farmId, fieldId, uid);
        try {
            Map<String, Object> result = aiClient.availability();
            if (Boolean.TRUE.equals(result.get("available")) && "AVAILABLE".equals(result.get("status"))) return result;
            Map<String, Object> unavailable = new LinkedHashMap<>(result);
            unavailable.put("available", false);
            unavailable.put("status", "MODEL_UNAVAILABLE");
            unavailable.putIfAbsent("message", "A trained, evaluated model must be supplied before disease inference is available.");
            return unavailable;
        } catch (RuntimeException e) {
            boolean authMissing = e instanceof IllegalStateException && e.getMessage() != null && e.getMessage().contains("not configured");
            return Map.of("available", false,
                    "status", authMissing ? "AI_SERVICE_AUTH_NOT_CONFIGURED" : "AI_SERVICE_UNAVAILABLE",
                    "error_code", authMissing ? "AI_SERVICE_AUTH_NOT_CONFIGURED" : "AI_SERVICE_UNAVAILABLE",
                    "message", authMissing ? "Disease inference is unavailable because backend service authentication is not configured."
                            : "Disease inference is temporarily unavailable because the AI service could not be reached.");
        }
    }
}
