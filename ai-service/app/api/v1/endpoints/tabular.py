from fastapi import APIRouter, Header, HTTPException
from app.api.v1.endpoints.inference import require_backend_key
from app.core.tabular_model import predict_field_status, get_tabular_models, TabularModelUnavailable
from app.schemas.tabular import TabularFeatures, TabularInferenceResponse

router = APIRouter()


@router.get("/availability")
def get_tabular_availability(
    x_ai_service_key: str | None = Header(default=None),
):
    require_backend_key(x_ai_service_key)
    try:
        bundle = get_tabular_models()
        meta = bundle.get("meta", {})
        return {
            "available": True,
            "status": "AVAILABLE",
            "model_version": meta.get("model_version", "tabular-pipeline-v2.0"),
            "models_loaded": ["water_need", "field_status"] + (["crop_recommendation"] if bundle.get("cr_bundle") else []),
            "message": "Tabular ML pipelines are loaded and ready.",
        }
    except TabularModelUnavailable as exc:
        return {
            "available": False,
            "status": "MODEL_UNAVAILABLE",
            "error_code": "MODEL_UNAVAILABLE",
            "message": str(exc),
        }


@router.post("", response_model=TabularInferenceResponse)
def infer_tabular(
    features: TabularFeatures,
    x_ai_service_key: str | None = Header(default=None),
) -> TabularInferenceResponse:
    require_backend_key(x_ai_service_key)
    try:
        water_need, wn_conf, field_status, fs_conf, model_version, rec_crop, crop_conf = predict_field_status(features)
        return TabularInferenceResponse(
            status="COMPLETED",
            model_version=model_version,
            water_need=water_need,
            field_status=field_status,
            water_need_confidence=wn_conf,
            field_status_confidence=fs_conf,
            recommended_crop=rec_crop,
            crop_confidence=crop_conf,
        )
    except TabularModelUnavailable as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "MODEL_UNAVAILABLE", "message": str(exc)},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"code": "INFERENCE_FAILED", "message": str(exc)},
        ) from exc
