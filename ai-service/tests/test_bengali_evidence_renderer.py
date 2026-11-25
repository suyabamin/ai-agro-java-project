from app.services.bengali_evidence_renderer import render_evidence_sentence_bn


def test_bengali_renderer_translates_symptoms_and_preserves_scientific_names():
    line, ok = render_evidence_sentence_bn(
        "doi:10.1000/eb.1",
        "Alternaria solani causes dark concentric ring lesions on lower leaves.",
    )
    assert ok is True
    assert "[doi:10.1000/eb.1]" in line
    assert "Alternaria solani" in line
    assert "গাঢ় বৃত্তাকার দাগ" in line
    assert "মূল উৎস (EN)" in line


def test_bengali_renderer_preserves_english_with_indicator_when_untranslatable():
    line, ok = render_evidence_sentence_bn(
        "doi:10.1000/unknown.1",
        "Mitochondrial haplotype diversity was measured across 120 isolates.",
    )
    assert ok is False
    assert "[ইংরেজি প্রমাণ / Evidence EN]" in line
    assert "Mitochondrial haplotype diversity" in line


def test_bengali_renderer_never_invents_chemicals_or_dosages():
    line, ok = render_evidence_sentence_bn(
        "extension.umn.edu",
        "Remove infected leaves and avoid overhead irrigation to reduce disease spread.",
    )
    assert ok is True
    assert "আক্রান্ত পাতা বা অংশ সরিয়ে ফেলা" in line
    assert "ওপর থেকে পাতায় সেচ দেওয়া এড়ানো" in line
    assert "mg" not in line and "ml" not in line
