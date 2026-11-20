import hmac
from functools import lru_cache

from fastapi import APIRouter, Header, HTTPException, Request

from app.core.config import settings
from app.core.image_preprocessing import ImageValidationError, PreprocessorUnavailable, _sniff_format
from app.core.inference import run_inference, unavailable_response
from app.core.model_registry import ModelRegistry
from app.schemas.inference import InferenceResponse, ModelAvailability

router = APIRouter()


@lru_cache(maxsize=1)
def get_model_registry() -> ModelRegistry:
    return ModelRegistry(settings.MODEL_DIR)


def require_backend_key(value: str | None) -> None:
    configured = settings.AI_SERVICE_KEY
    if not configured:
        raise HTTPException(status_code=503, detail={"code": "AI_SERVICE_AUTH_NOT_CONFIGURED"})
    if value is None or not hmac.compare_digest(value, configured):
        raise HTTPException(status_code=401, detail={"code": "AI_SERVICE_UNAUTHORIZED"})


@router.get("/availability", response_model=ModelAvailability)
def get_availability(x_ai_service_key: str | None = Header(default=None)) -> ModelAvailability:
    require_backend_key(x_ai_service_key)
    registry = get_model_registry()
    if not registry.available or registry.metadata is None:
        return ModelAvailability(
            available=False,
            status="MODEL_UNAVAILABLE",
            error_code=registry.error_code or "MODEL_UNAVAILABLE",
            message="No evaluated disease model is registered.",
        )
    return ModelAvailability(
        available=True,
        status="AVAILABLE",
        model_name=registry.metadata.model_name,
        model_version=registry.metadata.model_version,
        input_width=registry.metadata.input.width,
        input_height=registry.metadata.input.height,
        input_color=registry.metadata.input.color,
        normalization=registry.metadata.input.normalization,
        message="An evaluated model is registered and loaded.",
    )


@router.post("/disease", response_model=InferenceResponse)
async def infer_disease(
    request: Request,
    x_ai_service_key: str | None = Header(default=None),
) -> InferenceResponse:
    require_backend_key(x_ai_service_key)
    chunks = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > settings.MAX_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail={"code": "IMAGE_TOO_LARGE"})
        chunks.append(chunk)
    image_bytes = b"".join(chunks)
    try:
        actual_type = _sniff_format(image_bytes)
    except ImageValidationError as exc:
        raise HTTPException(status_code=422, detail={"code": exc.code, "message": str(exc)}) from exc
    declared = request.headers.get("content-type", "").split(";")[0].strip().lower()
    if declared not in ("", "application/octet-stream", actual_type):
        raise HTTPException(status_code=422, detail={"code": "CONTENT_TYPE_MISMATCH"})

    registry = get_model_registry()
    if not registry.available:
        # Explicit unavailable state; never invent a class, score, or successful completion.
        return unavailable_response(registry)
    try:
        return run_inference(registry, image_bytes, actual_type)
    except ImageValidationError as exc:
        raise HTTPException(status_code=422, detail={"code": exc.code, "message": str(exc)}) from exc
    except PreprocessorUnavailable as exc:
        raise HTTPException(status_code=503, detail={"code": "PREPROCESSOR_UNAVAILABLE", "message": str(exc)}) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail={"code": "INFERENCE_FAILED", "message": "Model inference failed"}) from exc
