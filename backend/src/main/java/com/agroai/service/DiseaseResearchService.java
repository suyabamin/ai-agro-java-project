package com.agroai.service;

import com.agroai.exception.FieldNotFoundException;
import com.agroai.model.Field;
import com.agroai.monitoring.MonitoringActivity;
import com.agroai.monitoring.MonitoringAuthorizationService;
import com.agroai.repository.CursorPage;
import com.agroai.repository.FieldMonitoringRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class DiseaseResearchService {
    private static final Logger log = LoggerFactory.getLogger(DiseaseResearchService.class);
    public static final String COLLECTION = "disease_research_reports";
    private static final int MAX_ATTEMPTS_PER_ANALYSIS = 3;

    private final FieldMonitoringRepository repository;
    private final MonitoringAuthorizationService authorization;
    private final AiInferenceClient aiClient;
    private final ExecutorService executor = Executors.newFixedThreadPool(2);

    public DiseaseResearchService(FieldMonitoringRepository repository,
                                  MonitoringAuthorizationService authorization,
                                  AiInferenceClient aiClient) {
        this.repository = repository;
        this.authorization = authorization;
        this.aiClient = aiClient;
    }

    public Map<String, Object> triggerAsync(String farmId, String fieldId, String analysisId, String uid) {
        return triggerInternal(farmId, fieldId, analysisId, uid, true);
    }

    public Map<String, Object> triggerSyncForTest(String farmId, String fieldId, String analysisId, String uid) {
        return triggerInternal(farmId, fieldId, analysisId, uid, false);
    }

    private Map<String, Object> triggerInternal(String farmId, String fieldId, String analysisId, String uid, boolean async) {
        Field authorizedField = authorization.requireWriteAccess(farmId, fieldId, uid);
        String canonicalFieldId = authorizedField != null && authorizedField.getFieldId() != null
                ? authorizedField.getFieldId()
                : fieldId;

        Map<String, Object> analysis = repository.find("ai_analysis_results", analysisId)
                .orElseThrow(() -> new FieldNotFoundException(analysisId));
        if (!farmId.equals(analysis.get("farmId")) || !canonicalFieldId.equals(analysis.get("fieldId"))) {
            throw new FieldNotFoundException(analysisId);
        }
        if (!DiseaseAnalysisService.ANALYSIS_TYPE.equals(analysis.get("analysisType")) ||
                !"COMPLETED".equals(analysis.get("status"))) {
            throw new IllegalStateException("Disease research requires a COMPLETED disease analysis");
        }

        String currentResearchStatus = String.valueOf(analysis.getOrDefault("researchStatus", ""));
        if ("PENDING".equals(currentResearchStatus) || "PROCESSING".equals(currentResearchStatus)) {
            return analysis;
        }

        List<Map<String, Object>> priorReports = listRawForAnalysis(farmId, canonicalFieldId, analysisId);
        if (priorReports.size() >= MAX_ATTEMPTS_PER_ANALYSIS) {
            throw new IllegalArgumentException("Maximum disease research retry limit (" + MAX_ATTEMPTS_PER_ANALYSIS + ") reached for this analysis");
        }

        Instant now = Instant.now();
        String researchId = "research_" + UUID.randomUUID();
        String diseaseName = String.valueOf(analysis.getOrDefault("diseaseName", analysis.get("predictedClass")));
        String cropName = authorizedField != null && authorizedField.getCropType() != null
                ? authorizedField.getCropType().name()
                : null;
        Double confidence = analysis.get("confidence") instanceof Number n ? n.doubleValue() : null;
        Boolean isHealthy = analysis.get("isHealthy") instanceof Boolean b ? b : null;

        Map<String, Object> report = new LinkedHashMap<>();
        report.put("researchId", researchId);
        report.put("id", researchId);
        report.put("analysisId", analysisId);
        report.put("farmId", farmId);
        report.put("fieldId", canonicalFieldId);
        report.put("requestedByUid", uid);
        report.put("diseaseName", diseaseName);
        report.put("cropName", cropName);
        report.put("confidence", confidence);
        report.put("isHealthy", isHealthy);
        report.put("researchStatus", "PENDING");
        report.put("sources", List.of());
        report.put("bengaliReport", null);
        report.put("queriesUsed", List.of());
        report.put("attemptNumber", priorReports.size() + 1);
        report.put("createdAt", now.toString());
        report.put("createdAtEpochMs", now.toEpochMilli());

        repository.createWithActivity(COLLECTION, researchId, report,
                MonitoringActivity.create(farmId, canonicalFieldId, uid, "DISEASE_RESEARCH_REQUESTED", "RESEARCH", researchId,
                        "Disease research requested for " + analysisId));

        analysis.put("researchStatus", "PENDING");
        analysis.put("latestResearchId", researchId);
        analysis.put("updatedAt", now.toString());
        analysis.put("updatedAtEpochMs", now.toEpochMilli());
        repository.updateWithActivity("ai_analysis_results", analysisId, analysis,
                MonitoringActivity.create(farmId, canonicalFieldId, uid, "DISEASE_RESEARCH_LINKED", "ANALYSIS", analysisId,
                        "Linked research job " + researchId));

        if (async) {
            Map<String, Object> reportCopy = new LinkedHashMap<>(report);
            CompletableFuture.runAsync(() -> executeWorker(farmId, canonicalFieldId, analysisId, researchId, uid, reportCopy), executor);
            return new LinkedHashMap<>(report);
        } else {
            executeWorker(farmId, canonicalFieldId, analysisId, researchId, uid, report);
            return report;
        }
    }

    private void executeWorker(String farmId, String canonicalFieldId, String analysisId, String researchId, String uid, Map<String, Object> report) {
        try {
            report.put("researchStatus", "PROCESSING");
            report.put("updatedAt", Instant.now().toString());
            repository.updateWithActivity(COLLECTION, researchId, report,
                    MonitoringActivity.create(farmId, canonicalFieldId, uid, "DISEASE_RESEARCH_PROCESSING", "RESEARCH", researchId,
                            "Selenium disease research started"));

            updateAnalysisResearchSnapshot(farmId, canonicalFieldId, analysisId, uid, "PROCESSING", researchId, null);

            Map<String, Object> reqPayload = new LinkedHashMap<>();
            reqPayload.put("analysisId", analysisId);
            reqPayload.put("diseaseName", report.get("diseaseName"));
            if (report.get("cropName") != null) reqPayload.put("cropName", report.get("cropName"));
            if (report.get("confidence") != null) reqPayload.put("confidence", report.get("confidence"));
            if (report.get("isHealthy") != null) reqPayload.put("isHealthy", report.get("isHealthy"));
            reqPayload.put("maxResults", 5);

            Map<String, Object> aiResp = aiClient.researchDisease(reqPayload);
            String rStatus = String.valueOf(aiResp.getOrDefault("researchStatus", "FAILED"));

            report.put("researchStatus", rStatus);
            report.put("lowConfidenceWarning", Boolean.TRUE.equals(aiResp.get("lowConfidenceWarning")));
            report.put("queriesUsed", aiResp.getOrDefault("queriesUsed", List.of()));
            report.put("sources", aiResp.getOrDefault("sources", List.of()));
            report.put("bengaliReport", aiResp.get("bengaliReport"));
            report.put("errorCode", aiResp.get("errorCode"));
            report.put("errorMessage", aiResp.get("errorMessage"));
            report.put("seleniumVersion", aiResp.get("seleniumVersion"));
            report.put("browserInfo", aiResp.get("browserInfo"));
            report.put("searchProvidersAttempted", aiResp.getOrDefault("searchProvidersAttempted", List.of()));
            report.put("successfulProvider", aiResp.get("successfulProvider"));
            report.put("fallbackUsed", Boolean.TRUE.equals(aiResp.get("fallbackUsed")));
            report.put("fallbackReason", aiResp.get("fallbackReason"));
            report.put("sourceCount", aiResp.getOrDefault("sourceCount", 0));
            report.put("validatedSourceCount", aiResp.getOrDefault("validatedSourceCount", 0));
            report.put("retrievedAt", aiResp.get("retrievedAt") != null ? String.valueOf(aiResp.get("retrievedAt")) : Instant.now().toString());
        } catch (Exception e) {
            log.warn("Disease research failed for analysis={} research={}: {}", analysisId, researchId, e.getMessage());
            report.put("researchStatus", "FAILED");
            report.put("errorCode", "RESEARCH_WORKER_FAILED");
            report.put("errorMessage", "Background research service failed; disease prediction remains valid.");
            report.put("sources", List.of());
            report.put("bengaliReport", null);
        }

        Instant doneAt = Instant.now();
        report.put("updatedAt", doneAt.toString());
        report.put("updatedAtEpochMs", doneAt.toEpochMilli());
        repository.updateWithActivity(COLLECTION, researchId, report,
                MonitoringActivity.create(farmId, canonicalFieldId, uid, "DISEASE_RESEARCH_" + report.get("researchStatus"), "RESEARCH", researchId,
                        "Disease research status: " + report.get("researchStatus")));

        updateAnalysisResearchSnapshot(farmId, canonicalFieldId, analysisId, uid,
                String.valueOf(report.get("researchStatus")), researchId, report);
    }

    private void updateAnalysisResearchSnapshot(String farmId, String canonicalFieldId, String analysisId, String uid,
                                                String status, String researchId, Map<String, Object> completedReport) {
        try {
            Map<String, Object> latest = repository.find("ai_analysis_results", analysisId).orElse(null);
            if (latest == null) return;
            latest.put("researchStatus", status);
            latest.put("latestResearchId", researchId);
            if (completedReport != null) {
                Map<String, Object> snapshot = new LinkedHashMap<>();
                snapshot.put("researchId", researchId);
                snapshot.put("researchStatus", status);
                snapshot.put("lowConfidenceWarning", Boolean.TRUE.equals(completedReport.get("lowConfidenceWarning")));
                snapshot.put("sources", completedReport.getOrDefault("sources", List.of()));
                snapshot.put("bengaliReport", completedReport.get("bengaliReport") != null ? completedReport.get("bengaliReport") : Map.of());
                snapshot.put("errorCode", completedReport.get("errorCode") != null ? completedReport.get("errorCode") : "");
                snapshot.put("errorMessage", completedReport.get("errorMessage") != null ? completedReport.get("errorMessage") : "");
                snapshot.put("searchProvidersAttempted", completedReport.getOrDefault("searchProvidersAttempted", List.of()));
                snapshot.put("successfulProvider", completedReport.get("successfulProvider") != null ? completedReport.get("successfulProvider") : "");
                snapshot.put("fallbackUsed", Boolean.TRUE.equals(completedReport.get("fallbackUsed")));
                snapshot.put("fallbackReason", completedReport.get("fallbackReason") != null ? completedReport.get("fallbackReason") : "");
                snapshot.put("sourceCount", completedReport.getOrDefault("sourceCount", 0));
                snapshot.put("validatedSourceCount", completedReport.getOrDefault("validatedSourceCount", 0));
                snapshot.put("retrievedAt", completedReport.get("retrievedAt") != null ? completedReport.get("retrievedAt") : "");
                latest.put("researchReport", snapshot);
            }
            latest.put("updatedAt", Instant.now().toString());
            latest.put("updatedAtEpochMs", Instant.now().toEpochMilli());
            repository.updateWithActivity("ai_analysis_results", analysisId, latest,
                    MonitoringActivity.create(farmId, canonicalFieldId, uid, "DISEASE_RESEARCH_SYNC", "ANALYSIS", analysisId,
                            "Updated research status: " + status));
        } catch (Exception e) {
            log.warn("Could not sync research snapshot onto analysis {}: {}", analysisId, e.getMessage());
        }
    }

    public List<Map<String, Object>> listForAnalysis(String farmId, String fieldId, String analysisId, String uid) {
        Field authorizedField = authorization.requireReadAccess(farmId, fieldId, uid);
        String canonicalFieldId = authorizedField != null && authorizedField.getFieldId() != null
                ? authorizedField.getFieldId()
                : fieldId;
        return listRawForAnalysis(farmId, canonicalFieldId, analysisId);
    }

    private List<Map<String, Object>> listRawForAnalysis(String farmId, String canonicalFieldId, String analysisId) {
        CursorPage<Map<String, Object>> page = repository.page(COLLECTION, farmId, canonicalFieldId, null, 25, Map.of(), null, null);
        if (page == null || page.items() == null) return List.of();
        return page.items().stream()
                .filter(item -> analysisId.equals(item.get("analysisId")))
                .toList();
    }
}
