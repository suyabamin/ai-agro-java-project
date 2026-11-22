package com.agroai.service;

import com.agroai.model.CropType;
import com.agroai.model.Field;
import com.agroai.monitoring.MonitoringAuthorizationService;
import com.agroai.repository.CursorPage;
import com.agroai.repository.FieldMonitoringRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AgriculturalAnalysisServiceTest {
    private FieldMonitoringRepository repository;
    private MonitoringAuthorizationService authorization;
    private AiInferenceClient aiClient;
    private AgriculturalAnalysisService service;

    @BeforeEach
    void setUp() {
        repository = mock(FieldMonitoringRepository.class);
        authorization = mock(MonitoringAuthorizationService.class);
        aiClient = mock(AiInferenceClient.class);
        service = new AgriculturalAnalysisService(repository, authorization, aiClient);
    }

    @Test
    void createsAgriculturalAnalysisWithTabularInferenceWhenReadingsPresent() {
        Field mockField = new Field();
        mockField.setFieldId("field-1");
        mockField.setFarmId("farm-1");
        mockField.setCropType(CropType.RICE);
        mockField.setAreaHectares(5.0);
        when(authorization.requireWriteAccess("farm-1", "field-1", "uid-1")).thenReturn(mockField);

        List<Map<String, Object>> telemetryItems = List.of(
                Map.of("measurementType", "NITROGEN", "rawValue", 90.0, "unit", "mg/kg", "observedAt", Instant.now().toString(), "validationStatus", "VALID", "telemetryId", "t-1"),
                Map.of("measurementType", "PHOSPHORUS", "rawValue", 42.0, "unit", "mg/kg", "observedAt", Instant.now().toString(), "validationStatus", "VALID", "telemetryId", "t-2"),
                Map.of("measurementType", "POTASSIUM", "rawValue", 43.0, "unit", "mg/kg", "observedAt", Instant.now().toString(), "validationStatus", "VALID", "telemetryId", "t-3"),
                Map.of("measurementType", "AIR_TEMPERATURE", "rawValue", 24.5, "unit", "C", "observedAt", Instant.now().toString(), "validationStatus", "VALID", "telemetryId", "t-4"),
                Map.of("measurementType", "RELATIVE_HUMIDITY", "rawValue", 78.0, "unit", "%", "observedAt", Instant.now().toString(), "validationStatus", "VALID", "telemetryId", "t-5"),
                Map.of("measurementType", "SOIL_PH", "rawValue", 6.5, "unit", "pH", "observedAt", Instant.now().toString(), "validationStatus", "VALID", "telemetryId", "t-6"),
                Map.of("measurementType", "RAINFALL", "rawValue", 150.0, "unit", "mm", "observedAt", Instant.now().toString(), "validationStatus", "VALID", "telemetryId", "t-7"),
                Map.of("measurementType", "SOIL_MOISTURE", "rawValue", 45.0, "unit", "%", "observedAt", Instant.now().toString(), "validationStatus", "VALID", "telemetryId", "t-8")
        );

        CursorPage<Map<String, Object>> page = new CursorPage<>(telemetryItems, null, false);
        when(repository.page(eq("soil_telemetry"), eq("farm-1"), eq("field-1"), isNull(), anyInt(), anyMap(), isNull(), isNull()))
                .thenReturn(page);

        when(aiClient.inferTabular(anyMap())).thenReturn(Map.of(
                "water_need", "Low",
                "field_status", "Healthy",
                "water_need_confidence", 0.98,
                "field_status_confidence", 0.95,
                "recommended_crop", "rice",
                "crop_confidence", 0.99,
                "model_version", "tabular-pipeline-v2.0",
                "disclaimer", "Agronomic rule-derived model notice"
        ));

        Map<String, Object> result = service.create("farm-1", "field-1", "uid-1");

        assertNotNull(result);
        assertEquals("COMPLETED", result.get("status"));
        assertEquals("COMPLETED", result.get("tabularStatus"));
        assertEquals("Low", result.get("predictedWaterNeed"));
        assertEquals("Healthy", result.get("predictedFieldStatus"));
        assertEquals("rice", result.get("recommendedCrop"));
        assertEquals(0.98, result.get("waterNeedConfidence"));
        assertEquals("tabular-pipeline-v2.0", result.get("tabularModelVersion"));
        assertEquals("rule_derived", result.get("labelProvenance"));
        assertEquals("MODEL_UNAVAILABLE", result.get("diseaseDetectionStatus"));
        assertNull(result.get("predictedDisease"));

        verify(aiClient).inferTabular(anyMap());
        verify(repository).createWithActivity(eq("ai_analysis_results"), anyString(), anyMap(), anyMap());
    }

    @Test
    void createsAgriculturalAnalysisWithInsufficientTelemetryWhenReadingsEmpty() {
        Field mockField = new Field();
        mockField.setFieldId("field-1");
        mockField.setFarmId("farm-1");
        when(authorization.requireWriteAccess("farm-1", "field-1", "uid-1")).thenReturn(mockField);

        CursorPage<Map<String, Object>> emptyPage = new CursorPage<>(List.of(), null, false);
        when(repository.page(eq("soil_telemetry"), eq("farm-1"), eq("field-1"), isNull(), anyInt(), anyMap(), isNull(), isNull()))
                .thenReturn(emptyPage);

        Map<String, Object> result = service.create("farm-1", "field-1", "uid-1");

        assertNotNull(result);
        assertEquals("INSUFFICIENT_DATA", result.get("status"));
        assertEquals("INSUFFICIENT_TELEMETRY", result.get("tabularStatus"));
        verify(aiClient, never()).inferTabular(anyMap());
        verify(repository).createWithActivity(eq("ai_analysis_results"), anyString(), anyMap(), anyMap());
    }

    @Test
    void createsAnalysisAsynchronouslyWithPendingInitialState() {
        Field mockField = new Field();
        mockField.setFieldId("field-1");
        mockField.setFarmId("farm-1");
        when(authorization.requireWriteAccess("farm-1", "field-1", "uid-1")).thenReturn(mockField);

        // Async executor that delays execution
        java.util.concurrent.Executor delayedExecutor = task -> { /* do not run immediately */ };
        AgriculturalAnalysisService asyncService = new AgriculturalAnalysisService(repository, authorization, aiClient, delayedExecutor);

        Map<String, Object> result = asyncService.create("farm-1", "field-1", "uid-1", true);

        assertNotNull(result);
        assertEquals("PENDING", result.get("status"));
        assertEquals("PENDING", result.get("tabularStatus"));
        verify(repository).createWithActivity(eq("ai_analysis_results"), anyString(), anyMap(), anyMap());
    }

    @Test
    void handlesInferenceFailureGracefully() {
        Field mockField = new Field();
        mockField.setFieldId("field-1");
        mockField.setFarmId("farm-1");
        when(authorization.requireWriteAccess("farm-1", "field-1", "uid-1")).thenReturn(mockField);

        List<Map<String, Object>> telemetryItems = List.of(
                Map.of("measurementType", "NITROGEN", "rawValue", 90.0, "unit", "mg/kg", "observedAt", Instant.now().toString(), "validationStatus", "VALID", "telemetryId", "t-1"),
                Map.of("measurementType", "PHOSPHORUS", "rawValue", 42.0, "unit", "mg/kg", "observedAt", Instant.now().toString(), "validationStatus", "VALID", "telemetryId", "t-2"),
                Map.of("measurementType", "POTASSIUM", "rawValue", 43.0, "unit", "mg/kg", "observedAt", Instant.now().toString(), "validationStatus", "VALID", "telemetryId", "t-3"),
                Map.of("measurementType", "AIR_TEMPERATURE", "rawValue", 24.5, "unit", "C", "observedAt", Instant.now().toString(), "validationStatus", "VALID", "telemetryId", "t-4"),
                Map.of("measurementType", "RELATIVE_HUMIDITY", "rawValue", 78.0, "unit", "%", "observedAt", Instant.now().toString(), "validationStatus", "VALID", "telemetryId", "t-5"),
                Map.of("measurementType", "SOIL_PH", "rawValue", 6.5, "unit", "pH", "observedAt", Instant.now().toString(), "validationStatus", "VALID", "telemetryId", "t-6"),
                Map.of("measurementType", "RAINFALL", "rawValue", 150.0, "unit", "mm", "observedAt", Instant.now().toString(), "validationStatus", "VALID", "telemetryId", "t-7"),
                Map.of("measurementType", "SOIL_MOISTURE", "rawValue", 45.0, "unit", "%", "observedAt", Instant.now().toString(), "validationStatus", "VALID", "telemetryId", "t-8")
        );
        when(repository.page(eq("soil_telemetry"), eq("farm-1"), eq("field-1"), isNull(), anyInt(), anyMap(), isNull(), isNull()))
                .thenReturn(new CursorPage<>(telemetryItems, null, false));

        when(aiClient.inferTabular(anyMap())).thenThrow(new RuntimeException("AI inference timeout"));

        Map<String, Object> result = service.create("farm-1", "field-1", "uid-1");

        assertNotNull(result);
        assertEquals("COMPLETED", result.get("status"));
        assertEquals("FAILED", result.get("tabularStatus"));
        assertEquals("AI inference timeout", result.get("tabularErrorMessage"));
        verify(repository, atLeastOnce()).updateWithActivity(eq("ai_analysis_results"), anyString(), anyMap(), anyMap());
    }

    @Test
    void getRetrievesExistingAnalysisForAuthorizedUser() {
        Field mockField = new Field();
        mockField.setFieldId("field-1");
        mockField.setFarmId("farm-1");
        when(authorization.requireReadAccess("farm-1", "field-1", "uid-1")).thenReturn(mockField);

        Map<String, Object> stored = Map.of("analysisId", "an-123", "farmId", "farm-1", "fieldId", "field-1", "status", "COMPLETED");
        when(repository.find("ai_analysis_results", "an-123")).thenReturn(java.util.Optional.of(stored));

        Map<String, Object> result = service.get("farm-1", "field-1", "an-123", "uid-1");
        assertNotNull(result);
        assertEquals("an-123", result.get("analysisId"));
    }

    @Test
    void getThrowsWhenFieldMismatch() {
        Field mockField = new Field();
        mockField.setFieldId("field-1");
        mockField.setFarmId("farm-1");
        when(authorization.requireReadAccess("farm-1", "field-1", "uid-1")).thenReturn(mockField);

        Map<String, Object> stored = Map.of("analysisId", "an-123", "farmId", "farm-1", "fieldId", "other-field", "status", "COMPLETED");
        when(repository.find("ai_analysis_results", "an-123")).thenReturn(java.util.Optional.of(stored));

        assertThrows(com.agroai.exception.FieldNotFoundException.class,
                () -> service.get("farm-1", "field-1", "an-123", "uid-1"));
    }

    @Test
    void listPagesAnalysesForField() {
        Field mockField = new Field();
        mockField.setFieldId("field-1");
        mockField.setFarmId("farm-1");
        when(authorization.requireReadAccess("farm-1", "field-1", "uid-1")).thenReturn(mockField);

        CursorPage<Map<String, Object>> page = new CursorPage<>(List.of(Map.of("analysisId", "an-1")), null, false);
        when(repository.page(eq("ai_analysis_results"), eq("farm-1"), eq("field-1"), isNull(), eq(25), anyMap(), isNull(), isNull()))
                .thenReturn(page);

        CursorPage<Map<String, Object>> result = service.list("farm-1", "field-1", "uid-1", null, 25);
        assertNotNull(result);
        assertEquals(1, result.items().size());
    }

    @Test
    void getLatestForFarmReturnsMapOfAnalysesForActiveFields() {
        com.agroai.repository.FieldRepository mockFieldRepo = mock(com.agroai.repository.FieldRepository.class);
        AgriculturalAnalysisService farmService = new AgriculturalAnalysisService(
                repository, authorization, aiClient, java.util.concurrent.ForkJoinPool.commonPool(), mockFieldRepo);

        Field f1 = new Field();
        f1.setFieldId("farm-1--f-1");
        f1.setLocalFieldId("f-1");
        f1.setFarmId("farm-1");
        f1.setStatus(com.agroai.model.FieldStatus.ACTIVE);

        Field f2 = new Field();
        f2.setFieldId("farm-1--f-2");
        f2.setLocalFieldId("f-2");
        f2.setFarmId("farm-1");
        f2.setStatus(com.agroai.model.FieldStatus.ACTIVE);

        when(mockFieldRepo.findByFarmId("farm-1")).thenReturn(List.of(f1, f2));

        Map<String, Object> analysis1 = Map.of(
                "analysisId", "an-1",
                "fieldId", "farm-1--f-1",
                "status", "COMPLETED",
                "predictedWaterNeed", "Low"
        );
        Map<String, Object> analysis2 = Map.of(
                "analysisId", "an-2",
                "fieldId", "farm-1--f-2",
                "status", "PENDING"
        );

        when(repository.page(eq("ai_analysis_results"), eq("farm-1"), eq("farm-1--f-1"), isNull(), eq(1), anyMap(), isNull(), isNull()))
                .thenReturn(new CursorPage<>(List.of(analysis1), null, false));
        when(repository.page(eq("ai_analysis_results"), eq("farm-1"), eq("farm-1--f-2"), isNull(), eq(1), anyMap(), isNull(), isNull()))
                .thenReturn(new CursorPage<>(List.of(analysis2), null, false));

        Map<String, Map<String, Object>> latest = farmService.getLatestForFarm("farm-1", "uid-1");

        assertNotNull(latest);
        assertTrue(latest.containsKey("farm-1--f-1"));
        assertTrue(latest.containsKey("f-1")); // localFieldId alias
        assertEquals("Low", latest.get("farm-1--f-1").get("predictedWaterNeed"));
        assertTrue(latest.containsKey("farm-1--f-2"));
        assertEquals("PENDING", latest.get("farm-1--f-2").get("status"));
        verify(authorization).requireFarmReadAccess("farm-1", "uid-1");
    }

    @Test
    void getLatestForFarmThrowsWhenUserUnauthorized() {
        doThrow(new com.agroai.exception.UnauthorizedResourceAccessException("farm", "farm-other", "Denied"))
                .when(authorization).requireFarmReadAccess("farm-other", "uid-bad");

        assertThrows(com.agroai.exception.UnauthorizedResourceAccessException.class,
                () -> service.getLatestForFarm("farm-other", "uid-bad"));
    }
}
