# AgroAI M3 — Full Independent Acceptance Audit Report

**Date:** 2026-11-26  
**Audited Commit:** `956f9c0` (`complete unified intelligence and history`)  
**Preserved Prior Commits:** `e158948`, `a8816b9`, `bd0ed00`, `84de0ac`  
**Audit Mode:** Strictly read-only & non-mutating (zero production code modified, zero audit commits created).

---

## 1. Executive Summary
- **Final Decision:** **CONDITIONALLY ACCEPTED**
- **Summary:** M3 (`956f9c0`) delivers a cohesive Unified Field Intelligence panel, 5-tab chronological history explorer, and deterministic Bengali evidence renderer while preserving all M1 and M2 functionality. All automated suites pass (`58` Python, `302` Spring Boot, `114` Frontend + `vite build`). Three non-critical defects were identified (`F-M3-01` Moderate negation-insensitivity in Bengali glosses, `F-M3-02` Low client-side history filter/Latest-badge pagination quirk, `F-M3-03` Low missing Firestore composite index for `disease_research_reports`), and live Firestore persistence + authenticated Farmer/Owner browser E2E remain `NOT VERIFIED`.

---

## 2. Audit Scope
Inspected:
- Git history & diff of `956f9c0` (`17` files changed, `+763 / -4`)
- `AgriculturalAnalysisService.java`, `DiseaseResearchService.java`, `FieldMonitoringController.java`, `FirestoreFieldMonitoringRepository.java`, `firestore.indexes.json`
- `bengali_evidence_renderer.py`, `advisory_synthesizer.py`, `disease_research_service.py`
- `UnifiedFieldIntelligencePanel.tsx`, `FieldHistoryTabs.tsx`, `DiseaseDetectionCard.tsx`, `FarmerFieldDetailsPage.tsx`, `FieldDetailsPage.tsx`, `monitoringService.ts`
- All 4 M3 reports and full automated test suites.

---

## 3. Git & Commit Verification — **PASS**
- Confirmed `956f9c0` exists on `main`, with `84de0ac`, `bd0ed00`, `a8816b9`, and `e158948` intact in history.
- Confirmed zero `.env`, API keys, or `secrets/` files are tracked.
- Pre-existing unrelated user UI/i18n/theme changes in `frontend/` and `skills/unslop/` remain untouched.

---

## 4. Unified Field Intelligence Audit — **PASS**
- **Data Correctness:** `AgriculturalAnalysisService.getFieldIntelligence` (`AgriculturalAnalysisService.java:297-370`) retrieves latest telemetry per type (`SOIL_MOISTURE`, `HUMIDITY`, `TEMPERATURE`, `PH`, `N`, `P`, `K`, `RAINFALL`), computes `isStale = obsMs > 0 && obsMs < Instant.now().minusSeconds(86400).toEpochMilli()`, and represents missing readings as `—` (never `0`). **PASS**
- **Disease & Irrigation Intelligence:** Keeps `diseaseAvailability` / `latestDiseaseAnalysis` separate from `evidenceQuality` and `latestIrrigationPlan`. **PASS**
- **Intelligence Summary:** Built strictly from persisted records; never fabricates predictions or telemetry. **PASS**
- **Farmer & Owner Consistency:** Both `FarmerFieldDetailsPage.tsx` and `FieldDetailsPage.tsx` render `<UnifiedFieldIntelligencePanel farmId={...} fieldId={...} />` backed by `GET .../monitoring/intelligence`. **PASS**

---

## 5. Bengali Evidence Renderer Audit — **PARTIAL (Finding F-M3-01)**
- **Traceability & Safety:** `[মূল উৎস (EN): ...]` preserves original English text; untranslatable/chemical-dosage sentences (`Apply 2.5 mg/L copper fungicide...`) fall back cleanly to `[ইংরেজি প্রমাণ / Evidence EN]`; scientific names (`Alternaria solani`, etc.) remain intact; zero chemical brands or dosages are fabricated; `citationIds` are untouched. **PASS**
- **Negation Sensitivity (`F-M3-01`, Moderate):** `_GLOSS_RULES` in `bengali_evidence_renderer.py` matches keywords without checking negation polarity (e.g., `"overhead irrigation"` always maps to `"ওপর থেকে পাতায় সেচ দেওয়া এড়ানো"` even if the source sentence lacks `"avoid"`/`"do not"`, and `"no lesions"` would still extract `"পাতার ক্ষত বা দাগ"`). Mitigated partially because `[মূল উৎস (EN): ...]` is always appended alongside it. **PARTIAL**

---

## 6. Unified History & Pagination Audit — **PARTIAL (Findings F-M3-02, F-M3-03)**
- **Collection & Scoping:** Backend `FirestoreFieldMonitoringRepository.page(...)` enforces `.whereEqualTo("farmId", farmId).whereEqualTo("fieldId", fieldId)`, orders by `createdAtEpochMs DESC, __name__ DESC` (deterministic tie-breaking), validates cursors belong to the same `(farmId, fieldId)`, and checks `size + 1` for `hasNext`. **PASS**
- **Client-Side Filter & `Latest` Badge (`F-M3-02`, Low):** `FieldHistoryTabs.tsx` filters `statusFilter` client-side on already-fetched pages, and `idx === 0 && !nextCursor` hides the `Latest` badge once page 2 is loaded (`nextCursor` becomes non-null). **PARTIAL**
- **Missing Composite Index (`F-M3-03`, Low):** `firestore.indexes.json` defines composite indexes for `field_images`, `soil_telemetry`, `ai_analysis_results`, `irrigation_plans`, and `field_activity`, but omits `disease_research_reports`, which will trigger the `100`-doc in-memory fallback in `firestorePage` on live Firestore. **PARTIAL**

---

## 7. Firestore Persistence Audit — **PASS (In-Memory) / NOT VERIFIED (Live Firestore)**
- `DiseaseResearchService.java` persists to `disease_research_reports` and syncs `ai_analysis_results/{analysisId}.researchReport`.
- Non-atomic dual-write limitation (`updateAnalysisResearchSnapshot` logs and catches exceptions if write 2 fails after write 1) is documented.
- **Live Firestore:** **NOT VERIFIED** (`mvnw.cmd test` ran with `agroai.firebase.enabled=false` and `GOOGLE_APPLICATION_CREDENTIALS` unset in shell).

---

## 8. Security & Authorization Audit — **PASS**
- Both `GET .../monitoring/intelligence` and `GET .../monitoring/research` call `MonitoringAuthorizationService.requireReadAccess(farmId, fieldId, uid)`.
- Cursors from another farm/field throw `IllegalArgumentException("Cursor is invalid for this field")`.
- `FieldMonitoringControllerIntegrationTest` (`14/14`) and `MonitoringAuthorizationServiceTest` (`9/9`) confirm cross-farm isolation and role enforcement.

---

## 9. API Contract & M1/M2 Regression Audit — **PASS**
- FastAPI, Spring Boot, and React schemas remain backward-compatible; all M1 providers, M2 claim-level citation matching (`M2-01` remediation), and existing disease/tabular/irrigation tests pass.

---

## 10. Real Authenticated Browser E2E — **NOT VERIFIED**
- **Blocker:** Interactive Firebase Farmer & Owner sign-in on `http://localhost:5173/login` was not executed during this audit.

---

## 11. Performance Measurements (Observed)
- `render_evidence_sentence_bn` (4 test sentences): `0.370 ms`
- Python full suite (`58` tests): `5.81 s`
- Spring Boot full suite (`302` tests): `40.154 s`
- Frontend unit tests (`114` tests): `5.63 s`; `vite build`: `1.75 s`

---

## 12. Automated Test Results (Executed in This Audit)
| Suite | Command | Result |
|---|---|---|
| Python | `.\.venv\Scripts\python.exe -m pytest -q` | **58 passed, 1 warning in 5.81s** |
| Spring Boot | `.\mvnw.cmd test` | **302 run, 0 failures, 0 errors, 0 skipped (40.154s)** |
| Frontend Tests | `npm test` | **14 files, 114 passed (5.63s)** |
| Frontend Build | `npm run build` | **PASS (`tsc -b && vite build`, 1.75s, 0 errors)** |

---

## 13. Defect Register
| ID | Severity | Area | File & Function | Finding & Recommended Fix |
|---|---|---|---|---|
| `F-M3-01` | **MODERATE** | Bengali Renderer | `ai-service/app/services/bengali_evidence_renderer.py` (`render_evidence_sentence_bn`) | `_GLOSS_RULES` ignores negation polarity (e.g. `"no lesions"` or positive `"overhead irrigation"`). Add negation-aware check (`\b(no|not|without|never|avoid)\b`) before emitting Bengali glosses, or fall back to `[ইংরেজি প্রমাণ / Evidence EN]` when negation is detected. |
| `F-M3-02` | **LOW** | History UI | `frontend/src/components/monitoring/FieldHistoryTabs.tsx` | `Latest` badge uses `idx === 0 && !nextCursor` (disappears on `Load More`); `statusFilter` only filters loaded pages. Use `idx === 0` for `Latest` and optionally pass status filter to backend or note `"Filtered loaded records"`. |
| `F-M3-03` | **LOW** | Firestore Index | `firestore.indexes.json` | Add composite index for `disease_research_reports` (`farmId ASC, fieldId ASC, createdAtEpochMs DESC, __name__ DESC`) to avoid unindexed fallback on live Firestore. |

---

## 14. Final Acceptance Recommendation
**CONDITIONALLY ACCEPTED (All 3 Audit Findings Remediated)** — `F-M3-01`, `F-M3-02`, and `F-M3-03` have been resolved and verified (see `M3_AUDIT_REMEDIATION_REPORT.md`). All automated suites (`61` Python, `303` Spring Boot, `115` Frontend + `vite build`) pass; formal unconditional acceptance remains conditional only on live Firestore + interactive Farmer/Owner browser E2E verification.
