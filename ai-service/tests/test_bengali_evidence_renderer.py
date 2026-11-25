from app.services.bengali_evidence_renderer import render_evidence_sentence_bn


def test_bengali_renderer_positive_symptom_and_scientific_name():
    line, ok = render_evidence_sentence_bn(
        "doi:10.1000/eb.1",
        "Alternaria solani causes dark concentric ring lesions on lower leaves.",
    )
    assert ok is True
    assert "[doi:10.1000/eb.1]" in line
    assert "Alternaria solani" in line
    assert "গাঢ় বৃত্তাকার দাগ" in line
    assert "মূল উৎস (EN)" in line


def test_bengali_renderer_negations_fall_back_conservatively():
    for sentence in (
        "No lesions were observed on any sampled leaves.",
        "Plants remained healthy without visible symptoms.",
        "Symptoms are not present in resistant cultivars.",
        "Fungal pathogen was never detected in the seed lot.",
        "Absence of necrosis was confirmed at harvest.",
    ):
        line, ok = render_evidence_sentence_bn("doi:10.1000/neg.1", sentence)
        assert ok is False
        assert "[ইংরেজি প্রমাণ / Evidence EN]" in line
        assert "[doi:10.1000/neg.1]" in line


def test_bengali_renderer_positive_vs_negative_and_conditional_irrigation():
    pos_line, pos_ok = render_evidence_sentence_bn(
        "ext.edu",
        "Overhead irrigation wets the lower foliage.",
    )
    assert pos_ok is True
    assert "ওপর থেকে পাতায় সেচ" in pos_line
    assert "এড়ানো" not in pos_line

    neg_line, neg_ok = render_evidence_sentence_bn(
        "ext.edu",
        "Overhead irrigation is not recommended during high humidity.",
    )
    assert neg_ok is False
    assert "[ইংরেজি প্রমাণ / Evidence EN]" in neg_line

    cond_line, cond_ok = render_evidence_sentence_bn(
        "ext.edu",
        "Overhead irrigation may increase disease spread.",
    )
    assert cond_ok is False
    assert "[ইংরেজি প্রমাণ / Evidence EN]" in cond_line


def test_bengali_renderer_negation_in_sentence_one_does_not_leak_to_sentence_two():
    line, ok = render_evidence_sentence_bn(
        "doi:10.1000/mix.1",
        "No lesions were seen on stems. Fungal pathogen causes yellowing on lower leaves.",
    )
    assert ok is True
    parts = line.split(" | ")
    assert len(parts) == 2
    assert "[ইংরেজি প্রমাণ / Evidence EN] No lesions were seen on stems." in parts[0]
    assert "ছত্রাকজনিত জীবাণু" in parts[1]
    assert "পাতা হলুদ হয়ে যাওয়া" in parts[1]


def test_bengali_renderer_multiple_negations_and_untranslatable():
    line, ok = render_evidence_sentence_bn(
        "doi:10.1000/unknown.1",
        "Do not apply unverified sprays and never ignore field sanitation.",
    )
    assert ok is False
    assert "[ইংরেজি প্রমাণ / Evidence EN]" in line


def test_bengali_renderer_never_invents_chemicals_or_dosages():
    line, ok = render_evidence_sentence_bn(
        "extension.umn.edu",
        "Apply 2.5 mg/L copper fungicide every 7 days.",
    )
    assert ok is False
    assert "[ইংরেজি প্রমাণ / Evidence EN]" in line
    assert "Apply 2.5 mg/L copper fungicide every 7 days." in line
