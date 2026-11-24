from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class AlternativePrediction(BaseModel):
    class_id: str
    label: str
    score: float = Field(ge=0, le=1)


class TopPrediction(BaseModel):
    classIndex: int = Field(ge=0)
    className: str
    confidence: float = Field(ge=0, le=100)


class InferenceResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Canonical AgroAI backend fields
    status: Literal["COMPLETED", "MODEL_UNAVAILABLE"]
    model_name: str | None = None
    model_version: str | None = None
    predicted_class: str | None = None
    predicted_class_id: str | None = None
    confidence_score: float | None = Field(default=None, ge=0, le=1)
    confidence_semantics: str | None = None
    alternatives: list[AlternativePrediction] = Field(default_factory=list)
    processed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    error_code: str | None = None
    message: str
    limitations: list[str] = Field(default_factory=list)
    is_mock: Literal[False] = False

    # Extended disease-detection fields
    success: bool = False
    model: str | None = None
    modelVersion: str | None = None
    preprocessingVersion: str | None = None
    classIndex: int | None = None
    diseaseName: str | None = None
    confidence: float | None = Field(default=None, ge=0, le=100)
    isHealthy: bool | None = None
    topPredictions: list[TopPrediction] = Field(default_factory=list)


class ModelAvailability(BaseModel):
    available: bool
    status: Literal["AVAILABLE", "MODEL_UNAVAILABLE"]
    model_name: str | None = None
    model_version: str | None = None
    class_count: int | None = None
    input_width: int | None = None
    input_height: int | None = None
    input_color: str | None = None
    normalization: str | None = None
    preprocessing_version: str | None = None
    error_code: str | None = None
    message: str
