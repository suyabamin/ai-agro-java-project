package com.agroai.service;

import com.agroai.monitoring.MonitoringActivity;
import com.agroai.monitoring.MonitoringAuthorizationService;
import com.agroai.repository.CursorPage;
import com.agroai.repository.FieldMonitoringRepository;
import com.agroai.util.CursorPagination;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Evidence aggregation only; it does not produce disease classifications or unsupported agronomic claims. */
@Service
public class AgriculturalAnalysisService {
    private final FieldMonitoringRepository repository;
    private final MonitoringAuthorizationService authorization;
    private final AiInferenceClient aiClient;

    public AgriculturalAnalysisService(FieldMonitoringRepository repository,
                                       MonitoringAuthorizationService authorization,
                                       AiInferenceClient aiClient) {
        this.repository = repository;
        this.authorization = authorization;
        this.aiClient = aiClient;
    }

    public Map<String, Object> create(String farmId, String fieldId, String uid) {
        var field = authorization.requireWriteAccess(farmId, fieldId, uid);
        CursorPage<Map<String, Object>> telemetry = repository.page("soil_telemetry", farmId, fieldId, null,
                CursorPagination.MAX_PAGE_SIZE, Map.of(), null, null);
        List<Map<String, Object>> evidence = telemetry.items();
        Instant now = Instant.now();
        String id = "analysis_" + UUID.randomUUID();
        List<String> risks = evidence.stream().filter(item -> "OUT_OF_RANGE".equals(item.get("validationStatus")))
                .map(item -> "Out-of-range " + item.get("measurementType") + " reading: " + item.get("telemetryId"))
                .toList();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("analysisId", id);
        result.put("analysisType", "AGRICULTURAL_EVIDENCE_SUMMARY");
        result.put("farmId", farmId);
        result.put("fieldId", fieldId);
        result.put("initiatedByUid", uid);
        result.put("status", evidence.isEmpty() ? "INSUFFICIENT_DATA" : "COMPLETED");
        result.put("cropType", field.getCropType() == null ? null : field.getCropType().name());
        result.put("fieldAreaHectares", field.getAreaHectares());
        result.put("telemetryRecordCount", evidence.size());
        result.put("telemetryReferences", evidence.stream().map(item -> item.get("telemetryId")).toList());
        result.put("measurements", evidence.stream().map(item -> Map.of("measurementType", item.get("measurementType"),
                "value", item.get("rawValue"), "unit", item.get("unit"), "observedAt", item.get("observedAt"),
                "validationStatus", item.get("validationStatus"))).toList());
        result.put("riskIndicators", risks);
        result.put("recommendations", List.of());
        result.put("diseaseDetectionStatus", "MODEL_UNAVAILABLE");
        result.put("predictedDisease", null);
        result.put("confidenceScore", null);

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
                result.put("tabularStatus", "COMPLETED");
                result.put("predictedWaterNeed", aiResult.get("water_need"));
                result.put("predictedFieldStatus", aiResult.get("field_status"));
                result.put("waterNeedConfidence", aiResult.get("water_need_confidence"));
                result.put("fieldStatusConfidence", aiResult.get("field_status_confidence"));
                result.put("recommendedCrop", aiResult.get("recommended_crop"));
                result.put("cropConfidence", aiResult.get("crop_confidence"));
                result.put("tabularModelVersion", aiResult.get("model_version"));
                result.put("labelProvenance", "rule_derived");
                result.put("labelMethod", "agronomic_rule_v1");
                result.put("tabularDisclaimer", aiResult.get("disclaimer"));
            } catch (Exception e) {
                result.put("tabularStatus", "FAILED");
                result.put("tabularErrorMessage", e.getMessage());
            }
        } else {
            result.put("tabularStatus", "INSUFFICIENT_TELEMETRY");
        }

        result.put("ruleVersion", "evidence-summary-v1");
        result.put("explanation", "This record summarizes stored field and soil measurements with tabular ML inference when complete readings are present.");
        result.put("limitations", List.of("Disease detection is unavailable until the user's trained and evaluated model is supplied.",
                "Tabular Water Need and Field Status are predicted using models trained on rule-derived agronomic labels (label_method=agronomic_rule_v1).",
                evidence.isEmpty() ? "No telemetry records were available at analysis time." : "This summary does not infer unmeasured soil conditions."));
        result.put("createdAt", now.toString());
        result.put("createdAtEpochMs", now.toEpochMilli());
        repository.createWithActivity("ai_analysis_results", id, result,
                MonitoringActivity.create(farmId, fieldId, uid, "AGRICULTURAL_ANALYSIS_" + result.get("status"), "ANALYSIS", id,
                        "Agricultural evidence summary created"));
        result.put("id", id);
        return result;
    }
}
