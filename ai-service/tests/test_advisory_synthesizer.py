from app.schemas.research import ResearchPaper, ResearchSource
from app.services.advisory_synthesizer import (
    synthesize_advisory,
    synthesize_evidence_bengali_report,
)


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
                "Spores spread via rain splash and wind. Field sanitation and Trichoderma biocontrol reduce disease severity."
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


def test_evidence_bengali_report_cites_retrieved_abstracts_without_fabricating_chemicals():
    report = synthesize_evidence_bengali_report(
        disease_name="Tomato_Early_Blight",
        crop_name="TOMATO",
        confidence=88.0,
        is_healthy=False,
        papers=_sample_papers(),
        sources=_sample_sources(),
        evidence_quality="HIGH",
    )
    assert "HIGH" in report.summaryBn
    assert "doi:10.1000/eb.1" in report.symptomsBn
    assert "Alternaria solani" in report.causesBn
    assert "extension.umn.edu" in (report.referencesBn or "")
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
    assert "doi:10.1000/eb.1" in adv.citedPaperIds


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
