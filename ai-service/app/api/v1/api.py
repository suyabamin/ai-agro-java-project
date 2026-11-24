from fastapi import APIRouter
from app.api.v1.endpoints import health, inference, research, tabular

api_router = APIRouter()
api_router.include_router(health.router, tags=["Health & Diagnostics"])
api_router.include_router(inference.router, prefix="/inference", tags=["Inference"])
api_router.include_router(tabular.router, prefix="/inference/tabular", tags=["Tabular Inference"])
api_router.include_router(research.router, prefix="/research", tags=["Disease Research"])
