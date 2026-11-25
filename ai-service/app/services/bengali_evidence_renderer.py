from __future__ import annotations

import re

# Deterministic agricultural evidence glosses (never invents pesticide brands or dosages)
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
    (re.compile(r"\boverhead\s+irrigation|\boverhead\s+watering\b", re.I), "ওপর থেকে পাতায় সেচ দেওয়া এড়ানো"),
    (re.compile(r"\bremove\s+infected|\bpruning|\bprune\b", re.I), "আক্রান্ত পাতা বা অংশ সরিয়ে ফেলা"),
    (re.compile(r"\bfield\s+sanitation|\bsanitation|\bhygiene\b", re.I), "জমি পরিচ্ছন্ন রাখা"),
    (re.compile(r"\bcanopy\s+airflow|\bair\s+circulation|\bspacing\b", re.I), "গাছের ফাঁকে বাতাস চলাচল বজায় রাখা"),
    (re.compile(r"\bbiocontrol|\bbioagents?\b", re.I), "জৈবিক নিয়ন্ত্রণ ব্যবস্থা"),
    (re.compile(r"\bresistant\s+(?:cultivars?|varieties)\b", re.I), "রোগ-সহনশীল জাত ব্যবহার"),
    (re.compile(r"\bcrop\s+rotation\b", re.I), "ফসল পর্যায় অনুসরণ"),
    (re.compile(r"\bintegrated\s+(?:pest|disease)\s+management|\bipm\b", re.I), "সমন্বিত বালাই ব্যবস্থাপনা (IPM)"),
]

_SCIENTIFIC_NAME_RE = re.compile(
    r"\b(Alternaria solani|Phytophthora infestans|Magnaporthe oryzae|Xanthomonas oryzae|"
    r"Trichoderma harzianum|Pseudomonas fluorescens|Fusarium oxysporum|Botrytis cinerea|"
    r"Cercospora|Colletotrichum|Rhizoctonia solani)\b",
    re.I,
)


def render_evidence_sentence_bn(citation_id: str, sentence_en: str) -> tuple[str, bool]:
    """Render a retrieved English evidence sentence into accurate Bengali with traceability.

    Returns ``(rendered_text, translated_ok)``.
    - Preserves scientific names in English inside parentheses.
    - Never invents chemical brands, dosages, or extra claims.
    - If no deterministic gloss matches, preserves the original English sentence
      with a clear ``[ইংরেজি প্রমাণ / Evidence EN]`` indicator.
    """
    clean_en = re.sub(r"\s+", " ", (sentence_en or "").strip())[:240]
    if not clean_en:
        return "", False

    matched_bn: list[str] = []
    for pattern, bn_phrase in _GLOSS_RULES:
        if pattern.search(clean_en) and bn_phrase not in matched_bn:
            matched_bn.append(bn_phrase)

    sci_names = list(dict.fromkeys(m.group(0) for m in _SCIENTIFIC_NAME_RE.finditer(clean_en)))
    sci_suffix = f" ({', '.join(sci_names)})" if sci_names else ""

    if not matched_bn:
        return f"[{citation_id}] [ইংরেজি প্রমাণ / Evidence EN] {clean_en}", False

    bn_summary = "، ".join(matched_bn[:4]).replace("،", ",")
    return f"[{citation_id}] শনাক্তকৃত প্রমাণ{sci_suffix}: {bn_summary}। [মূল উৎস (EN): {clean_en}]", True
