from fastapi import APIRouter, Header

from app.api.v1.endpoints.inference import require_backend_key
from app.schemas.research import DiseaseResearchRequest, DiseaseResearchResponse
from app.services.disease_research_service import run_disease_research

router = APIRouter()


@router.post("/disease", response_model=DiseaseResearchResponse)
def research_disease(
    payload: DiseaseResearchRequest,
    x_ai_service_key: str | None = Header(default=None),
) -> DiseaseResearchResponse:
    require_backend_key(x_ai_service_key)
    return run_disease_research(payload)
