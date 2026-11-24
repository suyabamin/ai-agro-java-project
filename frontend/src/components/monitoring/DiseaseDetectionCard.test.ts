import { describe, it, expect } from 'vitest';
import { formatDiseaseLabel, parseConfidencePercent } from './DiseaseDetectionCard';
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
