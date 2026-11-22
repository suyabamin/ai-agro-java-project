"""
AgroAI — Water Need Class Imbalance Investigation & Strategy Comparison
========================================================================
This tool investigates the extreme class imbalance in the Water Need prediction task
(specifically the 9 'Urgent' samples in the 2,200-sample dataset) and compares
candidate remediation strategies without modifying any production model artifacts.
"""

from __future__ import annotations

import csv
import hashlib
import json
import pathlib
import sys
from typing import Dict, Any, List, Tuple

import numpy as np
from sklearn.model_selection import train_test_split, StratifiedKFold, RepeatedStratifiedKFold
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.pipeline import Pipeline
from sklearn.ensemble import (
    HistGradientBoostingClassifier,
    RandomForestClassifier,
    ExtraTreesClassifier,
    GradientBoostingClassifier,
)
from sklearn.linear_model import LogisticRegression
from sklearn.utils import resample
from sklearn.utils.class_weight import compute_sample_weight
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    classification_report,
    confusion_matrix,
)

ROOT_DIR = pathlib.Path(__file__).resolve().parents[2]
DATASET_PATH_1 = ROOT_DIR / "ai-service" / "data" / "agroai_labeled_dataset_v2 (1).csv"
DATASET_PATH_2 = ROOT_DIR / "ai-service" / "data" / "agroai_labeled_dataset_v2.csv"
MODEL_DIR = ROOT_DIR / "ai-service" / "models"

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


def sha256_of_file(filepath: pathlib.Path) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def load_dataset(path: pathlib.Path):
    rows = []
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(r)
    return rows


def extract_features_and_targets(rows: List[Dict[str, str]]):
    X = []
    y_wn = []
    for r in rows:
        feats = [float(r[col]) for col in FEATURE_COLUMNS]
        wn = r["Water Need"].strip()
        X.append(feats)
        y_wn.append(wn)
    return np.array(X, dtype=np.float64), np.array(y_wn)


def inspect_urgent_samples(rows: List[Dict[str, str]]):
    print("\n--- Detailed Inspection of 'Urgent' Samples ---")
    urgent_rows = [r for r in rows if r["Water Need"].strip() == "Urgent"]
    print(f"Total 'Urgent' samples found: {len(urgent_rows)} out of {len(rows)} ({(len(urgent_rows)/len(rows))*100:.3f}%)")
    for idx, r in enumerate(urgent_rows):
        print(f"  Sample {idx+1}:")
        print(f"    Crop (label): {r.get('label')}")
        print(f"    Soil Moisture: {r.get('Soil Moisture')}")
        print(f"    Temp: {r.get('temperature')} | Humidity: {r.get('humidity')} | Rainfall: {r.get('rainfall')} | pH: {r.get('ph')}")
        print(f"    N: {r.get('N')} | P: {r.get('P')} | K: {r.get('K')}")
        print(f"    Status: {r.get('Status')} | Label Source: {r.get('label_source')} | Method: {r.get('label_method')}")
    return urgent_rows


def evaluate_split_metrics(y_true, y_pred, classes: List[str]):
    acc = accuracy_score(y_true, y_pred)
    f1_m = f1_score(y_true, y_pred, average="macro", zero_division=0)
    f1_w = f1_score(y_true, y_pred, average="weighted", zero_division=0)
    prec_m = precision_score(y_true, y_pred, average="macro", zero_division=0)
    rec_m = recall_score(y_true, y_pred, average="macro", zero_division=0)
    cm = confusion_matrix(y_true, y_pred, labels=classes)
    rep = classification_report(y_true, y_pred, labels=classes, output_dict=True, zero_division=0)
    
    # Urgent stats
    urgent_stats = rep.get("Urgent", {})
    urgent_prec = urgent_stats.get("precision", 0.0)
    urgent_rec = urgent_stats.get("recall", 0.0)
    urgent_f1 = urgent_stats.get("f1-score", 0.0)
    urgent_support = urgent_stats.get("support", 0)
    
    # False negatives for Urgent:
    urgent_idx = classes.index("Urgent")
    urgent_row = cm[urgent_idx]
    urgent_fn = int(np.sum(urgent_row) - urgent_row[urgent_idx])

    return {
        "accuracy": acc,
        "f1_macro": f1_m,
        "f1_weighted": f1_w,
        "precision_macro": prec_m,
        "recall_macro": rec_m,
        "urgent_precision": urgent_prec,
        "urgent_recall": urgent_rec,
        "urgent_f1": urgent_f1,
        "urgent_support": urgent_support,
        "urgent_false_negatives": urgent_fn,
        "confusion_matrix": cm,
        "report": rep,
    }


def run_heldout_evaluation(candidates: Dict[str, Any], X_train, y_train, X_test, y_test, classes: List[str]):
    results = {}
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    for name, config in candidates.items():
        clf = config["clf"]
        use_sample_weight = config.get("use_sample_weight", False)
        use_oversampling = config.get("use_oversampling", False)

        curr_X_train = X_train_scaled
        curr_y_train = y_train

        if use_oversampling:
            # Oversample only minority class on train split
            train_data = np.hstack([curr_X_train, curr_y_train.reshape(-1, 1)])
            urgent_mask = (curr_y_train == "Urgent")
            train_urgent = train_data[urgent_mask]
            train_non_urgent = train_data[~urgent_mask]
            
            # Oversample Urgent to target count (e.g. 50 samples in train)
            train_urgent_oversampled = resample(
                train_urgent,
                replace=True,
                n_samples=50,
                random_state=42
            )
            train_resampled = np.vstack([train_non_urgent, train_urgent_oversampled])
            np.random.seed(42)
            np.random.shuffle(train_resampled)
            curr_X_train = train_resampled[:, :-1].astype(np.float64)
            curr_y_train = train_resampled[:, -1]

        if use_sample_weight:
            sw = compute_sample_weight("balanced", curr_y_train)
            clf.fit(curr_X_train, curr_y_train, sample_weight=sw)
        else:
            clf.fit(curr_X_train, curr_y_train)

        y_pred = clf.predict(X_test_scaled)
        metrics = evaluate_split_metrics(y_test, y_pred, classes)
        results[name] = metrics

    return results


def run_repeated_cv(candidates: Dict[str, Any], X, y, classes: List[str], n_splits=5, n_repeats=5):
    """Run repeated stratified K-fold cross validation for stability evaluation."""
    rskf = RepeatedStratifiedKFold(n_splits=n_splits, n_repeats=n_repeats, random_state=42)
    cv_results = {name: {
        "accuracy": [],
        "f1_macro": [],
        "f1_weighted": [],
        "urgent_precision": [],
        "urgent_recall": [],
        "urgent_f1": [],
        "urgent_false_negatives": [],
    } for name in candidates}

    fold_idx = 0
    for train_idx, test_idx in rskf.split(X, y):
        fold_idx += 1
        X_train, X_test = X[train_idx], X[test_idx]
        y_train, y_test = y[train_idx], y[test_idx]

        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)

        for name, config in candidates.items():
            # Create fresh estimator clone
            clf = config["make_clf"]()
            use_sample_weight = config.get("use_sample_weight", False)
            use_oversampling = config.get("use_oversampling", False)

            curr_X_train = X_train_scaled
            curr_y_train = y_train

            if use_oversampling:
                train_data = np.hstack([curr_X_train, curr_y_train.reshape(-1, 1)])
                urgent_mask = (curr_y_train == "Urgent")
                train_urgent = train_data[urgent_mask]
                train_non_urgent = train_data[~urgent_mask]
                
                train_urgent_oversampled = resample(
                    train_urgent,
                    replace=True,
                    n_samples=50,
                    random_state=42
                )
                train_resampled = np.vstack([train_non_urgent, train_urgent_oversampled])
                curr_X_train = train_resampled[:, :-1].astype(np.float64)
                curr_y_train = train_resampled[:, -1]

            if use_sample_weight:
                sw = compute_sample_weight("balanced", curr_y_train)
                clf.fit(curr_X_train, curr_y_train, sample_weight=sw)
            else:
                clf.fit(curr_X_train, curr_y_train)

            y_pred = clf.predict(X_test_scaled)
            m = evaluate_split_metrics(y_test, y_pred, classes)
            cv_results[name]["accuracy"].append(m["accuracy"])
            cv_results[name]["f1_macro"].append(m["f1_macro"])
            cv_results[name]["f1_weighted"].append(m["f1_weighted"])
            cv_results[name]["urgent_precision"].append(m["urgent_precision"])
            cv_results[name]["urgent_recall"].append(m["urgent_recall"])
            cv_results[name]["urgent_f1"].append(m["urgent_f1"])
            cv_results[name]["urgent_false_negatives"].append(m["urgent_false_negatives"])

    return cv_results


def main():
    print("=" * 78)
    print("AgroAI Water Need Imbalance Investigation & Model Strategy Comparison")
    print("=" * 78)

    # 1. Dataset Verification
    print("\n--- 1. Dataset Verification & Fingerprints ---")
    h1 = sha256_of_file(DATASET_PATH_1)
    h2 = sha256_of_file(DATASET_PATH_2)
    print(f"File 1: {DATASET_PATH_1.name}")
    print(f"  SHA-256: {h1}")
    print(f"File 2: {DATASET_PATH_2.name}")
    print(f"  SHA-256: {h2}")
    if h1 == h2:
        print("  -> Confirmed: Both files are byte-for-byte identical.")
    else:
        print("  -> Warning: Files differ!")

    rows = load_dataset(DATASET_PATH_1)
    print(f"Total Rows: {len(rows)}")

    # 2. Inspect Target Distribution & Urgent Samples
    print("\n--- 2. Water Need Target Distribution ---")
    wn_counts = {}
    for r in rows:
        val = r["Water Need"].strip()
        wn_counts[val] = wn_counts.get(val, 0) + 1
    for k, v in sorted(wn_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"  {k:12s}: {v:5d} ({v/len(rows)*100:6.2f}%)")

    inspect_urgent_samples(rows)

    # 3. Features & Train/Test Split
    X, y_wn = extract_features_and_targets(rows)
    classes = sorted(list(wn_counts.keys()))
    print(f"\nClasses: {classes}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y_wn, test_size=0.20, random_state=42, stratify=y_wn
    )
    print(f"\nTrain size: {len(y_train)} | Test size: {len(y_test)}")
    print("Train Class Distribution:")
    for c in classes:
        cnt = np.sum(y_train == c)
        print(f"  {c:12s}: {cnt:4d} ({cnt/len(y_train)*100:5.2f}%)")
    print("Test Class Distribution:")
    for c in classes:
        cnt = np.sum(y_test == c)
        print(f"  {c:12s}: {cnt:4d} ({cnt/len(y_test)*100:5.2f}%)")

    # 4. Define Candidate Strategies
    candidates = {
        "1. Baseline: HistGradientBoosting (unweighted)": {
            "clf": HistGradientBoostingClassifier(max_iter=150, random_state=42),
            "make_clf": lambda: HistGradientBoostingClassifier(max_iter=150, random_state=42),
        },
        "2. HistGradientBoosting (class_weight='balanced')": {
            "clf": HistGradientBoostingClassifier(max_iter=150, class_weight="balanced", random_state=42),
            "make_clf": lambda: HistGradientBoostingClassifier(max_iter=150, class_weight="balanced", random_state=42),
        },
        "3. HistGradientBoosting (sample_weight='balanced')": {
            "clf": HistGradientBoostingClassifier(max_iter=150, random_state=42),
            "make_clf": lambda: HistGradientBoostingClassifier(max_iter=150, random_state=42),
            "use_sample_weight": True,
        },
        "4. RandomForest (unweighted)": {
            "clf": RandomForestClassifier(n_estimators=200, max_depth=12, random_state=42, n_jobs=-1),
            "make_clf": lambda: RandomForestClassifier(n_estimators=200, max_depth=12, random_state=42, n_jobs=-1),
        },
        "5. RandomForest (class_weight='balanced')": {
            "clf": RandomForestClassifier(n_estimators=200, max_depth=12, class_weight="balanced", random_state=42, n_jobs=-1),
            "make_clf": lambda: RandomForestClassifier(n_estimators=200, max_depth=12, class_weight="balanced", random_state=42, n_jobs=-1),
        },
        "6. HistGradientBoosting + Train Random Oversampling": {
            "clf": HistGradientBoostingClassifier(max_iter=150, random_state=42),
            "make_clf": lambda: HistGradientBoostingClassifier(max_iter=150, random_state=42),
            "use_oversampling": True,
        },
        "7. LogisticRegression (class_weight='balanced')": {
            "clf": LogisticRegression(max_iter=1000, class_weight="balanced", random_state=42),
            "make_clf": lambda: LogisticRegression(max_iter=1000, class_weight="balanced", random_state=42),
        },
    }

    # 5. Held-Out Test Evaluation
    print("\n" + "=" * 78)
    print("5. Held-Out Test Evaluation (Identical 80/20 Test Split, N=440, Urgent N=2)")
    print("=" * 78)
    heldout_res = run_heldout_evaluation(candidates, X_train, y_train, X_test, y_test, classes)

    for name, res in heldout_res.items():
        print(f"\n--- Strategy: {name} ---")
        print(f"Overall Accuracy:       {res['accuracy']*100:.2f}%")
        print(f"Macro F1-Score:         {res['f1_macro']*100:.2f}%")
        print(f"Weighted F1-Score:      {res['f1_weighted']*100:.2f}%")
        print(f"Macro Precision:        {res['precision_macro']*100:.2f}%")
        print(f"Macro Recall:           {res['recall_macro']*100:.2f}%")
        print(f"Urgent Precision:       {res['urgent_precision']*100:.2f}%")
        print(f"Urgent Recall:          {res['urgent_recall']*100:.2f}% (Found {2 - res['urgent_false_negatives']} of 2)")
        print(f"Urgent F1-Score:        {res['urgent_f1']*100:.2f}%")
        print(f"Urgent False Negatives: {res['urgent_false_negatives']}")
        print(f"Confusion Matrix (Classes: {classes}):")
        print(res["confusion_matrix"])
        print("\nPer-class breakdown:")
        for c in classes:
            c_rep = res["report"][c]
            print(f"  {c:10s} | P: {c_rep['precision']*100:5.1f}% | R: {c_rep['recall']*100:5.1f}% | F1: {c_rep['f1-score']*100:5.1f}% | Supp: {int(c_rep['support'])}")

    # 6. Repeated Stratified K-Fold Cross-Validation (5 Folds x 5 Repeats = 25 evaluations)
    print("\n" + "=" * 78)
    print("6. Repeated Stratified K-Fold Cross-Validation (5 Folds x 5 Repeats = 25 splits)")
    print("=" * 78)
    cv_res = run_repeated_cv(candidates, X, y_wn, classes, n_splits=5, n_repeats=5)

    print(f"\n{'Candidate':<48} | {'Macro F1':<14} | {'Urgent Recall':<15} | {'Urgent Prec':<15} | {'Urgent F1':<15}")
    print("-" * 115)
    for name, metrics in cv_res.items():
        m_f1_mean = np.mean(metrics["f1_macro"]) * 100
        m_f1_std = np.std(metrics["f1_macro"]) * 100
        u_rec_mean = np.mean(metrics["urgent_recall"]) * 100
        u_rec_std = np.std(metrics["urgent_recall"]) * 100
        u_prec_mean = np.mean(metrics["urgent_precision"]) * 100
        u_prec_std = np.std(metrics["urgent_precision"]) * 100
        u_f1_mean = np.mean(metrics["urgent_f1"]) * 100
        u_f1_std = np.std(metrics["urgent_f1"]) * 100

        print(f"{name:<48} | {m_f1_mean:5.1f}% ±{m_f1_std:4.1f}% | {u_rec_mean:5.1f}% ±{u_rec_std:4.1f}% | {u_prec_mean:5.1f}% ±{u_prec_std:4.1f}% | {u_f1_mean:5.1f}% ±{u_f1_std:4.1f}%")

    print("\nInvestigation script completed without modifying any production artifacts.")


if __name__ == "__main__":
    main()
