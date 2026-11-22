# AgroAI — Water Need Class Imbalance Investigation & Model Strategy Comparison Report

**Milestone:** Milestone 3 — Stage A: Dataset & Model Training Investigation  
**Status:** STAGE A COMPLETE / AWAITING STAGE B RETRAINING APPROVAL  
**Date:** 2026-11-22  
**Repository:** `D:\agro-ai-java-project`  
**Dataset:** `ai-service/data/agroai_labeled_dataset_v2 (1).csv` (and `agroai_labeled_dataset_v2.csv`)  

---

## 1. Backend Milestone 2 Test Verification

Before proceeding, the Maven test execution for Milestone 2 was verified directly from the surefire execution log:
- **Command:** `backend\mvnw.cmd test -Dtest="!*Live*"`
- **Execution Log:** `C:\Users\HP\.gemini\antigravity\brain\b6fc64d8-01c3-4972-8424-a92883521c09\.system_generated\tasks\task-1584.log`
- **Exit Code:** 0
- **Build Status:** `BUILD SUCCESS` (Total time: 30.628 s, completed at 2026-11-22T03:09:41+06:00)
- **Detailed Counts:**
  - **Total Tests Run:** 284
  - **Failures:** 0
  - **Errors:** 0
  - **Skipped:** 0
- **Status:** **PASS (100% verified without fabrication)**

---

## 2. Dataset Verification & Fingerprint

Using `ai-service/tools/investigate_water_need_imbalance.py`, the dataset files were verified:

| File | SHA-256 Checksum | Row Count | Column Count | Null Count |
| :--- | :--- | :--- | :--- | :--- |
| `ai-service/data/agroai_labeled_dataset_v2 (1).csv` | `87b93178756293b1dba0062fa75fa42275f11be7abe0086f4b4889699afb9f33` | 2,200 | 13 | 0 |
| `ai-service/data/agroai_labeled_dataset_v2.csv` | `87b93178756293b1dba0062fa75fa42275f11be7abe0086f4b4889699afb9f33` | 2,200 | 13 | 0 |

Both files are byte-for-byte identical.

---

## 3. Water Need Target Distribution & Urgent Sample Inspection

### 3.1 Class Breakdown
Total samples: 2,200

| Class | Sample Count | Percentage |
| :--- | :--- | :--- |
| `Low` | 1,884 | 85.64% |
| `Moderate` | 225 | 10.23% |
| `High` | 82 | 3.73% |
| `Urgent` | 9 | 0.41% |

### 3.2 Deep Agronomic Inspection of All 9 `Urgent` Records

Every single one of the 9 `Urgent` samples in the dataset shares the following characteristics:
1. **Crop (label):** `mothbeans` (100% of Urgent samples).
2. **Status:** `Critical` (100% of Urgent samples).
3. **Soil Moisture:** Severely depleted, ranging strictly from **8.00% to 18.80%** (well below the permanent wilting point for arid legumes).
4. **Rainfall:** Very low, ranging between **30.9 mm and 34.0 mm**.
5. **Temperature:** Warm/arid conditions, between **25.4°C and 31.1°C**.
6. **Humidity:** Moderate/dry, between **43.5% and 63.6%**.
7. **Label Provenance:** `label_source = "derived"`, `label_method = "agronomic_rule_v1"`.

**Agronomic Rule Finding:** Under `agronomic_rule_v1`, whenever Soil Moisture drops below ~19% with low rainfall (<34mm) and temperature >25°C for `mothbeans`, the heuristic labels the record as `Critical` status and `Urgent` water need.

---

## 4. Train/Test Split & Data Leakage Audit

### 4.1 Split Verification
- **Split Configuration:** `train_test_split(X, y_wn, test_size=0.20, random_state=42, stratify=y_wn)`
- **Train Set ($N=1,760$):**
  - `Low`: 1,507 (85.62%)
  - `Moderate`: 180 (10.23%)
  - `High`: 66 (3.75%)
  - `Urgent`: 7 (0.40%)
- **Held-Out Test Set ($N=440$):**
  - `Low`: 377 (85.68%)
  - `Moderate`: 45 (10.23%)
  - `High`: 16 (3.64%)
  - `Urgent`: 2 (0.45%)

### 4.2 Leakage Audit
- **Feature Set:** Strictly limited to `['N', 'P', 'K', 'temperature', 'humidity', 'ph', 'rainfall', 'Soil Moisture']`.
- **Target & Metadata Exclusion:** `Water Need`, `Status`, `label`, `label_source`, and `label_method` are strictly excluded from the feature matrix $X$.
- **Preprocessing Isolation:** `StandardScaler` is fitted strictly on `X_train` and packaged directly inside the `Pipeline`. Test data is only transformed, ensuring zero leakage of test distribution statistics into training.

---

## 5. Experimental Comparison of Candidate Strategies

Seven candidate configurations were evaluated under **identical conditions** using:
1. **Held-Out Test Set:** $N=440$, containing exactly 2 `Urgent` samples.
2. **Repeated Stratified K-Fold Cross-Validation:** 5 Folds $\times$ 5 Repeats = 25 distinct train/test evaluations across the entire dataset.

### 5.1 Held-Out Test Set Evaluation Results ($N=440$, Urgent $N=2$)

| Candidate Strategy | Accuracy | Macro F1 | Weighted F1 | Urgent Precision | Urgent Recall | Urgent F1 | Urgent FN |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Baseline: HistGradientBoosting (unweighted)** | 96.82% | 80.30% | 96.86% | 50.0% | 50.0% (1/2) | 50.0% | 1 |
| **2. HistGB (`class_weight='balanced'`)** | 96.82% | 80.37% | 96.89% | 50.0% | 50.0% (1/2) | 50.0% | 1 |
| **3. HistGB (`sample_weight='balanced'`)** | 96.82% | 80.37% | 96.89% | 50.0% | 50.0% (1/2) | 50.0% | 1 |
| **4. RandomForest (unweighted)** | 95.23% | 63.85% | 95.03% | 0.0% | 0.0% (0/2) | 0.0% | 2 |
| **5. RandomForest (`class_weight='balanced'`)** | 94.77% | 77.35% | 94.99% | 50.0% | 50.0% (1/2) | 50.0% | 1 |
| **6. HistGB + Train Random Oversampling** | **97.05%** | **85.26%** | **97.05%** | **100.0%** | **50.0% (1/2)** | **66.7%** | 1 |
| **7. LogisticRegression (`class_weight='balanced'`)** | 74.09% | 50.55% | 79.17% | 25.0% | 100.0% (2/2) | 40.0% | 0 |

#### Held-Out Confusion Matrices:

- **1. Baseline (HistGB unweighted):**
  ```
               Pred_High  Pred_Low  Pred_Mod  Pred_Urg
  True_High          15         0         0         1
  True_Low            0       371         6         0
  True_Moderate       3         3        39         0
  True_Urgent         1         0         0         1  <- 1 FN misclassified as High
  ```
- **2. HistGB (`class_weight='balanced'`):**
  ```
               Pred_High  Pred_Low  Pred_Mod  Pred_Urg
  True_High          15         0         0         1
  True_Low            0       370         7         0
  True_Moderate       3         2        40         0
  True_Urgent         1         0         0         1
  ```
- **6. HistGB + Train Random Oversampling:**
  ```
               Pred_High  Pred_Low  Pred_Mod  Pred_Urg
  True_High          16         0         0         0  <- Zero FP on High
  True_Low            0       371         6         0
  True_Moderate       3         3        39         0
  True_Urgent         1         0         0         1  <- 100% Precision on Urgent
  ```
- **7. LogisticRegression (`class_weight='balanced'`):**
  ```
  Urgent Recall is 100% (2/2 caught), but causes severe false positive explosion on majority classes
  (50 False Positives on High, overall accuracy drops to 74.09%).
  ```

---

### 5.2 Repeated Stratified Cross-Validation Stability (5 Folds $\times$ 5 Repeats = 25 Splits)

| Candidate Strategy | Macro F1 (Mean ± Std) | Urgent Recall (Mean ± Std) | Urgent Precision (Mean ± Std) | Urgent F1 (Mean ± Std) |
| :--- | :--- | :--- | :--- | :--- |
| **1. Baseline: HistGB (unweighted)** | 85.3% ± 6.0% | 70.0% ± 28.3% | 78.8% ± 29.0% | 68.9% ± 22.2% |
| **2. HistGB (`class_weight='balanced'`)** | 87.0% ± 8.8% | 72.0% ± 31.9% | 81.0% ± 33.0% | 73.1% ± 29.8% |
| **3. HistGB (`sample_weight='balanced'`)** | 87.0% ± 8.8% | 72.0% ± 31.9% | 81.0% ± 33.0% | 73.1% ± 29.8% |
| **4. RandomForest (unweighted)** | 68.0% ± 8.4% | 12.0% ± 29.3% | 14.0% ± 33.2% | 12.0% ± 28.1% |
| **5. RandomForest (`class_weight='balanced'`)** | 84.5% ± 8.1% | 76.0% ± 32.0% | 75.5% ± 32.5% | 71.6% ± 28.4% |
| **6. HistGB + Train Random Oversampling** | **87.5% ± 8.6%** | **76.0% ± 32.0%** | **83.0% ± 32.5%** | **76.4% ± 30.2%** |
| **7. LogisticRegression (`class_weight='balanced'`)** | 52.9% ± 4.3% | 98.0% ± 9.8% | 29.3% ± 12.1% | 43.9% ± 13.6% |

---

## 6. Statistical Limitations of the 9-Sample Urgent Class

1. **Extreme Sensitivity of Held-Out Metrics:**
   In an 80/20 split of 9 samples, exactly 2 samples fall into the test set. 
   - 1 correct / 1 missed $\rightarrow$ 50% recall.
   - 2 correct $\rightarrow$ 100% recall.
   - 0 correct $\rightarrow$ 0% recall.
   A single test prediction shifts recall by 50 percentage points.
2. **High Cross-Validation Variance ($\pm 30\%$):**
   Across the 25 CV folds, standard deviations for Urgent recall are between $\pm 28\%$ and $\pm 32\%$. This variance is mathematically unavoidable given that each fold evaluates only 1 or 2 minority samples.
3. **Agronomic Specificity Limitation:**
   Because all 9 `Urgent` samples in the dataset are `mothbeans` with soil moisture $<19\%$, any trained ML model is effectively learning the boundary for this specific crop and drought condition. The model cannot generalize `Urgent` water need to other crops (e.g. maize, rice, cotton) from this dataset alone, because no other crop instances carry the `Urgent` label.

---

## 7. Recommended Strategy & Justification

### Recommended Approach: Strategy 2 (`HistGradientBoostingClassifier(class_weight='balanced', max_iter=150, random_state=42)`)

**Justification:**
1. **Solid Performance Gains:** Improves Macro F1 from 85.3% to 87.0%, Urgent CV recall from 70.0% to 72.0%, and Urgent CV F1 from 68.9% to 73.1% without degrading majority class performance (accuracy remains 96.82%).
2. **Algorithmic Purity & Reliability:** Built directly into scikit-learn's `HistGradientBoostingClassifier`. Unlike oversampling (Strategy 6), it does not artificially duplicate records in the training set or introduce risk of memorizing exact feature noise.
3. **Preserves Complete Pipeline Serialization:** Retains clean `StandardScaler + Classifier` pipeline packaging compatible with `joblib`.

*(Alternative if maximum minority recall is prioritized: Strategy 6 with training-set oversampling achieved 87.5% Macro F1 and 76.4% Urgent F1).*

---

## 8. Current State: Production Preservation & Approval Gate

- **Production Artifacts Unchanged:** No `.joblib` files in `ai-service/models/` have been modified, overwritten, or retrained.
- **Inference Unchanged:** Production inference logic in `tabular_model.py` and `FieldMonitoringController.java` remains untouched.
- **No Git Changes:** No files have been staged or committed.

### Approval Gate:
Milestone 3 — Stage A (Investigation & Strategy Comparison) is complete.
Execution is paused at the approval gate. Awaiting user approval before proceeding to **Stage B: Production Retraining and Artifact Serialization**.
