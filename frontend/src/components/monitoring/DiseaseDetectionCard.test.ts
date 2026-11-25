import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { formatDiseaseLabel, parseConfidencePercent } from './DiseaseDetectionCard';
import {
  DISEASE_UI_LANG_KEY,
  DISEASE_UI_STRINGS,
  extractDiseaseClassification,
  getInitialDiseaseUiLang,
  parseEvidenceBlocks,
} from './diseaseIntelligenceI18n';
import { buildFieldDecisionRow } from '../../utils/farmAiInsights';
import type { Field } from '../../types/field';

describe('DiseaseDetectionCard helpers & Owner/Farmer insight integration', () => {
  it('formats underscores into readable disease names', () => {
    expect(formatDiseaseLabel('Tomato_Early_Blight')).toBe('Tomato Early Blight');
    expect(formatDiseaseLabel('Banana_leaf__Black_Leaf_Streak')).toBe('Banana leaf Black Leaf Streak');
    expect(formatDiseaseLabel(null)).toBe('Unknown');
  });

  it('extracts confidence percentage from either confidence or confidenceScore', () => {
    expect(parseConfidencePercent({ status: 'COMPLETED', confidence: 94.8 })).toBe(94.8);
    expect(parseConfidencePercent({ status: 'COMPLETED', confidenceScore: 0.948 })).toBe(94.8);
    expect(parseConfidencePercent({ status: 'FAILED' })).toBeNull();
  });

  it('merges persisted disease prediction into Owner field decision row without altering tabular predictions', () => {
    const field: Field = {
      fieldId: 'farm-1--f1',
      localFieldId: 'f1',
      farmId: 'farm-1',
      name: 'North Plot',
      cropType: 'TOMATO',
      soilType: 'LOAM',
      areaHectares: 2.5,
      status: 'ACTIVE',
      irrigationType: 'DRIP',
      createdAt: '2026-11-25T00:00:00Z',
    };

    const agri = {
      analysisId: 'analysis_agri_1',
      fieldId: 'farm-1--f1',
      status: 'COMPLETED',
      predictedWaterNeed: 'Moderate',
      predictedFieldStatus: 'Healthy',
      recommendedCrop: 'tomato',
    };

    const disease = {
      analysisId: 'analysis_dis_1',
      analysisType: 'DISEASE_DETECTION',
      fieldId: 'farm-1--f1',
      status: 'COMPLETED',
      diseaseName: 'Tomato_Early_Blight',
      confidence: 94.8,
      isHealthy: false,
    };

    const row = buildFieldDecisionRow(field, agri, disease);
    expect(row.waterNeed).toBe('Moderate');
    expect(row.fieldStatus).toBe('Healthy');
    expect(row.recommendedCrop).toBe('tomato');
    expect(row.diseaseStatus).toBe('Tomato Early Blight (94.8%)');
  });

  it('never reports Healthy when disease inference failed or model is unavailable', () => {
    const field: Field = {
      fieldId: 'farm-1--f1',
      localFieldId: 'f1',
      farmId: 'farm-1',
      name: 'North Plot',
      cropType: 'RICE',
      soilType: 'CLAY',
      areaHectares: 1.5,
      status: 'ACTIVE',
      irrigationType: 'FLOOD',
      createdAt: '2026-11-25T00:00:00Z',
    };

    const failedDisease = {
      analysisId: 'analysis_dis_fail',
      status: 'FAILED',
      errorMessage: 'Inference failed',
    };

    const row = buildFieldDecisionRow(field, undefined, failedDisease);
    expect(row.diseaseStatus).toBe('FAILED');
  });
});

describe('Bilingual Disease Intelligence UI helpers', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as unknown as { window?: unknown }).window = {
      localStorage: {
        getItem: (key: string) => (key in store ? store[key] : null),
        setItem: (key: string, value: string) => {
          store[key] = value;
        },
        removeItem: (key: string) => {
          delete store[key];
        },
      },
    };
  });

  afterEach(() => {
    (globalThis as unknown as { window?: unknown }).window = originalWindow;
  });

  it('defaults language to Bangla (bn) and respects persisted bn/en selection', () => {
    expect(getInitialDiseaseUiLang()).toBe('bn');

    window.localStorage.setItem(DISEASE_UI_LANG_KEY, 'en');
    expect(getInitialDiseaseUiLang()).toBe('en');

    window.localStorage.setItem(DISEASE_UI_LANG_KEY, 'bn');
    expect(getInitialDiseaseUiLang()).toBe('bn');

    window.localStorage.setItem(DISEASE_UI_LANG_KEY, 'invalid');
    expect(getInitialDiseaseUiLang()).toBe('bn');
  });

  it('provides complete, non-empty UI strings for both bn and en', () => {
    const bnKeys = Object.keys(DISEASE_UI_STRINGS.bn).sort();
    const enKeys = Object.keys(DISEASE_UI_STRINGS.en).sort();
    expect(bnKeys).toEqual(enKeys);

    for (const key of bnKeys) {
      const bnVal = DISEASE_UI_STRINGS.bn[key as keyof typeof DISEASE_UI_STRINGS.bn];
      const enVal = DISEASE_UI_STRINGS.en[key as keyof typeof DISEASE_UI_STRINGS.en];
      expect(typeof bnVal).toBe('string');
      expect(typeof enVal).toBe('string');
      expect(bnVal.trim().length).toBeGreaterThan(0);
      expect(enVal.trim().length).toBeGreaterThan(0);
    }
  });

  it('classifies Phytophthora infestans / Potato_Late_Blight as Oomycete rather than true fungus', () => {
    const lateBlight = extractDiseaseClassification('Potato_Late_Blight', [
      'Caused by the oomycete Phytophthora infestans under cool humid weather.',
    ]);
    expect(lateBlight.pathogenName).toBe('Phytophthora infestans');
    expect(lateBlight.classificationEn.toLowerCase()).toContain('oomycete');
    expect(lateBlight.classificationEn.toLowerCase()).toContain('not a true fungus');
    expect(lateBlight.classificationBn).toContain('ওমাইসিট');
  });

  it('parses bilingual evidence blocks with [মূল উৎস (EN): ...] and English fallback while preserving citationId', () => {
    const raw =
      'পাতায় জলভেজা দাগ দেখা যায়। [মূল উৎস (EN): Water-soaked lesions appear on leaves.] [src-1] | ' +
      '[ইংরেজি প্রমাণ / Evidence EN]: Sporangia spread rapidly in cool, wet conditions. [src-2]';

    const blocks = parseEvidenceBlocks(raw);
    expect(blocks).toHaveLength(2);

    expect(blocks[0].bnText).toContain('পাতায় জলভেজা দাগ দেখা যায়।');
    expect(blocks[0].enText).toBe('Water-soaked lesions appear on leaves.');
    expect(blocks[0].citationId).toBe('src-1');
    expect(blocks[0].isFallbackOnly).toBe(false);

    expect(blocks[1].enText).toBe('Sporangia spread rapidly in cool, wet conditions.');
    expect(blocks[1].citationId).toBe('src-2');
    expect(blocks[1].isFallbackOnly).toBe(true);
  });

  it('handles leading citations, missing citations, empty evidence, nested brackets, special chars, and malformed delimiters safely', () => {
    expect(parseEvidenceBlocks(null)).toEqual([]);
    expect(parseEvidenceBlocks(undefined)).toEqual([]);
    expect(parseEvidenceBlocks('')).toEqual([]);
    expect(parseEvidenceBlocks('  |  ||   ')).toEqual([]);

    const complexRaw =
      '[paper-1] পাতায় গাঢ় বাদামী দাগ [মূল উৎস (EN): Dark brown lesions [Fig 1]; DOI: 10.1016/j.cropro.2024.106612] | ' +
      'উদ্ধৃতি ছাড়া তথ্য। [মূল উৎস (EN): Observation without citation.] | ' +
      'অসমাপ্ত বন্ধনী [মূল উৎস (EN): Unclosed bracket test';

    const blocks = parseEvidenceBlocks(complexRaw);
    expect(blocks).toHaveLength(3);

    expect(blocks[0].citationId).toBe('paper-1');
    expect(blocks[0].bnText).toBe('পাতায় গাঢ় বাদামী দাগ');
    expect(blocks[0].enText).toBe('Dark brown lesions [Fig 1]; DOI: 10.1016/j.cropro.2024.106612');
    expect(blocks[0].isFallbackOnly).toBe(false);

    expect(blocks[1].citationId).toBeNull();
    expect(blocks[1].bnText).toBe('উদ্ধৃতি ছাড়া তথ্য।');
    expect(blocks[1].enText).toBe('Observation without citation.');

    // Malformed unclosed bracket does not crash or drop text
    expect(blocks[2].citationId).toBeNull();
    expect(blocks[2].bnText).toContain('অসমাপ্ত বন্ধনী');
  });

  it('preserves full Bengali and English paragraph text alongside long DOI citation IDs', () => {
    const longDoiRaw =
      '[doi:10.1016/j.cropro.2024.106612-extended-pathogen-review] ' +
      'এই রোগটি Phytophthora infestans নামক ওমাইসিট জীবাণুর মাধ্যমে সৃষ্টি হয় এবং শীতল ও আর্দ্র আবহাওয়ায় দ্রুত বিস্তার লাভ করে। ' +
      '[মূল উৎস (EN): Late blight is caused by the oomycete Phytophthora infestans and spreads rapidly under cool, humid field conditions with prolonged leaf wetness.]';

    const blocks = parseEvidenceBlocks(longDoiRaw);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].citationId).toBe('doi:10.1016/j.cropro.2024.106612-extended-pathogen-review');
    expect(blocks[0].bnText).toContain('এই রোগটি Phytophthora infestans নামক ওমাইসিট জীবাণুর মাধ্যমে সৃষ্টি হয়');
    expect(blocks[0].enText).toBe(
      'Late blight is caused by the oomycete Phytophthora infestans and spreads rapidly under cool, humid field conditions with prolonged leaf wetness.'
    );
  });
});
