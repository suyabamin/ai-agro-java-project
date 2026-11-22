# AgroAI — Farm-Wise AI Insights & Dataset Model Training Audit Report

**Date:** 2026-11-22  
**Repository:** `D:\agro-ai-java-project`  
**Dataset Inspected:** `ai-service\data\agroai_labeled_dataset_v2 (1).csv`  
**Milestone:** MILESTONE 1 — Investigation & Audit  
**Author:** Antigravity Agent  

---

## Executive Summary

This audit assesses:
1. The dynamic field behavior of the **Farm AI Insights** dashboard component and why the UI appeared to show only one field.
2. The integrity, distributions, and characteristics of the specified labeled dataset `ai-service\data\agroai_labeled_dataset_v2 (1).csv`.
3. The exact training, validation, artifact validity, and inference status of all AI models in the AgroAI service.

---

## 1. Farm AI Insights Investigation (Task 1.1)

### 1.1 Architecture & Flow Inspection
- **Frontend Architecture:**
  - `DashboardPage.tsx`: Primary Farm Owner dashboard. Calls `fieldService.fetchFields(activeFarm.farmId)` to retrieve the fields belonging to the active farm. Then executes concurrent calls to `monitoringService.listAgriculturalAnalyses(farmId, fieldId, null, 1)` to fetch each field's latest agronomic evaluation.
  - `AIAnalysisDashboardPage.tsx` (AI Diagnostics Center): Dedicated to Computer Vision leaf disease diagnostics. It uses a single-field `<select>` dropdown (`selectedFieldId = loaded[0].fieldId`) to select one field at a time for image upload and analysis.
  - `SoilMonitoringDashboardPage.tsx`: Dedicated to in-situ IoT probe readings, also selecting a single field at a time (`fields[0]`).
- **Backend Farm-to-Field Relationship:**
  - `FieldController.java` (`GET /api/v1/farms/{farmId}/fields`): Invokes `fieldService.getFields(...)` which queries `fieldRepository.findActiveByFarmId(farmId)`.
  - In Firestore, fields are stored in the `fields` collection with composite key `{farmId}--{localFieldId}` and a foreign key property `farmId`.
  - Scoping is enforced: queries strictly filter `whereEqualTo("farmId", farmId)`.
- **Root Cause of "Only One Field Displayed":**
  1. **Single-Field Dropdowns on Specialized Pages:** `AIAnalysisDashboardPage.tsx` and `SoilMonitoringDashboardPage.tsx` were designed around an active field selector (`fields[0]`), showing only 1 field at a time.
  2. **Single-Field Telemetry Widget:** In `DashboardPage.tsx` (lines 72-74), `fieldsList[0]` was used to fetch telemetry for the right-hand LoRaWAN widget, creating a single-field view for sensor telemetry.
  3. **Live Database State:** In test/live environments where only a single test field was registered under the farm holding (e.g. `farm-aec1a140-3c82-4d1a-85fa-502c96a6f5d8`), `fields.map(...)` rendered exactly 1 row.
  4. **Multi-Field Handling in Table:** The Farm AI Insights table in `DashboardPage.tsx` maps over `fields`, but lacked automated multi-field test coverage (e.g., verifying 0, 1, 2, 5, 10 fields and mixed evaluated/unevaluated fields).

---

## 2. Defined Dynamic Field Behavior (Task 1.2)

For Milestone 2, the expected dynamic behavior is defined as follows:

| Condition | Rows Rendered | Expected UI Behavior |
|---|---|---|
| **0 Fields** | 0 rows | Renders empty state: *"No field parcels registered under this farm holding."* with link to *"Add Field"*. |
| **1 Field** | 1 row | Renders 1 row for that specific field. |
| **2 Fields** | 2 rows | Renders 2 distinct rows, each with its own field ID, crop, and independent AI record. |
| **$N$ Fields** | $N$ rows | Dynamically renders $N$ rows. Never hardcoded. |

### Field-Wise Row Schema:
1. **Field Zone:** `field.name` + canonical `field.fieldId`.
2. **Crop Variety:** `field.cropType` (or designated crop).
3. **Latest Evaluation:** Timestamp formatted via `toLocaleString()` or *"No evaluation yet"*.
4. **Water Need:** Evaluated water need (`Low`, `Moderate`, `High`, `Urgent`) or `"—"`.
5. **Field Status:** Evaluated status (`Healthy`, `Attention`, `Critical`) or `"—"`.
6. **Recommended Crop:** Model recommendation (`rice`, `maize`, etc.) or `"—"`.
7. **Disease Status:** Foliar status (reports `"MODEL_UNAVAILABLE"` when no image model is registered).
8. **View Decision:** Action link navigating to `/dashboard/fields/${field.fieldId}#ai-decision`.

### Core Data Integrity Rules:
- **Strict Scoping:** Every row corresponds to a field with `field.farmId === activeFarm.farmId`.
- **Zero Cross-Field Leakage:** Evaluations are keyed strictly by `field.fieldId`. An evaluation for Field A is never shown under Field B.
- **Explicit Evaluation States:**
  - `COMPLETED`: Displays prediction badges and timestamp.
  - `PENDING` / `PROCESSING`: Displays active progress indicator (*"Analyzing..."*).
  - `FAILED`: Displays error indicator (*"Evaluation Failed"*).
  - Un-evaluated: Displays *"No evaluation yet"*.

---

## 3. Dataset Audit: `agroai_labeled_dataset_v2 (1).csv` (Task 1.3)

### 3.1 File Identification & Checksum
- **File Path:** `ai-service\data\agroai_labeled_dataset_v2 (1).csv`
- **Reference Path:** `ai-service\data\agroai_labeled_dataset_v2.csv`
- **SHA-256 Checksum:** `87b93178756293b1dba0062fa75fa42275f11be7abe0086f4b4889699afb9f33`
- **Result:** The two files are **byte-for-byte identical**.

### 3.2 Dimensions & Cleanliness
- **Total Rows:** 2,200
- **Total Columns:** 13
- **Duplicate Rows:** 0 (2,200 unique records)
- **Missing / Null Values:** 0 across all columns

### 3.3 Columns & Data Types
| Column | Type | Role | Value Range / Classes |
|---|---|---|---|
| `N` | float64 | Feature | 0.00 – 140.00 (mean: 50.55) |
| `P` | float64 | Feature | 5.00 – 145.00 (mean: 53.36) |
| `K` | float64 | Feature | 5.00 – 205.00 (mean: 48.15) |
| `temperature` | float64 | Feature | 8.83 – 43.68 °C (mean: 25.62) |
| `humidity` | float64 | Feature | 14.26 – 99.98 % (mean: 71.48) |
| `ph` | float64 | Feature | 3.50 – 9.94 (mean: 6.47) |
| `rainfall` | float64 | Feature | 20.21 – 298.56 mm (mean: 103.46) |
| `Soil Moisture` | float64 | Feature | 8.00 – 55.00 % (mean: 25.21) |
| `label` | string | Target (Crop) | 22 classes, exactly 100 rows each (4.55% each) |
| `Water Need` | string | Target (Water) | 4 classes (Low, Moderate, High, Urgent) |
| `Status` | string | Target (Field) | 3 classes (Healthy, Attention, Critical) |
| `label_source` | string | Metadata | 100% `"derived"` |
| `label_method` | string | Metadata | 100% `"agronomic_rule_v1"` |

### 3.4 Target Distributions & Imbalance
1. **`Water Need` (Severe Class Imbalance):**
   - `Low`: 1,884 samples (85.64%)
   - `Moderate`: 225 samples (10.23%)
   - `High`: 82 samples (3.73%)
   - `Urgent`: 9 samples (0.41%)  
   *Risk: Extremely scarce representation for "Urgent" (only 9 samples total).*
2. **`Status` (Field Status — Moderate Imbalance):**
   - `Healthy`: 1,534 samples (69.73%)
   - `Attention`: 378 samples (17.18%)
   - `Critical`: 288 samples (13.09%)
3. **`label` (Crop Recommendation — Perfectly Balanced):**
   - 22 crop classes, exactly 100 samples per crop (4.55% each).

### 3.5 Preprocessing & Splitting Strategy
- **Feature Pipeline:** 8 numerical features (`N`, `P`, `K`, `temperature`, `humidity`, `ph`, `rainfall`, `Soil Moisture`) normalized using `StandardScaler` fitted strictly on training data.
- **Split:** 80% Train (1,760 samples), 20% Held-Out Test (440 samples).
- **Stratification:** Mandatory stratified splitting (`stratify=y`) to ensure minority classes (`Urgent` = 2 test samples, `High` = 16 test samples) appear in both splits.

---

## 4. AI Model Inventory & Verification Audit (Task 1.4)

| Model Name | Target Domain | Model Architecture | Dataset Fingerprint | Training Status | Artifact Status | Test Evaluation | Production Status |
|---|---|---|---|---|---|---|---|
| **Water Need** | Soil Water Deficit | `StandardScaler` + `HistGradientBoostingClassifier` | SHA-256: `87b93178` | **TRAINED_AND_VALIDATED** | `water_need_model.joblib` (Valid, Loadable) | Accuracy: 96.82%<br>Macro F1: 80.30%<br>Weighted F1: 96.86% | **VALIDATED** (Rule-derived baseline) |
| **Field Status** | Agronomic Stress | `StandardScaler` + `HistGradientBoostingClassifier` | SHA-256: `87b93178` | **TRAINED_AND_VALIDATED** | `field_status_model.joblib` (Valid, Loadable) | Accuracy: 93.86%<br>Macro F1: 90.87%<br>Weighted F1: 93.76% | **VALIDATED** (Rule-derived baseline) |
| **Crop Recommendation** | Crop Suitability | `StandardScaler` + `RandomForestClassifier` | SHA-256: `87b93178` | **TRAINED_AND_VALIDATED** | `crop_recommendation_model.joblib` (Valid, Loadable) | Accuracy: 99.32%<br>Macro F1: 99.32%<br>Weighted F1: 99.32% | **VALIDATED** |
| **Leaf Disease Detection** | Foliar Pathology | Computer Vision / CNN (`.keras` / `.h5`) | N/A (Image Dataset) | **NOT_TRAINED** (Tabular CSV contains no images) | `MODEL_ARTIFACT_MISSING` | N/A | **FAIL-CLOSED** (`MODEL_UNAVAILABLE`) |

### 4.1 Detailed Model Audit Findings
1. **Water Need Model (`water_need_model.joblib`):**
   - **Trained:** Yes. `ai-service/tools/train_tabular_models.py` executed on `2026-11-19T22:33:25Z`.
   - **Evaluation Evidence:** Held-out test set (440 samples):
     - Low: Precision 99.2%, Recall 98.4%, F1 98.8% (377 samples).
     - Moderate: Precision 86.7%, Recall 86.7%, F1 86.7% (45 samples).
     - High: Precision 78.9%, Recall 93.8%, F1 85.7% (16 samples).
     - Urgent: Precision 50.0%, Recall 50.0%, F1 50.0% (2 samples).
   - **Diagnosis:** The model is valid and functional. The Urgent class has limited test support due to the underlying dataset distribution (9 samples total).
2. **Field Status Model (`field_status_model.joblib`):**
   - **Trained:** Yes. Tested on 440 held-out samples:
     - Healthy: Precision 95.5%, Recall 97.7%, F1 96.6% (307 samples).
     - Attention: Precision 85.7%, Recall 78.9%, F1 82.2% (76 samples).
     - Critical: Precision 94.6%, Recall 93.0%, F1 93.8% (57 samples).
   - **Diagnosis:** Well-generalized multi-class performance with balanced precision and recall.
3. **Crop Recommendation Model (`crop_recommendation_model.joblib`):**
   - **Trained:** Yes. RandomForestClassifier (200 estimators, max depth 12).
   - **Evaluation Evidence:** Overall accuracy 99.32%, macro F1 99.32% across all 22 crops.
   - **Diagnosis:** Exceptional separation of soil and climate envelopes.
4. **Leaf Disease Model:**
   - **Dataset Compatibility:** The provided dataset `agroai_labeled_dataset_v2 (1).csv` is strictly tabular and cannot be used to train an image-based disease model.
   - **System Policy Compliance:** As mandated by PRD.md and RULES.md, the application correctly reports `MODEL_UNAVAILABLE` rather than fabricating predictions.

---

## 5. Technical Risks & Gaps

1. **Urgent Water Need Data Scarcity:** With only 9 "Urgent" instances out of 2,200 rows, any retrain without SMOTE or class-weighting risks low sensitivity for urgent drought/irrigation alerts.
2. **Label Provenance:** `Water Need` and `Status` are labeled via `agronomic_rule_v1` (heuristics), not ground truth soil laboratory assays. This limitation is transparently documented in `tabular_model_meta.json`.
3. **Multi-Field Frontend Snapshot Test Coverage:** Frontend test suite currently tests services and components, but lacks a dedicated multi-field fixture test specifically verifying 0, 1, 2, and 10 field rows in the Farm AI Insights table.

---

## 6. Proposed Remediation & Implementation Plan

### Milestone 2: Dynamic Field-Wise AI Insights
1. **Frontend Refinements:**
   - In `DashboardPage.tsx`, ensure `Farm AI Insights` table seamlessly handles any dynamic number of fields ($N=0, 1, 2, 3, 10+$) with no hardcoded limits or single-field assumptions.
   - Ensure the right-hand "Mesh Telemetry Feed" gracefully adapts or provides farm-wide aggregation rather than assuming `fieldsList[0]`.
   - Add explicit badge styling and accessible tooltips for all evaluation statuses (`COMPLETED`, `PENDING`, `FAILED`, `No evaluation yet`).
2. **Comprehensive Test Suite:**
   - Unit tests covering 0 fields (empty state), 1 field, 2 fields, multiple fields.
   - Tests verifying cross-field data isolation (Field A's analysis never leaks into Field B).
   - Tests verifying pending, failed, and un-evaluated field states.

### Milestone 3: AI Model Training Remediation
- Since the existing tabular models (`water_need_model.joblib`, `field_status_model.joblib`, `crop_recommendation_model.joblib`) are already trained and validated on this exact CSV (SHA-256: `87b93178`), verify whether retraining with class weighting (`class_weight='balanced'`) improves minority class recall (especially `Urgent` from 50% to >70%) without degrading overall accuracy.
- If retraining is approved:
  - Execute `train_tabular_models.py` with balanced class weights for `HistGradientBoostingClassifier`.
  - Re-evaluate on held-out test split.
  - Save new artifacts and update `tabular_model_meta.json`.

---

## 7. Approval Gate Request

**Milestone 1 Investigation & Audit is complete.**  
In accordance with project rules, we pause at this approval gate. No code changes or retraining will take place until the user approves the audit findings and the proposed implementation plan.
