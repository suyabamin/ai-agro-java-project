from datetime import datetime, timezone
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class TabularFeatures(BaseModel):
    model_config = ConfigDict(extra="ignore")

    n: float = Field(..., ge=0, le=1000, description="Nitrogen content (mg/kg or ratio in soil)")
    p: float = Field(..., ge=0, le=1000, description="Phosphorus content (mg/kg or ratio in soil)")
    k: float = Field(..., ge=0, le=1000, description="Potassium content (mg/kg or ratio in soil)")
    temperature: float = Field(..., ge=-20, le=60, description="Ambient or field temperature in Celsius")
    humidity: float = Field(..., ge=0, le=100, description="Relative humidity in percentage (%)")
    ph: float = Field(..., ge=0, le=14, description="Soil pH value (0-14)")
    rainfall: float = Field(..., ge=0, le=2000, description="Rainfall measurement in mm")
    soil_moisture: float = Field(..., ge=0, le=100, description="Soil volumetric moisture content percentage (%)")


class TabularInferenceResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["COMPLETED", "FAILED"]
    model_version: str
    water_need: str
    field_status: str
    water_need_confidence: float | None = Field(default=None, ge=0, le=1)
    field_status_confidence: float | None = Field(default=None, ge=0, le=1)
    recommended_crop: str | None = None
    crop_confidence: float | None = Field(default=None, ge=0, le=1)
    processed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    label_provenance: str = "rule_derived"
    label_method: str = "agronomic_rule_v1"
    disclaimer: str = (
        "Water Need and Field Status are predicted using models trained on agronomic rule-derived labels. "
        "They provide operational guidance and are not independently validated agronomic ground truth."
    )
