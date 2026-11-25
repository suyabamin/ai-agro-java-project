# AgroAI M2 — Citation Integrity Remediation Report (M2-01)

**Date:** 2026-11-26  
**Target Defect:** Moderate Defect **M2-01** from `M2_INDEPENDENT_ACCEPTANCE_AUDIT.md`  
**Preserved Prior Commits:** `e158948`, `a8816b9`, `bd0ed00`

---

## 1. Original Defect & Root Cause
- **Defect (M2-01):** `synthesize_advisory()` in `ai-service/app/services/advisory_synthesizer.py` generically attached `cited_papers[:2]` and `cited_domains[:2]` (including `bangladesh_agri_official` portal domains `bamis.gov.bd` and `dae.gov.bd`) to `actionableSteps` (`IMMEDIATE`, `SHORT_TERM`, `PREVENTIVE`) without verifying whether each cited source's actual retrieved text supported that step's claim.
- **Secondary Gap:** `synthesize_evidence_bengali_report()` populated `referencesBn` from top `papers[:3]` / `sources[:4]` rather than strictly from the sources that actually matched retrieved evidence sections.

---

## 2. Exact Fix & Citation Matching Rules
Updated `ai-service/app/services/advisory_synthesizer.py`:
1. **Source Eligibility Gate (`_eligible_evidence_candidates`):**
   - `ResearchPaper` is eligible **only** if `abstract` has length `>= 25` characters. DOI metadata verification or title match alone never qualifies as claim support.
   - `ResearchSource` with `provider == "bangladesh_agri_official"` (generic BAMIS/DAE/BARI/BRRI portal links) is **excluded** unless `extractedSummary` is non-empty.
2. **Deterministic Claim-Level Matching (`_match_citations_for_claim`):**
   - Uses whole-word regex boundaries (`\b...\b`, case-insensitive) per actionable step (`_STEP_ISOLATE_KW`, `_STEP_MANAGEMENT_KW`, `_STEP_PREVENTIVE_KW`) across sentences (`>= 20` chars) of eligible abstracts/snippets.
   - Word-boundary matching prevents false positives (e.g., `"isolate"` no longer matches `"Alternaria solani isolates"`).
   - Returns `citationIds = []` if no eligible source explicitly supports the step — never falls back to generic top-N citations.
3. **Aligned `citedPaperIds`, `citedSourceDomains`, and `referencesBn`:**
   - `citedPaperIds` and `citedSourceDomains` on `AdvisoryPayload` only list citations that backed at least one matched `actionableSteps` item.
   - `referencesBn` on `BengaliResearchReport` only lists citations that matched `symptomsBn`, `causesBn`, `spreadBn`, or `managementBn`.

---

## 3. Verification Results
- **Python (`pytest -q`):** **55 passed, 1 warning** (including 8 claim-level citation tests in `tests/test_advisory_synthesizer.py`).
- **Spring Boot (`mvnw.cmd test`):** **50 passed, 0 failures, 0 errors, 0 skipped** (`FieldMonitoringControllerIntegrationTest` in-memory mode + unit suites).
- **Frontend (`npm test && npm run build`):** **112 passed** across `14` files; `vite build` `0` errors (`2.07s`).
- **Live Unmocked M2 Check:** Verified `Tomato_Early_Blight`: `PREVENTIVE` cited only `['extension.umn.edu']`, `SHORT_TERM` cited only management-matching DOIs, and `BN_REFS` excluded generic BAMIS/DAE portals.
- **Live Firestore & Browser E2E:** **NOT VERIFIED** in this remediation run (Spring Boot integration tests ran with `agroai.firebase.enabled=false`; interactive Firebase browser sign-in was not performed).

---

## 4. Remaining Limitations
1. Extracted evidence sentences in `symptomsBn`, `causesBn`, `spreadBn`, and `managementBn` remain verbatim English abstract/snippet sentences inside Bengali section labels.
2. Live Firestore + interactive Farmer/Owner browser E2E remains unexecuted pending an authenticated browser session.
