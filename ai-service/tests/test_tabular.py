import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from app.core.config import settings
from app.core import tabular_model
from app.schemas.tabular import TabularFeatures
from app.main import app

client = TestClient(app)


def test_dataset_file_exists():
    data_path = Path(__file__).resolve().parents[1] / "data" / "agroai_labeled_dataset_v2.csv"
    assert data_path.exists(), "Dataset file must exist at ai-service/data/agroai_labeled_dataset_v2.csv"


def test_model_artifacts_exist():
    models_dir = Path(__file__).resolve().parents[1] / "models"
    assert (models_dir / "water_need_model.joblib").exists(), "water_need_model.joblib must exist"
    assert (models_dir / "field_status_model.joblib").exists(), "field_status_model.joblib must exist"
    assert (models_dir / "crop_recommendation_model.joblib").exists(), "crop_recommendation_model.joblib must exist"
    assert (models_dir / "tabular_model_meta.json").exists(), "tabular_model_meta.json must exist"


def test_tabular_model_loading_and_prediction():
    tabular_model.reset_model_cache()
    bundle = tabular_model.get_tabular_models()
    assert "wn_bundle" in bundle
    assert "fs_bundle" in bundle

    feats = TabularFeatures(
        n=90.0,
        p=42.0,
        k=43.0,
        temperature=20.87,
        humidity=82.0,
        ph=6.5,
        rainfall=202.9,
        soil_moisture=46.96,
    )
    wn, wn_conf, fs, fs_conf, ver, crop, crop_conf = tabular_model.predict_field_status(feats)

    assert wn in ["Low", "Moderate", "High", "Urgent"]
    assert 0.0 <= wn_conf <= 1.0
    assert fs in ["Healthy", "Attention", "Critical"]
    assert 0.0 <= fs_conf <= 1.0
    assert ver == "tabular-pipeline-v2.0"
    assert crop == "rice"
    assert 0.0 <= crop_conf <= 1.0


def test_missing_model_behavior(monkeypatch, tmp_path):
    tabular_model.reset_model_cache()
    # Point models to empty tmp dir
    monkeypatch.setattr(tabular_model, "_WN_MODEL_PATH", tmp_path / "nonexistent.joblib")
    with pytest.raises(tabular_model.TabularModelUnavailable) as exc:
        tabular_model.get_tabular_models()
    assert "not found" in str(exc.value)

    # Availability endpoint returns MODEL_UNAVAILABLE
    monkeypatch.setattr(settings, "AI_SERVICE_KEY", "key-test")
    res = client.get("/api/v1/inference/tabular/availability", headers={"X-AI-Service-Key": "key-test"})
    assert res.status_code == 200
    assert res.json()["status"] == "MODEL_UNAVAILABLE"

    # Reset cache back for other tests
    tabular_model.reset_model_cache()


def test_tabular_inference_requires_key(monkeypatch):
    monkeypatch.setattr(settings, "AI_SERVICE_KEY", "test-key-123")
    payload = {
        "n": 90,
        "p": 42,
        "k": 43,
        "temperature": 20.8,
        "humidity": 82.0,
        "ph": 6.5,
        "rainfall": 202.9,
        "soil_moisture": 46.96,
    }
    res = client.post("/api/v1/inference/tabular", json=payload)
    assert res.status_code == 401
    assert res.json()["detail"]["code"] == "AI_SERVICE_UNAUTHORIZED"


def test_tabular_inference_invalid_input(monkeypatch):
    monkeypatch.setattr(settings, "AI_SERVICE_KEY", "test-key-123")
    # pH outside 0-14
    invalid_payload = {
        "n": 90,
        "p": 42,
        "k": 43,
        "temperature": 20.8,
        "humidity": 82.0,
        "ph": 18.5,
        "rainfall": 202.9,
        "soil_moisture": 46.96,
    }
    res = client.post(
        "/api/v1/inference/tabular",
        json=invalid_payload,
        headers={"X-AI-Service-Key": "test-key-123"},
    )
    assert res.status_code == 422  # Pydantic validation error


def test_tabular_inference_successful(monkeypatch):
    monkeypatch.setattr(settings, "AI_SERVICE_KEY", "test-key-123")
    payload = {
        "n": 90,
        "p": 42,
        "k": 43,
        "temperature": 20.8797,
        "humidity": 82.0027,
        "ph": 6.5029,
        "rainfall": 202.9355,
        "soil_moisture": 46.96,
    }
    res = client.post(
        "/api/v1/inference/tabular",
        json=payload,
        headers={"X-AI-Service-Key": "test-key-123"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "COMPLETED"
    assert data["water_need"] in ["Low", "Moderate", "High", "Urgent"]
    assert data["field_status"] in ["Healthy", "Attention", "Critical"]
    assert 0 <= data["water_need_confidence"] <= 1
    assert 0 <= data["field_status_confidence"] <= 1
    assert data["recommended_crop"] == "rice"
    assert 0 <= data["crop_confidence"] <= 1
    assert data["label_provenance"] == "rule_derived"
    assert data["label_method"] == "agronomic_rule_v1"
    assert "agronomic rule-derived labels" in data["disclaimer"]
