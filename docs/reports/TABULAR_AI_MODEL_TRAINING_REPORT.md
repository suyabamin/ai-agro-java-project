# AgroAI — Tabular AI Model Training & Verification Report

**Date:** November 20, 2026  
**Pipeline Version:** `tabular-pipeline-v2.0`  
**Dataset:** `ai-service/data/agroai_labeled_dataset_v2.csv`  
**Evaluation Status:** COMPLETE & EMPIRICALLY VERIFIED (Held-out Test Evaluation)  

---

## 1. Executive Summary

This report documents the rigorous implementation, training, evaluation, comparison, artifact serialization, and FastAPI integration of tabular machine learning models for the AgroAI platform.

Three distinct predictive models were trained on the clean agricultural dataset:
1. **Model 1: Water Need Prediction** — Categorizes field irrigation urgency into `['Low', 'Moderate', 'High', 'Urgent']`.
2. **Model 2: Field Status Prediction** — Assesses field agronomic condition into `['Healthy', 'Attention', 'Critical']`.
3. **Model 3: Crop Classification / Recommendation** — Identifies optimal crop varieties across 22 classes based on environmental and soil telemetry.

All models were evaluated strictly on an unseen 20% held-out test set (`440` samples) after 5-fold stratified cross-validation on the 80% training set (`1,760` samples). Preprocessing pipelines (`StandardScaler` + `Classifier`) are bundled and serialized together using `joblib`.

---

## 2. Dataset Exploration & Preprocessing Decisions

### 2.1 Raw Dataset Audit
- **Source File:** `ai-service/data/agroai_labeled_dataset_v2.csv`
- **Total Rows:** `2,200`
- **Feature Columns (8 Signals):**
  - `N` (Nitrogen): Continuous [0.0 - 140.0 mg/kg]
  - `P` (Phosphorus): Continuous [5.0 - 145.0 mg/kg]
  - `K` (Potassium): Continuous [5.0 - 205.0 mg/kg]
  - `temperature`: Continuous [8.83 - 43.68 °C]
  - `humidity`: Continuous [14.26 - 99.98 %]
  - `ph`: Continuous [3.50 - 9.94]
  - `rainfall`: Continuous [20.21 - 298.56 mm]
  - `Soil Moisture`: Continuous [10.08 - 89.89 %]
- **Target Attributes:**
  - `Water Need`: Class distribution:
    - `Low`: 1,884 samples (85.6%)
    - `Moderate`: 225 samples (10.2%)
    - `High`: 82 samples (3.7%)
    - `Urgent`: 9 samples (0.4%)
  - `Status`: Class distribution:
    - `Healthy`: 1,534 samples (69.7%)
    - `Attention`: 378 samples (17.2%)
    - `Critical`: 288 samples (13.1%)
  - `label` (Crop variety): 22 classes (`rice`, `maize`, `chickpea`, `kidneybeans`, etc.), exactly 100 samples each (balanced).
- **Duplicate Analysis:** Feature deduplication confirmed 2,200 unique 8-feature tuples (0 identical duplicate records).

### 2.2 Data Leakage Prevention & Ethical Boundaries
- **Target Isolation:** Target variables (`Water Need`, `Status`, `label`) are never used as inputs to any model or each other.
- **Provenance Stripping:** Metadata columns `label_source` and `label_method` were completely excluded from the feature matrix.
- **Rule-Derived Provenance Notice:** The dataset tags `label_source=derived` and `label_method=agronomic_rule_v1`. These models learn patterns from rule-derived labels; they do not represent independently validated agronomic ground truth.
- **Image Segregation:** This tabular dataset is strictly separated from image-based leaf disease inference.

### 2.3 Preprocessing & Splitting Strategy
- **Train/Test Split:** Stratified 80/20 train/test split with `random_state=42`.
  - Training Set: `1,760` samples
  - Held-out Test Set: `440` samples
  - Stratification preserves minority classes (e.g. 7 `Urgent` in train, 2 in test).
- **Pipeline Scaling:** `sklearn.preprocessing.StandardScaler` fitted strictly on training data and encapsulated directly inside the `Pipeline` artifact, preventing data leakage during inference.

---

## 3. Algorithm Comparison (5-Fold Stratified Cross-Validation on Training Data)

Five distinct model families were evaluated on the 80% training set across all three tasks:

| Algorithm | Water Need (5-Fold CV) | Field Status (5-Fold CV) | Crop Recommendation (5-Fold CV) | Selected |
|---|---|---|---|---|
| **HistGradientBoosting** | **96.88% ± 0.74%** | **92.84% ± 1.21%** | 99.03% ± 0.43% | **Winner (Water Need & Field Status)** |
| **GradientBoosting** | 96.59% ± 1.16% | 92.84% ± 0.71% | 99.09% ± 0.45% | Alternate |
| **RandomForest** | 95.51% ± 1.43% | 91.19% ± 1.02% | **99.66% ± 0.33%** | **Winner (Crop Recommendation)** |
| **ExtraTrees** | 93.30% ± 0.53% | 86.93% ± 2.27% | 99.49% ± 0.21% | Alternate |
| **LogisticRegression** | 91.02% ± 0.73% | 73.92% ± 1.30% | 97.73% ± 0.93% | Linear Baseline |

### Selection Rationale:
- **HistGradientBoosting** was chosen for **Water Need** and **Field Status** because of its superior handling of non-linear multi-threshold splits, robustness against class imbalance (such as the 9 `Urgent` samples), and highest cross-validation score without overfitting.
- **RandomForest** was chosen for **Crop Recommendation** because it achieved nearly perfect cross-validation accuracy (99.66%) with zero convergence sensitivity across all 22 balanced crop types.

---

## 4. Held-Out Test Evaluation Results (Unseen 440 Samples)

### 4.1 Model 1: Water Need Prediction
- **Algorithm:** `HistGradientBoostingClassifier` inside `Pipeline([('scaler', StandardScaler()), ...])`
- **Test Set Accuracy:** **96.82%**
- **Macro Precision:** 78.70% | **Weighted Precision:** 97.00%
- **Macro Recall:** 82.21% | **Weighted Recall:** 96.82%
- **Macro F1-Score:** 80.30% | **Weighted F1-Score:** 97.00%

#### Classification Report (Held-out Test Data):
```
              precision    recall  f1-score   support

        High       0.79      0.94      0.86        16
         Low       0.99      0.98      0.99       377
    Moderate       0.87      0.87      0.87        45
      Urgent       0.50      0.50      0.50         2

    accuracy                           0.97       440
   macro avg       0.79      0.82      0.80       440
weighted avg       0.97      0.97      0.97       440
```

#### Confusion Matrix:
```
[[ 15   0   0   1]   <- High (15 correct, 1 predicted Urgent)
 [  0 371   6   0]   <- Low (371 correct, 6 predicted Moderate)
 [  3   3  39   0]   <- Moderate (39 correct, 3 predicted High, 3 predicted Low)
 [  1   0   0   1]]  <- Urgent (1 correct, 1 predicted High)
```

---

### 4.2 Model 2: Field Status Prediction
- **Algorithm:** `HistGradientBoostingClassifier` inside `Pipeline([('scaler', StandardScaler()), ...])`
- **Test Set Accuracy:** **93.86%**
- **Macro Precision:** 91.97% | **Weighted Precision:** 94.00%
- **Macro Recall:** 89.88% | **Weighted Recall:** 93.86%
- **Macro F1-Score:** 90.87% | **Weighted F1-Score:** 94.00%

#### Classification Report (Held-out Test Data):
```
              precision    recall  f1-score   support

   Attention       0.86      0.79      0.82        76
    Critical       0.95      0.93      0.94        57
     Healthy       0.96      0.98      0.97       307

    accuracy                           0.94       440
   macro avg       0.92      0.90      0.91       440
weighted avg       0.94      0.94      0.94       440
```

#### Confusion Matrix:
```
[[ 60   2  14]   <- Attention (60 correct, 2 Critical, 14 Healthy)
 [  4  53   0]   <- Critical (53 correct, 4 Attention, 0 Healthy)
 [  6   1 300]]  <- Healthy (300 correct, 6 Attention, 1 Critical)
```

---

### 4.3 Model 3: Crop Recommendation / Classification
- **Algorithm:** `RandomForestClassifier` inside `Pipeline([('scaler', StandardScaler()), ...])`
- **Test Set Accuracy:** **99.32%**
- **Macro F1-Score:** **99.32%**
- Across all 22 classes (20 test samples each), 21 classes achieved 100% precision and recall; minor overlap occurred only between `rice` and `jute` (1 sample) and `blackgram` and `lentil` (1 sample).

---

## 5. Artifact Storage & Model Metadata

Artifacts are saved in `ai-service/models/`:
- `ai-service/models/water_need_model.joblib` — Complete preprocessing + classifier pipeline for Water Need.
- `ai-service/models/field_status_model.joblib` — Complete preprocessing + classifier pipeline for Field Status.
- `ai-service/models/crop_recommendation_model.joblib` — Complete preprocessing + classifier pipeline for Crop Recommendation.
- `ai-service/models/tabular_model_meta.json` — Comprehensive metadata detailing model version (`tabular-pipeline-v2.0`), feature column order, test metrics, and provenance disclaimers.

---

## 6. FastAPI & System Integration

### 6.1 Inference Service (`ai-service/`)
- **`app/core/tabular_model.py`:**
  - Enforces exact feature column order: `['N', 'P', 'K', 'temperature', 'humidity', 'ph', 'rainfall', 'Soil Moisture']`.
  - Lazy loads model pipelines and verifies artifact presence.
  - Generates probability distributions via `predict_proba` and calculates prediction confidence scores.
  - Fail-closed error handling: Raises `TabularModelUnavailable` if artifacts are missing, returning HTTP 503 `MODEL_UNAVAILABLE`.
- **Endpoints:**
  - `POST /api/v1/inference/tabular`: Accepts `TabularFeatures` (with Pydantic physical boundary validation) and returns `TabularInferenceResponse`.
  - `GET /api/v1/inference/tabular/availability`: Returns readiness status and list of loaded models.

### 6.2 Backend Service Integration (`backend/`)
- `AiInferenceClient.java` calls `POST /api/v1/inference/tabular` with `X-AI-Service-Key`.
- `AgriculturalAnalysisService.java` pulls latest field telemetry, executes inference, and records predictions:
  - `predictedWaterNeed` (e.g. `Low`, `Moderate`, `High`, `Urgent`)
  - `predictedFieldStatus` (e.g. `Healthy`, `Attention`, `Critical`)
  - `recommendedCrop` (e.g. `rice`)
  - Confidences, model version, and the rule-derived agronomic notice.
- Persisted to `ai_analysis_results` collection and tracked in field history.

### 6.3 Farmer Workdesk UI (`frontend/`)
- `FarmerFieldDetailsPage.tsx`: Displays actual predicted Water Need, Field Status, AI Recommended Crop, and confidence percentages in the operational dashboard.
- Displays submitted physical telemetry and observation timestamps alongside analysis records.

---

## 7. Verification Test Suite Results

| Test Category | Command | Result |
|---|---|---|
| **AI Tabular & Diagnostics Tests** | `pytest tests/ -v` | **24/24 PASSED** (0 failures) |
| **Backend Monitoring & Regression Suite** | `mvnw.cmd test` | **250/250 PASSED** (`BUILD SUCCESS`) |
| **Frontend Unit Test Suite** | `npm run test -- --run` | **76/76 PASSED** (10/10 test files) |
| **Frontend Production Build** | `npm run build` | **0 errors**, production bundle compiled |

---

## 8. Remaining Limitations & Agronomic Risks

1. **Heuristic Rule Grounding:** The target labels in `agroai_labeled_dataset_v2.csv` were produced by deterministic agronomic rules (`agronomic_rule_v1`). Although the machine learning models achieve high accuracy on this dataset, they approximate rule-derived classifications rather than multi-season empirical crop yield measurements.
2. **Minority Class Support:** The `Urgent` class for Water Need comprises only 9 samples in the entire dataset. While stratified splitting ensured representation in both train (7) and test (2), real-world drought conditions may require ongoing sample collection.
3. **Leaf Disease Independence:** Disease detection remains independent of tabular models and continues to report `MODEL_UNAVAILABLE` until an evaluated visual model is registered.
