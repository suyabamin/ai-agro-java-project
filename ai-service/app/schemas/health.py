from pydantic import BaseModel, Field
from typing import Optional, Dict, Any


class HealthStatus(BaseModel):
    status: str = Field(..., description="Service operational status (UP, DEGRADED, DOWN)")
    service: str = Field(..., description="Service identifier name")
    version: str = Field(..., description="Semantic service version")


class HealthDiagnosticResponse(HealthStatus):
    environment: str = Field(default="development", description="Current runtime environment")
    inference_ready: bool = Field(default=False, description="Whether ML inference model is loaded and ready")
    active_model: Optional[str] = Field(default=None, description="Active model name and version if loaded")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Safe diagnostic metadata")
