package com.agroai.service;

import com.agroai.dto.UpdateIrrigationPlanStatusRequest;
import com.agroai.exception.FieldNotFoundException;
import com.agroai.monitoring.MonitoringActivity;
import com.agroai.monitoring.MonitoringAuthorizationService;
import com.agroai.repository.CursorPage;
import com.agroai.repository.FieldMonitoringRepository;
import com.agroai.util.CursorPagination;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class IrrigationPlanningService {
    private final FieldMonitoringRepository repository;
    private final MonitoringAuthorizationService authorization;
    private final String thresholdValue;
    private final String thresholdSource;
    private final String thresholdVersion;

    public IrrigationPlanningService(FieldMonitoringRepository repository, MonitoringAuthorizationService authorization,
            @Value("${agroai.irrigation.moisture-threshold-percent:}") String thresholdValue,
            @Value("${agroai.irrigation.threshold-source:}") String thresholdSource,
            @Value("${agroai.irrigation.threshold-version:unconfigured}") String thresholdVersion) {
        this.repository = repository;
        this.authorization = authorization;
        this.thresholdValue = thresholdValue;
        this.thresholdSource = thresholdSource;
        this.thresholdVersion = thresholdVersion;
    }

    public Map<String, Object> create(String farmId, String fieldId, String uid) {
        authorization.requireWriteAccess(farmId, fieldId, uid);
        var latest = repository.page("soil_telemetry", farmId, fieldId, null, 1,
                Map.of("measurementType", "SOIL_MOISTURE"), null, null).items().stream().findFirst().orElse(null);
        Double moisture = latest == null ? null : ((Number) latest.get("rawValue")).doubleValue();
        Double threshold = parseThreshold();
        String recommendation = "INSUFFICIENT_DATA";
        String rationale = "A configured, sourced threshold and recent valid soil-moisture reading are required.";
        boolean recent = latest != null && latest.get("observedAtEpochMs") instanceof Number observed &&
                observed.longValue() >= Instant.now().minusSeconds(24 * 60 * 60).toEpochMilli();
        boolean valid = latest != null && "VALID".equals(latest.get("validationStatus"));
        if (threshold != null && recent && valid && thresholdSource != null && !thresholdSource.isBlank()) {
            recommendation = moisture <= threshold ? "IRRIGATION_NEEDED" : "NO_IRRIGATION_NEEDED";
            rationale = "Observed soil moisture " + moisture + "% was compared with configured threshold " + threshold + "%.";
        } else if (latest != null && !valid) {
            rationale = "The latest moisture reading is outside validation range and was not used for an irrigation recommendation.";
        } else if (latest != null && !recent) {
            rationale = "The latest soil-moisture reading is older than 24 hours and was not used for an irrigation recommendation.";
        }
        Instant now = Instant.now();
        String id = "irrigation_" + UUID.randomUUID();
        Map<String, Object> plan = new LinkedHashMap<>();
        plan.put("planId", id);
        plan.put("farmId", farmId);
        plan.put("fieldId", fieldId);
        plan.put("createdByUid", uid);
        plan.put("status", "DRAFT");
        plan.put("recommendationStatus", recommendation);
        plan.put("recommendedTiming", recommendation.equals("IRRIGATION_NEEDED") ? "PROMPT_REVIEW" : null);
        plan.put("estimatedWaterLiters", null);
        Map<String, Object> inputSnapshot = new LinkedHashMap<>();
        inputSnapshot.put("soilMoisturePercent", moisture == null ? "MISSING" : moisture);
        inputSnapshot.put("fieldAreaHectares", authorization.requireReadAccess(farmId, fieldId, uid).getAreaHectares());
        plan.put("inputSnapshot", inputSnapshot);
        plan.put("inputTelemetryIds", latest == null ? List.of() : List.of(latest.get("telemetryId")));
        plan.put("thresholdPercent", threshold);
        plan.put("thresholdSource", thresholdSource == null || thresholdSource.isBlank() ? null : thresholdSource);
        plan.put("rulesVersion", thresholdVersion == null || thresholdVersion.isBlank() ? "threshold-unconfigured" : thresholdVersion);
        plan.put("rationale", rationale);
        plan.put("limitations", List.of("Moisture readings older than 24 hours or marked out of range are not used.",
                "No water volume was estimated because soil depth and water-holding capacity inputs are unavailable.",
                "Thresholds are user-configured and are not claimed as scientifically validated crop-specific values."));
        plan.put("createdAt", now.toString());
        plan.put("createdAtEpochMs", now.toEpochMilli());
        repository.createWithActivity("irrigation_plans", id, plan,
                MonitoringActivity.create(farmId, fieldId, uid, "IRRIGATION_PLAN_CREATED", "IRRIGATION_PLAN", id, "Irrigation plan created"));
        plan.put("id", id);
        return plan;
    }

    public CursorPage<Map<String, Object>> list(String farmId, String fieldId, String uid, String cursor, Integer size) {
        authorization.requireReadAccess(farmId, fieldId, uid);
        return repository.page("irrigation_plans", farmId, fieldId, CursorPagination.decode(cursor),
                CursorPagination.validatePageSize(size), Map.of(), null, null);
    }

    public Map<String, Object> get(String farmId, String fieldId, String planId, String uid) {
        authorization.requireReadAccess(farmId, fieldId, uid);
        Map<String, Object> plan = repository.find("irrigation_plans", planId).orElseThrow(() -> new FieldNotFoundException(planId));
        if (!farmId.equals(plan.get("farmId")) || !fieldId.equals(plan.get("fieldId"))) throw new FieldNotFoundException(planId);
        return plan;
    }

    public Map<String, Object> updateStatus(String farmId, String fieldId, String planId, String uid,
                                           UpdateIrrigationPlanStatusRequest request) {
        authorization.requireManager(farmId, uid);
        Map<String, Object> plan = get(farmId, fieldId, planId, uid);
        String target = request.status().trim().toUpperCase();
        String current = String.valueOf(plan.get("status"));
        boolean allowed = switch (current) {
            case "DRAFT" -> List.of("SCHEDULED", "CANCELLED").contains(target);
            case "SCHEDULED" -> List.of("COMPLETED", "CANCELLED").contains(target);
            default -> false;
        };
        if (!allowed) throw new IllegalArgumentException("Invalid irrigation plan status transition");
        plan.put("status", target);
        plan.put("statusNote", request.note());
        plan.put("updatedAt", Instant.now().toString());
        plan.put("updatedAtEpochMs", Instant.now().toEpochMilli());
        repository.updateWithActivity("irrigation_plans", planId, plan,
                MonitoringActivity.create(farmId, fieldId, uid, "IRRIGATION_PLAN_" + target, "IRRIGATION_PLAN", planId,
                        "Irrigation plan status changed to " + target));
        return plan;
    }

    private Double parseThreshold() {
        if (thresholdValue == null || thresholdValue.isBlank()) return null;
        try {
            double value = Double.parseDouble(thresholdValue);
            return Double.isFinite(value) && value >= 0 && value <= 100 ? value : null;
        } catch (NumberFormatException ignored) { return null; }
    }
}
