"""
AgroAI — Comprehensive Tabular ML Training & Evaluation Pipeline
================================================================

Trains, evaluates, compares, and serializes production-grade ML pipelines
for AgroAI precision agriculture:
  1. Water Need Prediction (Multi-class: Low, Moderate, High, Urgent)
  2. Field Status Prediction (Multi-class: Healthy, Attention, Critical)
  3. Crop Classification / Recommendation (Multi-class: 22 crop classes)

Key Rules:
  - Held-out test evaluation: Models evaluated strictly on unseen 20% test split.
  - Stratified sampling: Preserves minority class proportions (e.g. Urgent).
  - No data leakage:
      * Features strictly limited to: N, P, K, temperature, humidity, ph, rainfall, Soil Moisture.
      * No target columns, label_source, or label_method used as features.
  - Complete Pipeline serialization: StandardScaler + Classifier bundled together.
  - Label provenance: Explicitly notes rule-derived labels (label_method=agronomic_rule_v1).
"""

from __future__ import annotations

import csv
import json
import pathlib
import sys
import time
from datetime import datetime, timezone
from typing import Dict, Any, List, Tuple

import numpy as np
import joblib

from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.pipeline import Pipeline
from sklearn.ensemble import (
    RandomForestClassifier,
    GradientBoostingClassifier,
    ExtraTreesClassifier,
    HistGradientBoostingClassifier,
)
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    classification_report,
    confusion_matrix,
)

# Paths
ROOT_DIR = pathlib.Path(__file__).resolve().parents[2]
DATASET_PATH = ROOT_DIR / "ai-service" / "data" / "agroai_labeled_dataset_v2.csv"
MODEL_DIR = ROOT_DIR / "ai-service" / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

FEATURE_COLUMNS = [
    "N",
    "P",
    "K",
    "temperature",
    "humidity",
    "ph",
    "rainfall",
    "Soil Moisture",
]

MODEL_VERSION = "tabular-pipeline-v2.0"


def load_and_validate_dataset() -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, List[Dict[str, Any]]]:
    if not DATASET_PATH.exists():
        raise FileNotFoundError(f"Dataset not found at: {DATASET_PATH}")

    rows: List[Dict[str, str]] = []
    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)

    print(f"[Dataset] Total raw records loaded: {len(rows)}")

    X_list: List[List[float]] = []
    y_water_need: List[str] = []
    y_status: List[str] = []
    y_crop: List[str] = []
    raw_dicts: List[Dict[str, Any]] = []

    for idx, r in enumerate(rows):
        # Extract features
        try:
            feats = [float(r[col]) for col in FEATURE_COLUMNS]
            wn = r["Water Need"].strip()
            st = r["Status"].strip()
            crop = r["label"].strip()

            if not wn or not st or not crop:
                print(f"[Warning] Row {idx} has empty target, skipping.")
                continue

            X_list.append(feats)
            y_water_need.append(wn)
            y_status.append(st)
            y_crop.append(crop)
            raw_dicts.append(r)
        except (ValueError, KeyError) as e:
            print(f"[Warning] Row {idx} parsing error: {e}, skipping.")
            continue

    X = np.array(X_list, dtype=np.float64)
    y_wn = np.array(y_water_need)
    y_st = np.array(y_status)
    y_cr = np.array(y_crop)

    print(f"[Dataset] Clean samples: {X.shape[0]} features shape: {X.shape[1]}")
    return X, y_wn, y_st, y_cr, raw_dicts


def evaluate_candidate_algorithms(
    X_train: np.ndarray,
    y_train: np.ndarray,
    target_name: str,
) -> Tuple[str, Any]:
    """Compare multiple classification algorithms via 5-fold stratified CV."""
    print(f"\n--- Comparing Algorithms for [{target_name}] (5-Fold Stratified CV on Training Set) ---")
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    candidates = {
        "RandomForest": RandomForestClassifier(n_estimators=200, max_depth=12, random_state=42, n_jobs=-1),
        "ExtraTrees": ExtraTreesClassifier(n_estimators=200, max_depth=12, random_state=42, n_jobs=-1),
        "HistGradientBoosting": HistGradientBoostingClassifier(max_iter=150, random_state=42),
        "GradientBoosting": GradientBoostingClassifier(n_estimators=150, max_depth=5, random_state=42),
        "LogisticRegression": LogisticRegression(max_iter=1000, random_state=42),
    }

    best_name = ""
    best_score = -1.0
    best_model = None

    for name, clf in candidates.items():
        pipe = Pipeline([
            ("scaler", StandardScaler()),
            ("classifier", clf),
        ])
        scores = cross_val_score(pipe, X_train, y_train, cv=cv, scoring="accuracy")
        mean_acc = float(np.mean(scores))
        std_acc = float(np.std(scores))
        print(f"  {name:22s} | 5-Fold CV Accuracy: {mean_acc * 100:6.2f}% (±{std_acc * 100:4.2f}%)")

        if mean_acc > best_score:
            best_score = mean_acc
            best_name = name
            best_model = clf

    print(f"  => Best Candidate for {target_name}: {best_name} ({best_score * 100:.2f}%)")
    return best_name, best_model


def train_and_evaluate_pipeline(
    X_train: np.ndarray,
    X_test: np.ndarray,
    y_train_raw: np.ndarray,
    y_test_raw: np.ndarray,
    target_name: str,
    selected_clf: Any,
) -> Dict[str, Any]:
    """Train complete pipeline on train set and evaluate strictly on held-out test set."""
    # Label encode
    le = LabelEncoder()
    y_train = le.fit_transform(y_train_raw)
    y_test = le.transform(y_test_raw)

    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("classifier", selected_clf),
    ])

    print(f"\n[Training] Fitting final {target_name} pipeline...")
    start_time = time.time()
    pipeline.fit(X_train, y_train)
    fit_duration = time.time() - start_time

    # Evaluate on held-out test set
    y_pred = pipeline.predict(X_test)

    acc = float(accuracy_score(y_test, y_pred))
    prec_macro = float(precision_score(y_test, y_pred, average="macro", zero_division=0))
    prec_weighted = float(precision_score(y_test, y_pred, average="weighted", zero_division=0))
    rec_macro = float(recall_score(y_test, y_pred, average="macro", zero_division=0))
    rec_weighted = float(recall_score(y_test, y_pred, average="weighted", zero_division=0))
    f1_m = float(f1_score(y_test, y_pred, average="macro", zero_division=0))
    f1_w = float(f1_score(y_test, y_pred, average="weighted", zero_division=0))
    cm = confusion_matrix(y_test, y_pred).tolist()
    report_dict = classification_report(y_test, y_pred, target_names=list(le.classes_), output_dict=True, zero_division=0)
    report_text = classification_report(y_test, y_pred, target_names=list(le.classes_), zero_division=0)

    print(f"\n=== Held-Out Test Evaluation: {target_name} ===")
    print(f"Accuracy:         {acc * 100:.2f}%")
    print(f"Macro Precision:  {prec_macro * 100:.2f}%")
    print(f"Macro Recall:     {rec_macro * 100:.2f}%")
    print(f"Macro F1-Score:   {f1_m * 100:.2f}%")
    print("\nClassification Report (Test Data):")
    print(report_text)
    print("Confusion Matrix (Test Data):")
    print(np.array(cm))

    return {
        "target_name": target_name,
        "pipeline": pipeline,
        "label_encoder": le,
        "classes": list(le.classes_),
        "fit_duration_seconds": round(fit_duration, 4),
        "test_metrics": {
            "accuracy": round(acc, 4),
            "precision_macro": round(prec_macro, 4),
            "precision_weighted": round(prec_weighted, 4),
            "recall_macro": round(rec_macro, 4),
            "recall_weighted": round(rec_weighted, 4),
            "f1_macro": round(f1_m, 4),
            "f1_weighted": round(f1_w, 4),
            "confusion_matrix": cm,
            "classification_report": report_dict,
        },
    }


def main():
    print("=================================================================")
    print("AgroAI Tabular ML Pipeline Training & Verification")
    print(f"Started at: {datetime.now(timezone.utc).isoformat()}")
    print("=================================================================")

    # 1. Load data
    X, y_wn, y_st, y_cr, raw_rows = load_and_validate_dataset()

    # 2. Split dataset with fixed random state (80% train / 20% test)
    # For Water Need:
    X_train_wn, X_test_wn, y_train_wn, y_test_wn = train_test_split(
        X, y_wn, test_size=0.20, random_state=42, stratify=y_wn
    )
    # For Field Status:
    X_train_st, X_test_st, y_train_st, y_test_st = train_test_split(
        X, y_st, test_size=0.20, random_state=42, stratify=y_st
    )
    # For Crop Recommendation:
    X_train_cr, X_test_cr, y_train_cr, y_test_cr = train_test_split(
        X, y_cr, test_size=0.20, random_state=42, stratify=y_cr
    )

    print(f"\nTrain size: {X_train_wn.shape[0]} samples | Held-out test size: {X_test_wn.shape[0]} samples")

    # 3. Model 1: Water Need
    best_wn_name, best_wn_clf = evaluate_candidate_algorithms(X_train_wn, y_train_wn, "Water Need")
    res_wn = train_and_evaluate_pipeline(X_train_wn, X_test_wn, y_train_wn, y_test_wn, "Water Need", best_wn_clf)

    # 4. Model 2: Field Status
    best_st_name, best_st_clf = evaluate_candidate_algorithms(X_train_st, y_train_st, "Field Status")
    res_st = train_and_evaluate_pipeline(X_train_st, X_test_st, y_train_st, y_test_st, "Field Status", best_st_clf)

    # 5. Model 3: Crop Classification (Useful for Agronomic Recommendation)
    best_cr_name, best_cr_clf = evaluate_candidate_algorithms(X_train_cr, y_train_cr, "Crop Recommendation")
    res_cr = train_and_evaluate_pipeline(X_train_cr, X_test_cr, y_train_cr, y_test_cr, "Crop Recommendation", best_cr_clf)

    # 6. Save Pipeline Artifacts
    # Water Need pipeline
    wn_path = MODEL_DIR / "water_need_model.joblib"
    joblib.dump({
        "pipeline": res_wn["pipeline"],
        "encoder": res_wn["label_encoder"],
        "feature_columns": FEATURE_COLUMNS,
        "classes": res_wn["classes"],
        "model_version": MODEL_VERSION,
        "algorithm": best_wn_name,
    }, wn_path, compress=3)
    print(f"\n[Saved] Water Need pipeline -> {wn_path}")

    # Field Status pipeline
    st_path = MODEL_DIR / "field_status_model.joblib"
    joblib.dump({
        "pipeline": res_st["pipeline"],
        "encoder": res_st["label_encoder"],
        "feature_columns": FEATURE_COLUMNS,
        "classes": res_st["classes"],
        "model_version": MODEL_VERSION,
        "algorithm": best_st_name,
    }, st_path, compress=3)
    print(f"[Saved] Field Status pipeline -> {st_path}")

    # Crop Recommendation pipeline
    cr_path = MODEL_DIR / "crop_recommendation_model.joblib"
    joblib.dump({
        "pipeline": res_cr["pipeline"],
        "encoder": res_cr["label_encoder"],
        "feature_columns": FEATURE_COLUMNS,
        "classes": res_cr["classes"],
        "model_version": MODEL_VERSION,
        "algorithm": best_cr_name,
    }, cr_path, compress=3)
    print(f"[Saved] Crop Recommendation pipeline -> {cr_path}")

    # Metadata record
    meta = {
        "model_version": MODEL_VERSION,
        "trained_at_utc": datetime.now(timezone.utc).isoformat(),
        "dataset_path": str(DATASET_PATH),
        "total_samples": len(X),
        "train_samples": int(X_train_wn.shape[0]),
        "test_samples": int(X_test_wn.shape[0]),
        "feature_columns": FEATURE_COLUMNS,
        "preprocessing": "StandardScaler (fitted on train split, stored inside Pipeline)",
        "models": {
            "water_need": {
                "algorithm": best_wn_name,
                "artifact_file": "water_need_model.joblib",
                "classes": res_wn["classes"],
                "test_metrics": res_wn["test_metrics"],
                "label_provenance": "rule_derived",
                "label_method": "agronomic_rule_v1",
            },
            "field_status": {
                "algorithm": best_st_name,
                "artifact_file": "field_status_model.joblib",
                "classes": res_st["classes"],
                "test_metrics": res_st["test_metrics"],
                "label_provenance": "rule_derived",
                "label_method": "agronomic_rule_v1",
            },
            "crop_recommendation": {
                "algorithm": best_cr_name,
                "artifact_file": "crop_recommendation_model.joblib",
                "classes": res_cr["classes"],
                "test_metrics": res_cr["test_metrics"],
                "label_provenance": "agricultural_benchmarks",
                "label_method": "soil_and_climate_matching",
            },
        },
        "disclaimer": (
            "Water Need and Status labels were derived using rule-based agronomic heuristics (agronomic_rule_v1). "
            "These models learn patterns from the rule-derived dataset and must not be presented as "
            "independently validated agronomic ground truth."
        ),
    }

    meta_path = MODEL_DIR / "tabular_model_meta.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print(f"[Saved] Model metadata -> {meta_path}")

    print("\nTraining and evaluation pipeline completed successfully!")


if __name__ == "__main__":
    main()
