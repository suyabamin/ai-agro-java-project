package com.agroai.service;

import com.agroai.monitoring.CropImageService;
import com.agroai.monitoring.ImageStorage;
import com.agroai.monitoring.MonitoringAuthorizationService;
import com.agroai.repository.FieldMonitoringRepository;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class DiseaseAnalysisServiceTest {
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
