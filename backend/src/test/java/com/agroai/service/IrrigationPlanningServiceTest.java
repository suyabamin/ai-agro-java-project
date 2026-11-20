package com.agroai.service;

import com.agroai.dto.UpdateIrrigationPlanStatusRequest;
import com.agroai.model.Field;
import com.agroai.monitoring.MonitoringAuthorizationService;
import com.agroai.repository.CursorPage;
import com.agroai.repository.FieldMonitoringRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class IrrigationPlanningServiceTest {
    private FieldMonitoringRepository repository;
    private MonitoringAuthorizationService authorization;

    @BeforeEach
    void setUp() {
        repository = mock(FieldMonitoringRepository.class);
        authorization = mock(MonitoringAuthorizationService.class);

        Field field = new Field("field-1", "plot-1", "farm-1", "Paddy Alpha", 5.0);
        when(authorization.requireReadAccess(anyString(), anyString(), anyString())).thenReturn(field);
    }

    @Test
    void producesInsufficientDataWhenThresholdUnconfigured() {
        // thresholdValue is empty/unconfigured
        IrrigationPlanningService service = new IrrigationPlanningService(repository, authorization, "", "", "unconfigured");

        Map<String, Object> latestReading = new LinkedHashMap<>();
        latestReading.put("telemetryId", "tel-1");
        latestReading.put("rawValue", 35.0);
        latestReading.put("observedAtEpochMs", Instant.now().minusSeconds(3600).toEpochMilli());
        latestReading.put("validationStatus", "VALID");

        when(repository.page(eq("soil_telemetry"), anyString(), anyString(), any(), eq(1), anyMap(), any(), any()))
                .thenReturn(new CursorPage<>(List.of(latestReading), null, false));

        Map<String, Object> plan = service.create("farm-1", "field-1", "user-1");

        assertEquals("INSUFFICIENT_DATA", plan.get("recommendationStatus"));
        assertNull(plan.get("estimatedWaterLiters"));
        assertNull(plan.get("thresholdPercent"));
    }

    @Test
    void producesInsufficientDataWhenMoistureReadingIsOlderThan24Hours() {
        // Configured threshold at 40%
        IrrigationPlanningService service = new IrrigationPlanningService(repository, authorization, "40.0", "operator-manual", "1.0.0");

        Map<String, Object> oldReading = new LinkedHashMap<>();
        oldReading.put("telemetryId", "tel-old");
        oldReading.put("rawValue", 30.0);
        // 25 hours old
        oldReading.put("observedAtEpochMs", Instant.now().minusSeconds(25 * 3600).toEpochMilli());
        oldReading.put("validationStatus", "VALID");

        when(repository.page(eq("soil_telemetry"), anyString(), anyString(), any(), eq(1), anyMap(), any(), any()))
                .thenReturn(new CursorPage<>(List.of(oldReading), null, false));

        Map<String, Object> plan = service.create("farm-1", "field-1", "user-1");

        assertEquals("INSUFFICIENT_DATA", plan.get("recommendationStatus"));
        assertTrue(String.valueOf(plan.get("rationale")).contains("older than 24 hours"));
    }

    @Test
    void recommendsIrrigationNeededWhenRecentValidMoistureIsBelowThreshold() {
        IrrigationPlanningService service = new IrrigationPlanningService(repository, authorization, "40.0", "operator-manual", "1.0.0");

        Map<String, Object> reading = new LinkedHashMap<>();
        reading.put("telemetryId", "tel-dry");
        reading.put("rawValue", 28.5); // 28.5% <= 40% threshold -> Irrigation needed
        reading.put("observedAtEpochMs", Instant.now().minusSeconds(1800).toEpochMilli());
        reading.put("validationStatus", "VALID");

        when(repository.page(eq("soil_telemetry"), anyString(), anyString(), any(), eq(1), anyMap(), any(), any()))
                .thenReturn(new CursorPage<>(List.of(reading), null, false));

        Map<String, Object> plan = service.create("farm-1", "field-1", "user-1");

        assertEquals("IRRIGATION_NEEDED", plan.get("recommendationStatus"));
        assertEquals("PROMPT_REVIEW", plan.get("recommendedTiming"));
        assertNull(plan.get("estimatedWaterLiters"), "Water quantity must remain null without agronomic crop models");
        assertEquals(40.0, plan.get("thresholdPercent"));
    }

    @Test
    void recommendsNoIrrigationNeededWhenRecentValidMoistureIsAboveThreshold() {
        IrrigationPlanningService service = new IrrigationPlanningService(repository, authorization, "40.0", "operator-manual", "1.0.0");

        Map<String, Object> reading = new LinkedHashMap<>();
        reading.put("telemetryId", "tel-wet");
        reading.put("rawValue", 55.0); // 55% > 40% threshold -> No irrigation needed
        reading.put("observedAtEpochMs", Instant.now().minusSeconds(1800).toEpochMilli());
        reading.put("validationStatus", "VALID");

        when(repository.page(eq("soil_telemetry"), anyString(), anyString(), any(), eq(1), anyMap(), any(), any()))
                .thenReturn(new CursorPage<>(List.of(reading), null, false));

        Map<String, Object> plan = service.create("farm-1", "field-1", "user-1");

        assertEquals("NO_IRRIGATION_NEEDED", plan.get("recommendationStatus"));
        assertNull(plan.get("recommendedTiming"));
        assertNull(plan.get("estimatedWaterLiters"));
    }

    @Test
    void updatesPlanStatusWithAuditActivity() {
        IrrigationPlanningService service = new IrrigationPlanningService(repository, authorization, "40.0", "operator-manual", "1.0.0");

        Map<String, Object> plan = new LinkedHashMap<>();
        plan.put("planId", "plan-123");
        plan.put("farmId", "farm-1");
        plan.put("fieldId", "field-1");
        plan.put("status", "DRAFT");

        when(repository.find("irrigation_plans", "plan-123")).thenReturn(Optional.of(plan));

        UpdateIrrigationPlanStatusRequest request = new UpdateIrrigationPlanStatusRequest("SCHEDULED", "Scheduled for 06:00 tomorrow");
        Map<String, Object> updated = service.updateStatus("farm-1", "field-1", "plan-123", "user-1", request);

        assertEquals("SCHEDULED", updated.get("status"));
        assertEquals("Scheduled for 06:00 tomorrow", updated.get("statusNote"));
        verify(repository).updateWithActivity(eq("irrigation_plans"), eq("plan-123"), anyMap(), anyMap());
    }
}
