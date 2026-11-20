package com.agroai.service;

import com.agroai.dto.SubmitTelemetryRequest;
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

@Service
public class SoilTelemetryService {
    private final FieldMonitoringRepository repository;
    private final MonitoringAuthorizationService authorization;

    public SoilTelemetryService(FieldMonitoringRepository repository, MonitoringAuthorizationService authorization) {
        this.repository = repository;
        this.authorization = authorization;
    }

    public Map<String, Object> submit(String farmId, String fieldId, String uid, SubmitTelemetryRequest request) {
        authorization.requireWriteAccess(farmId, fieldId, uid);
        if (request == null || request.measurementType() == null || request.value() == null || request.observedAt() == null) {
            throw new IllegalArgumentException("Measurement type, numeric value and observation time are required");
        }
        if (!Double.isFinite(request.value())) throw new IllegalArgumentException("Telemetry value must be a finite number");
        if (request.observedAt().isAfter(Instant.now().plusSeconds(300))) throw new IllegalArgumentException("Future telemetry timestamps are not accepted");
        Measurement measurement;
        try { measurement = Measurement.valueOf(request.measurementType().trim().toUpperCase()); }
        catch (IllegalArgumentException e) { throw new IllegalArgumentException("Unsupported soil measurement type"); }
        String unit = request.unit().trim();
        if (!measurement.unit.equalsIgnoreCase(unit)) throw new IllegalArgumentException("Expected unit " + measurement.unit + " for " + measurement.name());
        String source = request.source().trim().toUpperCase();
        if (!List.of("MANUAL", "SENSOR", "IMPORT").contains(source)) throw new IllegalArgumentException("Source must be MANUAL, SENSOR, or IMPORT");
        if (source.equals("SENSOR") && (request.sensorId() == null || request.sensorId().isBlank())) throw new IllegalArgumentException("Sensor ID is required for SENSOR readings");
        if (request.clientEventId() != null && !request.clientEventId().isBlank() && !request.clientEventId().matches("[A-Za-z0-9._:-]{1,100}")) {
            throw new IllegalArgumentException("clientEventId contains unsupported characters");
        }

        String id = request.clientEventId() == null || request.clientEventId().isBlank()
                ? "telemetry_" + UUID.randomUUID()
                : "telemetry_" + UUID.nameUUIDFromBytes((farmId + "|" + fieldId + "|" + uid + "|" + request.clientEventId()).getBytes(java.nio.charset.StandardCharsets.UTF_8));
        var existing = repository.find("soil_telemetry", id);
        if (existing.isPresent()) {
            Map<String, Object> prior = existing.get();
            if (!uid.equals(prior.get("submittedByUid")) || !request.value().equals(prior.get("rawValue")) ||
                    !measurement.name().equals(prior.get("measurementType")) || !measurement.unit.equalsIgnoreCase(unit) ||
                    !request.observedAt().toString().equals(prior.get("observedAt")) || !source.equals(prior.get("source")) ||
                    !java.util.Objects.equals(request.sensorId(), prior.get("sensorId"))) {
                throw new IllegalArgumentException("Idempotency key was already used for a different reading");
            }
            return prior;
        }

        Instant now = Instant.now();
        boolean inRange = request.value() >= measurement.min && request.value() <= measurement.max;
        List<String> warnings = inRange ? List.of() : List.of("Reading is outside the configured physical validation range");
        Map<String, Object> reading = new LinkedHashMap<>();
        reading.put("telemetryId", id);
        reading.put("farmId", farmId);
        reading.put("fieldId", fieldId);
        reading.put("submittedByUid", uid);
        reading.put("sensorId", request.sensorId());
        reading.put("measurementType", measurement.name());
        reading.put("rawValue", request.value());
        reading.put("value", request.value());
        reading.put("unit", measurement.unit);
        reading.put("observedAt", request.observedAt().toString());
        reading.put("observedAtEpochMs", request.observedAt().toEpochMilli());
        reading.put("source", source);
        reading.put("validationStatus", inRange ? "VALID" : "OUT_OF_RANGE");
        reading.put("warnings", warnings);
        reading.put("createdAt", now.toString());
        // Order telemetry pages by observation time, preserving out-of-order source events.
        reading.put("createdAtEpochMs", request.observedAt().toEpochMilli());
        reading.put("ingestedAtEpochMs", now.toEpochMilli());
        reading.put("clientEventId", request.clientEventId());
        repository.createWithActivity("soil_telemetry", id, reading,
                MonitoringActivity.create(farmId, fieldId, uid, "SOIL_TELEMETRY_RECORDED", "TELEMETRY", id,
                        measurement.name() + " reading recorded (" + reading.get("validationStatus") + ")"));
        reading.put("id", id);
        return reading;
    }

    public CursorPage<Map<String, Object>> history(String farmId, String fieldId, String uid,
            String cursor, Integer size, String measurementType, Long fromEpochMs, Long toEpochMs) {
        authorization.requireReadAccess(farmId, fieldId, uid);
        int pageSize = CursorPagination.validatePageSize(size);
        if (fromEpochMs != null && toEpochMs != null && fromEpochMs > toEpochMs) throw new IllegalArgumentException("from must be earlier than to");
        Map<String, Object> filters = Map.of();
        if (measurementType != null && !measurementType.isBlank()) {
            try { filters = Map.of("measurementType", Measurement.valueOf(measurementType.trim().toUpperCase()).name()); }
            catch (IllegalArgumentException e) { throw new IllegalArgumentException("Unsupported soil measurement type"); }
        }
        return repository.page("soil_telemetry", farmId, fieldId, CursorPagination.decode(cursor), pageSize, filters, fromEpochMs, toEpochMs);
    }

    public List<Map<String, Object>> latest(String farmId, String fieldId, String uid) {
        authorization.requireReadAccess(farmId, fieldId, uid);
        CursorPage<Map<String, Object>> first = repository.page("soil_telemetry", farmId, fieldId, null,
                CursorPagination.MAX_PAGE_SIZE, Map.of(), null, null);
        Map<String, Map<String, Object>> latestByMeasurement = new LinkedHashMap<>();
        for (Map<String, Object> reading : first.items()) latestByMeasurement.putIfAbsent(String.valueOf(reading.get("measurementType")), reading);
        return List.copyOf(latestByMeasurement.values());
    }

    private enum Measurement {
        SOIL_MOISTURE("%", 0, 100),
        SOIL_TEMPERATURE("C", -20, 80),
        SOIL_PH("pH", 0, 14),
        ELECTRICAL_CONDUCTIVITY("mS/cm", 0, 100),
        NITROGEN("mg/kg", 0, 10000),
        PHOSPHORUS("mg/kg", 0, 10000),
        POTASSIUM("mg/kg", 0, 10000),
        AIR_TEMPERATURE("C", -20, 60),
        RELATIVE_HUMIDITY("%", 0, 100),
        RAINFALL("mm", 0, 10000);
        private final String unit; private final double min; private final double max;
        Measurement(String unit, double min, double max) { this.unit = unit; this.min = min; this.max = max; }
    }
}
