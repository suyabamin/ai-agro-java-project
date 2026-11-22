package com.agroai.service;

import com.agroai.exception.FieldNotFoundException;
import com.agroai.model.Field;
import com.agroai.model.FieldStatus;
import com.agroai.monitoring.MonitoringActivity;
import com.agroai.monitoring.MonitoringAuthorizationService;
import com.agroai.repository.CursorPage;
import com.agroai.repository.FieldMonitoringRepository;
import com.agroai.repository.FieldRepository;
import com.agroai.util.CursorPagination;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;

/** Evidence aggregation only; it does not produce disease classifications or unsupported agronomic claims. */
@Service
public class AgriculturalAnalysisService {
    private static final Logger log = LoggerFactory.getLogger(AgriculturalAnalysisService.class);

    private final FieldMonitoringRepository repository;
    private final MonitoringAuthorizationService authorization;
    private final AiInferenceClient aiClient;
    private final Executor executor;
    private final FieldRepository fieldRepository;

    public AgriculturalAnalysisService(FieldMonitoringRepository repository,
                                       MonitoringAuthorizationService authorization,
                                       AiInferenceClient aiClient) {
        this(repository, authorization, aiClient, java.util.concurrent.ForkJoinPool.commonPool(), null);
    }

    public AgriculturalAnalysisService(FieldMonitoringRepository repository,
                                       MonitoringAuthorizationService authorization,
                                       AiInferenceClient aiClient,
                                       Executor executor) {
        this(repository, authorization, aiClient, executor, null);
    }

    @Autowired
    public AgriculturalAnalysisService(FieldMonitoringRepository repository,
                                       MonitoringAuthorizationService authorization,
                                       AiInferenceClient aiClient,
                                       @org.springframework.beans.factory.annotation.Qualifier("analysisTaskExecutor") Executor executor,
                                       @Autowired(required = false) FieldRepository fieldRepository) {
        this.repository = repository;
        this.authorization = authorization;
        this.aiClient = aiClient;
        this.executor = executor != null ? executor : java.util.concurrent.ForkJoinPool.commonPool();
        this.fieldRepository = fieldRepository;
    }

    public Map<String, Object> create(String farmId, String fieldId, String uid) {
        return create(farmId, fieldId, uid, false);
    }

    public Map<String, Object> create(String farmId, String fieldId, String uid, boolean async) {
        Field field = authorization.requireWriteAccess(farmId, fieldId, uid);
        String resolvedFieldId = field != null && field.getFieldId() != null ? field.getFieldId() : fieldId;

        Instant now = Instant.now();
        String id = "analysis_" + UUID.randomUUID();

        Map<String, Object> record = new LinkedHashMap<>();
        record.put("analysisId", id);
        record.put("id", id);
        record.put("analysisType", "AGRICULTURAL_EVIDENCE_SUMMARY");
        record.put("farmId", farmId);
        record.put("fieldId", resolvedFieldId);
        record.put("initiatedByUid", uid);
        record.put("status", "PENDING");
        record.put("cropType", field != null && field.getCropType() != null ? field.getCropType().name() : null);
        record.put("fieldAreaHectares", field != null ? field.getAreaHectares() : null);
        record.put("telemetryRecordCount", 0);
        record.put("telemetryReferences", List.of());
        record.put("measurements", List.of());
        record.put("riskIndicators", List.of());
        record.put("recommendations", List.of());
        record.put("diseaseDetectionStatus", "MODEL_UNAVAILABLE");
        record.put("predictedDisease", null);
        record.put("confidenceScore", null);
        record.put("tabularStatus", "PENDING");
        record.put("ruleVersion", "evidence-summary-v1");
        record.put("explanation", "This record summarizes stored field and soil measurements with tabular ML inference when complete readings are present.");
        record.put("limitations", List.of("Disease detection is unavailable until the user's trained and evaluated model is supplied.",
                "Tabular Water Need and Field Status are predicted using models trained on rule-derived agronomic labels (label_method=agronomic_rule_v1)."));
        record.put("createdAt", now.toString());
        record.put("createdAtEpochMs", now.toEpochMilli());

        repository.createWithActivity("ai_analysis_results", id, record,
                MonitoringActivity.create(farmId, resolvedFieldId, uid, "AGRICULTURAL_ANALYSIS_REQUESTED", "ANALYSIS", id,
                        "Agricultural evidence summary requested"));

        if (async) {
            Map<String, Object> asyncCopy = new LinkedHashMap<>(record);
            CompletableFuture.runAsync(() -> executeInferenceLifecycle(id, farmId, resolvedFieldId, field, uid, asyncCopy), executor);
            return new LinkedHashMap<>(record);
        } else {
            executeInferenceLifecycle(id, farmId, resolvedFieldId, field, uid, record);
            return record;
        }
    }

    private void executeInferenceLifecycle(String analysisId, String farmId, String resolvedFieldId, Field field, String uid, Map<String, Object> record) {
        try {
            record.put("status", "PROCESSING");
            record.put("tabularStatus", "PROCESSING");
            record.put("updatedAt", Instant.now().toString());
            record.put("updatedAtEpochMs", Instant.now().toEpochMilli());
            repository.updateWithActivity("ai_analysis_results", analysisId, record,
                    MonitoringActivity.create(farmId, resolvedFieldId, uid, "AGRICULTURAL_ANALYSIS_PROCESSING", "ANALYSIS", analysisId,
                            "Agricultural evidence summary processing started"));

            CursorPage<Map<String, Object>> telemetry = repository.page("soil_telemetry", farmId, resolvedFieldId, null,
                    CursorPagination.MAX_PAGE_SIZE, Map.of(), null, null);
            List<Map<String, Object>> evidence = telemetry.items();
            List<String> risks = evidence.stream().filter(item -> "OUT_OF_RANGE".equals(item.get("validationStatus")))
                    .map(item -> "Out-of-range " + item.get("measurementType") + " reading: " + item.get("telemetryId"))
                    .toList();

            record.put("status", evidence.isEmpty() ? "INSUFFICIENT_DATA" : "COMPLETED");
            record.put("telemetryRecordCount", evidence.size());
            record.put("telemetryReferences", evidence.stream().map(item -> item.get("telemetryId")).toList());
            record.put("measurements", evidence.stream().map(item -> Map.of(
                    "measurementType", item.get("measurementType"),
                    "value", item.get("rawValue"),
                    "unit", item.get("unit"),
                    "observedAt", item.get("observedAt"),
                    "validationStatus", item.get("validationStatus")
            )).toList());
            record.put("riskIndicators", risks);

            // Tabular AI analysis (Water Need and Field Status)
            Double nVal = null, pVal = null, kVal = null, tempVal = null, humVal = null, phVal = null, rainVal = null, moistureVal = null;
            for (Map<String, Object> item : evidence) {
                String type = String.valueOf(item.get("measurementType"));
                Object raw = item.get("rawValue");
                if (raw instanceof Number num) {
                    double val = num.doubleValue();
                    switch (type) {
                        case "NITROGEN" -> { if (nVal == null) nVal = val; }
                        case "PHOSPHORUS" -> { if (pVal == null) pVal = val; }
                        case "POTASSIUM" -> { if (kVal == null) kVal = val; }
                        case "AIR_TEMPERATURE", "SOIL_TEMPERATURE" -> { if (tempVal == null) tempVal = val; }
                        case "RELATIVE_HUMIDITY" -> { if (humVal == null) humVal = val; }
                        case "SOIL_PH" -> { if (phVal == null) phVal = val; }
                        case "RAINFALL" -> { if (rainVal == null) rainVal = val; }
                        case "SOIL_MOISTURE" -> { if (moistureVal == null) moistureVal = val; }
                    }
                }
            }

            if (nVal != null && pVal != null && kVal != null && tempVal != null &&
                humVal != null && phVal != null && rainVal != null && moistureVal != null && aiClient != null) {
                try {
                    Map<String, Object> featMap = Map.of(
                            "n", nVal, "p", pVal, "k", kVal,
                            "temperature", tempVal, "humidity", humVal,
                            "ph", phVal, "rainfall", rainVal,
                            "soil_moisture", moistureVal
                    );
                    Map<String, Object> aiResult = aiClient.inferTabular(featMap);
                    record.put("tabularStatus", "COMPLETED");
                    record.put("predictedWaterNeed", aiResult.get("water_need"));
                    record.put("predictedFieldStatus", aiResult.get("field_status"));
                    record.put("waterNeedConfidence", aiResult.get("water_need_confidence"));
                    record.put("fieldStatusConfidence", aiResult.get("field_status_confidence"));
                    record.put("recommendedCrop", aiResult.get("recommended_crop"));
                    record.put("cropConfidence", aiResult.get("crop_confidence"));
                    record.put("tabularModelVersion", aiResult.get("model_version"));
                    record.put("labelProvenance", "rule_derived");
                    record.put("labelMethod", "agronomic_rule_v1");
                    record.put("tabularDisclaimer", aiResult.get("disclaimer"));
                } catch (Exception e) {
                    log.warn("Tabular AI inference failed for analysis {}: {}", analysisId, e.getMessage());
                    record.put("tabularStatus", "FAILED");
                    record.put("tabularErrorMessage", e.getMessage());
                }
            } else {
                record.put("tabularStatus", "INSUFFICIENT_TELEMETRY");
            }

            record.put("limitations", List.of(
                    "Disease detection is unavailable until the user's trained and evaluated model is supplied.",
                    "Tabular Water Need and Field Status are predicted using models trained on rule-derived agronomic labels (label_method=agronomic_rule_v1).",
                    evidence.isEmpty() ? "No telemetry records were available at analysis time." : "This summary does not infer unmeasured soil conditions."
            ));
            record.put("updatedAt", Instant.now().toString());
            record.put("updatedAtEpochMs", Instant.now().toEpochMilli());

            repository.updateWithActivity("ai_analysis_results", analysisId, record,
                    MonitoringActivity.create(farmId, resolvedFieldId, uid, "AGRICULTURAL_ANALYSIS_" + record.get("status"), "ANALYSIS", analysisId,
                            "Agricultural evidence summary completed (" + record.get("status") + ")"));
        } catch (Exception e) {
            log.error("Failed to execute agricultural analysis lifecycle for {}", analysisId, e);
            record.put("status", "FAILED");
            record.put("tabularStatus", "FAILED");
            record.put("errorMessage", e.getMessage());
            record.put("updatedAt", Instant.now().toString());
            record.put("updatedAtEpochMs", Instant.now().toEpochMilli());
            try {
                repository.updateWithActivity("ai_analysis_results", analysisId, record,
                        MonitoringActivity.create(farmId, resolvedFieldId, uid, "AGRICULTURAL_ANALYSIS_FAILED", "ANALYSIS", analysisId,
                                "Agricultural analysis failed"));
            } catch (Exception ex) {
                log.error("Failed to persist failed analysis state", ex);
            }
        }
    }

    public Map<String, Object> get(String farmId, String fieldId, String analysisId, String uid) {
        Field authorizedField = authorization.requireReadAccess(farmId, fieldId, uid);
        String resolvedFieldId = authorizedField != null && authorizedField.getFieldId() != null ? authorizedField.getFieldId() : fieldId;
        Map<String, Object> result = repository.find("ai_analysis_results", analysisId)
                .orElseThrow(() -> new FieldNotFoundException(analysisId));
        if (!farmId.equals(result.get("farmId")) || !resolvedFieldId.equals(result.get("fieldId"))) {
            throw new FieldNotFoundException(analysisId);
        }
        return result;
    }

    public CursorPage<Map<String, Object>> list(String farmId, String fieldId, String uid, String cursor, Integer size) {
        Field authorizedField = authorization.requireReadAccess(farmId, fieldId, uid);
        String resolvedFieldId = authorizedField != null && authorizedField.getFieldId() != null ? authorizedField.getFieldId() : fieldId;
        int pageSize = CursorPagination.validatePageSize(size);
        return repository.page("ai_analysis_results", farmId, resolvedFieldId, CursorPagination.decode(cursor),
                pageSize, Map.of(), null, null);
    }

    public Map<String, Map<String, Object>> getLatestForFarm(String farmId, String uid) {
        authorization.requireFarmReadAccess(farmId, uid);
        Map<String, Map<String, Object>> results = new LinkedHashMap<>();
        if (fieldRepository == null) {
            return results;
        }
        List<Field> farmFields = fieldRepository.findByFarmId(farmId);
        if (farmFields == null || farmFields.isEmpty()) {
            return results;
        }
        for (Field f : farmFields) {
            if (f.getStatus() == FieldStatus.ARCHIVED) {
                continue;
            }
            String canonicalFieldId = f.getFieldId();
            if (canonicalFieldId == null || canonicalFieldId.isBlank()) {
                continue;
            }
            CursorPage<Map<String, Object>> pageCanonical = repository.page("ai_analysis_results", farmId, canonicalFieldId, null, 1, Map.of(), null, null);
            Map<String, Object> chosen = null;
            if (pageCanonical != null && !pageCanonical.items().isEmpty()) {
                chosen = pageCanonical.items().get(0);
            }
            if (f.getLocalFieldId() != null && !f.getLocalFieldId().isBlank() && !f.getLocalFieldId().equals(canonicalFieldId)) {
                CursorPage<Map<String, Object>> pageLocal = repository.page("ai_analysis_results", farmId, f.getLocalFieldId(), null, 1, Map.of(), null, null);
                if (pageLocal != null && !pageLocal.items().isEmpty()) {
                    Map<String, Object> localItem = pageLocal.items().get(0);
                    if (chosen == null || extractEpochMs(localItem) > extractEpochMs(chosen)) {
                        chosen = localItem;
                    }
                }
            }
            if (chosen != null) {
                results.put(canonicalFieldId, chosen);
                if (f.getLocalFieldId() != null && !f.getLocalFieldId().isBlank()) {
                    results.put(f.getLocalFieldId(), chosen);
                }
            }
        }
        return results;
    }

    private long extractEpochMs(Map<String, Object> record) {
        if (record == null) return 0L;
        Object val = record.get("createdAtEpochMs");
        if (val instanceof Number num) return num.longValue();
        Object createdStr = record.get("createdAt");
        if (createdStr != null) {
            try {
                return Instant.parse(createdStr.toString()).toEpochMilli();
            } catch (Exception ignored) {}
        }
        return 0L;
    }
}
