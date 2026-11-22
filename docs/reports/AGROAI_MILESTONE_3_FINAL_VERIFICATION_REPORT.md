# AgroAI — Milestone 3 Final Testing, Production Integrity & Regression Audit Report

**Project:** `D:\agro-ai-java-project`  
**Milestone:** Milestone 3 — AI Model Training Remediation  
**Status:** COMPLETED & VERIFIED  
**Final Verdict:** **PASS**  
**Authoritative Decision:** **ORIGINAL BASELINE WATER NEED MODEL RETAINED IN PRODUCTION**  
**Date:** 2026-11-22  

---

## 1. Authoritative Production Decision

Following comprehensive investigation (Stage A) and isolated candidate validation (Stage B), the authoritative production decision is finalized as follows:

- **Original Baseline Water Need Model (`ai-service/models/water_need_model.joblib`):**  
  **PRODUCTION ACTIVE (RETAINED).**  
  SHA-256: `eb5362b9529d444e3ff3e48bce5ffc9c6e0a0d5731b14ef9bb681b64053af8fd`.
- **Candidate 2 (`ai-service/models/candidates/water_need_model_candidate_balanced.joblib`):**  
  **VALIDATED, NOT PROMOTED.**  
  SHA-256: `b102bd3b755dc620e3c3bd2d316df3758ef765d3af53259aaf56399afb3a026d`.
- **Candidate Metadata (`ai-service/models/candidates/candidate_water_need_meta.json`):**  
  Documented as `status: "VALIDATED_NOT_PROMOTED"`, `production_decision: "ORIGINAL_BASELINE_RETAINED"`.  
  SHA-256: `0c202568c4561044e0a9d959f6fd6f95e4960a97dcbf829b8e052d5f8a5a764e`.
- **Candidate Artifacts:** Staged and preserved in `ai-service/models/candidates/` for historical benchmarking and future research.
- **Production Inference Behavior:** **100% UNCHANGED.** Zero modification to production model loading or inference paths.

---

## 2. Model Artifact Integrity Verification Matrix

All model artifacts were audited and their SHA-256 cryptographic hashes were calculated and verified both before and after full regression test execution:

| Artifact | File Path | Expected SHA-256 | Actual Post-Test SHA-256 | Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Production Water Need** | `ai-service/models/water_need_model.joblib` | `eb5362b9529d444e3ff3e48bce5ffc9c6e0a0d5731b14ef9bb681b64053af8fd` | `eb5362b9529d444e3ff3e48bce5ffc9c6e0a0d5731b14ef9bb681b64053af8fd` | **MATCH** | **ACTIVE (RETAINED)** |
| **Candidate 2 Water Need** | `ai-service/models/candidates/water_need_model_candidate_balanced.joblib` | `b102bd3b755dc620e3c3bd2d316df3758ef765d3af53259aaf56399afb3a026d` | `b102bd3b755dc620e3c3bd2d316df3758ef765d3af53259aaf56399afb3a026d` | **MATCH** | **VALIDATED, NOT PROMOTED** |
| **Candidate Metadata** | `ai-service/models/candidates/candidate_water_need_meta.json` | `0c202568c4561044e0a9d959f6fd6f95e4960a97dcbf829b8e052d5f8a5a764e` | `0c202568c4561044e0a9d959f6fd6f95e4960a97dcbf829b8e052d5f8a5a764e` | **MATCH** | **PRESERVED** |
| **Crop Recommendation** | `ai-service/models/crop_recommendation_model.joblib` | Current state | `cd0cfb991e9afec33c1da41eecff1310c034a0f064e70cc3ef809db87cf4e347` | **MATCH** | **ACTIVE (UNTOUCHED)** |
| **Field Status** | `ai-service/models/field_status_model.joblib` | Current state | `09467cea5cb7e4218ad868fbae7fd20deb7a646c3ce215dbc20abeba04997f41` | **MATCH** | **ACTIVE (UNTOUCHED)** |
| **Tabular Metadata** | `ai-service/models/tabular_model_meta.json` | Current state | `dcf03f451d0901e0fddb1068f4827b126b43a76ff4040c7f2477ba0ede1b9d33` | **MATCH** | **ACTIVE (UNTOUCHED)** |
| **Dataset (Approved)** | `ai-service/data/agroai_labeled_dataset_v2.csv` | `87b93178756293b1dba0062fa75fa42275f11be7abe0086f4b4889699afb9f33` | `87b93178756293b1dba0062fa75fa42275f11be7abe0086f4b4889699afb9f33` | **MATCH** | **VERIFIED** |
| **Dataset (Copy 1)** | `ai-service/data/agroai_labeled_dataset_v2 (1).csv` | `87b93178756293b1dba0062fa75fa42275f11be7abe0086f4b4889699afb9f33` | `87b93178756293b1dba0062fa75fa42275f11be7abe0086f4b4889699afb9f33` | **MATCH** | **VERIFIED** |

---

## 3. Comprehensive Test Results Across Full Stack

### 3.1 AI Service Test Suite
- **Command:** `cd ai-service; .venv\Scripts\pytest tests/ -v`
- **Execution Directory:** `D:\agro-ai-java-project\ai-service`
- **Exit Code:** `0`
- **Results:** **24 passed, 0 failed, 0 errors, 0 skipped in 3.97s**
- **Suites Verified:**
  - `tests/test_health.py` (5 tests) — Actuator health, diagnostics, OpenAPI schema, CORS headers.
  - `tests/test_inference.py` (12 tests) — Disease inference auth gating, fail-closed `MODEL_UNAVAILABLE` contract, payload limits, image header validation, OpenCV preprocessing.
  - `tests/test_tabular.py` (7 tests) — Tabular model loading, inference execution, schema validation, error handling.

### 3.2 Non-Destructive AI Artifact & Inference Checks
- **Script:** `ai-service/tools/verify_production_integrity.py`
- **Exit Code:** `0`
- **Checks Verified:**
  - Production model loader dynamically verifies `class_weight=None` (original baseline active).
  - Both production baseline and Candidate 2 accept exactly the 8 specified numeric features in order: `['N', 'P', 'K', 'temperature', 'humidity', 'ph', 'rainfall', 'Soil Moisture']`.
  - Multi-class output probabilities sum to 1.0 (non-negative, finite, calibrated shape `(4,)`).
  - Missing features (7 columns) correctly rejected (`ValueError`).
  - Extra features (9 columns) correctly rejected (`ValueError`).
  - Non-numeric inputs correctly rejected (`ValueError`).
  - Leaf disease detection strictly preserves fail-closed `MODEL_UNAVAILABLE` (`inference_ready=False`).

### 3.3 Frontend Vitest Regression Suite
- **Command:** `cd frontend; npm run test`
- **Execution Directory:** `D:\agro-ai-java-project\frontend`
- **Exit Code:** `0`
- **Results:** **88 passed, 0 failed, 0 errors, 0 skipped across 11 test files in 1.93s**
- **Field-Wise AI Insights Coverage (`src/utils/farmAiInsights.test.ts` - 8 tests):**
  - Zero active fields ($N=0 \rightarrow$ clean Empty State).
  - Single active field ($N=1 \rightarrow$ 1 row).
  - Two active fields ($N=2 \rightarrow$ 2 rows).
  - Multiple active fields ($N=5 \rightarrow$ 5 rows).
  - Cross-field data isolation: Mismatched analysis IDs injected into target field rows are rejected with a warning log and rendered as `UNEVALUATED`.
  - Array deduplication: Identical canonical field objects are safely deduplicated.
  - Lifecycle state handling: `COMPLETED`, `PENDING`, `FAILED`, and `UNEVALUATED` states.
  - Disease status: Verifies `MODEL_UNAVAILABLE` fail-closed rendering without fabrication.
  - Telemetry aggregation: Mathematically aggregates sensor packets across sectors without `fieldsList[0]` hardcoding.

### 3.4 Frontend Production Build
- **Command:** `cd frontend; npm run build` (`tsc -b && vite build`)
- **Execution Directory:** `D:\agro-ai-java-project\frontend`
- **Exit Code:** `0`
- **Results:**
  - TypeScript strict compile (`tsc -b`): **0 errors**
  - Vite Rollup production bundle: **195 modules transformed in 703ms**
  - Dist bundle generated cleanly with route-level chunks.

### 3.5 Backend Spring Boot Regression Suite
- **Command:** `cd backend; .\mvnw.cmd test -Dtest="!*Live*"`
- **Execution Directory:** `D:\agro-ai-java-project\backend`
- **Exit Code:** `0`
- **Results:** **284 passed, 0 failures, 0 errors, 0 skipped in 27.2s (`BUILD SUCCESS`)**
- **Areas Verified:**
  - Contextual authentication & token verification (`DefaultFirebaseTokenVerifier`, `RevocationCheckInterceptor`).
  - Contextual authorization evaluators (`FarmSecurityEvaluator`, `FieldSecurityEvaluator`).
  - Monitoring authorization (`MonitoringAuthorizationServiceTest` — `TELEMETRY` permission and legacy `WRITE_LOGS` compatibility).
  - Soil telemetry batch ingestion (`SoilTelemetryServiceTest` — 14 tests, atomic batch submission).
  - Agricultural analysis service & asynchronous processing (`AgriculturalAnalysisServiceTest` — 18 tests).
  - Field management, job applications, payments, and reviews.

---

## 4. Production Safety and Cross-Service Verification

1. **Active Model Selection:** Production inference in `app.core.tabular_model.py` loads `ai-service/models/water_need_model.joblib`. Its classifier parameters (`class_weight=None`, `max_iter=150`, `random_state=42`) confirm the original baseline is active.
2. **Candidate Isolation:** Candidate 2 resides in `ai-service/models/candidates/water_need_model_candidate_balanced.joblib`. No production service or controller references this directory.
3. **Model Non-Interference:** The Crop Recommendation and Field Status models were not retrained or modified. Their hashes remain consistent with current-state records.
4. **Disease Model Fail-Closed Contract:** No mock disease diagnoses or synthetic CNN weights were introduced. The service strictly reports `status: "MODEL_UNAVAILABLE"` and `inference_ready: false`.
5. **No Database or API Contract Changes:** All existing Spring Boot endpoints and DTO contracts remain completely unchanged.

---

## 5. Fundamental Scientific & Dataset Limitations

1. **Extreme Minority Class Imbalance ($N=9$):**
   The approved dataset contains only 9 `Urgent` samples out of 2,200 records (0.41%). In an 80/20 train/test split, exactly 2 samples fall into the test set. A single misclassification swings test recall by 50 percentage points.
2. **Monoculture Bias (Mothbeans Exclusivity):**
   All 9 `Urgent` records in the dataset belong strictly to the `mothbeans` crop. Under `agronomic_rule_v1`, the rule marks records as `Urgent` only when Soil Moisture $<19\%$, Rainfall $<34$mm, and Temperature $>25^\circ$C for mothbeans.
3. **No Cross-Crop Generalization:**
   The model cannot learn how `Urgent` water stress manifests in other crops (e.g., maize, rice, cotton, coffee) because zero other crops carry this label in the dataset.
4. **Empirical Held-Out Parity:**
   In held-out 80/20 test evaluation, Candidate 2 (`class_weight='balanced'`) achieved the exact same held-out Urgent recall (50.0%, 1 of 2 caught, 1 missed) as the baseline. While repeated cross-validation showed slight distributional gains (CV recall 72.0% vs. 70.0%), it came with substantial variance ($\pm 31.9\%$).
5. **Real-World Ground Truth Disclaimer:**
   The dataset labels are derived from rule-based heuristics (`agronomic_rule_v1`), not physically validated agronomic sensor ground truth. AgroAI decisions should serve as advisory decision support, not unverified autonomous irrigation triggers.

---

## 6. Git Working-Tree Status

As required by engineering policy, zero Git staging, commits, pushes, or branch changes were made:
- Git Working Tree: Clean index; untracked verification scripts, tests, reports, and isolated candidate artifacts remain intact.
- Production `.joblib` files: Completely untampered.

---

## 7. Final Verdict

**FINAL VERDICT: PASS**

- All required automated test suites executed cleanly across Python AI (24/24), Frontend Vitest (88/88), Frontend Build (0 errors), and Backend Maven (284/284).
- Production baseline Water Need model SHA-256 (`eb5362b9529d444e3ff3e48bce5ffc9c6e0a0d5731b14ef9bb681b64053af8fd`) is 100% verified and active.
- Candidate 2 SHA-256 (`b102bd3b755dc620e3c3bd2d316df3758ef765d3af53259aaf56399afb3a026d`) is preserved in staging and verified as NOT PROMOTED.
- Milestone 3 is complete, verified, and closed.
