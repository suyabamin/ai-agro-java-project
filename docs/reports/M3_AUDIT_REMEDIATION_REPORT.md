# AgroAI M3 — Audit Remediation Report (`F-M3-01`, `F-M3-02`, `F-M3-03`)

**Date:** 2026-11-26  
**Target Audit:** `M3_INDEPENDENT_ACCEPTANCE_AUDIT.md`  
**Preserved Prior Commits:** `e158948`, `a8816b9`, `bd0ed00`, `84de0ac`, `956f9c0`

---

## 1. Remediated Findings

### F-M3-01 (Moderate) — Negation-Aware Bengali Evidence Rendering
- **Root Cause:** `_GLOSS_RULES` in `ai-service/app/services/bengali_evidence_renderer.py` matched keywords without checking negation polarity or conditional ambiguity (and mapped `"overhead irrigation"` to `"ওপর থেকে পাতায় সেচ দেওয়া এড়ানো"` even in positive sentences).
- **Exact Fix:**
  - Updated `_GLOSS_RULES` so `"overhead irrigation"` / `"overhead watering"` maps neutrally to `"ওপর থেকে পাতায় সেচ"`.
  - Split multi-sentence inputs strictly along sentence boundaries (`_render_single_sentence`), preventing negation in one sentence from leaking into another.
  - Added conservative `_NEGATION_OR_AMBIGUOUS_RE` gate (`no`, `not`, `never`, `without`, `absence of`, `lack of`, `does not`, `do not`, `is not`, `are not`, `cannot`, `can't`, `should not`, `shouldn't`, `don't`, `doesn't`, `isn't`, `aren't`, `won't`, `would not`, `neither`, `nor`, `avoid`, `prevent`, `free of`, `may`, `might`, `could`, `uncertain`, `if`) that falls back safely to `[ইংরেজি প্রমাণ / Evidence EN]`.
- **Tests:** 6 comprehensive test functions in `ai-service/tests/test_bengali_evidence_renderer.py`.

### F-M3-02 (Low) — History `Latest` Badge & Status Filtering
- **Root Cause:** `FieldHistoryTabs.tsx` used `idx === 0 && !nextCursor` for the `Latest` badge (disappearing once `Load More History` was clicked) and filtered `statusFilter` only on already-loaded client pages.
- **Exact Fix:**
  - Added server-side `@RequestParam(required = false) String status` to `GET /api/v1/farms/{farmId}/fields/{fieldId}/monitoring/research` (`FieldMonitoringController.java`, `DiseaseResearchService.listForField`), filtering by `researchStatus` before cursor pagination.
  - Added filter validation on `after` cursor snapshots in `FirestoreFieldMonitoringRepository.firestorePage` so cursors from different filters cannot be mixed.
  - Updated `FieldHistoryTabs.tsx` to pass `status` to `monitoringService.listFieldResearch`, reset `items` and `nextCursor` on tab/filter change, guard against rapid-switch races via `reqSeqRef`, display `Latest` on `idx === 0 && statusFilter === 'ALL'`, and honestly label client-filtered tabs as `Filtered loaded pages (N)`.

### F-M3-03 (Low) — Missing Firestore Composite Index for `disease_research_reports`
- **Root Cause:** `firestore.indexes.json` lacked composite indexes for `disease_research_reports`, forcing `FirestoreFieldMonitoringRepository.firestorePage` into the `100`-doc in-memory fallback on live Firestore.
- **Exact Fix:**
  - Added two `disease_research_reports` composite indexes to `firestore.indexes.json`:
    1. `(farmId ASC, fieldId ASC, createdAtEpochMs DESC, __name__ DESC)`
    2. `(farmId ASC, fieldId ASC, researchStatus ASC, createdAtEpochMs DESC, __name__ DESC)`
  - Added JSON validation in `DiseaseResearchServiceTest.java` to guard against accidental index removal.

---

## 2. Live Verification Status
- **Firestore Index & Query Execution:** **NOT VERIFIED** against live Cloud Firestore (`GOOGLE_APPLICATION_CREDENTIALS` was unset in the shell; Spring Boot integration tests ran in in-memory mode with `agroai.firebase.enabled=false`). JSON syntax and index definitions were validated locally (`VALID_JSON=True, TOTAL_INDEXES=18, DISEASE_RESEARCH_INDEXES=2`).
- **Authenticated Browser E2E:** **NOT VERIFIED** (requires interactive Firebase Authentication sign-in on `http://localhost:5173/login`).
