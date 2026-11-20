import hashlib
import json
import threading
from pathlib import Path
from typing import Any, Protocol
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator


class InputContract(BaseModel):
    model_config = ConfigDict(extra="forbid")
    width: int = Field(gt=0, le=4096)
    height: int = Field(gt=0, le=4096)
    channels: int = Field(ge=3, le=3)
    color: str = Field(pattern="^RGB$")
    normalization: str = Field(pattern="^(NONE|ZERO_ONE|MINUS_ONE_TO_ONE|MEAN_STD)$")
    mean: list[float] | None = None
    std: list[float] | None = None

    @model_validator(mode="after")
    def validate_normalization(self):
        if self.normalization == "MEAN_STD":
            if self.mean is None or self.std is None or len(self.mean) != 3 or len(self.std) != 3:
                raise ValueError("MEAN_STD normalization requires three mean and standard-deviation values")
            if any(value <= 0 for value in self.std):
                raise ValueError("Standard-deviation values must be positive")
        return self


class EvaluationMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: str = Field(pattern="^(EVALUATED|NOT_EVALUATED)$")
    dataset_name: str = Field(min_length=1)
    dataset_license: str = Field(min_length=1)
    evaluated_at: datetime
    validation_split: str = Field(min_length=1)
    metrics: dict[str, float] = Field(min_length=1)
    limitations: list[str] = Field(min_length=1)

    @model_validator(mode="after")
    def metrics_are_finite(self):
        import math
        if any(not math.isfinite(value) for value in self.metrics.values()):
            raise ValueError("Evaluation metrics must be finite numbers")
        return self


class ModelMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: str = Field(pattern="^1\\.0$")
    model_name: str = Field(min_length=1, max_length=100)
    model_version: str = Field(min_length=1, max_length=100)
    model_file: str = Field(pattern="^[A-Za-z0-9_.-]+\\.(keras|h5)$")
    model_sha256: str = Field(pattern="^[a-fA-F0-9]{64}$")
    labels_file: str = Field(pattern="^[A-Za-z0-9_.-]+\\.json$")
    labels_sha256: str = Field(pattern="^[a-fA-F0-9]{64}$")
    output_activation: str = Field(pattern="^(SOFTMAX|LOGITS)$")
    input: InputContract
    evaluation: EvaluationMetadata


class InferenceAdapter(Protocol):
    def predict(self, tensor: Any) -> Any: ...


class TensorFlowKerasAdapter:
    def __init__(self, model_path: Path):
        try:
            from tensorflow.keras.models import load_model
        except ImportError as exc:
            raise RuntimeError("TensorFlow is not installed; model cannot be loaded") from exc
        self.model = load_model(model_path, compile=False)

    def predict(self, tensor: Any) -> Any:
        return self.model.predict(tensor, verbose=0)


class ModelRegistry:
    """Loads only an explicitly registered, checksum-verified and evaluated model."""

    def __init__(self, root: Path, adapter_factory=TensorFlowKerasAdapter):
        self.root = root.resolve()
        self.adapter_factory = adapter_factory
        self._lock = threading.Lock()
        self._loaded = False
        self.metadata: ModelMetadata | None = None
        self.labels: dict[int, dict[str, str]] = {}
        self.adapter: InferenceAdapter | None = None
        self.error_code: str | None = None
        self.error_message = "No model has been registered"

    @staticmethod
    def sha256(path: Path) -> str:
        digest = hashlib.sha256()
        with path.open("rb") as model_file:
            for chunk in iter(lambda: model_file.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()

    def _contained_file(self, directory: Path, name: str) -> Path:
        candidate = (directory / name).resolve()
        if directory.resolve() not in candidate.parents:
            raise ValueError("Registered model file must stay inside its version directory")
        return candidate

    def load(self) -> bool:
        with self._lock:
            if self._loaded:
                return self.adapter is not None
            self._loaded = True
            try:
                active_path = self._contained_file(self.root, "active.json")
                active = json.loads(active_path.read_text(encoding="utf-8"))
                version_dir = self._contained_file(self.root, active["directory"])
                if version_dir.parent != self.root:
                    raise ValueError("Registered model version must be a direct child directory")
                if not version_dir.is_dir():
                    raise FileNotFoundError("Registered model version directory is missing")
                metadata_path = self._contained_file(version_dir, "metadata.json")
                metadata = ModelMetadata.model_validate_json(metadata_path.read_text(encoding="utf-8"))
                if metadata.evaluation.status != "EVALUATED":
                    raise ValueError("Model evaluation metadata is not marked EVALUATED")
                model_path = self._contained_file(version_dir, metadata.model_file)
                labels_path = self._contained_file(version_dir, metadata.labels_file)
                if not model_path.is_file() or not labels_path.is_file():
                    raise FileNotFoundError("Registered model or label file is missing")
                if self.sha256(model_path).lower() != metadata.model_sha256.lower():
                    raise ValueError("Model checksum does not match metadata")
                if self.sha256(labels_path).lower() != metadata.labels_sha256.lower():
                    raise ValueError("Label-map checksum does not match metadata")
                raw_labels = json.loads(labels_path.read_text(encoding="utf-8"))
                if not isinstance(raw_labels, dict) or not raw_labels:
                    raise ValueError("Label mapping must be a non-empty JSON object")
                labels = {int(index): item for index, item in raw_labels.items()}
                if sorted(labels) != list(range(len(labels))):
                    raise ValueError("Label mapping indices must be contiguous and start at zero")
                for item in labels.values():
                    if not isinstance(item, dict) or not item.get("classId") or not item.get("displayName"):
                        raise ValueError("Each label needs classId and displayName")
                adapter = self.adapter_factory(model_path)
                self.metadata, self.labels, self.adapter = metadata, labels, adapter
                self.error_code, self.error_message = None, "Registered model loaded"
                return True
            except FileNotFoundError as exc:
                self.error_code, self.error_message = "MODEL_UNAVAILABLE", str(exc)
            except (KeyError, TypeError, ValueError, ValidationError, json.JSONDecodeError) as exc:
                self.error_code, self.error_message = "MODEL_METADATA_INVALID", str(exc)
            except Exception:
                self.error_code, self.error_message = "MODEL_LOAD_FAILED", "Registered model could not be loaded"
            return False

    def reload(self) -> bool:
        with self._lock:
            self._loaded = False
            self.metadata = None
            self.labels = {}
            self.adapter = None
            self.error_code = None
        return self.load()

    @property
    def available(self) -> bool:
        return self.load()

