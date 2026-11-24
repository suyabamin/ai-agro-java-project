package com.agroai.service;

import com.agroai.model.Field;
import com.agroai.model.FieldStatus;
import com.agroai.monitoring.CropImageService;
import com.agroai.monitoring.ImageStorage;
import com.agroai.monitoring.MonitoringAuthorizationService;
import com.agroai.repository.CursorPage;
import com.agroai.repository.FieldMonitoringRepository;
import com.agroai.repository.FieldRepository;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class DiseaseAnalysisServiceTest {
    @Test
    void persistsCompletedTfliteDiseaseResultWithCanonicalFieldAndMetadata() {
        FieldMonitoringRepository repository = mock(FieldMonitoringRepository.class);
        CropImageService images = mock(CropImageService.class);
        MonitoringAuthorizationService authorization = mock(MonitoringAuthorizationService.class);
        AiInferenceClient ai = mock(AiInferenceClient.class);

        Field canonicalField = new Field();
        canonicalField.setFieldId("farm-1--field-a");
        canonicalField.setFarmId("farm-1");
        when(authorization.requireWriteAccess("farm-1", "field-a", "farmer-1")).thenReturn(canonicalField);
        when(repository.find(eq("ai_analysis_results"), anyString())).thenReturn(Optional.empty());
        when(images.get("farm-1", "farm-1--field-a", "image-1", "farmer-1"))
                .thenReturn(new LinkedHashMap<>(Map.of("imageId", "image-1", "storageKey", "image-1.jpg")));
        when(images.content("farm-1", "farm-1--field-a", "image-1", "farmer-1"))
                .thenReturn(new ImageStorage.StoredImage(new byte[]{1, 2, 3}, "image/jpeg"));

        Map<String, Object> aiResp = new LinkedHashMap<>();
        aiResp.put("status", "COMPLETED");
        aiResp.put("model_name", "crop_disease_model");
        aiResp.put("model_version", "su-0.1-tflite");
        aiResp.put("predicted_class", "Tomato_Early_Blight");
        aiResp.put("diseaseName", "Tomato_Early_Blight");
        aiResp.put("predicted_class_id", "83");
        aiResp.put("classIndex", 83);
        aiResp.put("confidence_score", 0.948);
        aiResp.put("confidence", 94.8);
        aiResp.put("isHealthy", false);
        aiResp.put("preprocessingVersion", "letterbox-224-rgb128-f32-0-255-v1");
        aiResp.put("topPredictions", List.of(
                Map.of("classIndex", 83, "className", "Tomato_Early_Blight", "confidence", 94.8),
                Map.of("classIndex", 84, "className", "Tomato_Late_Blight", "confidence", 3.1),
                Map.of("classIndex", 90, "className", "Tomato_healthy", "confidence", 1.2)
        ));
        aiResp.put("is_mock", false);
        when(ai.inferDisease(any(), eq("image/jpeg"))).thenReturn(aiResp);

        DiseaseAnalysisService service = new DiseaseAnalysisService(repository, images, authorization, ai);
        Map<String, Object> result = service.submit("farm-1", "field-a", "image-1", "farmer-1", null);

        assertEquals("COMPLETED", result.get("status"));
        assertEquals("DISEASE_DETECTION", result.get("analysisType"));
        assertEquals("farm-1--field-a", result.get("fieldId"));
        assertEquals("image-1.jpg", result.get("imageStorageKey"));
        assertEquals("Tomato_Early_Blight", result.get("predictedClass"));
        assertEquals("Tomato_Early_Blight", result.get("diseaseName"));
        assertEquals(83, result.get("classIndex"));
        assertEquals(0.948, result.get("confidenceScore"));
        assertEquals(94.8, result.get("confidence"));
        assertEquals(Boolean.FALSE, result.get("isHealthy"));
        assertEquals("crop_disease_model", result.get("modelName"));
        assertEquals("su-0.1-tflite", result.get("modelVersion"));
        assertNotNull(result.get("completedAt"));
        assertEquals(3, ((List<?>) result.get("topPredictions")).size());
    }

    @Test
    void persistsExplicitModelUnavailableStateWithoutPredictionOrConfidence() {
        FieldMonitoringRepository repository = mock(FieldMonitoringRepository.class);
        CropImageService images = mock(CropImageService.class);
        MonitoringAuthorizationService authorization = mock(MonitoringAuthorizationService.class);
        AiInferenceClient ai = mock(AiInferenceClient.class);
        when(repository.find(eq("ai_analysis_results"), anyString())).thenReturn(Optional.empty());
        when(images.get("farm-1", "field-1", "image-1", "user-1")).thenReturn(new LinkedHashMap<>(Map.of("imageId", "image-1")));
        when(images.content("farm-1", "field-1", "image-1", "user-1"))
                .thenReturn(new ImageStorage.StoredImage(new byte[]{1}, "image/png"));
        when(ai.inferDisease(any(), anyString())).thenReturn(Map.of(
                "status", "MODEL_UNAVAILABLE", "error_code", "MODEL_UNAVAILABLE",
                "message", "A trained, evaluated model must be supplied.", "is_mock", false));

        DiseaseAnalysisService service = new DiseaseAnalysisService(repository, images, authorization, ai);
        Map<String, Object> result = service.submit("farm-1", "field-1", "image-1", "user-1", null);

        assertEquals("MODEL_UNAVAILABLE", result.get("status"));
        assertNull(result.get("predictedClass"));
        assertNull(result.get("predictedClassId"));
        assertNull(result.get("confidenceScore"));
        assertNull(result.get("isHealthy"));
        assertEquals(Boolean.FALSE, result.get("isMock"));
        verify(repository, times(2)).updateWithActivity(eq("ai_analysis_results"), anyString(), anyMap(), anyMap());
    }

    @Test
    void rejectsContradictoryUnavailableResponseAsFailureWithoutPersistingPrediction() {
        FieldMonitoringRepository repository = mock(FieldMonitoringRepository.class);
        CropImageService images = mock(CropImageService.class);
        MonitoringAuthorizationService authorization = mock(MonitoringAuthorizationService.class);
        AiInferenceClient ai = mock(AiInferenceClient.class);
        when(repository.find(eq("ai_analysis_results"), anyString())).thenReturn(Optional.empty());
        when(images.get("farm-1", "field-1", "image-1", "user-1")).thenReturn(new LinkedHashMap<>(Map.of("imageId", "image-1")));
        when(images.content("farm-1", "field-1", "image-1", "user-1"))
                .thenReturn(new ImageStorage.StoredImage(new byte[]{1}, "image/png"));
        when(ai.inferDisease(any(), anyString())).thenReturn(Map.of(
                "status", "MODEL_UNAVAILABLE", "predicted_class", "fabricated", "is_mock", false));

        Map<String, Object> result = new DiseaseAnalysisService(repository, images, authorization, ai)
                .submit("farm-1", "field-1", "image-1", "user-1", null);
        assertEquals("FAILED", result.get("status"));
        assertNull(result.get("predictedClass"));
        assertNull(result.get("confidenceScore"));
        assertNull(result.get("isHealthy"));
    }

    @Test
    void listFiltersOutTabularAnalysesAndGetLatestForFarmIsolatesActiveFields() {
        FieldMonitoringRepository repository = mock(FieldMonitoringRepository.class);
        CropImageService images = mock(CropImageService.class);
        MonitoringAuthorizationService authorization = mock(MonitoringAuthorizationService.class);
        AiInferenceClient ai = mock(AiInferenceClient.class);
        FieldRepository fieldRepository = mock(FieldRepository.class);

        Field active = new Field();
        active.setFieldId("farm-1--f1");
        active.setLocalFieldId("f1");
        active.setFarmId("farm-1");
        active.setStatus(FieldStatus.ACTIVE);

        Field archived = new Field();
        archived.setFieldId("farm-1--f2");
        archived.setFarmId("farm-1");
        archived.setStatus(FieldStatus.ARCHIVED);

        when(fieldRepository.findByFarmId("farm-1")).thenReturn(List.of(active, archived));
        when(authorization.requireReadAccess("farm-1", "f1", "owner-1")).thenReturn(active);

        Map<String, Object> tabular = Map.of("analysisId", "a-tab", "analysisType", "AGRICULTURAL_EVIDENCE_SUMMARY");
        Map<String, Object> disease = Map.of("analysisId", "a-dis", "analysisType", "DISEASE_DETECTION", "diseaseName", "Rice_Blast");
        when(repository.page(eq("ai_analysis_results"), eq("farm-1"), eq("farm-1--f1"), isNull(), anyInt(), eq(Map.of()), isNull(), isNull()))
                .thenReturn(new CursorPage<Map<String, Object>>(List.of(tabular, disease), null, false));

        DiseaseAnalysisService service = new DiseaseAnalysisService(repository, images, authorization, ai, fieldRepository);

        CursorPage<Map<String, Object>> listed = service.list("farm-1", "f1", "owner-1", null, 10);
        assertEquals(1, listed.items().size());
        assertEquals("a-dis", listed.items().get(0).get("analysisId"));

        Map<String, Map<String, Object>> latest = service.getLatestForFarm("farm-1", "owner-1");
        assertTrue(latest.containsKey("farm-1--f1"));
        assertEquals("Rice_Blast", latest.get("farm-1--f1").get("diseaseName"));
        assertFalse(latest.containsKey("farm-1--f2"));
    }

    @Test
    void reportsMissingBackendKeyAsUnavailableModelServiceState() {
        FieldMonitoringRepository repository = mock(FieldMonitoringRepository.class);
        CropImageService images = mock(CropImageService.class);
        MonitoringAuthorizationService authorization = mock(MonitoringAuthorizationService.class);
        AiInferenceClient ai = mock(AiInferenceClient.class);
        when(ai.availability()).thenThrow(new IllegalStateException("AI service authentication is not configured"));

        Map<String, Object> result = new DiseaseAnalysisService(repository, images, authorization, ai)
                .availability("farm-1", "field-1", "user-1");
        assertEquals("AI_SERVICE_AUTH_NOT_CONFIGURED", result.get("status"));
        assertEquals(Boolean.FALSE, result.get("available"));
    }
}
