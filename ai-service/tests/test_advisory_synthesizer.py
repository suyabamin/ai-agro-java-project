from app.schemas.research import DiseaseResearchRequest, ResearchPaper, ResearchSource
from app.services import disease_research_service
from app.services.advisory_synthesizer import (
    synthesize_advisory,
    synthesize_evidence_bengali_report,
)
from app.services.disease_research_service import clear_research_cache, run_disease_research
from app.services.providers.base import ProviderOutcome
from app.services.providers.crossref_provider import CrossrefProvider
from app.services.providers.openalex_provider import OpenAlexProvider
from app.services.providers.semantic_scholar_provider import SemanticScholarProvider
from app.services.tavily_search_provider import TavilySearchOutcome, TavilySearchProvider


def _sample_papers():
    return [
        ResearchPaper(
            paperId="doi:10.1000/eb.1",
            title="Integrated Management of Tomato Early Blight",
            authors=["A. Rahman"],
            publicationYear=2024,
            doi="10.1000/eb.1",
            abstract=(
                "Alternaria solani is the fungal pathogen causing early blight symptoms with dark concentric ring lesions on lower leaves. "
                "Spores spread via rain splash and wind. Field sanitation, pruning infected foliage, and Trichoderma biocontrol reduce disease severity."
            ),
            url="https://doi.org/10.1000/eb.1",
            domain="doi.org",
            isOpenAccess=True,
            sourceProvider="openalex",
            authoritativeTier="ACADEMIC",
            metadataValidated=True,
            sourceIdentityVerified=True,
            doiVerificationStatus="VERIFIED_MATCH",
            retrievedAt="2026-11-26T00:00:00Z",
        )
    ]


def _sample_sources():
    return [
        ResearchSource(
            title="Early Blight Extension Guide",
            url="https://extension.umn.edu/early-blight",
            domain="extension.umn.edu",
            snippet="Remove infected lower foliage and avoid overhead irrigation to limit fungal spread.",
            authoritativeTier="ACADEMIC",
            retrievedAt="2026-11-26T00:00:00Z",
            provider="tavily",
        )
    ]


def _bd_portal_sources():
    return [
        ResearchSource(
            title="BAMIS — Official Portal",
            url="https://www.bamis.gov.bd/",
            domain="bamis.gov.bd",
            snippet="Official DAE agro-meteorological advisory portal for Bangladesh farmers (portal reference only).",
            authoritativeTier="BANGLADESH_GOV_RESEARCH",
            retrievedAt="2026-11-26T00:00:00Z",
            provider="bangladesh_agri_official",
        ),
        ResearchSource(
            title="DAE — Official Portal",
            url="https://dae.gov.bd/",
            domain="dae.gov.bd",
            snippet="Official Bangladesh Department of Agricultural Extension portal.",
            authoritativeTier="BANGLADESH_GOV_RESEARCH",
            retrievedAt="2026-11-26T00:00:00Z",
            provider="bangladesh_agri_official",
        ),
    ]


def test_evidence_bengali_report_cites_retrieved_abstracts_without_fabricating_chemicals():
    report = synthesize_evidence_bengali_report(
        disease_name="Tomato_Early_Blight",
        crop_name="TOMATO",
        confidence=88.0,
        is_healthy=False,
        papers=_sample_papers(),
        sources=_sample_sources() + _bd_portal_sources(),
        evidence_quality="HIGH",
    )
    assert "HIGH" in report.summaryBn
    assert "doi:10.1000/eb.1" in report.symptomsBn
    assert "Alternaria solani" in report.causesBn
    assert "bamis.gov.bd" not in (report.referencesBn or "")
    assert "dae.gov.bd" not in (report.referencesBn or "")
    assert "কোনো অনুমানভিত্তিক রাসায়নিক মাত্রা বা ব্র্যান্ড যোগ করা হয়নি" in report.evidenceNoticeBn


def test_advisory_correlates_telemetry_and_flags_escalation_on_critical_field():
    adv = synthesize_advisory(
        disease_name="Tomato_Early_Blight",
        crop_name="TOMATO",
        confidence=88.0,
        is_healthy=False,
        papers=_sample_papers(),
        sources=_sample_sources(),
        evidence_quality="HIGH",
        telemetry_context={
            "predictedFieldStatus": "Critical",
            "predictedWaterNeed": "High",
            "humidity": 86.0,
            "soilMoisture": 78.0,
            "soilPh": 5.1,
        },
    )
    assert adv.advisoryStatus == "READY"
    assert adv.severityLevel == "HIGH"
    assert adv.confidenceBand == "HIGH"
    assert adv.escalationRequired is True
    assert "Critical" in (adv.escalationReasonEn or "")
    assert len(adv.telemetryContextNotes) >= 4
    assert len(adv.actionableSteps) == 3
    assert adv.actionableSteps[0].priority == "IMMEDIATE"
    assert "doi:10.1000/eb.1" in adv.actionableSteps[0].citationIds
    assert "extension.umn.edu" in adv.actionableSteps[2].citationIds


def test_unrelated_same_disease_paper_and_generic_portals_receive_no_citations():
    genomics_only_paper = ResearchPaper(
        paperId="doi:10.1000/genomics.1",
        title="Tomato Early Blight Molecular Sequencing Study",
        authors=["S. Karim"],
        publicationYear=2025,
        doi="10.1000/genomics.1",
        abstract="We sequenced the mitochondrial genome of Alternaria solani isolates collected from tomato.",
        url="https://doi.org/10.1000/genomics.1",
        domain="doi.org",
        sourceProvider="openalex",
        authoritativeTier="ACADEMIC",
        metadataValidated=True,
        doiVerificationStatus="VERIFIED_MATCH",
        retrievedAt="2026-11-26T00:00:00Z",
    )
    adv = synthesize_advisory(
        disease_name="Tomato_Early_Blight",
        crop_name="TOMATO",
        confidence=85.0,
        is_healthy=False,
        papers=[genomics_only_paper],
        sources=_bd_portal_sources(),
        evidence_quality="MODERATE",
    )
    # Genomics paper is about the same disease, but supports NONE of the 3 action steps
    for step in adv.actionableSteps:
        assert step.citationIds == []
    assert adv.citedPaperIds == []
    assert "bamis.gov.bd" not in adv.citedSourceDomains
    assert "dae.gov.bd" not in adv.citedSourceDomains


def test_doi_verified_paper_without_abstract_never_supports_claims():
    no_abstract_paper = ResearchPaper(
        paperId="doi:10.1000/noabs.1",
        title="Remove Infected Leaves and Avoid Overhead Irrigation in Tomato Early Blight",
        authors=["K. Islam"],
        publicationYear=2024,
        doi="10.1000/noabs.1",
        abstract=None,
        url="https://doi.org/10.1000/noabs.1",
        domain="doi.org",
        sourceProvider="openalex",
        authoritativeTier="ACADEMIC",
        metadataValidated=True,
        doiVerificationStatus="VERIFIED_MATCH",
        retrievedAt="2026-11-26T00:00:00Z",
    )
    adv = synthesize_advisory(
        disease_name="Tomato_Early_Blight",
        crop_name="TOMATO",
        confidence=85.0,
        is_healthy=False,
        papers=[no_abstract_paper],
        sources=[],
        evidence_quality="MODERATE",
    )
    for step in adv.actionableSteps:
        assert step.citationIds == []
    assert adv.citedPaperIds == []


def test_multiple_sources_assign_only_relevant_citations_per_step():
    biocontrol_paper = ResearchPaper(
        paperId="doi:10.1000/bio.1",
        title="Bioagents for Early Blight",
        authors=["N. Akter"],
        publicationYear=2024,
        doi="10.1000/bio.1",
        abstract="Trichoderma harzianum and Pseudomonas fluorescens biocontrol treatments reduced early blight severity.",
        url="https://doi.org/10.1000/bio.1",
        domain="doi.org",
        sourceProvider="openalex",
        authoritativeTier="ACADEMIC",
        metadataValidated=True,
        doiVerificationStatus="VERIFIED_MATCH",
        retrievedAt="2026-11-26T00:00:00Z",
    )
    irrigation_guide = ResearchSource(
        title="Tomato Canopy Management",
        url="https://content.ces.ncsu.edu/tomato",
        domain="content.ces.ncsu.edu",
        snippet="Avoid overhead watering and increase plant spacing to improve airflow and dry foliage.",
        authoritativeTier="ACADEMIC",
        retrievedAt="2026-11-26T00:00:00Z",
        provider="tavily",
    )
    adv = synthesize_advisory(
        disease_name="Tomato_Early_Blight",
        crop_name="TOMATO",
        confidence=85.0,
        is_healthy=False,
        papers=[biocontrol_paper],
        sources=[irrigation_guide] + _bd_portal_sources(),
        evidence_quality="HIGH",
    )
    by_prio = {s.priority: s.citationIds for s in adv.actionableSteps}
    assert by_prio["IMMEDIATE"] == []
    assert by_prio["SHORT_TERM"] == ["doi:10.1000/bio.1"]
    assert by_prio["PREVENTIVE"] == ["content.ces.ncsu.edu"]


def test_cached_research_with_fresh_telemetry_preserves_citation_integrity(monkeypatch):
    clear_research_cache()
    monkeypatch.setattr(
        disease_research_service,
        "_run_selenium_google_search",
        lambda *_a, **_kw: ("BLOCKED", [], "GOOGLE_CAPTCHA_BLOCKED", "selenium@4.54.0", "chrome@158"),
    )
    monkeypatch.setattr(
        TavilySearchProvider,
        "search",
        lambda self, queries, max_results=6, domain_classifier=None: TavilySearchOutcome(
            ok=True, reason="ok", sources=_sample_sources()
        ),
    )
    monkeypatch.setattr(
        OpenAlexProvider,
        "search",
        lambda self, query, max_results=5: ProviderOutcome(
            provider="openalex", ok=True, reason="ok", papers=_sample_papers(), sources=[]
        ),
    )
    monkeypatch.setattr(
        SemanticScholarProvider,
        "search",
        lambda self, query, max_results=5: ProviderOutcome(
            provider="semantic_scholar", ok=False, reason="rate_limited"
        ),
    )
    monkeypatch.setattr(CrossrefProvider, "verify_and_enrich", lambda self, p: (True, "verified_match"))

    r1 = run_disease_research(
        DiseaseResearchRequest(
            analysisId="cache_cite_1",
            diseaseName="Tomato_Early_Blight",
            cropName="TOMATO",
            confidence=85.0,
            isHealthy=False,
            telemetryContext={"predictedFieldStatus": "Healthy"},
        )
    )
    r2 = run_disease_research(
        DiseaseResearchRequest(
            analysisId="cache_cite_2",
            diseaseName="Tomato_Early_Blight",
            cropName="TOMATO",
            confidence=85.0,
            isHealthy=False,
            telemetryContext={"predictedFieldStatus": "Critical", "humidity": 89.0},
        )
    )
    assert r1.advisory is not None and r2.advisory is not None
    assert r1.advisory.escalationRequired is False
    assert r2.advisory.escalationRequired is True
    assert "bamis.gov.bd" not in r2.advisory.citedSourceDomains
    assert r2.advisory.actionableSteps[2].citationIds == ["doi:10.1000/eb.1", "extension.umn.edu"]
    clear_research_cache()


def test_advisory_low_confidence_and_insufficient_evidence_states():
    low_adv = synthesize_advisory(
        disease_name="Tomato_Early_Blight",
        crop_name="TOMATO",
        confidence=48.0,
        is_healthy=False,
        papers=_sample_papers(),
        sources=_sample_sources(),
        evidence_quality="MODERATE",
    )
    assert low_adv.advisoryStatus == "LOW_CONFIDENCE_CAUTION"
    assert low_adv.confidenceBand == "LOW"
    assert low_adv.escalationRequired is True

    insuff_adv = synthesize_advisory(
        disease_name="Unknown_Spot",
        crop_name="TOMATO",
        confidence=70.0,
        is_healthy=False,
        papers=[],
        sources=[],
        evidence_quality="INSUFFICIENT",
    )
    assert insuff_adv.advisoryStatus == "INSUFFICIENT_EVIDENCE"
    assert insuff_adv.severityLevel == "UNKNOWN"
    assert insuff_adv.escalationRequired is True


def test_advisory_healthy_monitoring():
    healthy_adv = synthesize_advisory(
        disease_name="Tomato_healthy",
        crop_name="TOMATO",
        confidence=94.0,
        is_healthy=True,
        papers=[],
        sources=[],
        evidence_quality="INSUFFICIENT",
    )
    assert healthy_adv.advisoryStatus == "HEALTHY_MONITORING"
    assert healthy_adv.severityLevel == "LOW"
    assert healthy_adv.escalationRequired is False
