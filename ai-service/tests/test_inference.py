import hashlib
import json
from types import SimpleNamespace

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.api.v1.endpoints import inference
from app.core.config import settings
from app.core.model_registry import ModelRegistry
from app.core.image_preprocessing import ImageValidationError, decode_and_preprocess
from app.core.inference import run_inference
from app.main import app
from app.services.disease_detection_service import DiseaseDetectionService

client = TestClient(app)
PNG_HEADER = b"\x89PNG\r\n\x1a\n"


def test_inference_requires_backend_service_key(monkeypatch):
    monkeypatch.setattr(settings, "AI_SERVICE_KEY", "secret-for-test")
    response = client.post("/api/v1/inference/disease", content=PNG_HEADER, headers={"Content-Type": "image/png"})
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "AI_SERVICE_UNAUTHORIZED"


def test_inference_fails_closed_when_service_key_is_not_configured(monkeypatch):
    monkeypatch.setattr(settings, "AI_SERVICE_KEY", "")
    response = client.get("/api/v1/inference/availability")
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "AI_SERVICE_AUTH_NOT_CONFIGURED"


def test_missing_model_response_contains_no_prediction_or_confidence(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "AI_SERVICE_KEY", "backend-test-key")
    monkeypatch.setattr(inference, "get_disease_service", lambda: DiseaseDetectionService(tmp_path))
    response = client.post(
        "/api/v1/inference/disease",
        content=PNG_HEADER + b"image bytes",
        headers={"X-AI-Service-Key": "backend-test-key", "Content-Type": "image/png"},
    )
    assert response.status_code == 200
    result = response.json()
    assert result["status"] == "MODEL_UNAVAILABLE"
    assert result["success"] is False
    assert result["predicted_class"] is None
    assert result["predicted_class_id"] is None
    assert result["confidence_score"] is None
    assert result["isHealthy"] is None
    assert result["is_mock"] is False


def test_invalid_image_signature_is_rejected_even_without_model(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "AI_SERVICE_KEY", "backend-test-key")
    monkeypatch.setattr(inference, "get_disease_service", lambda: DiseaseDetectionService(tmp_path))
    response = client.post(
        "/api/v1/inference/disease",
        content=b"GIF89a",
        headers={"X-AI-Service-Key": "backend-test-key", "Content-Type": "image/gif"},
    )
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "UNSUPPORTED_IMAGE"


def test_declared_content_type_must_match_image_signature(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "AI_SERVICE_KEY", "backend-test-key")
    monkeypatch.setattr(inference, "get_disease_service", lambda: DiseaseDetectionService(tmp_path))
    response = client.post(
        "/api/v1/inference/disease",
        content=PNG_HEADER + b"payload",
        headers={"X-AI-Service-Key": "backend-test-key", "Content-Type": "image/jpeg"},
    )
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "CONTENT_TYPE_MISMATCH"


def test_upload_byte_limit_is_enforced(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "AI_SERVICE_KEY", "backend-test-key")
    monkeypatch.setattr(settings, "MAX_IMAGE_BYTES", 12)
    monkeypatch.setattr(inference, "get_disease_service", lambda: DiseaseDetectionService(tmp_path))
    response = client.post(
        "/api/v1/inference/disease",
        content=PNG_HEADER + b"123456789",
        headers={"X-AI-Service-Key": "backend-test-key", "Content-Type": "image/png"},
    )
    assert response.status_code == 413
    assert response.json()["detail"]["code"] == "IMAGE_TOO_LARGE"


def test_model_registry_rejects_metadata_that_claims_no_evaluation(tmp_path):
    version = tmp_path / "candidate-v1"
    version.mkdir()
    model_path = version / "candidate.keras"
    labels_path = version / "labels.json"
    model_path.write_bytes(b"test-only-not-a-model")
    labels_path.write_text(json.dumps({"0": {"classId": "test-class", "displayName": "Test class"}}))
    metadata = {
        "schema_version": "1.0",
        "model_name": "test-only",
        "model_version": "0.0-test",
        "model_file": "candidate.keras",
        "model_sha256": hashlib.sha256(model_path.read_bytes()).hexdigest(),
        "labels_file": "labels.json",
        "labels_sha256": hashlib.sha256(labels_path.read_bytes()).hexdigest(),
        "output_activation": "SOFTMAX",
        "input": {"width": 224, "height": 224, "channels": 3, "color": "RGB", "normalization": "ZERO_ONE"},
        "evaluation": {
            "status": "NOT_EVALUATED", "dataset_name": "test fixture", "dataset_license": "fixture",
            "evaluated_at": "2026-11-18T00:00:00Z", "validation_split": "fixture",
            "metrics": {"accuracy": 0.0}, "limitations": ["test fixture only"],
        },
    }
    (version / "metadata.json").write_text(json.dumps(metadata))
    (tmp_path / "active.json").write_text(json.dumps({"directory": "candidate-v1"}))
    registry = ModelRegistry(tmp_path, adapter_factory=lambda _: pytest.fail("unevaluated model must not load"))

    assert registry.available is False
    assert registry.error_code == "MODEL_METADATA_INVALID"


def test_diagnostics_reports_model_unavailable_without_inference_claim(monkeypatch, tmp_path):
    monkeypatch.setattr(inference, "get_disease_service", lambda: DiseaseDetectionService(tmp_path))
    response = client.get("/api/v1/health/diagnostics")
    assert response.status_code == 200
    body = response.json()
    assert body["inference_ready"] is False
    assert body["active_model"] is None
    assert body["metadata"]["disease_inference_status"] == "MODEL_UNAVAILABLE"


def test_diagnostics_requires_backend_auth_even_when_a_model_is_loaded(monkeypatch):
    monkeypatch.setattr(settings, "AI_SERVICE_KEY", "")
    monkeypatch.setattr(
        inference,
        "get_disease_service",
        lambda: SimpleNamespace(available=True, model_name="fixture", model_version="test-only", labels={0: "A"}, error_code=None),
    )
    response = client.get("/api/v1/health/diagnostics")
    body = response.json()
    assert body["inference_ready"] is False
    assert body["active_model"] == "fixture@test-only"
    assert body["metadata"]["disease_inference_status"] == "AI_SERVICE_AUTH_NOT_CONFIGURED"


def test_opencv_preprocessing_decodes_converts_resizes_and_normalizes():
    original = np.zeros((120, 160, 3), dtype=np.uint8)
    original[:, :] = (0, 0, 255)  # OpenCV BGR red becomes RGB red.
    encoded_ok, encoded = cv2.imencode(".png", original)
    assert encoded_ok
    metadata = SimpleNamespace(
        input=SimpleNamespace(width=32, height=24, normalization="ZERO_ONE", mean=None, std=None)
    )

    result = decode_and_preprocess(encoded.tobytes(), "image/png", metadata)
    assert (result.width, result.height) == (160, 120)
    assert result.tensor.shape == (24, 32, 3)
    assert float(result.tensor[0, 0, 0]) > 0.99
    assert float(result.tensor[0, 0, 2]) < 0.01


def test_opencv_rejects_corrupt_image_even_with_valid_signature():
    with pytest.raises(ImageValidationError) as error:
        decode_and_preprocess(PNG_HEADER + b"not a png", "image/png")
    assert error.value.code == "CORRUPTED_IMAGE"


def test_mock_adapter_result_is_model_output_only_and_not_a_real_accuracy_claim():
    labels = {
        0: {"classId": "fixture-a", "displayName": "Fixture class A"},
        1: {"classId": "fixture-b", "displayName": "Fixture class B"},
    }
    metadata = SimpleNamespace(
        input=SimpleNamespace(width=8, height=8, normalization="ZERO_ONE", mean=None, std=None),
        output_activation="SOFTMAX",
        model_name="test-fixture",
        model_version="test-only",
        evaluation=SimpleNamespace(limitations=["Synthetic unit-test output; no disease prediction or model accuracy claim."]),
    )

    class FixtureAdapter:
        def predict(self, _tensor):
            return np.asarray([[0.25, 0.75]])

    registry = SimpleNamespace(available=True, metadata=metadata, adapter=FixtureAdapter(), labels=labels)
    encoded_ok, encoded = cv2.imencode(".png", np.zeros((80, 80, 3), dtype=np.uint8))
    assert encoded_ok
    result = run_inference(registry, encoded.tobytes(), "image/png")
    assert result.status == "COMPLETED"
    assert result.predicted_class == "Fixture class B"
    assert result.confidence_score == pytest.approx(0.75)
    assert "not a probability of correctness" in result.confidence_semantics
