"""
AgroAI — Isolated Training & Staging of Candidate 2 Water Need Model
===================================================================

Trains Candidate 2:
    HistGradientBoostingClassifier(class_weight="balanced", max_iter=150, random_state=42)
with StandardScaler preprocessing inside a Pipeline.

STRICT CONSTRAINTS:
- Does NOT overwrite or modify existing production models.
- Saves candidate artifacts strictly to: ai-service/models/candidates/
- Evaluates on identical held-out test split (test_size=0.20, random_state=42, stratify=y)
- Trains final full-dataset candidate pipeline only for artifact packaging.
"""

from __future__ import annotations

import csv
import hashlib
import json
import pathlib
import sys
import time
from datetime import datetime, timezone
from typing import Dict, Any, List, Tuple

import numpy as np
import joblib

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.pipeline import Pipeline
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    classification_report,
    confusion_matrix,
)

ROOT_DIR = pathlib.Path(__file__).resolve().parents[2]
DATASET_PATH = ROOT_DIR / "ai-service" / "data" / "agroai_labeled_dataset_v2.csv"
CANDIDATE_DIR = ROOT_DIR / "ai-service" / "models" / "candidates"
CANDIDATE_DIR.mkdir(parents=True, exist_ok=True)
PRODUCTION_MODEL_PATH = ROOT_DIR / "ai-service" / "models" / "water_need_model.joblib"

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

CANDIDATE_VERSION = "water-need-candidate-balanced-v2.1"


def compute_sha256(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def load_dataset() -> Tuple[np.ndarray, np.ndarray, List[Dict[str, str]]]:
    rows: List[Dict[str, str]] = []
    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(r)

    X_list: List[List[float]] = []
    y_list: List[str] = []
    for r in rows:
        feats = [float(r[col]) for col in FEATURE_COLUMNS]
        wn = r["Water Need"].strip()
        X_list.append(feats)
        y_list.append(wn)

    return np.array(X_list, dtype=np.float64), np.array(y_list), rows


def main():
    print("=" * 80)
    print("AgroAI Candidate 2 (Water Need - Balanced) Training & Packaging")
    print(f"Timestamp UTC: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 80)

    # 1. Baseline Guard Check
    if not PRODUCTION_MODEL_PATH.exists():
        raise FileNotFoundError(f"Production model not found at {PRODUCTION_MODEL_PATH}")
    prod_sha256_before = compute_sha256(PRODUCTION_MODEL_PATH)
    dataset_sha256 = compute_sha256(DATASET_PATH)
    print(f"[Baseline] Production water_need_model.joblib SHA-256 before: {prod_sha256_before}")
    print(f"[Dataset]  Dataset SHA-256: {dataset_sha256}")

    # 2. Load dataset
    X, y_raw, raw_rows = load_dataset()
    classes = sorted(list(set(y_raw)))
    print(f"[Dataset] Total samples: {len(X)} | Classes: {classes}")

    le = LabelEncoder()
    y_encoded = le.fit_transform(y_raw)

    # 3. Held-out 80/20 train/test evaluation (strictly matching Stage A conditions)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y_encoded, test_size=0.20, random_state=42, stratify=y_encoded
    )
    print(f"[Split] Train samples: {X_train.shape[0]} | Test samples: {X_test.shape[0]}")

    # Define Candidate 2 classifier
    candidate_clf = HistGradientBoostingClassifier(
        class_weight="balanced",
        max_iter=150,
        random_state=42,
    )

    eval_pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("classifier", candidate_clf),
    ])

    print("\n[Evaluation Pipeline] Fitting on 80% train split...")
    t0 = time.time()
    eval_pipeline.fit(X_train, y_train)
    eval_duration = time.time() - t0

    # Predictions on unseen held-out test split
    y_pred = eval_pipeline.predict(X_test)
    y_proba = eval_pipeline.predict_proba(X_test)

    acc = float(accuracy_score(y_test, y_pred))
    prec_macro = float(precision_score(y_test, y_pred, average="macro", zero_division=0))
    prec_weighted = float(precision_score(y_test, y_pred, average="weighted", zero_division=0))
    rec_macro = float(recall_score(y_test, y_pred, average="macro", zero_division=0))
    rec_weighted = float(recall_score(y_test, y_pred, average="weighted", zero_division=0))
    f1_m = float(f1_score(y_test, y_pred, average="macro", zero_division=0))
    f1_w = float(f1_score(y_test, y_pred, average="weighted", zero_division=0))
    cm = confusion_matrix(y_test, y_pred).tolist()
    rep_dict = classification_report(y_test, y_pred, target_names=list(le.classes_), output_dict=True, zero_division=0)
    rep_text = classification_report(y_test, y_pred, target_names=list(le.classes_), zero_division=0)

    # Urgent false negatives
    urgent_idx = list(le.classes_).index("Urgent")
    urgent_cm_row = cm[urgent_idx]
    urgent_fn = int(np.sum(urgent_cm_row) - urgent_cm_row[urgent_idx])
    urgent_precision = rep_dict["Urgent"]["precision"]
    urgent_recall = rep_dict["Urgent"]["recall"]
    urgent_f1 = rep_dict["Urgent"]["f1-score"]

    print("\n=== Held-Out Test Evaluation Results (Unseen 20% Split, N=440) ===")
    print(f"Overall Accuracy:       {acc * 100:.2f}%")
    print(f"Macro F1-Score:         {f1_m * 100:.2f}%")
    print(f"Weighted F1-Score:      {f1_w * 100:.2f}%")
    print(f"Macro Precision:        {prec_macro * 100:.2f}%")
    print(f"Macro Recall:           {rec_macro * 100:.2f}%")
    print(f"Urgent Precision:       {urgent_precision * 100:.2f}%")
    print(f"Urgent Recall:          {urgent_recall * 100:.2f}% (Found {int(rep_dict['Urgent']['support']) - urgent_fn} of {int(rep_dict['Urgent']['support'])})")
    print(f"Urgent F1-Score:        {urgent_f1 * 100:.2f}%")
    print(f"Urgent False Negatives: {urgent_fn}")
    print("\nConfusion Matrix (Classes: High, Low, Moderate, Urgent):")
    print(np.array(cm))
    print("\nClassification Report:")
    print(rep_text)

    # 4. Train final candidate on full approved dataset for packaging
    print("\n[Final Candidate Pipeline] Fitting on full approved dataset (N=2,200)...")
    final_clf = HistGradientBoostingClassifier(
        class_weight="balanced",
        max_iter=150,
        random_state=42,
    )
    final_pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("classifier", final_clf),
    ])

    t1 = time.time()
    final_pipeline.fit(X, y_encoded)
    full_fit_duration = time.time() - t1
    print(f"Full-dataset fit completed in {full_fit_duration:.4f}s.")

    # 5. Save strictly to candidate directory (NEVER production path)
    candidate_artifact_path = CANDIDATE_DIR / "water_need_model_candidate_balanced.joblib"
    candidate_meta_path = CANDIDATE_DIR / "candidate_water_need_meta.json"

    candidate_payload = {
        "pipeline": final_pipeline,
        "encoder": le,
        "feature_columns": FEATURE_COLUMNS,
        "classes": list(le.classes_),
        "model_version": CANDIDATE_VERSION,
        "algorithm": "HistGradientBoosting",
        "class_weight": "balanced",
        "training_strategy": "Candidate 2 - Balanced HistGradientBoosting",
    }

    joblib.dump(candidate_payload, candidate_artifact_path, compress=3)
    print(f"\n[Saved] Candidate artifact -> {candidate_artifact_path}")

    # Metadata record
    meta = {
        "candidate_version": CANDIDATE_VERSION,
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "status": "STAGED_CANDIDATE_NOT_ACTIVATED",
        "algorithm": "HistGradientBoostingClassifier",
        "parameters": {
            "class_weight": "balanced",
            "max_iter": 150,
            "random_state": 42,
            "learning_rate": 0.1,
            "loss": "log_loss",
        },
        "dataset": {
            "path": str(DATASET_PATH),
            "sha256": dataset_sha256,
            "total_samples": len(X),
            "urgent_samples": int(np.sum(y_raw == "Urgent")),
            "feature_columns": FEATURE_COLUMNS,
        },
        "heldout_test_evaluation": {
            "test_size": 440,
            "split_random_state": 42,
            "stratified": True,
            "duration_seconds": round(eval_duration, 4),
            "accuracy": round(acc, 4),
            "macro_precision": round(prec_macro, 4),
            "macro_recall": round(rec_macro, 4),
            "macro_f1": round(f1_m, 4),
            "weighted_f1": round(f1_w, 4),
            "urgent_metrics": {
                "precision": round(urgent_precision, 4),
                "recall": round(urgent_recall, 4),
                "f1": round(urgent_f1, 4),
                "support": int(rep_dict["Urgent"]["support"]),
                "false_negatives": urgent_fn,
            },
            "confusion_matrix": cm,
            "classification_report": rep_dict,
        },
        "full_training": {
            "samples": len(X),
            "duration_seconds": round(full_fit_duration, 4),
            "note": "Full-dataset training reflects final artifact fit, NOT independent held-out evaluation.",
        },
        "scientific_limitation": (
            "The training dataset contains only 9 'Urgent' instances (0.41% of 2,200 samples). "
            "All 9 instances belong exclusively to the mothbeans crop category and are derived from "
            "a rule-based agronomic heuristic (agronomic_rule_v1: Soil Moisture < 19%, Rainfall < 34mm, Temp > 25C). "
            "This model learns patterns consistent with this rule but cannot generalize 'Urgent' water need to other crops "
            "or real-world field irrigation without field validation."
        ),
    }

    with open(candidate_meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print(f"[Saved] Candidate metadata -> {candidate_meta_path}")

    # 6. Verify Production Baseline Integrity
    prod_sha256_after = compute_sha256(PRODUCTION_MODEL_PATH)
    candidate_sha256 = compute_sha256(candidate_artifact_path)
    print("\n--- Integrity Verification ---")
    print(f"Production model path:     {PRODUCTION_MODEL_PATH}")
    print(f"Production SHA-256 before: {prod_sha256_before}")
    print(f"Production SHA-256 after:  {prod_sha256_after}")
    if prod_sha256_before == prod_sha256_after:
        print("  -> CONFIRMED: Production water_need_model.joblib is byte-for-byte UNTOUCHED.")
    else:
        raise RuntimeError("CRITICAL ERROR: Production model was altered!")

    print(f"Candidate model path:      {candidate_artifact_path}")
    print(f"Candidate SHA-256:         {candidate_sha256}")
    print("=" * 80)


if __name__ == "__main__":
    main()
