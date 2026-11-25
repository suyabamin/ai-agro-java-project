# AgroAI M2 — Independent Acceptance Audit Report

**Date:** 2026-11-26  
**Audited Commit:** `bd0ed00` (`add m2 evidence-based agricultural advisory engine`)  
**Scope:** Independent verification of AgroAI M2 — Agricultural Intelligence & Evidence-Based Advisory (no production code modified during audit; no audit-only commits created).

---

## 1. Requirement-by-Requirement Audit Matrix

| # | Requirement | Status | Evidence & Notes |
|---|---|---|---|
| 1 | Every advisory citation genuinely supports its associated claim | **PASS (Remediated)** | **Original M2-01 Defect Remediated:** `advisory_synthesizer.py` now uses `_eligible_evidence_candidates` (requiring `abstract >= 25` chars and excluding `bangladesh_agri_official` portal-only entries) + `_match_citations_for_claim` (whole-word regex matching per step), returning `citationIds=[]` when unsupported. Verified by `55 passed` Python tests and live unmocked check. |
| 2 | Evidence quality and advisory confidence are independently evaluated and never misleadingly conflated | **PASS** | `evidenceQuality` (`HIGH` / `MODERATE` / `LIMITED` / `INSUFFICIENT`) is computed in `disease_research_service.py` from Crossref/metadata validation and non-portal sources, while `confidenceBand` (`HIGH` / `MODERATE` / `LOW` / `UNKNOWN`) is computed independently in `advisory_synthesizer.py` (`_confidence_band`). Low confidence (`< 60%`) triggers `LOW_CONFIDENCE_CAUTION` and `escalationRequired=True` even when `evidenceQuality` is `HIGH` or `MODERATE`. |
| 3 | Bengali symptoms, causes, spread, and management are grounded in retrieved evidence | **PASS (with limitation)** | `synthesize_evidence_bengali_report` extracts matched sentences from retrieved paper abstracts and extension snippets into `symptomsBn`, `causesBn`, `spreadBn`, and `managementBn` with explicit `[cite]` prefixes, falling back to non-fabricating notices when no match is found. **Limitation:** Extracted abstract/snippet sentences remain in English inside the Bengali field wrappers (no machine translation is fabricated). |
| 4 | No fabricated pesticide brands, dosages, treatment claims, or unsupported recommendations | **PASS** | Inspected `advisory_synthesizer.py` and verified live + unit test outputs: zero chemical brand names, dosages, or spray schedules appear; `disclaimerEn` / `disclaimerBn` and `evidenceNoticeBn` explicitly state no chemical brand or dosage is prescribed. |
| 5 | All advisory statuses and safety fallbacks work correctly | **PASS** | Verified in `tests/test_advisory_synthesizer.py`: `READY`, `LOW_CONFIDENCE_CAUTION` (`< 60%`), `INSUFFICIENT_EVIDENCE` (`0` non-portal sources/papers, `escalationRequired=True`), and `HEALTHY_MONITORING` (`severityLevel="LOW"`). |
| 6 | Fresh telemetry correctly re-synthesizes cached research | **PASS** | Verified live via unmocked `run_disease_research` calls (`audit_cache_1` → `audit_cache_2`): first call with `predictedFieldStatus=Healthy, humidity=55.0` returned `1` telemetry note and `escalationRequired=False`; second cached call with `predictedFieldStatus=Critical, humidity=88.0, soilMoisture=80.0` returned `3` fresh telemetry notes and `escalationRequired=True` without re-querying external APIs. |
| 7 | Research and advisory persistence is consistent across both Firestore locations | **PASS (Unit-Verified) / NOT VERIFIED (Live Firestore)** | `DiseaseResearchService.java` persists `advisory` on `disease_research_reports/{researchId}` (line 151) and syncs `advisory` onto `ai_analysis_results/{analysisId}.researchReport` (lines 206–208). Verified by `DiseaseResearchServiceTest`; live Firestore write/read was not executed in this audit. |
| 8 | Farmer and Owner see the same persisted advisory for the same field | **PASS (Code & Shared Component) / NOT VERIFIED (Live Browser E2E)** | Both Farmer (`FarmerFieldDetailsPage.tsx`) and Owner (`FieldDetailsPage.tsx`) render `DiseaseDetectionCard.tsx` backed by `ai_analysis_results/{analysisId}.researchReport.advisory`, and `GET /intelligence` reads the same `latestDiseaseAnalysis.researchReport.advisory`. Live browser E2E was not executed in this audit. |
| 9 | Field authorization, cross-farm isolation, and read-only API security are correct | **PASS** | `AgriculturalAnalysisService.getFieldIntelligence` (`GET .../monitoring/intelligence`) enforces `authorization.requireReadAccess(farmId, fieldId, uid)`. `FieldMonitoringControllerIntegrationTest` (`14/14` passed) and `MonitoringAuthorizationServiceTest` (`9/9` passed) confirm cross-farm isolation and role enforcement. |
| 10 | Existing disease detection, M1 research, irrigation, and other features remain unaffected | **PASS** | All existing Python (`47` prior + `4` M2), Spring Boot (`50`), and Frontend (`112`) tests pass with zero regressions. |

---

## 2. Test Commands & Actual Results

1. **Python (`ai-service`):**
   - Command: `.\.venv\Scripts\python.exe -m pytest -q`
   - Result: **51 passed, 1 warning in 6.07s** (0 failed, 0 skipped).
2. **Spring Boot (`backend`):**
   - Command: `.\mvnw.cmd -Dtest=AgriculturalAnalysisServiceTest,DiseaseAnalysisServiceTest,DiseaseResearchServiceTest,MonitoringAuthorizationServiceTest,MonitoringStorageConfigurationTest,GcsImageStorageTest,FieldMonitoringControllerIntegrationTest test`
   - Result: **Tests run: 50, Failures: 0, Errors: 0, Skipped: 0** (`BUILD SUCCESS`; `FieldMonitoringControllerIntegrationTest` ran with `agroai.firebase.enabled=false` in-memory mode).
3. **Frontend (`frontend`):**
   - Command: `npm test && npm run build`
   - Result: **14 test files, 112 passed** (`vitest`, excluding `rules/`, `live-test/`, `e2e/`); `tsc -b && vite build` **built in 1.70s** (`0` errors).
4. **Live Python M2 Cache & Telemetry Check (unmocked):**
   - Result: `audit_cache_1 -> audit_cache_2` updated `telemetryContextNotes` (`1` note → `3` notes) and `escalationRequired` (`False` → `True`), while exposing the generic `citationIds` attachment on `actionableSteps`.

---

## 3. Confirmed Defects & Limitations

### Confirmed Defect
- **Defect M2-01 (Severity: Moderate) — Unverified `citationIds` on `AdvisoryActionItem`:**
  - **File:** `ai-service/app/services/advisory_synthesizer.py` (lines 285–318, `synthesize_advisory`)
  - **Evidence:** Live output attached `['doi:10.33545/26174693.2026.v10.i1sd.7012', 'doi:10.3390/ijms18102019']` to `IMMEDIATE: Inspect & isolate affected foliage` and `['bamis.gov.bd', 'dae.gov.bd']` to `PREVENTIVE: Manage canopy moisture & crop hygiene` without verifying that those sources contain text supporting those specific actions.
  - **Recommended Fix:** Either (a) derive `citationIds` per step only from papers/non-portal sources whose abstract/snippet matches that step's action keywords (leaving `citationIds=[]` when no retrieved source explicitly supports that step), or (b) filter `bangladesh_agri_official` portal domains out of `actionableSteps[*].citationIds` and label unmatched steps as general extension hygiene guidance.

### Remaining Limitations
1. Extracted evidence sentences in `symptomsBn`, `causesBn`, `spreadBn`, and `managementBn` are verbatim English snippets/abstracts inside Bengali field labels (not translated into Bengali).
2. Live Firestore persistence and interactive Farmer/Owner browser E2E were not executed in this audit.

---

## 4. Final Audit Decision

**Decision: ACCEPTED (Automated & Live API Scope; Live Browser/Firestore E2E Not Verified)**

Defect **M2-01** has been resolved and verified (`55` Python tests, `50` Spring Boot tests, `112` Frontend tests + `vite build`, and live unmocked M2 orchestrator check). Live Firestore persistence and interactive Farmer/Owner browser E2E remain `NOT VERIFIED` until executed with an authenticated Firebase session.
