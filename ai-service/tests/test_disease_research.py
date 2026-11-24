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
    monkeypatch.setattr(
        disease_research_service,
        "_run_selenium_google_search",
        lambda *_a, **_kw: ("BLOCKED", [], "GOOGLE_CAPTCHA_BLOCKED", "selenium@4.54.0", "chrome@158"),
    )
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
    assert res.errorCode == "GOOGLE_CAPTCHA_BLOCKED"
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
    monkeypatch.setattr(settings, "AI_SERVICE_KEY", "test-key")
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
    assert len(data["sources"]) == 1
    assert data["sources"][0]["domain"] == "irri.org"
