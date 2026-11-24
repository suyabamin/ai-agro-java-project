import os
from typing import List
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")


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
    DISEASE_MODEL_DIR: Path = Path(os.getenv("AGROAI_DISEASE_MODEL_DIR", str(Path(__file__).resolve().parents[1] / "models" / "disease"))).resolve()
    AI_SERVICE_KEY: str = os.getenv("AGROAI_AI_SERVICE_KEY", "agroai-local-dev-key-2026" if os.getenv("APP_ENV", "development") != "production" else "")
    MAX_IMAGE_BYTES: int = int(os.getenv("AGROAI_MAX_IMAGE_BYTES", str(8 * 1024 * 1024)))
    MAX_IMAGE_PIXELS: int = int(os.getenv("AGROAI_MAX_IMAGE_PIXELS", "40000000"))
    MIN_IMAGE_SIDE: int = int(os.getenv("AGROAI_MIN_IMAGE_SIDE", "64"))
    MAX_IMAGE_SIDE: int = int(os.getenv("AGROAI_MAX_IMAGE_SIDE", "10000"))


settings = Settings()
