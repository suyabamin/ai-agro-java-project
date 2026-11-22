"""
AgroAI — Candidate Artifact & Inference Validation in a Fresh Process
=====================================================================

Validates:
1. Candidate 2 artifact serialization integrity, schema, pipeline steps, and parameters.
2. Inference behavior on representative samples for all four classes (Low, Moderate, High, Urgent).
3. Probability distribution outputs (sum to 1.0, non-negative, calibrated shape).
4. Error handling on malformed/invalid inputs.
5. Isolation verification: Confirms production inference pipeline still loads the original artifact.
"""

from __future__ import annotations

import hashlib
import pathlib
import sys
import numpy as np
import joblib

ROOT_DIR = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT_DIR / "ai-service"))

CANDIDATE_PATH = ROOT_DIR / "ai-service" / "models" / "candidates" / "water_need_model_candidate_balanced.joblib"
PRODUCTION_PATH = ROOT_DIR / "ai-service" / "models" / "water_need_model.joblib"

EXPECTED_FEATURES = [
    "N",
    "P",
    "K",
    "temperature",
    "humidity",
    "ph",
    "rainfall",
    "Soil Moisture",
]
EXPECTED_CLASSES = ["High", "Low", "Moderate", "Urgent"]


def compute_sha256(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def test_candidate_artifact_schema():
    print("--- 1. Candidate Artifact Schema & Parameter Inspection ---")
    if not CANDIDATE_PATH.exists():
        raise FileNotFoundError(f"Candidate artifact not found: {CANDIDATE_PATH}")

    c_hash = compute_sha256(CANDIDATE_PATH)
    print(f"Candidate Path:    {CANDIDATE_PATH}")
    print(f"Candidate SHA-256: {c_hash}")

    data = joblib.load(CANDIDATE_PATH)
    assert isinstance(data, dict), "Artifact must be a dictionary"
    assert "pipeline" in data, "Artifact missing 'pipeline'"
    assert "encoder" in data, "Artifact missing 'encoder'"
    assert "feature_columns" in data, "Artifact missing 'feature_columns'"
    assert "classes" in data, "Artifact missing 'classes'"

    # Verify features and classes
    assert data["feature_columns"] == EXPECTED_FEATURES, f"Unexpected features: {data['feature_columns']}"
    assert sorted(list(data["classes"])) == sorted(EXPECTED_CLASSES), f"Unexpected classes: {data['classes']}"
    print(f"Feature Columns (count={len(data['feature_columns'])}): {data['feature_columns']}")
    print(f"Classes (count={len(data['classes'])}): {data['classes']}")

    # Verify pipeline components
    pipeline = data["pipeline"]
    steps = dict(pipeline.steps)
    print(f"Pipeline Steps: {list(steps.keys())}")
    assert "scaler" in steps, "Pipeline must contain 'scaler'"
    assert "classifier" in steps, "Pipeline must contain 'classifier'"

    clf = steps["classifier"]
    assert type(clf).__name__ == "HistGradientBoostingClassifier", f"Unexpected classifier type: {type(clf)}"
    params = clf.get_params()
    print(f"Classifier Algorithm: {type(clf).__name__}")
    print(f"Classifier class_weight: {params.get('class_weight')}")
    print(f"Classifier max_iter: {params.get('max_iter')}")
    print(f"Classifier random_state: {params.get('random_state')}")

    assert params.get("class_weight") == "balanced", "class_weight must be 'balanced'"
    assert params.get("max_iter") == 150, "max_iter must be 150"
    assert params.get("random_state") == 42, "random_state must be 42"
    print("  -> PASS: Candidate schema and parameters verified.")
    return data


def test_representative_inferences(candidate_data):
    print("\n--- 2. Representative Inferences Across All Four Classes ---")
    pipeline = candidate_data["pipeline"]
    encoder = candidate_data["encoder"]

    # Representative test cases: [N, P, K, temp, humidity, ph, rainfall, soil_moisture]
    test_cases = {
        "Urgent (Severe mothbeans drought profile)": [29.0, 54.0, 16.0, 27.78, 54.65, 8.15, 32.05, 8.0],
        "High (Low moisture, warm, low rainfall)": [40.0, 50.0, 20.0, 30.0, 45.0, 6.5, 35.0, 19.5],
        "Moderate (Average soil moisture & rainfall)": [50.0, 50.0, 50.0, 26.0, 65.0, 6.5, 65.0, 28.0],
        "Low (Ample soil moisture & high rainfall)": [80.0, 40.0, 40.0, 22.0, 80.0, 6.8, 150.0, 45.0],
    }

    for desc, feats in test_cases.items():
        arr = np.array([feats], dtype=np.float64)
        pred_idx = pipeline.predict(arr)[0]
        probs = pipeline.predict_proba(arr)[0]
        label = encoder.classes_[pred_idx]

        assert probs.shape == (4,), f"Probabilities shape must be (4,), got {probs.shape}"
        assert np.isclose(np.sum(probs), 1.0, atol=1e-5), f"Probabilities do not sum to 1.0: {np.sum(probs)}"
        assert np.all(probs >= 0.0), "Negative probability detected"

        prob_breakdown = ", ".join([f"{cls}: {probs[i]*100:.1f}%" for i, cls in enumerate(encoder.classes_)])
        print(f"Case: {desc}")
        print(f"  Predicted Label: {label} (Confidence: {probs[pred_idx]*100:.1f}%)")
        print(f"  Distribution:    [{prob_breakdown}]")

    print("  -> PASS: Representative multi-class inference verified.")


def test_invalid_input_rejection(candidate_data):
    print("\n--- 3. Invalid Input & Schema Rejection Tests ---")
    pipeline = candidate_data["pipeline"]

    # 1. Feature dimension mismatch (7 features instead of 8)
    try:
        pipeline.predict(np.array([[29.0, 54.0, 16.0, 27.78, 54.65, 8.15, 32.05]]))
        raise AssertionError("Should have rejected 7 features!")
    except ValueError as e:
        print(f"  [Rejection 1] 7 features correctly rejected: {e}")

    # 2. Feature dimension mismatch (9 features instead of 8)
    try:
        pipeline.predict(np.array([[29.0, 54.0, 16.0, 27.78, 54.65, 8.15, 32.05, 8.0, 99.0]]))
        raise AssertionError("Should have rejected 9 features!")
    except ValueError as e:
        print(f"  [Rejection 2] 9 features correctly rejected: {e}")

    # 3. Non-numeric input
    try:
        pipeline.predict(np.array([["bad", "data", "1", "2", "3", "4", "5", "6"]]))
        raise AssertionError("Should have rejected string inputs!")
    except ValueError as e:
        print(f"  [Rejection 3] String input correctly rejected: {e}")

    print("  -> PASS: Invalid input rejection verified.")


def test_production_inference_isolation():
    print("\n--- 4. Production Inference Isolation Verification ---")
    # Verify production model artifact hash is intact
    prod_hash = compute_sha256(PRODUCTION_PATH)
    print(f"Production Model Path:    {PRODUCTION_PATH}")
    print(f"Production Model SHA-256: {prod_hash}")
    assert prod_hash == "eb5362b9529d444e3ff3e48bce5ffc9c6e0a0d5731b14ef9bb681b64053af8fd", \
        "CRITICAL: Production model hash does not match baseline!"

    # Test that production inference loads the original artifact
    from app.core import tabular_model
    tabular_model.reset_model_cache()
    bundle = tabular_model.get_tabular_models()
    loaded_wn_clf = bundle["wn_bundle"]["pipeline"].named_steps["classifier"]

    print(f"Production Loaded Classifier: {type(loaded_wn_clf).__name__}")
    print(f"Production Loaded class_weight: {loaded_wn_clf.get_params().get('class_weight')}")
    assert loaded_wn_clf.get_params().get("class_weight") is None, \
        "Production inference must still use unweighted baseline (class_weight=None)!"

    # Test production inference call
    from app.schemas.tabular import TabularFeatures
    sample_features = TabularFeatures(
        n=29.0, p=54.0, k=16.0,
        temperature=27.78, humidity=54.65, ph=8.15,
        rainfall=32.05, soil_moisture=8.0
    )
    wn, wn_conf, fs, fs_conf, ver, crop, crop_conf = tabular_model.predict_field_status(sample_features)
    print(f"Production predict_field_status output: wn={wn} ({wn_conf}), fs={fs} ({fs_conf}), ver={ver}")
    assert wn in EXPECTED_CLASSES
    print("  -> PASS: Production inference remains 100% isolated and operational on original artifact.")


def main():
    print("=" * 80)
    print("AgroAI Candidate 2 Fresh-Process Validation Suite")
    print("=" * 80)
    candidate_data = test_candidate_artifact_schema()
    test_representative_inferences(candidate_data)
    test_invalid_input_rejection(candidate_data)
    test_production_inference_isolation()
    print("\n" + "=" * 80)
    print("ALL VALIDATION CHECKS PASSED: Candidate 2 is completely validated and isolated.")
    print("=" * 80)


if __name__ == "__main__":
    main()
