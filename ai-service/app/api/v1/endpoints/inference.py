import hmac
from functools import lru_cache

from fastapi import APIRouter, Header, HTTPException, Request

from app.core.config import settings
from app.core.image_preprocessing import ImageValidationError, PreprocessorUnavailable, _sniff_format
from app.schemas.inference import InferenceResponse, ModelAvailability
from app.services.disease_detection_service import (
    PREPROCESSING_VERSION,
    TARGET_HEIGHT,
    TARGET_WIDTH,
    DiseaseDetectionService,
)

router = APIRouter()


@lru_cache(maxsize=1)
def get_disease_service() -> DiseaseDetectionService:
    return DiseaseDetectionService(settings.DISEASE_MODEL_DIR)


def require_backend_key(value: str | None) -> None:
    configured = settings.AI_SERVICE_KEY
    if not configured:
        raise HTTPException(status_code=503, detail={"code": "AI_SERVICE_AUTH_NOT_CONFIGURED"})
    if value is None or not hmac.compare_digest(value, configured):
        raise HTTPException(status_code=401, detail={"code": "AI_SERVICE_UNAUTHORIZED"})


@router.get("/availability", response_model=ModelAvailability)
def get_availability(x_ai_service_key: str | None = Header(default=None)) -> ModelAvailability:
    require_backend_key(x_ai_service_key)
    service = get_disease_service()
    if not service.available:
        return ModelAvailability(
            available=False,
            status="MODEL_UNAVAILABLE",
            error_code=service.error_code or "MODEL_UNAVAILABLE",
            message=service.error_message or "Disease detection model is unavailable.",
        )
    return ModelAvailability(
        available=True,
        status="AVAILABLE",
        model_name=service.model_name,
        model_version=service.model_version,
        class_count=len(service.labels),
        input_width=TARGET_WIDTH,
        input_height=TARGET_HEIGHT,
        input_color="RGB",
        normalization="EMBEDDED_RESCALE_1_255_AND_EFFICIENTNETB0_NORM",
        preprocessing_version=PREPROCESSING_VERSION,
        message="Pretrained TFLite crop disease model and 94-class mapping are loaded and ready.",
    )


@router.post("/disease", response_model=InferenceResponse)
async def infer_disease(
    request: Request,
    x_ai_service_key: str | None = Header(default=None),
) -> InferenceResponse:
    require_backend_key(x_ai_service_key)

    content_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
    if content_type.startswith("multipart/form-data"):
        form = await request.form()
        upload = form.get("file")
        if upload is None or not hasattr(upload, "read"):
            raise HTTPException(status_code=422, detail={"code": "EMPTY_IMAGE", "message": "Multipart field 'file' is required"})
        image_bytes = await upload.read()
        if len(image_bytes) > settings.MAX_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail={"code": "IMAGE_TOO_LARGE"})
        declared = (getattr(upload, "content_type", "") or "").split(";")[0].strip().lower()
    else:
        chunks = []
        size = 0
        async for chunk in request.stream():
            size += len(chunk)
            if size > settings.MAX_IMAGE_BYTES:
                raise HTTPException(status_code=413, detail={"code": "IMAGE_TOO_LARGE"})
            chunks.append(chunk)
        image_bytes = b"".join(chunks)
        declared = content_type

    try:
        actual_type = _sniff_format(image_bytes)
    except ImageValidationError as exc:
        raise HTTPException(status_code=422, detail={"code": exc.code, "message": str(exc)}) from exc

    if declared not in ("", "application/octet-stream", actual_type):
        raise HTTPException(status_code=422, detail={"code": "CONTENT_TYPE_MISMATCH"})

    service = get_disease_service()
    if not service.available:
        return service.unavailable_response()

    try:
        return service.predict(image_bytes, actual_type)
    except ImageValidationError as exc:
        raise HTTPException(status_code=422, detail={"code": exc.code, "message": str(exc)}) from exc
    except PreprocessorUnavailable as exc:
        raise HTTPException(status_code=503, detail={"code": "PREPROCESSOR_UNAVAILABLE", "message": str(exc)}) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail={"code": "INFERENCE_FAILED", "message": "Model inference failed"}) from exc
