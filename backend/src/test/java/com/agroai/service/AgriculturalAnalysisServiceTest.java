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
}
