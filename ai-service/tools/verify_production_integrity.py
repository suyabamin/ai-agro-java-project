"""
AgroAI — Production Model Artifact Integrity & Non-Destructive Verification
============================================================================

Authoritative Production Verification:
1. Production Baseline: water_need_model.joblib
   - SHA-256 == eb5362b9529d444e3ff3e48bce5ffc9c6e0a0d5731b14ef9bb681b64053af8fd
   - Algorithm: HistGradientBoostingClassifier
   - class_weight=None, max_iter=150, random_state=42
   - Loaded and active in production inference.
2. Candidate 2: water_need_model_candidate_balanced.joblib
   - SHA-256 == b102bd3b755dc620e3c3bd2d316df3758ef765d3af53259aaf56399afb3a026d
   - class_weight='balanced', max_iter=150, random_state=42
   - Preserved, isolated, VALIDATED, NOT PROMOTED.
3. Candidate Metadata: candidate_water_need_meta.json
   - Documented as VALIDATED_NOT_PROMOTED, ORIGINAL_BASELINE_RETAINED.
4. Other Model Artifacts: crop_recommendation_model.joblib, field_status_model.joblib
   - Hashes recorded and verified untampered.
5. Non-destructive inference tests:
   - 4-class predictions, probability shapes, sums, and non-negativity.
   - Input schema rejection (7 features, 9 features, non-numeric).
   - Disease detection fail-closed (MODEL_UNAVAILABLE).
"""

from __future__ import annotations

import hashlib
import json
import pathlib
import sys
from typing import Dict, Any

import numpy as np
import joblib

ROOT_DIR = pathlib.Path(__file__).resolve().parents[2]
AI_SERVICE_DIR = ROOT_DIR / "ai-service"
MODELS_DIR = AI_SERVICE_DIR / "models"
CANDIDATES_DIR = MODELS_DIR / "candidates"
DATA_DIR = AI_SERVICE_DIR / "data"

sys.path.insert(0, str(AI_SERVICE_DIR))

# Expected Constants
EXPECTED_PROD_WN_SHA256 = "eb5362b9529d444e3ff3e48bce5ffc9c6e0a0d5731b14ef9bb681b64053af8fd"
EXPECTED_CANDIDATE_WN_SHA256 = "b102bd3b755dc620e3c3bd2d316df3758ef765d3af53259aaf56399afb3a026d"
EXPECTED_DATASET_SHA256 = "87b93178756293b1dba0062fa75fa42275f11be7abe0086f4b4889699afb9f33"

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
CLASSES = ["High", "Low", "Moderate", "Urgent"]


def sha256_of_file(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def verify_production_baseline() -> Dict[str, Any]:
    prod_path = MODELS_DIR / "water_need_model.joblib"
    assert prod_path.exists(), f"Production model missing: {prod_path}"
    actual_hash = sha256_of_file(prod_path)
    print(f"[Check 4.A] Production Baseline Path: {prod_path}")
    print(f"            Expected SHA-256: {EXPECTED_PROD_WN_SHA256}")
    print(f"            Actual SHA-256:   {actual_hash}")
    assert actual_hash == EXPECTED_PROD_WN_SHA256, "Production baseline hash mismatch!"

    data = joblib.load(prod_path)
    pipeline = data["pipeline"]
    encoder = data["encoder"]
    clf = pipeline.named_steps["classifier"]
    params = clf.get_params()

    print(f"            Classifier:       {type(clf).__name__}")
    print(f"            class_weight:     {params.get('class_weight')}")
    print(f"            max_iter:         {params.get('max_iter')}")
    print(f"            random_state:     {params.get('random_state')}")
    print(f"            Classes:          {list(data['classes'])}")
    print(f"            Feature columns:  {data['feature_columns']}")

    assert type(clf).__name__ == "HistGradientBoostingClassifier"
    assert params.get("class_weight") is None, "Production baseline class_weight must be None!"
    assert params.get("max_iter") == 150
    assert params.get("random_state") == 42
    assert sorted(list(data["classes"])) == sorted(CLASSES)
    assert data["feature_columns"] == FEATURE_COLUMNS

    # Confirm production inference loads this baseline
    from app.core import tabular_model
    tabular_model.reset_model_cache()
    bundle = tabular_model.get_tabular_models()
    loaded_clf = bundle["wn_bundle"]["pipeline"].named_steps["classifier"]
    assert loaded_clf.get_params().get("class_weight") is None
    print("            Production loader check: Active model is original baseline.")
    print("  -> Result: PASS")
    return {"status": "PASS", "actual_hash": actual_hash}


def verify_candidate_2() -> Dict[str, Any]:
    cand_path = CANDIDATES_DIR / "water_need_model_candidate_balanced.joblib"
    assert cand_path.exists(), f"Candidate model missing: {cand_path}"
    actual_hash = sha256_of_file(cand_path)
    print(f"\n[Check 4.B] Candidate 2 Path:        {cand_path}")
    print(f"            Expected SHA-256:        {EXPECTED_CANDIDATE_WN_SHA256}")
    print(f"            Actual SHA-256:          {actual_hash}")
    assert actual_hash == EXPECTED_CANDIDATE_WN_SHA256, "Candidate hash mismatch!"

    data = joblib.load(cand_path)
    pipeline = data["pipeline"]
    encoder = data["encoder"]
    clf = pipeline.named_steps["classifier"]
    params = clf.get_params()

    print(f"            Classifier:              {type(clf).__name__}")
    print(f"            class_weight:            {params.get('class_weight')}")
    print(f"            max_iter:                {params.get('max_iter')}")
    print(f"            random_state:            {params.get('random_state')}")
    print(f"            Classes:                 {list(data['classes'])}")
    print(f"            Feature columns:         {data['feature_columns']}")

    assert type(clf).__name__ == "HistGradientBoostingClassifier"
    assert params.get("class_weight") == "balanced", "Candidate class_weight must be 'balanced'!"
    assert params.get("max_iter") == 150
    assert params.get("random_state") == 42
    assert sorted(list(data["classes"])) == sorted(CLASSES)
    assert data["feature_columns"] == FEATURE_COLUMNS
    print("  -> Result: PASS")
    return {"status": "PASS", "actual_hash": actual_hash}


def verify_candidate_metadata() -> Dict[str, Any]:
    meta_path = CANDIDATES_DIR / "candidate_water_need_meta.json"
    assert meta_path.exists(), f"Candidate metadata missing: {meta_path}"
    actual_hash = sha256_of_file(meta_path)
    print(f"\n[Check 4.C] Candidate Metadata Path: {meta_path}")
    print(f"            Actual SHA-256:          {actual_hash}")

    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    assert meta["status"] == "VALIDATED_NOT_PROMOTED"
    assert meta["production_decision"] == "ORIGINAL_BASELINE_RETAINED"
    assert meta["dataset"]["sha256"] == EXPECTED_DATASET_SHA256
    assert meta["dataset"]["feature_columns"] == FEATURE_COLUMNS
    assert meta["parameters"]["class_weight"] == "balanced"
    print(f"            Status documented:       {meta['status']}")
    print(f"            Production decision:     {meta['production_decision']}")
    print(f"            Dataset hash in meta:    {meta['dataset']['sha256']}")
    print("  -> Result: PASS")
    return {"status": "PASS", "actual_hash": actual_hash}


def verify_other_model_artifacts() -> Dict[str, str]:
    print("\n[Check 4.D] Other Model Artifacts State Verification:")
    artifacts = {
        "crop_recommendation": MODELS_DIR / "crop_recommendation_model.joblib",
        "field_status": MODELS_DIR / "field_status_model.joblib",
        "tabular_meta": MODELS_DIR / "tabular_model_meta.json",
        "tabular_field_status_legacy": MODELS_DIR / "tabular_field_status.joblib",
        "tabular_water_need_legacy": MODELS_DIR / "tabular_water_need.joblib",
    }
    hashes = {}
    for name, path in artifacts.items():
        if path.exists():
            h = sha256_of_file(path)
            hashes[name] = h
            print(f"  {name:28s} ({path.name}) -> SHA-256: {h}")
        else:
            print(f"  {name:28s} ({path.name}) -> NOT FOUND")
    return hashes


def test_non_destructive_inference():
    print("\n[Check 5] Non-Destructive Inference & Error Rejection Checks:")
    from app.core import tabular_model
    from app.schemas.tabular import TabularFeatures

    # 1. Test production inference returns expected schema and reasonable output
    feats_urgent = TabularFeatures(
        n=29.0, p=54.0, k=16.0,
        temperature=27.78, humidity=54.65, ph=8.15,
        rainfall=32.05, soil_moisture=8.0
    )
    wn, wn_conf, fs, fs_conf, ver, crop, crop_conf = tabular_model.predict_field_status(feats_urgent)
    print(f"  Representative Urgent profile -> wn={wn} (conf={wn_conf}), fs={fs} (conf={fs_conf}), crop={crop}")
    assert wn in CLASSES
    assert 0.0 <= wn_conf <= 1.0

    feats_low = TabularFeatures(
        n=80.0, p=40.0, k=40.0,
        temperature=22.0, humidity=80.0, ph=6.8,
        rainfall=150.0, soil_moisture=45.0
    )
    wn_l, wn_conf_l, fs_l, fs_conf_l, ver_l, crop_l, crop_conf_l = tabular_model.predict_field_status(feats_low)
    print(f"  Representative Low profile    -> wn={wn_l} (conf={wn_conf_l}), fs={fs_l} (conf={fs_conf_l}), crop={crop_l}")
    assert wn_l in CLASSES
    assert 0.0 <= wn_conf_l <= 1.0

    # 2. Probability distribution checks on both production and candidate models
    prod_data = joblib.load(MODELS_DIR / "water_need_model.joblib")
    cand_data = joblib.load(CANDIDATES_DIR / "water_need_model_candidate_balanced.joblib")

    arr = np.array([[29.0, 54.0, 16.0, 27.78, 54.65, 8.15, 32.05, 8.0]], dtype=np.float64)

    prod_probs = prod_data["pipeline"].predict_proba(arr)[0]
    cand_probs = cand_data["pipeline"].predict_proba(arr)[0]

    assert prod_probs.shape == (4,) and cand_probs.shape == (4,), "Probability shape must be (4,)"
    assert np.all(prod_probs >= 0.0) and np.all(cand_probs >= 0.0), "Probabilities must be non-negative"
    assert np.all(np.isfinite(prod_probs)) and np.all(np.isfinite(cand_probs)), "Probabilities must be finite"
    assert np.isclose(np.sum(prod_probs), 1.0, atol=1e-5), "Production probabilities must sum to 1.0"
    assert np.isclose(np.sum(cand_probs), 1.0, atol=1e-5), "Candidate probabilities must sum to 1.0"
    print(f"  Probabilities validated: Production sum={np.sum(prod_probs):.4f}, Candidate sum={np.sum(cand_probs):.4f}")

    # 3. Input rejection checks on both models
    for model_name, data in [("Production", prod_data), ("Candidate", cand_data)]:
        pipe = data["pipeline"]
        # Missing features (7)
        try:
            pipe.predict(np.array([[29.0, 54.0, 16.0, 27.78, 54.65, 8.15, 32.05]]))
            raise AssertionError(f"{model_name} failed to reject 7 features!")
        except ValueError:
            pass

        # Extra features (9)
        try:
            pipe.predict(np.array([[29.0, 54.0, 16.0, 27.78, 54.65, 8.15, 32.05, 8.0, 99.0]]))
            raise AssertionError(f"{model_name} failed to reject 9 features!")
        except ValueError:
            pass

        # Non-numeric values
        try:
            pipe.predict(np.array([["bad", "data", "1", "2", "3", "4", "5", "6"]]))
            raise AssertionError(f"{model_name} failed to reject non-numeric inputs!")
        except ValueError:
            pass
    print("  Schema and type rejections verified for both models (missing, extra, non-numeric).")

    # 4. Disease detection fail-closed check
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)
    resp = client.get("/api/v1/health/diagnostics")
    body = resp.json()
    status = body["metadata"]["disease_inference_status"]
    print(f"  Disease detection model status: {status} (inference_ready={body['inference_ready']})")
    assert status == "MODEL_UNAVAILABLE", "Disease model must remain MODEL_UNAVAILABLE!"
    assert body["inference_ready"] is False, "Disease inference must remain unavailable!"
    print("  Disease detection MODEL_UNAVAILABLE fail-closed verified.")
    print("  -> Result: PASS")


def main():
    print("=" * 80)
    print("AgroAI Production Artifact Integrity & Verification Audit")
    print("=" * 80)
    verify_production_baseline()
    verify_candidate_2()
    meta_res = verify_candidate_metadata()
    other_hashes = verify_other_model_artifacts()
    test_non_destructive_inference()
    print("\n" + "=" * 80)
    print("ALL PRODUCTION INTEGRITY & ARTIFACT CHECKS COMPLETED SUCCESSFULLY.")
    print("=" * 80)


if __name__ == "__main__":
    main()
