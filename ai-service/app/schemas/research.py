from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class DiseaseResearchRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    analysisId: str = Field(min_length=1, max_length=120)
    diseaseName: str = Field(min_length=1, max_length=200)
    cropName: str | None = Field(default=None, max_length=100)
    confidence: float | None = Field(default=None, ge=0, le=100)
    isHealthy: bool | None = None
    maxResults: int = Field(default=5, ge=1, le=8)
    telemetryContext: dict[str, Any] | None = None


class ResearchSource(BaseModel):
    title: str
    url: str
    domain: str
    snippet: str
    extractedSummary: str | None = None
    authoritativeTier: Literal["BANGLADESH_GOV_RESEARCH", "INTERNATIONAL_AGRI", "ACADEMIC", "GENERAL"]
    retrievedAt: str
    provider: str = "google_selenium"


class ResearchPaper(BaseModel):
    paperId: str
    title: str
    authors: list[str] = Field(default_factory=list)
    publicationYear: int | None = None
    doi: str | None = None
    journal: str | None = None
    abstract: str | None = None
    url: str
    domain: str
    isOpenAccess: bool | None = None
    citationCount: int | None = None
    sourceProvider: str
    additionalProviders: list[str] = Field(default_factory=list)
    authoritativeTier: Literal["BANGLADESH_GOV_RESEARCH", "INTERNATIONAL_AGRI", "ACADEMIC", "GENERAL"]
    # Four distinct validation stages (never collapsed into a single flag):
    searchResultRetrieved: bool = True
    metadataValidated: bool = False
    sourceIdentityVerified: bool = False
    scientificEvidenceAssessed: bool = False
    doiVerificationStatus: Literal[
        "VERIFIED_MATCH",
        "METADATA_MISMATCH",
        "DOI_NOT_FOUND",
        "UNVERIFIED",
        "NOT_APPLICABLE",
    ] = "NOT_APPLICABLE"
    doiVerificationNote: str | None = None
    relevanceScore: float = 0.0
    evidenceRank: int = 0
    retrievedAt: str


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


class AdvisoryActionItem(BaseModel):
    priority: Literal["IMMEDIATE", "SHORT_TERM", "PREVENTIVE"]
    titleEn: str
    titleBn: str
    detailEn: str
    detailBn: str
    citationIds: list[str] = Field(default_factory=list)


class AdvisoryPayload(BaseModel):
    advisoryStatus: Literal["READY", "LOW_CONFIDENCE_CAUTION", "INSUFFICIENT_EVIDENCE", "HEALTHY_MONITORING"]
    severityLevel: Literal["LOW", "MODERATE", "HIGH", "UNKNOWN"]
    confidenceBand: Literal["HIGH", "MODERATE", "LOW", "UNKNOWN"]
    evidenceQuality: Literal["HIGH", "MODERATE", "LIMITED", "INSUFFICIENT"]
    escalationRequired: bool = False
    escalationReasonEn: str | None = None
    escalationReasonBn: str | None = None
    actionableSteps: list[AdvisoryActionItem] = Field(default_factory=list)
    telemetryContextNotes: list[str] = Field(default_factory=list)
    citedPaperIds: list[str] = Field(default_factory=list)
    citedSourceDomains: list[str] = Field(default_factory=list)
    disclaimerEn: str
    disclaimerBn: str


class DiseaseResearchResponse(BaseModel):
    researchStatus: Literal["COMPLETED", "BLOCKED", "FAILED", "SKIPPED_HEALTHY", "INSUFFICIENT_EVIDENCE"]
    analysisId: str
    diseaseName: str
    cropName: str | None = None
    isHealthy: bool = False
    lowConfidenceWarning: bool = False
    queriesUsed: list[str] = Field(default_factory=list)
    sources: list[ResearchSource] = Field(default_factory=list)
    sourceReferences: list[ResearchSource] = Field(default_factory=list)
    researchPapers: list[ResearchPaper] = Field(default_factory=list)
    bengaliReport: BengaliResearchReport | None = None
    advisory: AdvisoryPayload | None = None
    errorCode: str | None = None
    errorMessage: str | None = None
    seleniumVersion: str | None = None
    browserInfo: str | None = None
    # Existing provider fields (backward compatible)
    searchProvidersAttempted: list[str] = Field(default_factory=list)
    successfulProvider: str | None = None
    fallbackUsed: bool = False
    fallbackReason: str | None = None
    sourceCount: int = 0
    validatedSourceCount: int = 0
    # M1 multi-source provider metadata
    providersAttempted: list[str] = Field(default_factory=list)
    successfulProviders: list[str] = Field(default_factory=list)
    failedProviders: list[str] = Field(default_factory=list)
    providerFailureReasons: dict[str, str] = Field(default_factory=dict)
    providerStatuses: dict[str, str] = Field(default_factory=dict)
    duplicateCount: int = 0
    evidenceQuality: Literal["HIGH", "MODERATE", "LIMITED", "INSUFFICIENT"] = "LIMITED"
    bamisStatus: dict[str, Any] = Field(default_factory=dict)
    retrievalTimestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    retrievedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
