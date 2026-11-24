import json
import math
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from app.core.config import settings
from app.core.image_preprocessing import ImageValidationError, PreprocessorUnavailable, _sniff_format
from app.schemas.inference import AlternativePrediction, InferenceResponse, TopPrediction

MODEL_ID = "crop_disease_model"
MODEL_FILENAME = "crop_disease_model.tflite"
CLASS_NAMES_FILENAME = "class_names.json"
CONVERSION_REPORT_FILENAME = "conversion_report.json"
PREPROCESSING_VERSION = "letterbox-224-rgb128-f32-0-255-v1"
TARGET_WIDTH = 224
TARGET_HEIGHT = 224
PAD_RGB = (128, 128, 128)

DISEASE_LIMITATIONS = [
    "AI-assisted crop leaf disease prediction only; not a guaranteed agronomic diagnosis.",
    "Trained on 94 crop/disease classes under controlled dataset conditions; field lighting, camera angle, and unseen diseases may affect results.",
    "Consult a qualified agronomist before applying chemical treatments or major crop interventions.",
]


def is_healthy_class(class_name: str) -> bool:
    """Determine healthy status using verified class_names.json naming conventions."""
    lower = class_name.strip().lower()
    return "healthy" in lower or "normal" in lower


def preprocess_leaf_image(image_bytes: bytes, declared_content_type: str = "") -> tuple[np.ndarray, int, int, str]:
    """
    Validate and preprocess crop leaf image bytes for the verified TFLite model:
    - Magic-byte & declared MIME check (PNG / JPEG only)
    - EXIF orientation correction via cv2.imdecode(IMREAD_COLOR)
    - BGR -> RGB conversion
    - Aspect-ratio-preserving resize + RGB(128,128,128) centered letterbox to 224x224
    - Float32 tensor in [0, 255] (rescaling & EfficientNetB0 normalization are embedded in the model)
    """
    if not image_bytes:
        raise ImageValidationError("EMPTY_IMAGE", "Image file is empty")
    if len(image_bytes) > settings.MAX_IMAGE_BYTES:
        raise ImageValidationError("IMAGE_TOO_LARGE", "Image exceeds the configured size limit")

    actual_type = _sniff_format(image_bytes)
    declared = (declared_content_type or "").split(";")[0].strip().lower()
    if declared and declared not in ("application/octet-stream", actual_type):
        raise ImageValidationError("CONTENT_TYPE_MISMATCH", "Declared content type does not match image bytes")

    encoded = np.frombuffer(image_bytes, dtype=np.uint8)
    bgr = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
    if bgr is None or bgr.size == 0:
        raise ImageValidationError("CORRUPTED_IMAGE", "Image bytes could not be decoded")

    orig_h, orig_w = bgr.shape[:2]
    if (
        min(orig_w, orig_h) < settings.MIN_IMAGE_SIDE
        or max(orig_w, orig_h) > settings.MAX_IMAGE_SIDE
        or (orig_w * orig_h) > settings.MAX_IMAGE_PIXELS
    ):
        raise ImageValidationError("INVALID_IMAGE_DIMENSIONS", "Image dimensions are outside configured limits")

    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    scale = min(TARGET_WIDTH / float(orig_w), TARGET_HEIGHT / float(orig_h))
    new_w = max(1, int(round(orig_w * scale)))
    new_h = max(1, int(round(orig_h * scale)))
    interp = cv2.INTER_AREA if scale < 1.0 else cv2.INTER_LINEAR
    resized = cv2.resize(rgb, (new_w, new_h), interpolation=interp)

    canvas = np.empty((TARGET_HEIGHT, TARGET_WIDTH, 3), dtype=np.uint8)
    canvas[:, :] = PAD_RGB
    top = (TARGET_HEIGHT - new_h) // 2
    left = (TARGET_WIDTH - new_w) // 2
    canvas[top : top + new_h, left : left + new_w] = resized

    batch_tensor = np.expand_dims(canvas.astype(np.float32), axis=0)
    return batch_tensor, orig_w, orig_h, actual_type


class DiseaseDetectionService:
    """Singleton-friendly, thread-safe TFLite crop leaf disease detection service."""

    def __init__(self, model_dir: Path | None = None):
        self.model_dir = Path(model_dir or settings.DISEASE_MODEL_DIR).resolve()
        self.model_path = self.model_dir / MODEL_FILENAME
        self.labels_path = self.model_dir / CLASS_NAMES_FILENAME
        self.report_path = self.model_dir / CONVERSION_REPORT_FILENAME

        self.available: bool = False
        self.error_code: str | None = None
        self.error_message: str | None = None
        self.model_name: str = MODEL_ID
        self.model_version: str = "su-0.1-tflite"
        self.labels: dict[int, str] = {}
        self.input_shape: tuple[int, ...] | None = None
        self.output_shape: tuple[int, ...] | None = None

        self._interpreter: Any = None
        self._input_index: int = -1
        self._output_index: int = -1
        self._lock = threading.Lock()

        self._load()

    def _load(self) -> None:
        if not self.model_path.is_file():
            self.error_code = "MODEL_NOT_FOUND"
            self.error_message = "Disease detection model artifact is missing."
            return
        if not self.labels_path.is_file():
            self.error_code = "CLASS_MAPPING_NOT_FOUND"
            self.error_message = "Disease class mapping artifact is missing."
            return

        try:
            raw_labels = json.loads(self.labels_path.read_text(encoding="utf-8"))
            if not isinstance(raw_labels, dict) or not raw_labels:
                self.error_code = "CLASS_MAPPING_INVALID"
                self.error_message = "Class mapping must be a non-empty JSON object."
                return
            parsed_labels: dict[int, str] = {}
            for k, v in raw_labels.items():
                idx = int(k)
                if not isinstance(v, str) or not v.strip():
                    raise ValueError(f"Invalid label at index {k}")
                parsed_labels[idx] = v.strip()
            expected_indices = list(range(len(parsed_labels)))
            if sorted(parsed_labels.keys()) != expected_indices:
                self.error_code = "CLASS_MAPPING_INVALID"
                self.error_message = "Class mapping indices must be contiguous 0..N-1."
                return
        except Exception as exc:
            self.error_code = "CLASS_MAPPING_INVALID"
            self.error_message = f"Failed to load class mapping: {exc}"
            return

        if self.report_path.is_file():
            try:
                report = json.loads(self.report_path.read_text(encoding="utf-8"))
                ver = str(report.get("model", "")).strip()
                if ver:
                    self.model_version = f"{ver.lower().replace(' ', '-')}-tflite"
            except Exception:
                pass

        try:
            import ai_edge_litert.interpreter as tflite
        except ImportError as exc:
            self.error_code = "TFLITE_RUNTIME_UNAVAILABLE"
            self.error_message = f"TFLite runtime is not available: {exc}"
            return

        try:
            interpreter = tflite.Interpreter(model_path=str(self.model_path))
            interpreter.allocate_tensors()
            in_details = interpreter.get_input_details()
            out_details = interpreter.get_output_details()
            if not in_details or not out_details:
                raise ValueError("Model must expose input and output tensors")

            in_shape = tuple(int(d) for d in in_details[0]["shape"])
            out_shape = tuple(int(d) for d in out_details[0]["shape"])
            in_dtype = in_details[0]["dtype"]
            out_dtype = out_details[0]["dtype"]

            if in_shape != (1, TARGET_HEIGHT, TARGET_WIDTH, 3) or in_dtype != np.float32:
                raise ValueError(f"Unexpected input tensor {in_shape} {in_dtype}")
            if out_shape != (1, len(parsed_labels)) or out_dtype != np.float32:
                raise ValueError(f"Unexpected output tensor {out_shape} {out_dtype} for {len(parsed_labels)} classes")

            self._interpreter = interpreter
            self._input_index = int(in_details[0]["index"])
            self._output_index = int(out_details[0]["index"])
            self.labels = parsed_labels
            self.input_shape = in_shape
            self.output_shape = out_shape
            self.available = True
            self.error_code = None
            self.error_message = None
        except Exception as exc:
            self._interpreter = None
            self.available = False
            self.error_code = "MODEL_LOAD_FAILED"
            self.error_message = f"Failed to initialize TFLite disease model: {exc}"

    def unavailable_response(self) -> InferenceResponse:
        return InferenceResponse(
            status="MODEL_UNAVAILABLE",
            success=False,
            error_code=self.error_code or "MODEL_UNAVAILABLE",
            message=self.error_message or "Disease inference is unavailable until a valid TFLite model and class mapping are supplied.",
            limitations=DISEASE_LIMITATIONS,
        )

    def predict(self, image_bytes: bytes, declared_content_type: str = "") -> InferenceResponse:
        if not self.available or self._interpreter is None:
            return self.unavailable_response()

        batch_tensor, _, _, _ = preprocess_leaf_image(image_bytes, declared_content_type)

        with self._lock:
            self._interpreter.set_tensor(self._input_index, batch_tensor)
            self._interpreter.invoke()
            raw_output = self._interpreter.get_tensor(self._output_index).copy()

        output = np.asarray(raw_output, dtype=np.float64)
        if output.ndim == 2 and output.shape[0] == 1:
            output = output[0]
        if output.ndim != 1 or output.size != len(self.labels) or not np.isfinite(output).all():
            raise ValueError("Model output shape or values do not match registered class mapping")

        if (output < -1e-6).any() or (output > 1.0 + 1e-6).any() or not math.isclose(float(output.sum()), 1.0, abs_tol=0.02):
            raise ValueError("Model output must be finite softmax probabilities summing to 1.0")

        scores = np.clip(output, 0.0, 1.0)
        ranked = sorted(enumerate(scores.tolist()), key=lambda item: item[1], reverse=True)
        top_idx, top_score = ranked[0]
        top_name = self.labels[top_idx]
        healthy = is_healthy_class(top_name)
        top_pct = round(float(top_score) * 100.0, 2)

        top_predictions = [
            TopPrediction(
                classIndex=idx,
                className=self.labels[idx],
                confidence=round(float(score) * 100.0, 2),
            )
            for idx, score in ranked[:3]
        ]
        alternatives = [
            AlternativePrediction(
                class_id=str(idx),
                label=self.labels[idx],
                score=float(score),
            )
            for idx, score in ranked[1:3]
        ]

        return InferenceResponse(
            status="COMPLETED",
            model_name=self.model_name,
            model_version=self.model_version,
            predicted_class=top_name,
            predicted_class_id=str(top_idx),
            confidence_score=float(top_score),
            confidence_semantics="Softmax model probability across 94 crop/disease classes; decision support only.",
            alternatives=alternatives,
            processed_at=datetime.now(timezone.utc),
            message="Disease inference completed using pretrained TFLite model.",
            limitations=DISEASE_LIMITATIONS,
            is_mock=False,
            success=True,
            model=self.model_name,
            modelVersion=self.model_version,
            preprocessingVersion=PREPROCESSING_VERSION,
            classIndex=top_idx,
            diseaseName=top_name,
            confidence=top_pct,
            isHealthy=healthy,
            topPredictions=top_predictions,
        )
