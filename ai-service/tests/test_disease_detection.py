import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.api.v1.endpoints.inference import get_disease_service
from app.core.config import settings
from app.core.image_preprocessing import ImageValidationError
from app.main import app
from app.services.disease_detection_service import (
    DiseaseDetectionService,
    is_healthy_class,
    preprocess_leaf_image,
)

client = TestClient(app)


def _encode_image(bgr: np.ndarray, ext: str = ".png") -> bytes:
    ok, buf = cv2.imencode(ext, bgr)
    assert ok
    return buf.tobytes()


def test_real_tflite_model_and_class_mapping_loaded():
    service = get_disease_service()
    assert service.model_path.is_file()
    assert service.labels_path.is_file()
    assert service.available is True
    assert service.input_shape == (1, 224, 224, 3)
    assert service.output_shape == (1, 94)
    assert len(service.labels) == 94
    assert sorted(service.labels.keys()) == list(range(94))


def test_letterbox_preprocessing_preserves_aspect_ratio_and_0_255_float32():
    # Wide 400x100 green image -> scaled to 224x56, padded top/bottom with RGB(128,128,128)
    bgr = np.zeros((100, 400, 3), dtype=np.uint8)
    bgr[:, :] = (20, 180, 40)  # BGR -> RGB(40, 180, 20)
    png_bytes = _encode_image(bgr, ".png")

    tensor, orig_w, orig_h, mime = preprocess_leaf_image(png_bytes, "image/png")
    assert (orig_w, orig_h) == (400, 100)
    assert mime == "image/png"
    assert tensor.shape == (1, 224, 224, 3)
    assert tensor.dtype == np.float32
    # Top padding pixel must be RGB(128, 128, 128)
    assert np.allclose(tensor[0, 0, 0], [128.0, 128.0, 128.0])
    # Center pixel must remain in [0, 255] green range (not divided by 255)
    assert tensor[0, 112, 112, 1] > 170.0


def test_healthy_class_detection_covers_healthy_and_rice_normal():
    assert is_healthy_class("Tomato_healthy") is True
    assert is_healthy_class("Banana_Healthy") is True
    assert is_healthy_class("Rice_normal") is True
    assert is_healthy_class("Jute_Healthy Leaf") is True
    assert is_healthy_class("Tomato_Early_Blight") is False
    assert is_healthy_class("Rice_Blast") is False


@pytest.mark.parametrize("ext,mime", [(".jpg", "image/jpeg"), (".png", "image/png")])
def test_real_inference_on_valid_jpeg_and_png(ext, mime):
    rng = np.random.default_rng(42)
    img = rng.integers(0, 256, size=(160, 120, 3), dtype=np.uint8)
    image_bytes = _encode_image(img, ext)

    service = get_disease_service()
    res = service.predict(image_bytes, mime)

    assert res.status == "COMPLETED"
    assert res.success is True
    assert res.is_mock is False
    assert res.model == "crop_disease_model"
    assert res.classIndex is not None and 0 <= res.classIndex < 94
    assert res.diseaseName == service.labels[res.classIndex]
    assert res.predicted_class == res.diseaseName
    assert res.confidence is not None and 0.0 <= res.confidence <= 100.0
    assert res.confidence_score is not None and 0.0 <= res.confidence_score <= 1.0
    assert res.isHealthy == is_healthy_class(res.diseaseName)
    assert len(res.topPredictions) == 3
    confs = [p.confidence for p in res.topPredictions]
    assert confs == sorted(confs, reverse=True)


def test_availability_and_multipart_endpoint_with_real_model(monkeypatch):
    monkeypatch.setattr(settings, "AI_SERVICE_KEY", "test-key")
    avail = client.get("/api/v1/inference/availability", headers={"X-AI-Service-Key": "test-key"})
    assert avail.status_code == 200
    avail_json = avail.json()
    assert avail_json["available"] is True
    assert avail_json["status"] == "AVAILABLE"
    assert avail_json["class_count"] == 94

    img = np.full((128, 128, 3), 100, dtype=np.uint8)
    jpg_bytes = _encode_image(img, ".jpg")
    resp = client.post(
        "/api/v1/inference/disease",
        files={"file": ("leaf.jpg", jpg_bytes, "image/jpeg")},
        headers={"X-AI-Service-Key": "test-key"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "COMPLETED"
    assert body["success"] is True
    assert len(body["topPredictions"]) == 3


def test_empty_and_undersized_images_are_rejected():
    with pytest.raises(ImageValidationError) as empty_err:
        preprocess_leaf_image(b"", "image/jpeg")
    assert empty_err.value.code == "EMPTY_IMAGE"

    tiny = _encode_image(np.zeros((16, 16, 3), dtype=np.uint8), ".png")
    with pytest.raises(ImageValidationError) as dim_err:
        preprocess_leaf_image(tiny, "image/png")
    assert dim_err.value.code == "INVALID_IMAGE_DIMENSIONS"


def test_service_fails_closed_when_class_mapping_is_corrupt(tmp_path):
    (tmp_path / "crop_disease_model.tflite").write_bytes(b"not-a-model")
    (tmp_path / "class_names.json").write_text("{bad json", encoding="utf-8")
    svc = DiseaseDetectionService(tmp_path)
    assert svc.available is False
    assert svc.error_code == "CLASS_MAPPING_INVALID"
