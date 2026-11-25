from __future__ import annotations

import re

# Deterministic positive agricultural evidence glosses (never invents pesticide brands or dosages)
_GLOSS_RULES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bconcentric\s+ring", re.I), "গাঢ় বৃত্তাকার দাগ"),
    (re.compile(r"\btarget[- ]?like\s+lesion|\blesions?\b", re.I), "পাতার ক্ষত বা দাগ"),
    (re.compile(r"\blower\s+leaves|\bolder\s+leaves|\blower\s+foliage", re.I), "গাছের নিচের দিকের পুরোনো পাতা"),
    (re.compile(r"\bchlorosis|\byellowing\b", re.I), "পাতা হলুদ হয়ে যাওয়া"),
    (re.compile(r"\bnecrosis|\bnecrotic\b", re.I), "টিস্যু শুকিয়ে মরে যাওয়া"),
    (re.compile(r"\bwilt(?:ing)?\b", re.I), "গাছ বা পাতা নেতিয়ে পড়া"),
    (re.compile(r"\bfungal\s+pathogen|\bfungus|\bfungi\b", re.I), "ছত্রাকজনিত জীবাণু"),
    (re.compile(r"\bbacterial|\bbacteria\b", re.I), "ব্যাকটেরিয়াজনিত জীবাণু"),
    (re.compile(r"\bviral|\bvirus\b", re.I), "ভাইরাসজনিত জীবাণু"),
    (re.compile(r"\brain\s+splash|\bsplash\b", re.I), "বৃষ্টির পানির ছাঁটা"),
    (re.compile(r"\bwind\b", re.I), "বাতাস"),
    (re.compile(r"\bhigh\s+humidity|\bhumidity\b", re.I), "উচ্চ বায়ু আর্দ্রতা"),
    (re.compile(r"\boverhead\s+irrigation|\boverhead\s+watering\b", re.I), "ওপর থেকে পাতায় সেচ"),
    (re.compile(r"\bremove\s+infected|\bpruning|\bprune\b", re.I), "আক্রান্ত পাতা বা অংশ সরিয়ে ফেলা"),
    (re.compile(r"\bfield\s+sanitation|\bsanitation|\bhygiene\b", re.I), "জমি পরিচ্ছন্ন রাখা"),
    (re.compile(r"\bcanopy\s+airflow|\bair\s+circulation|\bspacing\b", re.I), "গাছের ফাঁকে বাতাস চলাচল বজায় রাখা"),
    (re.compile(r"\bbiocontrol|\bbioagents?\b", re.I), "জৈবিক নিয়ন্ত্রণ ব্যবস্থা"),
    (re.compile(r"\bresistant\s+(?:cultivars?|varieties)\b", re.I), "রোগ-সহনশীল জাত ব্যবহার"),
    (re.compile(r"\bcrop\s+rotation\b", re.I), "ফসল পর্যায় অনুসরণ"),
    (re.compile(r"\bintegrated\s+(?:pest|disease)\s+management|\bipm\b", re.I), "সমন্বিত বালাই ব্যবস্থাপনা (IPM)"),
]

_NEGATION_OR_AMBIGUOUS_RE = re.compile(
    r"\b(?:no|not|never|without|absence\s+of|lack\s+of|does\s+not|do\s+not|is\s+not|are\s+not|"
    r"cannot|can't|should\s+not|shouldn't|don't|doesn't|isn't|aren't|won't|would\s+not|"
    r"neither|nor|avoid|prevent|free\s+of|may|might|could|uncertain|if)\b",
    re.I,
)

_SCIENTIFIC_NAME_RE = re.compile(
    r"\b(Alternaria solani|Phytophthora infestans|Magnaporthe oryzae|Xanthomonas oryzae|"
    r"Trichoderma harzianum|Pseudomonas fluorescens|Fusarium oxysporum|Botrytis cinerea|"
    r"Cercospora|Colletotrichum|Rhizoctonia solani)\b",
    re.I,
)


def _render_single_sentence(citation_id: str, sentence_en: str) -> tuple[str, bool]:
    clean_en = re.sub(r"\s+", " ", (sentence_en or "").strip())
    if not clean_en:
        return "", False

    # Conservative polarity/ambiguity gate: never guess when negation or conditional ambiguity is present
    if _NEGATION_OR_AMBIGUOUS_RE.search(clean_en):
        return f"[{citation_id}] [ইংরেজি প্রমাণ / Evidence EN] {clean_en}", False

    matched_bn: list[str] = []
    for pattern, bn_phrase in _GLOSS_RULES:
        if pattern.search(clean_en) and bn_phrase not in matched_bn:
            matched_bn.append(bn_phrase)

    if not matched_bn:
        return f"[{citation_id}] [ইংরেজি প্রমাণ / Evidence EN] {clean_en}", False

    sci_names = list(dict.fromkeys(m.group(0) for m in _SCIENTIFIC_NAME_RE.finditer(clean_en)))
    sci_suffix = f" ({', '.join(sci_names)})" if sci_names else ""
    bn_summary = ", ".join(matched_bn[:4])
    return f"[{citation_id}] শনাক্তকৃত প্রমাণ{sci_suffix}: {bn_summary}। [মূল উৎস (EN): {clean_en}]", True


def render_evidence_sentence_bn(citation_id: str, sentence_en: str) -> tuple[str, bool]:
    """Render retrieved English evidence sentence(s) into accurate Bengali with traceability.

    - Evaluates negation/ambiguity strictly per sentence boundary so negation in one
      sentence never affects another sentence.
    - Preserves scientific names, numbers, units, and citation IDs.
    - Falls back conservatively to ``[ইংরেজি প্রমাণ / Evidence EN]`` whenever negation
      or ambiguous polarity is detected.
    """
    clean_text = re.sub(r"\s+", " ", (sentence_en or "").strip())[:240]
    if not clean_text:
        return "", False

    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", clean_text) if s.strip()]
    if len(sentences) <= 1:
        return _render_single_sentence(citation_id, clean_text)

    parts: list[str] = []
    any_translated = False
    for sent in sentences:
        rendered, ok = _render_single_sentence(citation_id, sent)
        if rendered:
            parts.append(rendered)
        if ok:
            any_translated = True
    return " | ".join(parts), any_translated
