from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.api import api_router
from app.schemas.health import HealthStatus

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AgroAI Decision Support & Image Inference Microservice",
    version=settings.PROJECT_VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
)

# CORS configuration
if settings.ALLOWED_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Root level health check for container/load balancer orchestrators
@app.get("/health", response_model=HealthStatus, tags=["Root Health"])
def root_health() -> HealthStatus:
    return HealthStatus(
        status="UP",
        service="agroai-ai-service",
        version=settings.PROJECT_VERSION,
    )

# Include v1 API router
app.include_router(api_router, prefix=settings.API_V1_STR)
