package com.agroai.service;

import com.agroai.model.CropType;
import com.agroai.model.Field;
import com.agroai.monitoring.MonitoringAuthorizationService;
import com.agroai.repository.CursorPage;
import com.agroai.repository.FieldMonitoringRepository;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class DiseaseResearchServiceTest {
    @Test
    void persistsCompletedBengaliResearchReportAndKeepsDiseaseAnalysisCompleted() {
        FieldMonitoringRepository repository = mock(FieldMonitoringRepository.class);
        MonitoringAuthorizationService authorization = mock(MonitoringAuthorizationService.class);
        AiInferenceClient ai = mock(AiInferenceClient.class);

        Field field = new Field();
        field.setFieldId("farm-1--f1");
        field.setFarmId("farm-1");
        field.setCropType(CropType.POTATO);
        when(authorization.requireWriteAccess("farm-1", "f1", "farmer-1")).thenReturn(field);

        Map<String, Object> analysis = new LinkedHashMap<>();
        analysis.put("analysisId", "analysis_1");
        analysis.put("analysisType", DiseaseAnalysisService.ANALYSIS_TYPE);
        analysis.put("status", "COMPLETED");
        analysis.put("farmId", "farm-1");
        analysis.put("fieldId", "farm-1--f1");
        analysis.put("diseaseName", "Potato_Early_Blight");
        analysis.put("confidence", 85.0);
        analysis.put("isHealthy", false);

        when(repository.find("ai_analysis_results", "analysis_1")).thenReturn(Optional.of(analysis));
        when(repository.page(eq(DiseaseResearchService.COLLECTION), eq("farm-1"), eq("farm-1--f1"), isNull(), anyInt(), eq(Map.of()), isNull(), isNull()))
                .thenReturn(new CursorPage<>(List.of(), null, false));

        Map<String, Object> aiResearch = new LinkedHashMap<>();
        aiResearch.put("researchStatus", "COMPLETED");
        aiResearch.put("lowConfidenceWarning", false);
        aiResearch.put("searchProvidersAttempted", List.of("google_selenium", "tavily"));
        aiResearch.put("successfulProvider", "tavily");
        aiResearch.put("fallbackUsed", true);
        aiResearch.put("fallbackReason", "GOOGLE_CAPTCHA_BLOCKED");
        aiResearch.put("sourceCount", 1);
        aiResearch.put("validatedSourceCount", 1);
        aiResearch.put("providersAttempted", List.of("google_selenium", "tavily", "openalex", "crossref"));
        aiResearch.put("successfulProviders", List.of("tavily", "openalex", "crossref"));
        aiResearch.put("failedProviders", List.of("google_selenium"));
        aiResearch.put("duplicateCount", 1);
        aiResearch.put("evidenceQuality", "HIGH");
        aiResearch.put("researchPapers", List.of(Map.of("paperId", "doi:10.1000/potato", "title", "Potato Early Blight", "doiVerificationStatus", "VERIFIED_MATCH")));
        aiResearch.put("bamisStatus", Map.of("bamisApiAvailable", false));
        aiResearch.put("sources", List.of(Map.of("title", "BARI Potato", "url", "https://bari.gov.bd/potato", "domain", "bari.gov.bd", "provider", "tavily")));
        aiResearch.put("bengaliReport", Map.of("summaryBn", "আলু ফসলে প্রাথমিক তথ্য পাওয়া গেছে।"));
        when(ai.researchDisease(anyMap())).thenReturn(aiResearch);

        DiseaseResearchService service = new DiseaseResearchService(repository, authorization, ai);
        Map<String, Object> report = service.triggerSyncForTest("farm-1", "f1", "analysis_1", "farmer-1");

        assertEquals("COMPLETED", report.get("researchStatus"));
        assertEquals("tavily", report.get("successfulProvider"));
        assertEquals(true, report.get("fallbackUsed"));
        assertEquals("GOOGLE_CAPTCHA_BLOCKED", report.get("fallbackReason"));
        assertEquals("HIGH", report.get("evidenceQuality"));
        assertEquals(1, report.get("duplicateCount"));
        assertEquals("COMPLETED", analysis.get("status")); // disease analysis stays COMPLETED
        assertEquals("COMPLETED", analysis.get("researchStatus"));
        assertNotNull(analysis.get("researchReport"));
        @SuppressWarnings("unchecked")
        Map<String, Object> snap = (Map<String, Object>) analysis.get("researchReport");
        assertEquals("tavily", snap.get("successfulProvider"));
        assertEquals(true, snap.get("fallbackUsed"));
        assertEquals("HIGH", snap.get("evidenceQuality"));
        verify(repository, atLeastOnce()).createWithActivity(eq(DiseaseResearchService.COLLECTION), anyString(), anyMap(), anyMap());
    }

    @Test
    void handlesBlockedGoogleCaptchaWithoutInvalidatingDiseaseAnalysis() {
        FieldMonitoringRepository repository = mock(FieldMonitoringRepository.class);
        MonitoringAuthorizationService authorization = mock(MonitoringAuthorizationService.class);
        AiInferenceClient ai = mock(AiInferenceClient.class);

        Field field = new Field();
        field.setFieldId("farm-1--f1");
        field.setFarmId("farm-1");
        when(authorization.requireWriteAccess("farm-1", "f1", "farmer-1")).thenReturn(field);

        Map<String, Object> analysis = new LinkedHashMap<>();
        analysis.put("analysisId", "analysis_2");
        analysis.put("analysisType", DiseaseAnalysisService.ANALYSIS_TYPE);
        analysis.put("status", "COMPLETED");
        analysis.put("farmId", "farm-1");
        analysis.put("fieldId", "farm-1--f1");
        analysis.put("diseaseName", "Rice_Blast");
        analysis.put("confidence", 72.0);
        analysis.put("isHealthy", false);

        when(repository.find("ai_analysis_results", "analysis_2")).thenReturn(Optional.of(analysis));
        when(repository.page(eq(DiseaseResearchService.COLLECTION), eq("farm-1"), eq("farm-1--f1"), isNull(), anyInt(), eq(Map.of()), isNull(), isNull()))
                .thenReturn(new CursorPage<>(List.of(), null, false));
        when(ai.researchDisease(anyMap())).thenReturn(Map.of(
                "researchStatus", "BLOCKED",
                "errorCode", "GOOGLE_CAPTCHA_BLOCKED",
                "errorMessage", "Google Search blocked automated access."
        ));

        DiseaseResearchService service = new DiseaseResearchService(repository, authorization, ai);
        Map<String, Object> report = service.triggerSyncForTest("farm-1", "f1", "analysis_2", "farmer-1");

        assertEquals("BLOCKED", report.get("researchStatus"));
        assertEquals("GOOGLE_CAPTCHA_BLOCKED", report.get("errorCode"));
        assertEquals("COMPLETED", analysis.get("status")); // never invalidated
        assertEquals("BLOCKED", analysis.get("researchStatus"));
    }

    @Test
    void enforcesBoundedRetryLimit() {
        FieldMonitoringRepository repository = mock(FieldMonitoringRepository.class);
        MonitoringAuthorizationService authorization = mock(MonitoringAuthorizationService.class);
        AiInferenceClient ai = mock(AiInferenceClient.class);

        Field field = new Field();
        field.setFieldId("farm-1--f1");
        when(authorization.requireWriteAccess("farm-1", "f1", "farmer-1")).thenReturn(field);

        Map<String, Object> analysis = new LinkedHashMap<>();
        analysis.put("analysisId", "analysis_3");
        analysis.put("analysisType", DiseaseAnalysisService.ANALYSIS_TYPE);
        analysis.put("status", "COMPLETED");
        analysis.put("farmId", "farm-1");
        analysis.put("fieldId", "farm-1--f1");
        analysis.put("researchStatus", "BLOCKED");

        when(repository.find("ai_analysis_results", "analysis_3")).thenReturn(Optional.of(analysis));
        when(repository.page(eq(DiseaseResearchService.COLLECTION), eq("farm-1"), eq("farm-1--f1"), isNull(), anyInt(), eq(Map.of()), isNull(), isNull()))
                .thenReturn(new CursorPage<>(List.of(
                        Map.of("analysisId", "analysis_3"),
                        Map.of("analysisId", "analysis_3"),
                        Map.of("analysisId", "analysis_3")
                ), null, false));

        DiseaseResearchService service = new DiseaseResearchService(repository, authorization, ai);
        assertThrows(IllegalArgumentException.class, () -> service.triggerSyncForTest("farm-1", "f1", "analysis_3", "farmer-1"));
    }
}
