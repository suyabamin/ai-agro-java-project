from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class DiseaseResearchRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    analysisId: str = Field(min_length=1, max_length=120)
    diseaseName: str = Field(min_length=1, max_length=200)
    cropName: str | None = Field(default=None, max_length=100)
    confidence: float | None = Field(default=None, ge=0, le=100)
    isHealthy: bool | None = None
    maxResults: int = Field(default=5, ge=1, le=8)


class ResearchSource(BaseModel):
    title: str
    url: str
    domain: str
    snippet: str
    extractedSummary: str | None = None
    authoritativeTier: Literal["BANGLADESH_GOV_RESEARCH", "INTERNATIONAL_AGRI", "ACADEMIC", "GENERAL"]
    retrievedAt: str
    provider: str = "google_selenium"


class BengaliResearchReport(BaseModel):
    summaryBn: str
    symptomsBn: str
    managementBn: str
    preventionBn: str
    cautionBn: str
    evidenceNoticeBn: str
    overviewBn: str | None = None
    causesBn: str | None = None
    spreadBn: str | None = None
    damageBn: str | None = None
    immediateActionBn: str | None = None
    whenToConsultBn: str | None = None
    referencesBn: str | None = None


class DiseaseResearchResponse(BaseModel):
    researchStatus: Literal["COMPLETED", "BLOCKED", "FAILED", "SKIPPED_HEALTHY", "INSUFFICIENT_EVIDENCE"]
    analysisId: str
    diseaseName: str
    cropName: str | None = None
    isHealthy: bool = False
    lowConfidenceWarning: bool = False
    queriesUsed: list[str] = Field(default_factory=list)
    sources: list[ResearchSource] = Field(default_factory=list)
    bengaliReport: BengaliResearchReport | None = None
    errorCode: str | None = None
    errorMessage: str | None = None
    seleniumVersion: str | None = None
    browserInfo: str | None = None
    searchProvidersAttempted: list[str] = Field(default_factory=list)
    successfulProvider: str | None = None
    fallbackUsed: bool = False
    fallbackReason: str | None = None
    sourceCount: int = 0
    validatedSourceCount: int = 0
    retrievedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
