import os
from typing import List
from pathlib import Path


class Settings:
    PROJECT_NAME: str = "AgroAI Inference Service"
    PROJECT_VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    APP_ENV: str = os.getenv("APP_ENV", "development")
    ALLOWED_ORIGINS: List[str] = [
        origin.strip()
        for origin in os.getenv("ALLOWED_BACKEND_ORIGINS", "http://localhost:8080,http://localhost:5173").split(",")
        if origin.strip()
    ]
    MODEL_DIR: Path = Path(os.getenv("AGROAI_MODEL_DIR", str(Path(__file__).resolve().parents[3] / "ai model"))).resolve()
    AI_SERVICE_KEY: str = os.getenv("AGROAI_AI_SERVICE_KEY", "")
    MAX_IMAGE_BYTES: int = int(os.getenv("AGROAI_MAX_IMAGE_BYTES", str(8 * 1024 * 1024)))
    MAX_IMAGE_PIXELS: int = int(os.getenv("AGROAI_MAX_IMAGE_PIXELS", "40000000"))
    MIN_IMAGE_SIDE: int = int(os.getenv("AGROAI_MIN_IMAGE_SIDE", "64"))
    MAX_IMAGE_SIDE: int = int(os.getenv("AGROAI_MAX_IMAGE_SIDE", "10000"))


settings = Settings()
