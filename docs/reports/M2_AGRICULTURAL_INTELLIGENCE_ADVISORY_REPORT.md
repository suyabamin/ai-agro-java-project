# AgroAI M2 — Agricultural Intelligence & Evidence-Based Advisory Report

**Date:** 2026-11-26  
**Milestone:** M2 — Agricultural Intelligence & Evidence-Based Advisory  
**Preserved M1 Commits:** `e158948`, `a8816b9`

---

## 1. Scope & Architecture
- **Evidence-Grounded Advisory Synthesizer (`ai-service/app/services/advisory_synthesizer.py`):**
  - Replaces static boilerplate in `BengaliResearchReport` (`symptomsBn`, `causesBn`, `spreadBn`, `managementBn`) with sentences extracted directly from retrieved M1 paper abstracts (`OpenAlex` / `Semantic Scholar`) and extension snippets (`Tavily` / `Google`), tagged with their DOI or domain citation (`[doi:...]`, `[domain]`).
  - Produces a structured bilingual `AdvisoryPayload` (`advisoryStatus`, `severityLevel`, `confidenceBand`, `evidenceQuality`, `escalationRequired`, `escalationReasonEn/Bn`, `actionableSteps` [`IMMEDIATE`, `SHORT_TERM`, `PREVENTIVE`], `telemetryContextNotes`, `citedPaperIds`, `citedSourceDomains`, `disclaimerEn/Bn`).
  - Never fabricates pesticide brands, chemical dosages, or spray schedules; explicitly flags `INSUFFICIENT_EVIDENCE` or `LOW_CONFIDENCE_CAUTION` (`< 60%`) for agronomist escalation.
- **Telemetry-Correlated Context (`DiseaseResearchService.java` & `AgriculturalAnalysisService.java`):**
  - `DiseaseResearchService.buildTelemetryContext(...)` enriches research requests with the field's latest persisted `predictedFieldStatus`, `predictedWaterNeed`, `SOIL_MOISTURE`, `HUMIDITY`, and `PH` (when valid telemetry exists), and persists `advisory` onto both `disease_research_reports` and `ai_analysis_results.researchReport`.
  - Added read-only `GET /api/v1/farms/{farmId}/fields/{fieldId}/monitoring/intelligence` (`AgriculturalAnalysisService.getFieldIntelligence`) aggregating tabular analysis, disease analysis, research/advisory, and latest irrigation plan under `MonitoringAuthorizationService.requireReadAccess`.
- **Frontend (`DiseaseDetectionCard.tsx`, `monitoringService.ts`):**
  - Renders the `Evidence-Based Agronomic Advisory` section (status/severity badges, agronomist escalation alert, telemetry correlation notes, prioritized Bengali/English action cards with citations, and disclaimer) for both Farmer and Owner dashboards.
  - Added `monitoringService.fieldIntelligence(farmId, fieldId)`.

---

## 2. Verification Summary
- **Python (`pytest -q`):** `51 passed` (47 existing/M1 + 4 new M2 tests in `tests/test_advisory_synthesizer.py`).
- **Spring Boot (`mvnw.cmd test`):** `36 passed, 0 failures, 0 errors, 0 skipped`.
- **Frontend (`npm test && npm run build`):** `112 passed` across `14` files; `vite build` `0` errors.
- **Live M2 Orchestrator + Advisory Synthesis:** Verified against real OpenAlex/Crossref/Tavily responses with telemetry context (`predictedFieldStatus=Critical`, `humidity=85.0`), producing grounded `AdvisoryPayload` (`READY`, `HIGH` severity, `escalationRequired=true`, `3` cited action steps, and DOI-cited Bengali sections).
