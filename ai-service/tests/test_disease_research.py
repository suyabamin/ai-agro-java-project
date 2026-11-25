from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.schemas.research import DiseaseResearchRequest, ResearchSource
from app.services import disease_research_service
from app.services.disease_research_service import (
    _is_google_blocked,
    _is_valid_external_url,
    build_bengali_report,
    build_google_queries,
    classify_domain_tier,
    run_disease_research,
)

client = TestClient(app)


def test_healthy_class_skips_selenium_search_without_fabricating_treatment(monkeypatch):
    def fail_if_called(*_args, **_kwargs):
        raise AssertionError("Selenium must not be called for healthy class")

    monkeypatch.setattr(disease_research_service, "_run_selenium_google_search", fail_if_called)
    res = run_disease_research(
        DiseaseResearchRequest(
            analysisId="analysis_h1",
            diseaseName="Tomato_healthy",
            cropName="TOMATO",
            confidence=91.5,
            isHealthy=True,
        )
    )
    assert res.researchStatus == "SKIPPED_HEALTHY"
    assert res.isHealthy is True
    assert res.sources == []
    assert res.bengaliReport is not None
    assert "সুস্থ" in res.bengaliReport.summaryBn


def test_captcha_block_returns_blocked_without_fabricating_sources(monkeypatch):
    from app.services.providers.base import ProviderOutcome
    from app.services.providers.openalex_provider import OpenAlexProvider
    from app.services.providers.semantic_scholar_provider import SemanticScholarProvider

    monkeypatch.setattr(
        disease_research_service,
        "_run_selenium_google_search",
        lambda *_a, **_kw: ("BLOCKED", [], "GOOGLE_CAPTCHA_BLOCKED", "selenium@4.54.0", "chrome@158"),
    )
    monkeypatch.setattr(
        OpenAlexProvider,
        "search",
        lambda *_a, **_kw: ProviderOutcome(provider="openalex", ok=False, reason="network_error"),
    )
    monkeypatch.setattr(
        SemanticScholarProvider,
        "search",
        lambda *_a, **_kw: ProviderOutcome(provider="semantic_scholar", ok=False, reason="network_error"),
    )
    monkeypatch.setattr(settings, "TAVILY_API_KEY", "")
    res = run_disease_research(
        DiseaseResearchRequest(
            analysisId="analysis_b1",
            diseaseName="Tomato_Early_Blight",
            cropName="TOMATO",
            confidence=75.0,
            isHealthy=False,
        )
    )
    assert res.researchStatus == "BLOCKED"
    assert res.errorCode == "GOOGLE_CAPTCHA_BLOCKED+TAVILY_MISSING_API_KEY"
    assert res.fallbackUsed is True
    assert res.searchProvidersAttempted == ["google_selenium", "tavily"]
    assert res.sources == []
    assert res.bengaliReport is None


def test_completed_research_preserves_sources_and_adds_low_confidence_warning():
    sources = [
        ResearchSource(
            title="BARI Tomato Early Blight Guide",
            url="https://bari.gov.bd/tomato-early-blight",
            domain="bari.gov.bd",
            snippet="Early blight causes dark concentric rings on lower leaves.",
            authoritativeTier="BANGLADESH_GOV_RESEARCH",
            retrievedAt="2026-11-25T00:00:00Z",
        )
    ]
    report = build_bengali_report("Tomato_Early_Blight", "TOMATO", 42.3, False, sources)
    assert "42.3%" in report.summaryBn
    assert "bari.gov.bd" in report.symptomsBn
    assert "কীটনাশক" in report.cautionBn


def test_domain_classification_query_building_and_block_detection():
    queries = build_google_queries("Rice_Blast", "RICE")
    assert len(queries) == 2
    assert "DAE BARI BRRI" in queries[0]

    assert classify_domain_tier("https://dae.gov.bd/rice-blast") == ("dae.gov.bd", "BANGLADESH_GOV_RESEARCH")
    assert classify_domain_tier("https://www.irri.org/rice-blast") == ("irri.org", "INTERNATIONAL_AGRI")
    assert _is_valid_external_url("https://www.google.com/url?q=x") is False
    assert _is_valid_external_url("https://fao.org/doc") is True
    assert _is_google_blocked("https://www.google.com/sorry/index?continue=x", "<html></html>") is True


def test_research_endpoint_requires_backend_key_and_runs_with_mocked_selenium(monkeypatch):
    from app.services.providers.base import ProviderOutcome
    from app.services.providers.openalex_provider import OpenAlexProvider
    from app.services.providers.semantic_scholar_provider import SemanticScholarProvider

    disease_research_service.clear_research_cache()
    monkeypatch.setattr(settings, "AI_SERVICE_KEY", "test-key")
    monkeypatch.setattr(
        OpenAlexProvider,
        "search",
        lambda *_a, **_kw: ProviderOutcome(provider="openalex", ok=False, reason="zero_results"),
    )
    monkeypatch.setattr(
        SemanticScholarProvider,
        "search",
        lambda *_a, **_kw: ProviderOutcome(provider="semantic_scholar", ok=False, reason="zero_results"),
    )
    unauth = client.post(
        "/api/v1/research/disease",
        json={"analysisId": "a1", "diseaseName": "Rice_Blast"},
    )
    assert unauth.status_code == 401

    monkeypatch.setattr(
        disease_research_service,
        "_run_selenium_google_search",
        lambda *_a, **_kw: (
            "COMPLETED",
            [
                ResearchSource(
                    title="IRRI Rice Blast",
                    url="https://irri.org/rice-blast",
                    domain="irri.org",
                    snippet="Diamond-shaped lesions on rice leaves.",
                    authoritativeTier="INTERNATIONAL_AGRI",
                    retrievedAt="2026-11-25T00:00:00Z",
                )
            ],
            None,
            "selenium@4.54.0",
            "chrome@158",
        ),
    )
    ok = client.post(
        "/api/v1/research/disease",
        headers={"X-AI-Service-Key": "test-key"},
        json={"analysisId": "a1", "diseaseName": "Rice_Blast", "cropName": "RICE", "confidence": 82.0, "isHealthy": False},
    )
    assert ok.status_code == 200
    data = ok.json()
    assert data["researchStatus"] == "COMPLETED"
    assert data["successfulProvider"] == "google_selenium"
    assert data["fallbackUsed"] is False
    assert any(s["domain"] == "irri.org" for s in data["sources"])


def test_tavily_fallback_succeeds_when_selenium_captcha_blocks(monkeypatch):
    from app.services.providers.base import ProviderOutcome
    from app.services.providers.openalex_provider import OpenAlexProvider
    from app.services.providers.semantic_scholar_provider import SemanticScholarProvider
    from app.services.tavily_search_provider import TavilySearchOutcome, TavilySearchProvider

    disease_research_service.clear_research_cache()
    monkeypatch.setattr(
        OpenAlexProvider,
        "search",
        lambda *_a, **_kw: ProviderOutcome(provider="openalex", ok=False, reason="zero_results"),
    )
    monkeypatch.setattr(
        SemanticScholarProvider,
        "search",
        lambda *_a, **_kw: ProviderOutcome(provider="semantic_scholar", ok=False, reason="zero_results"),
    )

    monkeypatch.setattr(
        disease_research_service,
        "_run_selenium_google_search",
        lambda *_a, **_kw: ("BLOCKED", [], "GOOGLE_CAPTCHA_BLOCKED", "selenium@4.54.0", "chrome@158"),
    )

    def fake_tavily_search(self, queries, max_results=6, domain_classifier=None):
        assert len(queries) == 2
        return TavilySearchOutcome(
            ok=True,
            reason="ok",
            sources=[
                ResearchSource(
                    title="BARI Tomato Early Blight Management",
                    url="https://bari.gov.bd/tomato-early-blight",
                    domain="bari.gov.bd",
                    snippet="Early blight symptoms include dark concentric rings on older leaves.",
                    authoritativeTier="BANGLADESH_GOV_RESEARCH",
                    retrievedAt="2026-11-25T00:00:00Z",
                    provider="tavily",
                ),
                ResearchSource(
                    title="FAO Integrated Pest Management",
                    url="https://fao.org/ipm-tomato",
                    domain="fao.org",
                    snippet="Remove infected lower leaves and maintain spacing.",
                    authoritativeTier="INTERNATIONAL_AGRI",
                    retrievedAt="2026-11-25T00:00:00Z",
                    provider="tavily",
                ),
            ],
        )

    monkeypatch.setattr(TavilySearchProvider, "search", fake_tavily_search)

    res = run_disease_research(
        DiseaseResearchRequest(
            analysisId="analysis_tavily_1",
            diseaseName="Tomato_Early_Blight",
            cropName="TOMATO",
            confidence=79.5,
            isHealthy=False,
        )
    )
    assert res.researchStatus == "COMPLETED"
    assert res.searchProvidersAttempted == ["google_selenium", "tavily"]
    assert res.successfulProvider == "tavily"
    assert res.fallbackUsed is True
    assert res.fallbackReason == "GOOGLE_CAPTCHA_BLOCKED"
    assert res.validatedSourceCount >= 2
    assert res.bengaliReport is not None
    assert res.bengaliReport.overviewBn is not None
    assert res.bengaliReport.causesBn is not None
    assert res.bengaliReport.immediateActionBn is not None
    assert res.bengaliReport.whenToConsultBn is not None
    assert "bari.gov.bd" in (res.bengaliReport.referencesBn or "")


def test_tavily_provider_handles_401_and_never_leaks_api_key(monkeypatch):
    import httpx
    from app.services.tavily_search_provider import TavilySearchProvider

    secret_val = "tvly-test-super-secret-do-not-leak"

    class FakeResp:
        status_code = 401

        def json(self):
            return {"detail": "Unauthorized"}

    class FakeClient:
        def __init__(self, *a, **kw):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def post(self, url, json=None):
            assert json["api_key"] == secret_val
            return FakeResp()

    monkeypatch.setattr(httpx, "Client", FakeClient)
    provider = TavilySearchProvider(api_key=secret_val)
    outcome = provider.search(["Tomato Early Blight BARI"], max_results=5)
    assert outcome.ok is False
    assert outcome.reason == "invalid_api_key"
    assert secret_val not in (outcome.error_message or "")


def test_tavily_zero_results_returns_insufficient_evidence(monkeypatch):
    from app.services.providers.base import ProviderOutcome
    from app.services.providers.openalex_provider import OpenAlexProvider
    from app.services.providers.semantic_scholar_provider import SemanticScholarProvider
    from app.services.tavily_search_provider import TavilySearchOutcome, TavilySearchProvider

    monkeypatch.setattr(
        disease_research_service,
        "_run_selenium_google_search",
        lambda *_a, **_kw: ("FAILED", [], "NO_SEARCH_RESULTS", "selenium@4.54.0", "chrome@158"),
    )
    monkeypatch.setattr(
        OpenAlexProvider,
        "search",
        lambda *_a, **_kw: ProviderOutcome(provider="openalex", ok=False, reason="zero_results"),
    )
    monkeypatch.setattr(
        SemanticScholarProvider,
        "search",
        lambda *_a, **_kw: ProviderOutcome(provider="semantic_scholar", ok=False, reason="zero_results"),
    )
    monkeypatch.setattr(
        TavilySearchProvider,
        "search",
        lambda self, queries, max_results=6, domain_classifier=None: TavilySearchOutcome(
            ok=False, reason="zero_results", sources=[]
        ),
    )

    res = run_disease_research(
        DiseaseResearchRequest(
            analysisId="analysis_insuff_1",
            diseaseName="Unknown_Leaf_Spot",
            cropName="TOMATO",
            confidence=60.0,
            isHealthy=False,
        )
    )
    assert res.researchStatus == "INSUFFICIENT_EVIDENCE"
    assert res.fallbackUsed is True
    assert res.successfulProvider is None
    assert res.bengaliReport is not None
    assert "INSUFFICIENT_EVIDENCE" in res.bengaliReport.evidenceNoticeBn
