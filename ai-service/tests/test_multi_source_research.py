import httpx
import pytest

from app.core.config import settings
from app.schemas.research import DiseaseResearchRequest, ResearchPaper
from app.services import disease_research_service
from app.services.disease_research_service import (
    _deduplicate_and_rank_papers,
    clear_research_cache,
    run_disease_research,
)
from app.services.providers.bangladesh_agri_provider import BangladeshAgriProvider
from app.services.providers.base import ProviderOutcome
from app.services.providers.crossref_provider import CrossrefProvider
from app.services.providers.openalex_provider import OpenAlexProvider, reconstruct_openalex_abstract
from app.services.providers.semantic_scholar_provider import SemanticScholarProvider


@pytest.fixture(autouse=True)
def _clean_cache():
    clear_research_cache()
    yield
    clear_research_cache()


def test_openalex_successful_response_and_abstract_reconstruction(monkeypatch):
    class FakeResp:
        status_code = 200
        headers = {}

        def json(self):
            return {
                "results": [
                    {
                        "id": "https://openalex.org/W12345",
                        "title": "Management of Tomato Early Blight in South Asia",
                        "doi": "https://doi.org/10.1000/tomato.2024.01",
                        "publication_year": 2024,
                        "cited_by_count": 18,
                        "authorships": [{"author": {"display_name": "A. Rahman"}}],
                        "primary_location": {
                            "landing_page_url": "https://bari.gov.bd/papers/tomato-blight",
                            "source": {"display_name": "Bangladesh Journal of Agricultural Research"},
                        },
                        "open_access": {"is_oa": True, "oa_url": "https://bari.gov.bd/papers/tomato-blight.pdf"},
                        "abstract_inverted_index": {"Alternaria": [0], "solani": [1], "causes": [2], "early": [3], "blight.": [4]},
                    }
                ]
            }

    class FakeClient:
        def __init__(self, *a, **kw):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def get(self, url, params=None, headers=None):
            return FakeResp()

    monkeypatch.setattr(httpx, "Client", FakeClient)
    out = OpenAlexProvider(email="research@example.org").search("Tomato Early Blight", max_results=5)
    assert out.ok is True
    assert len(out.papers) == 1
    p = out.papers[0]
    assert p.doi == "10.1000/tomato.2024.01"
    assert p.abstract == "Alternaria solani causes early blight."
    assert p.authoritativeTier == "BANGLADESH_GOV_RESEARCH"
    assert p.scientificEvidenceAssessed is False
    assert p.doiVerificationStatus == "UNVERIFIED"


def test_openalex_empty_results_and_timeout(monkeypatch):
    class EmptyResp:
        status_code = 200
        headers = {}

        def json(self):
            return {"results": []}

    class EmptyClient:
        def __init__(self, *a, **kw):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def get(self, *a, **kw):
            return EmptyResp()

    monkeypatch.setattr(httpx, "Client", EmptyClient)
    empty_out = OpenAlexProvider().search("Rare Unknown Crop Disease")
    assert empty_out.ok is False
    assert empty_out.reason == "zero_results"

    class TimeoutClient(EmptyClient):
        def get(self, *a, **kw):
            raise httpx.TimeoutException("timed out")

    monkeypatch.setattr(httpx, "Client", TimeoutClient)
    to_out = OpenAlexProvider().search("Tomato Early Blight")
    assert to_out.ok is False
    assert to_out.reason == "timeout"


def test_crossref_doi_match_mismatch_and_not_found(monkeypatch):
    def make_paper(year=2024, title="Management of Tomato Early Blight"):
        return ResearchPaper(
            paperId="doi:10.1000/test.1",
            title=title,
            authors=[],
            publicationYear=year,
            doi="10.1000/test.1",
            url="https://doi.org/10.1000/test.1",
            domain="doi.org",
            sourceProvider="openalex",
            authoritativeTier="ACADEMIC",
            retrievedAt="2026-11-26T00:00:00Z",
        )

    class MatchResp:
        status_code = 200
        headers = {}

        def json(self):
            return {
                "message": {
                    "title": ["Management of Tomato Early Blight"],
                    "container-title": ["Plant Pathology Journal"],
                    "author": [{"given": "S.", "family": "Karim"}],
                    "published-print": {"date-parts": [[2024, 5]]},
                }
            }

    class FakeClient:
        resp = MatchResp()

        def __init__(self, *a, **kw):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def get(self, *a, **kw):
            return self.resp

    monkeypatch.setattr(httpx, "Client", FakeClient)
    p1 = make_paper()
    ok, reason = CrossrefProvider().verify_and_enrich(p1)
    assert ok is True and reason == "verified_match"
    assert p1.doiVerificationStatus == "VERIFIED_MATCH"
    assert p1.metadataValidated is True
    assert p1.journal == "Plant Pathology Journal"
    assert p1.authors == ["S. Karim"]
    assert p1.scientificEvidenceAssessed is False

    # Title mismatch
    p2 = make_paper(title="Completely Unrelated Quantum Mechanics Paper")
    ok2, reason2 = CrossrefProvider().verify_and_enrich(p2)
    assert ok2 is True and reason2 == "metadata_mismatch"
    assert p2.doiVerificationStatus == "METADATA_MISMATCH"
    assert p2.metadataValidated is False

    # 404 DOI not found
    class NotFoundResp:
        status_code = 404
        headers = {}

    FakeClient.resp = NotFoundResp()
    p3 = make_paper()
    ok3, reason3 = CrossrefProvider().verify_and_enrich(p3)
    assert ok3 is True and reason3 == "doi_not_found"
    assert p3.doiVerificationStatus == "DOI_NOT_FOUND"


def test_semantic_scholar_success_rate_limit_and_malformed_json(monkeypatch):
    class OkResp:
        status_code = 200
        headers = {}

        def json(self):
            return {
                "data": [
                    {
                        "paperId": "s2abc",
                        "title": "Rice Blast Management Strategies",
                        "abstract": "Integrated management of Magnaporthe oryzae in rice.",
                        "year": 2023,
                        "citationCount": 12,
                        "isOpenAccess": True,
                        "venue": "IRRI Monograph",
                        "url": "https://irri.org/rice-blast-2023",
                        "externalIds": {"DOI": "10.1000/irri.2023"},
                        "authors": [{"name": "M. Islam"}],
                    }
                ]
            }

    class FakeClient:
        resp = OkResp()

        def __init__(self, *a, **kw):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def get(self, *a, **kw):
            return self.resp

    monkeypatch.setattr(httpx, "Client", FakeClient)
    out = SemanticScholarProvider(api_key="dummy-s2-key").search("Rice Blast")
    assert out.ok is True
    assert len(out.papers) == 1
    assert out.papers[0].doi == "10.1000/irri.2023"

    class RateLimitResp:
        status_code = 429
        headers = {"Retry-After": "0.1"}

    FakeClient.resp = RateLimitResp()
    rl_out = SemanticScholarProvider().search("Rice Blast")
    assert rl_out.ok is False
    assert rl_out.reason == "rate_limited"

    class BadJsonResp:
        status_code = 200
        headers = {}

        def json(self):
            raise ValueError("bad json")

    FakeClient.resp = BadJsonResp()
    bad_out = SemanticScholarProvider().search("Rice Blast")
    assert bad_out.ok is False
    assert bad_out.reason == "invalid_response"


def test_deduplication_and_evidence_ranking():
    p_oa = ResearchPaper(
        paperId="doi:10.1000/same",
        title="Early Blight Control in Tomato",
        authors=["A. Roy"],
        publicationYear=2024,
        doi="10.1000/same",
        abstract="Tomato early blight management reduces foliar loss.",
        url="https://bari.gov.bd/early-blight",
        domain="bari.gov.bd",
        sourceProvider="openalex",
        authoritativeTier="BANGLADESH_GOV_RESEARCH",
        metadataValidated=True,
        sourceIdentityVerified=True,
        doiVerificationStatus="VERIFIED_MATCH",
        retrievedAt="2026-11-26T00:00:00Z",
    )
    p_s2_dup = ResearchPaper(
        paperId="doi:10.1000/same",
        title="Early Blight Control in Tomato",
        authors=["A. Roy"],
        publicationYear=2024,
        doi="10.1000/same",
        url="https://semanticscholar.org/paper/123",
        domain="semanticscholar.org",
        citationCount=40,
        sourceProvider="semantic_scholar",
        authoritativeTier="ACADEMIC",
        metadataValidated=True,
        sourceIdentityVerified=True,
        retrievedAt="2026-11-26T00:00:00Z",
    )
    p_other = ResearchPaper(
        paperId="s2:other",
        title="Unrelated Soil Study",
        authors=[],
        publicationYear=2012,
        doi=None,
        url="https://example.org/soil",
        domain="example.org",
        sourceProvider="semantic_scholar",
        authoritativeTier="GENERAL",
        metadataValidated=False,
        retrievedAt="2026-11-26T00:00:00Z",
    )
    ranked, dup_count = _deduplicate_and_rank_papers(
        [p_other, p_oa, p_s2_dup], "Tomato_Early_Blight", "TOMATO", max_results=5
    )
    assert dup_count == 1
    assert len(ranked) == 2
    assert ranked[0].paperId == "doi:10.1000/same"
    assert "semantic_scholar" in ranked[0].additionalProviders
    assert ranked[0].evidenceRank == 1


def test_orchestrator_partial_provider_failure_and_bamis_status(monkeypatch):
    monkeypatch.setattr(
        disease_research_service,
        "_run_selenium_google_search",
        lambda *_a, **_kw: ("BLOCKED", [], "GOOGLE_CAPTCHA_BLOCKED", "selenium@4.54.0", "chrome@158"),
    )
    monkeypatch.setattr(settings, "TAVILY_API_KEY", "")

    oa_paper = ResearchPaper(
        paperId="doi:10.1000/oa1",
        title="Tomato Early Blight Integrated Management",
        authors=["R. Begum"],
        publicationYear=2024,
        doi="10.1000/oa1",
        abstract="Tomato early blight foliar disease control.",
        url="https://bari.gov.bd/tomato-blight",
        domain="bari.gov.bd",
        sourceProvider="openalex",
        authoritativeTier="BANGLADESH_GOV_RESEARCH",
        metadataValidated=True,
        sourceIdentityVerified=True,
        doiVerificationStatus="UNVERIFIED",
        retrievedAt="2026-11-26T00:00:00Z",
    )
    monkeypatch.setattr(
        OpenAlexProvider,
        "search",
        lambda self, query, max_results=5: ProviderOutcome(
            provider="openalex", ok=True, reason="ok", papers=[oa_paper], sources=[]
        ),
    )
    monkeypatch.setattr(
        SemanticScholarProvider,
        "search",
        lambda self, query, max_results=5: ProviderOutcome(
            provider="semantic_scholar", ok=False, reason="timeout", error_message="timed out"
        ),
    )
    monkeypatch.setattr(
        CrossrefProvider,
        "verify_and_enrich",
        lambda self, paper: (True, "verified_match") if setattr(paper, "doiVerificationStatus", "VERIFIED_MATCH") is None else (True, "verified_match"),
    )

    res = run_disease_research(
        DiseaseResearchRequest(
            analysisId="m1_partial_1",
            diseaseName="Tomato_Early_Blight",
            cropName="TOMATO",
            confidence=88.0,
            isHealthy=False,
        )
    )
    assert res.researchStatus == "COMPLETED"
    assert "openalex" in res.successfulProviders
    assert "semantic_scholar" in res.failedProviders
    assert res.providerFailureReasons.get("semantic_scholar") == "timeout"
    assert res.bamisStatus.get("bamisApiAvailable") is False
    assert res.bamisStatus.get("scrapingPerformed") is False
    assert len(res.researchPapers) == 1


def test_bangladesh_agri_provider_never_fabricates_api():
    out = BangladeshAgriProvider().get_references("TOMATO")
    assert out.ok is True
    assert out.metadata["bamisStatus"]["bamisApiAvailable"] is False
    assert out.metadata["bamisStatus"]["scrapingPerformed"] is False
    assert any(s.domain == "bamis.gov.bd" for s in out.sources)
    assert reconstruct_openalex_abstract(None) is None
