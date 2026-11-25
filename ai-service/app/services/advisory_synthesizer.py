from __future__ import annotations

import re
from typing import Any

from app.schemas.research import (
    AdvisoryActionItem,
    AdvisoryPayload,
    BengaliResearchReport,
    ResearchPaper,
    ResearchSource,
)

_SYMPTOM_KW = ("symptom", "lesion", "spot", "blight", "ring", "necrosis", "chlorosis", "mosaic", "wilt", "rot", "pustule")
_CAUSE_KW = ("fungus", "fungi", "bacteria", "virus", "oomycete", "alternaria", "phytophthora", "pathogen", "causal", "caused by", "humidity", "moisture")
_SPREAD_KW = ("spread", "disseminat", "wind", "rain", "splash", "soil", "seed", "vector", "insect", "water", "debris")
_MGMT_KW = ("control", "manage", "management", "treatment", "biocontrol", "trichoderma", "pseudomonas", "resistant", "sanitation", "pruning", "cultural", "ipm")

# Step-specific claim-matching keywords (must match actual abstract/snippet content, never title/DOI/portal alone)
_STEP_ISOLATE_KW = (
    "remove", "removing", "prune", "pruning", "isolate", "isolating",
    "rogue", "roguing", "destroy", "infected leaves", "infected foliage",
    "affected leaves", "symptomatic", "scout", "scouting", "inspect", "sanitation",
)
_STEP_MANAGEMENT_KW = (
    "management", "manage", "control", "treatment", "biocontrol",
    "integrated pest", "ipm", "fungicide", "bactericide", "resistant",
    "cultivar", "variety", "trichoderma", "pseudomonas", "bioagent", "botanical",
)
_STEP_PREVENTIVE_KW = (
    "overhead", "irrigation", "watering", "airflow", "air circulation",
    "spacing", "canopy", "drainage", "debris", "residue", "crop rotation",
    "rotation", "disease-free seed", "clean seed", "mulch", "mulching", "hygiene", "sanitation",
)


def _eligible_evidence_candidates(
    papers: list[ResearchPaper],
    sources: list[ResearchSource],
) -> list[tuple[str, str]]:
    """Return (citation_id, evidence_text) pairs from sources with actual abstracts/snippets.

    Excludes generic portal-only references (bangladesh_agri_official) unless extractedSummary exists,
    and excludes papers missing abstracts (DOI/title alone never qualifies as claim support).
    """
    candidates: list[tuple[str, str]] = []
    for p in papers:
        abstract = (p.abstract or "").strip()
        if len(abstract) >= 25:
            cite = p.paperId or (f"doi:{p.doi}" if p.doi else p.domain)
            candidates.append((cite, abstract))
    for s in sources:
        if s.provider == "bangladesh_agri_official" and not (s.extractedSummary or "").strip():
            continue
        text = (s.extractedSummary or s.snippet or "").strip()
        if len(text) >= 25:
            candidates.append((s.domain, text))
    return candidates


def _match_citations_for_claim(
    papers: list[ResearchPaper],
    sources: list[ResearchSource],
    claim_keywords: tuple[str, ...],
    limit: int = 3,
) -> list[str]:
    """Deterministically attach citations ONLY when retrieved text explicitly supports the claim."""
    pattern = re.compile(
        r"\b(?:" + "|".join(re.escape(kw) for kw in claim_keywords) + r")\b",
        flags=re.IGNORECASE,
    )
    matched: list[str] = []
    seen: set[str] = set()
    for cite, text in _eligible_evidence_candidates(papers, sources):
        sentences = re.split(r"(?<=[.!?])\s+", text)
        for sent in sentences:
            if len(sent) < 20:
                continue
            if pattern.search(sent):
                if cite not in seen:
                    seen.add(cite)
                    matched.append(cite)
                break
        if len(matched) >= limit:
            break
    return matched


def _extract_matching_snippets(
    papers: list[ResearchPaper],
    sources: list[ResearchSource],
    keywords: tuple[str, ...],
    limit: int = 2,
) -> list[tuple[str, str]]:
    """Extract concise grounded text snippets matching theme keywords with citation tag."""
    matches: list[tuple[str, str]] = []
    seen_text: set[str] = set()

    candidates: list[tuple[str, str]] = []
    for p in papers:
        if p.abstract:
            cite = f"doi:{p.doi}" if p.doi else p.paperId
            candidates.append((cite, p.abstract))
    for s in sources:
        if s.provider == "bangladesh_agri_official":
            continue
        text = s.extractedSummary or s.snippet
        if text:
            candidates.append((s.domain, text))

    for cite, text in candidates:
        sentences = re.split(r"(?<=[.!?])\s+", text.strip())
        for sent in sentences:
            low = sent.lower()
            if len(sent) < 25:
                continue
            if any(k in low for k in keywords):
                norm = re.sub(r"\s+", " ", sent).strip()[:240]
                if norm not in seen_text:
                    seen_text.add(norm)
                    matches.append((cite, norm))
                    break
        if len(matches) >= limit:
            break
    return matches


def _confidence_band(confidence: float | None) -> str:
    if confidence is None:
        return "UNKNOWN"
    if confidence >= 80.0:
        return "HIGH"
    if confidence >= 60.0:
        return "MODERATE"
    return "LOW"


def _telemetry_notes(
    telemetry_ctx: dict[str, Any] | None,
    is_healthy: bool,
) -> tuple[list[str], bool]:
    """Correlate observed field telemetry/tabular status with disease advisory without fabricating."""
    if not isinstance(telemetry_ctx, dict) or not telemetry_ctx:
        return [], False

    notes: list[str] = []
    critical_flag = False

    field_status = str(telemetry_ctx.get("predictedFieldStatus") or "").strip()
    water_need = str(telemetry_ctx.get("predictedWaterNeed") or "").strip()
    moisture = telemetry_ctx.get("soilMoisture")
    humidity = telemetry_ctx.get("humidity")
    ph = telemetry_ctx.get("soilPh")

    if field_status:
        notes.append(f"Latest tabular field agronomic status: {field_status}.")
        if field_status.lower() == "critical":
            critical_flag = True
    if water_need:
        notes.append(
            f"Tabular Water Need is '{water_need}'; avoid overhead leaf wetting when foliar disease is suspected."
            if not is_healthy
            else f"Tabular Water Need is '{water_need}'; maintain scheduled irrigation."
        )
    if isinstance(humidity, (int, float)) and humidity >= 80:
        notes.append(f"Observed high air humidity ({humidity:.1f}%) favors foliar fungal/bacterial spread; prioritize canopy airflow.")
    if isinstance(moisture, (int, float)):
        if moisture >= 75:
            notes.append(f"High soil moisture ({moisture:.1f}%) observed; avoid excess irrigation and check field drainage.")
        elif moisture <= 25:
            notes.append(f"Low soil moisture ({moisture:.1f}%) observed; moisture stress can worsen plant susceptibility.")
    if isinstance(ph, (int, float)) and (ph < 5.5 or ph > 7.8):
        notes.append(f"Soil pH ({ph:.2f}) is outside typical 5.5-7.8 range; verify nutrient uptake before foliar sprays.")

    return notes, critical_flag


def synthesize_evidence_bengali_report(
    *,
    disease_name: str,
    crop_name: str,
    confidence: float | None,
    is_healthy: bool,
    papers: list[ResearchPaper],
    sources: list[ResearchSource],
    evidence_quality: str,
) -> BengaliResearchReport:
    readable = disease_name.replace("_", " ").strip()
    low_conf = confidence is not None and confidence < 60.0
    conf_note = (
        f" সতর্কতা: মডেলের আত্মবিশ্বাসের হার কম ({confidence:.1f}%) — মাঠে যাচাই জরুরি।"
        if low_conf and confidence is not None
        else ""
    )

    if is_healthy:
        return BengaliResearchReport(
            summaryBn=f"{crop_name} ফসলের নমুনাটি সুস্থ হিসেবে চিহ্নিত হয়েছে ({readable})। এই মুহূর্তে কোনো রোগের চিকিৎসার প্রয়োজন নেই।",
            overviewBn=f"{crop_name} ফসলের পাতায় সক্রিয় রোগের চিহ্ন পাওয়া যায়নি।",
            symptomsBn="সক্রিয় রোগের কোনো লক্ষণ শনাক্ত হয়নি।",
            causesBn="বর্তমানে কোনো রোগের জীবাণুজনিত কারণ প্রযোজ্য নয়।",
            spreadBn="রোগ না থাকায় ছড়ানোর ঝুঁকি কম; তবুও নিয়মিত পর্যবেক্ষণ করুন।",
            damageBn="কোনো রোগজনিত ক্ষতির আশঙ্কা এই মুহূর্তে শনাক্ত হয়নি।",
            immediateActionBn="নিয়মিত সেচ, সুষম সার এবং আগাছা পরিষ্কার রাখুন।",
            managementBn="নিয়মিত সেচ, সুষম সার এবং জমি পরিচ্ছন্ন রাখুন।",
            preventionBn="আগাম সতর্কতার জন্য সপ্তাহে অন্তত একবার জমির পাতা পর্যবেক্ষণ করুন।",
            whenToConsultBn="হঠাৎ পাতায় দাগ, পচন বা বিবর্ণতা দেখা দিলে কৃষি কর্মকর্তার পরামর্শ নিন।",
            referencesBn="সুস্থ শ্রেণি হওয়ায় বাহ্যিক রোগ-অনুসন্ধান প্রয়োজন হয়নি।",
            cautionBn="এই ফলাফলটি AI-ভিত্তিক প্রাথমিক মূল্যায়ন মাত্র; সন্দেহ হলে কৃষি কর্মকর্তার পরামর্শ নিন।",
            evidenceNoticeBn="সুস্থ শ্রেণি হওয়ায় কোনো রাসায়নিক বা রোগ ব্যবস্থাপনা সুপারিশ করা হয়নি।",
        )

    non_portal_sources = [s for s in sources if s.provider != "bangladesh_agri_official"]
    if not papers and not non_portal_sources:
        return BengaliResearchReport(
            summaryBn=f"{crop_name} ফসলে '{readable}' সম্পর্কে পর্যাপ্ত যাচাইকৃত তথ্য পাওয়া যায়নি।{conf_note}",
            overviewBn=f"{crop_name} ফসলের '{readable}' সংক্রান্ত নির্ভরযোগ্য তথ্য সংগ্রহে পর্যাপ্ত প্রমাণ পাওয়া যায়নি।",
            symptomsBn="পর্যাপ্ত যাচাইকৃত উৎস না থাকায় নির্দিষ্ট লক্ষণ তালিকাভুক্ত করা হয়নি।",
            causesBn="সঠিক কারণ নির্ণয়ের জন্য নমুনাটি স্থানীয় কৃষি অফিসে পরীক্ষা করুন।",
            spreadBn="রোগ ছড়ানোর ঝুঁকি এড়াতে আক্রান্ত গাছ আলাদা পর্যবেক্ষণে রাখুন।",
            damageBn="সঠিক তথ্য ছাড়া ক্ষতির মাত্রা অনুমান করা সম্ভব নয়।",
            immediateActionBn="আক্রান্ত পাতা সুস্থ গাছ থেকে আলাদা রাখুন এবং স্থানীয় কৃষি কর্মকর্তার সাথে যোগাযোগ করুন।",
            preventionBn="জমি পরিচ্ছন্ন রাখুন, সুষম সেচ দিন এবং রোগমুক্ত বীজ ব্যবহার করুন।",
            managementBn="নির্ভরযোগ্য কৃষিবিদের পরামর্শ ছাড়া কোনো রাসায়নিক বা কীটনাশক প্রয়োগ করবেন না।",
            whenToConsultBn="উপসর্গ দ্রুত ছড়ালে অবিলম্বে উপজেলা কৃষি কর্মকর্তা বা DAE-এর পরামর্শ নিন।",
            referencesBn="কোনো যাচাইকৃত তথ্যসূত্র পাওয়া যায়নি।",
            cautionBn="প্রমাণ অপ্রতুল থাকায় কোনো অনুমানভিত্তিক চিকিৎসা দেওয়া হয়নি।",
            evidenceNoticeBn="INSUFFICIENT_EVIDENCE: যাচাইকৃত উৎস না থাকায় কোনো ব্র্যান্ড বা মাত্রা সুপারিশ করা হয়নি।",
        )

    sym_hits = _extract_matching_snippets(papers, non_portal_sources, _SYMPTOM_KW, limit=2)
    cause_hits = _extract_matching_snippets(papers, non_portal_sources, _CAUSE_KW, limit=2)
    spread_hits = _extract_matching_snippets(papers, non_portal_sources, _SPREAD_KW, limit=2)
    mgmt_hits = _extract_matching_snippets(papers, non_portal_sources, _MGMT_KW, limit=2)

    def _fmt_hits(hits: list[tuple[str, str]], fallback: str) -> str:
        if not hits:
            return fallback
        return " | ".join(f"[{cite}] {txt}" for cite, txt in hits)

    ref_items: list[str] = []
    for cite, _txt in sym_hits + cause_hits + spread_hits + mgmt_hits:
        if cite not in ref_items:
            ref_items.append(cite)
    ref_list = ", ".join(f"[{i}] {r}" for i, r in enumerate(ref_items, start=1))

    return BengaliResearchReport(
        summaryBn=(
            f"{crop_name} ফসলে '{readable}' সংক্রান্ত তথ্য {len(papers)}টি গবেষণাপত্র ও "
            f"{len(non_portal_sources)}টি কৃষি উৎস থেকে সংগ্রহ করা হয়েছে (প্রমাণের মান: {evidence_quality})।{conf_note}"
        ),
        overviewBn=f"{crop_name} ফসলের '{readable}' একটি শনাক্তকৃত রোগ/অবস্থা, যা সংগৃহীত গবেষণাপত্র ও কৃষি সম্প্রসারণ উৎসে আলোচিত হয়েছে।{conf_note}",
        symptomsBn=_fmt_hits(
            sym_hits,
            "সংগৃহীত উৎসের সারাংশে সুনির্দিষ্ট লক্ষণ আলাদাভাবে পাওয়া যায়নি; মূল উৎস লিংক দেখুন।",
        ),
        causesBn=_fmt_hits(
            cause_hits,
            "সংগৃহীত গবেষণাপত্রে জীবাণু ও পরিবেশগত কারণের উল্লেখ রয়েছে; সুনির্দিষ্ট কারণ জানতে মূল প্রতিবেদন দেখুন।",
        ),
        spreadBn=_fmt_hits(
            spread_hits,
            "সংগৃহীত উৎসে রোগ ছড়ানোর মাধ্যম সম্পর্কিত বিস্তারিত তথ্য সীমিত; আক্রান্ত অংশ আলাদা রাখুন।",
        ),
        damageBn="সময়মতো ব্যবস্থা না নিলে পাতার সালোকসংশ্লেষণ কমে ফলন ও ফসলের গুণমান হ্রাস পেতে পারে।",
        immediateActionBn="আক্রান্ত পাতা সাবধানে আলাদা করুন, অতিরিক্ত আর্দ্রতা বা পাতায় সরাসরি পানি ছিটানো এড়িয়ে চলুন এবং নমুনা সংরক্ষণ করুন।",
        managementBn=_fmt_hits(
            mgmt_hits,
            "সঠিক মাত্রা ও করণীয় নির্ধারণে স্থানীয় কৃষি সম্প্রসারণ অধিদপ্তর (DAE) বা BARI/BRRI-এর অনুমোদিত নির্দেশিকা অনুসরণ করুন।",
        ),
        preventionBn="রোগমুক্ত বীজ/চারা ব্যবহার, আক্রান্ত অবশিষ্টাংশ অপসারণ, সুষম সেচ ও ফসল পর্যায় অনুসরণ প্রতিরোধে সহায়ক।",
        whenToConsultBn="রোগ দ্রুত ছড়িয়ে পড়লে, আত্মবিশ্বাস ৬০%-এর কম হলে বা রাসায়নিক প্রয়োগের আগে উপজেলা কৃষি কর্মকর্তার পরামর্শ নিন।",
        referencesBn=ref_list or "তথ্যসূত্র তালিকাভুক্ত আছে।",
        cautionBn="অনলাইন অনুসন্ধান থেকে পাওয়া তথ্য প্রাথমিক সহায়তা মাত্র; যাচাইকৃত কৃষিবিদের পরামর্শ ছাড়া কোনো কীটনাশক, ছত্রাকনাশক বা মাত্রা প্রয়োগ করবেন না।",
        evidenceNoticeBn="এই প্রতিবেদনে কোনো অনুমানভিত্তিক রাসায়নিক মাত্রা বা ব্র্যান্ড যোগ করা হয়নি; সব তথ্য সংগৃহীত গবেষণাপত্র ও কৃষি উৎস থেকে নেওয়া।",
    )


def synthesize_advisory(
    *,
    disease_name: str,
    crop_name: str,
    confidence: float | None,
    is_healthy: bool,
    papers: list[ResearchPaper],
    sources: list[ResearchSource],
    evidence_quality: str,
    telemetry_context: dict[str, Any] | None = None,
) -> AdvisoryPayload:
    band = _confidence_band(confidence)
    t_notes, critical_field = _telemetry_notes(telemetry_context, is_healthy)

    disclaimer_en = (
        "Advisory is synthesized strictly from retrieved agricultural sources and field telemetry; "
        "no chemical brand or dosage is prescribed. Consult local DAE/BARI/BRRI officers before chemical intervention."
    )
    disclaimer_bn = (
        "এই পরামর্শটি কেবল সংগৃহীত কৃষি উৎস ও মাঠের তথ্যের ভিত্তিতে তৈরি; কোনো রাসায়নিক ব্র্যান্ড বা মাত্রা নির্ধারণ করা হয়নি। "
        "রাসায়নিক প্রয়োগের আগে স্থানীয় DAE/BARI/BRRI কৃষি কর্মকর্তার পরামর্শ নিন।"
    )

    if is_healthy:
        return AdvisoryPayload(
            advisoryStatus="HEALTHY_MONITORING",
            severityLevel="LOW",
            confidenceBand=band,
            evidenceQuality=evidence_quality,  # type: ignore[arg-type]
            escalationRequired=critical_field,
            escalationReasonEn="Field agronomic status is Critical despite healthy leaf sample; inspect soil/irrigation." if critical_field else None,
            escalationReasonBn="পাতা সুস্থ হলেও মাঠের কৃষি অবস্থা সংকটাপন্ন; মাটি ও সেচ পরীক্ষা করুন।" if critical_field else None,
            actionableSteps=[
                AdvisoryActionItem(
                    priority="PREVENTIVE",
                    titleEn="Continue routine scouting",
                    titleBn="নিয়মিত মাঠ পর্যবেক্ষণ চালু রাখুন",
                    detailEn=f"Leaf sample for {crop_name} appears healthy ({disease_name.replace('_', ' ')}). Inspect lower leaves weekly.",
                    detailBn=f"{crop_name} ফসলের পাতা সুস্থ দেখা যাচ্ছে। প্রতি সপ্তাহে নিচের পাতা পর্যবেক্ষণ করুন।",
                    citationIds=[],
                )
            ],
            telemetryContextNotes=t_notes,
            citedPaperIds=[],
            citedSourceDomains=[],
            disclaimerEn=disclaimer_en,
            disclaimerBn=disclaimer_bn,
        )

    non_portal = [s for s in sources if s.provider != "bangladesh_agri_official"]
    if not papers and not non_portal:
        return AdvisoryPayload(
            advisoryStatus="INSUFFICIENT_EVIDENCE",
            severityLevel="UNKNOWN",
            confidenceBand=band,
            evidenceQuality="INSUFFICIENT",
            escalationRequired=True,
            escalationReasonEn="Insufficient verified research sources retrieved; field inspection by an agronomist is recommended.",
            escalationReasonBn="পর্যাপ্ত যাচাইকৃত গবেষণা উৎস পাওয়া যায়নি; কৃষি কর্মকর্তার সরাসরি মাঠ পরিদর্শন জরুরি।",
            actionableSteps=[
                AdvisoryActionItem(
                    priority="IMMEDIATE",
                    titleEn="Isolate symptomatic leaves & consult DAE",
                    titleBn="আক্রান্ত পাতা আলাদা করুন ও কৃষি কর্মকর্তার পরামর্শ নিন",
                    detailEn="Avoid applying unverified chemicals until a local extension officer confirms the diagnosis.",
                    detailBn="স্থানীয় কৃষি কর্মকর্তা নিশ্চিত না করা পর্যন্ত অনুমানভিত্তিক রাসায়নিক প্রয়োগ করবেন না।",
                    citationIds=[],
                )
            ],
            telemetryContextNotes=t_notes,
            citedPaperIds=[],
            citedSourceDomains=[],
            disclaimerEn=disclaimer_en,
            disclaimerBn=disclaimer_bn,
        )

    low_conf = band in ("LOW", "UNKNOWN")
    advisory_status = "LOW_CONFIDENCE_CAUTION" if low_conf else "READY"
    severity = "HIGH" if (critical_field or (confidence is not None and confidence >= 80.0)) else "MODERATE"
    escalate = low_conf or evidence_quality in ("LIMITED", "INSUFFICIENT") or critical_field

    esc_reasons_en: list[str] = []
    esc_reasons_bn: list[str] = []
    if low_conf:
        esc_reasons_en.append("Model confidence is below 60%")
        esc_reasons_bn.append("মডেলের আত্মবিশ্বাস ৬০%-এর নিচে")
    if evidence_quality in ("LIMITED", "INSUFFICIENT"):
        esc_reasons_en.append(f"Retrieved evidence quality is {evidence_quality}")
        esc_reasons_bn.append(f"সংগৃহীত প্রমাণের মান {evidence_quality}")
    if critical_field:
        esc_reasons_en.append("Field agronomic status is Critical")
        esc_reasons_bn.append("মাঠের কৃষি অবস্থা সংকটাপন্ন")

    immediate_cites = _match_citations_for_claim(papers, sources, _STEP_ISOLATE_KW, limit=3)
    mgmt_cites = _match_citations_for_claim(papers, sources, _STEP_MANAGEMENT_KW, limit=3)
    preventive_cites = _match_citations_for_claim(papers, sources, _STEP_PREVENTIVE_KW, limit=3)

    all_step_cites = list(dict.fromkeys(immediate_cites + mgmt_cites + preventive_cites))
    paper_id_set = {p.paperId for p in papers if p.paperId}
    source_domain_set = {
        s.domain for s in sources
        if s.domain and (s.provider != "bangladesh_agri_official" or bool((s.extractedSummary or "").strip()))
    }
    cited_papers = [c for c in all_step_cites if c in paper_id_set]
    cited_domains = [c for c in all_step_cites if c in source_domain_set and c not in paper_id_set]

    steps = [
        AdvisoryActionItem(
            priority="IMMEDIATE",
            titleEn="Inspect & isolate affected foliage",
            titleBn="আক্রান্ত পাতা পরীক্ষা ও আলাদা করুন",
            detailEn=f"Check neighboring {crop_name} plants for matching symptoms of {disease_name.replace('_', ' ')} and remove heavily infected leaves carefully.",
            detailBn=f"পাশের {crop_name} গাছে একই লক্ষণ আছে কিনা দেখুন এবং বেশি আক্রান্ত পাতা সাবধানে সরিয়ে ফেলুন।",
            citationIds=immediate_cites,
        ),
        AdvisoryActionItem(
            priority="SHORT_TERM",
            titleEn="Verify management options with DAE / BARI / BRRI",
            titleBn="DAE / BARI / BRRI নির্দেশিকা অনুযায়ী ব্যবস্থাপনা যাচাই করুন",
            detailEn="Review the linked scholarly abstracts and extension guides with a qualified agronomist before any treatment.",
            detailBn="যেকোনো চিকিৎসার আগে সংযুক্ত গবেষণাপত্র ও কৃষি সম্প্রসারণ নির্দেশিকা কৃষিবিদের সাথে যাচাই করুন।",
            citationIds=mgmt_cites,
        ),
        AdvisoryActionItem(
            priority="PREVENTIVE",
            titleEn="Manage canopy moisture & crop hygiene",
            titleBn="আর্দ্রতা নিয়ন্ত্রণ ও জমি পরিচ্ছন্ন রাখুন",
            detailEn="Avoid late-evening overhead watering, maintain plant spacing for airflow, and clear infected crop debris.",
            detailBn="সন্ধ্যায় পাতায় পানি ছিটানো এড়িয়ে চলুন, বাতাস চলাচলের ব্যবস্থা রাখুন এবং আক্রান্ত অবশিষ্টাংশ পরিষ্কার করুন।",
            citationIds=preventive_cites,
        ),
    ]

    return AdvisoryPayload(
        advisoryStatus=advisory_status,  # type: ignore[arg-type]
        severityLevel=severity,  # type: ignore[arg-type]
        confidenceBand=band,  # type: ignore[arg-type]
        evidenceQuality=evidence_quality,  # type: ignore[arg-type]
        escalationRequired=escalate,
        escalationReasonEn="; ".join(esc_reasons_en) if esc_reasons_en else None,
        escalationReasonBn="; ".join(esc_reasons_bn) if esc_reasons_bn else None,
        actionableSteps=steps,
        telemetryContextNotes=t_notes,
        citedPaperIds=cited_papers,
        citedSourceDomains=cited_domains,
        disclaimerEn=disclaimer_en,
        disclaimerBn=disclaimer_bn,
    )
