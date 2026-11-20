import json
from pathlib import Path
from typing import Tuple, Dict, Any, Optional
import numpy as np
import joblib

from app.schemas.tabular import TabularFeatures

_MODELS_DIR = Path(__file__).resolve().parents[2] / "models"
_META_PATH = _MODELS_DIR / "tabular_model_meta.json"
_WN_MODEL_PATH = _MODELS_DIR / "water_need_model.joblib"
_FS_MODEL_PATH = _MODELS_DIR / "field_status_model.joblib"
_CR_MODEL_PATH = _MODELS_DIR / "crop_recommendation_model.joblib"

_tabular_bundle: Optional[Dict[str, Any]] = None


class TabularModelUnavailable(RuntimeError):
    """Raised when one or more required tabular model artifacts are missing or invalid."""
    pass


def reset_model_cache():
    """Clear in-memory model cache (useful for testing)."""
    global _tabular_bundle
    _tabular_bundle = None


def get_tabular_models() -> Dict[str, Any]:
    global _tabular_bundle
    if _tabular_bundle is not None:
        return _tabular_bundle

    if not _WN_MODEL_PATH.exists():
        raise TabularModelUnavailable(f"Water Need model artifact not found at: {_WN_MODEL_PATH}")
    if not _FS_MODEL_PATH.exists():
        raise TabularModelUnavailable(f"Field Status model artifact not found at: {_FS_MODEL_PATH}")

    meta = {}
    if _META_PATH.exists():
        try:
            with open(_META_PATH, "r", encoding="utf-8") as f:
                meta = json.load(f)
        except Exception:
            pass

    try:
        wn_data = joblib.load(_WN_MODEL_PATH)
        fs_data = joblib.load(_FS_MODEL_PATH)
    except Exception as exc:
        raise TabularModelUnavailable(f"Failed to load model pipeline artifacts: {exc}") from exc

    cr_data = None
    if _CR_MODEL_PATH.exists():
        try:
            cr_data = joblib.load(_CR_MODEL_PATH)
        except Exception:
            cr_data = None

    _tabular_bundle = {
        "meta": meta,
        "wn_bundle": wn_data,
        "fs_bundle": fs_data,
        "cr_bundle": cr_data,
    }
    return _tabular_bundle


def predict_field_status(features: TabularFeatures) -> Tuple[str, float, str, float, str, Optional[str], Optional[float]]:
    """
    Given 8 agricultural features, returns:
    (water_need, water_need_conf, field_status, field_status_conf, model_version, recommended_crop, crop_conf)
    
    Feature Order strictly enforced:
    ["N", "P", "K", "temperature", "humidity", "ph", "rainfall", "Soil Moisture"]
    """
    bundle = get_tabular_models()
    meta = bundle["meta"]
    wn_bundle = bundle["wn_bundle"]
    fs_bundle = bundle["fs_bundle"]
    cr_bundle = bundle.get("cr_bundle")

    wn_pipeline = wn_bundle["pipeline"]
    wn_encoder = wn_bundle["encoder"]
    fs_pipeline = fs_bundle["pipeline"]
    fs_encoder = fs_bundle["encoder"]

    # Strict feature array matching training FEATURE_COLUMNS
    arr = np.array([[
        float(features.n),
        float(features.p),
        float(features.k),
        float(features.temperature),
        float(features.humidity),
        float(features.ph),
        float(features.rainfall),
        float(features.soil_moisture),
    ]], dtype=np.float64)

    # 1. Water Need Prediction
    wn_probs = wn_pipeline.predict_proba(arr)[0]
    wn_pred_idx = int(np.argmax(wn_probs))
    water_need = str(wn_encoder.classes_[wn_pred_idx])
    wn_conf = round(float(wn_probs[wn_pred_idx]), 4)

    # 2. Field Status Prediction
    fs_probs = fs_pipeline.predict_proba(arr)[0]
    fs_pred_idx = int(np.argmax(fs_probs))
    field_status = str(fs_encoder.classes_[fs_pred_idx])
    fs_conf = round(float(fs_probs[fs_pred_idx]), 4)

    # 3. Crop Recommendation (Optional Model 3)
    recommended_crop = None
    crop_conf = None
    if cr_bundle is not None:
        cr_pipeline = cr_bundle["pipeline"]
        cr_encoder = cr_bundle["encoder"]
        cr_probs = cr_pipeline.predict_proba(arr)[0]
        cr_pred_idx = int(np.argmax(cr_probs))
        recommended_crop = str(cr_encoder.classes_[cr_pred_idx])
        crop_conf = round(float(cr_probs[cr_pred_idx]), 4)

    model_version = meta.get("model_version", wn_bundle.get("model_version", "tabular-pipeline-v2.0"))

    return water_need, wn_conf, field_status, fs_conf, model_version, recommended_crop, crop_conf
