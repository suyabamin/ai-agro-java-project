from fastapi import APIRouter
from app.schemas.health import HealthStatus, HealthDiagnosticResponse
from app.core.config import settings
from app.api.v1.endpoints import inference

router = APIRouter()


@router.get("/health", response_model=HealthStatus, summary="Basic AI health check")
def get_health() -> HealthStatus:
    return HealthStatus(
        status="UP",
        service="agroai-ai-service",
        version=settings.PROJECT_VERSION,
    )


@router.get("/health/diagnostics", response_model=HealthDiagnosticResponse, summary="Detailed AI service diagnostics")
def get_diagnostics() -> HealthDiagnosticResponse:
    service = inference.get_disease_service()
    model_available = service.available
    try:
        import cv2  # noqa: F401
        import numpy  # noqa: F401
        preprocessor_available = True
        preprocessor_error = None
    except ImportError:
        preprocessor_available = False
        preprocessor_error = "PREPROCESSOR_UNAVAILABLE"
    service_key_configured = bool(settings.AI_SERVICE_KEY)
    ready = model_available and preprocessor_available and service_key_configured
    if not model_available:
        inference_status = "MODEL_UNAVAILABLE"
        error_code = service.error_code
    elif not service_key_configured:
        inference_status = "AI_SERVICE_AUTH_NOT_CONFIGURED"
        error_code = "AI_SERVICE_AUTH_NOT_CONFIGURED"
    elif not preprocessor_available:
        inference_status = "PREPROCESSOR_UNAVAILABLE"
        error_code = preprocessor_error
    else:
        inference_status = "AVAILABLE"
        error_code = None
    return HealthDiagnosticResponse(
        status="UP",
        service="agroai-ai-service",
        version=settings.PROJECT_VERSION,
        environment=settings.APP_ENV,
        inference_ready=ready,
        active_model=(f"{service.model_name}@{service.model_version}" if model_available else None),
        metadata={
            "disease_inference_status": inference_status,
            "model_error_code": error_code,
            "model_available": model_available,
            "class_count": len(service.labels) if model_available else 0,
            "backend_auth_configured": service_key_configured,
            "image_pipeline": "AVAILABLE" if preprocessor_available else "UNAVAILABLE",
        },
    )
