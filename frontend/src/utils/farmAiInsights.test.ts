import { describe, expect, it } from 'vitest';
import type { Field } from '../types/field';
import type { MonitoringRecord } from '../services/monitoringService';
import {
  buildFieldDecisionRow,
  computeFarmAiSummary,
  aggregateFarmTelemetry,
  getMonitoringState,
  formatConfidence,
  extractTelemetry8Parameters,
} from './farmAiInsights';

const makeField = (id: string, name: string, crop = 'Rice', area = 2.5): Field => ({
  fieldId: id,
  farmId: 'farm-test-001',
  name,
  cropType: crop as Field['cropType'],
  soilType: 'CLAY_LOAM',
  irrigationType: 'DRIP',
  areaHectares: area,
  status: 'ACTIVE',
  version: 1,
  createdAt: '2026-11-20T10:00:00Z',
  updatedAt: '2026-11-20T10:00:00Z',
});

describe('Farm AI Insights & Dynamic Multi-Field Logic', () => {
  describe('Zero Fields (Empty State)', () => {
    it('returns zero counts and empty lists when a farm has zero fields', () => {
      const summary = computeFarmAiSummary([], {});
      expect(summary.totalFields).toBe(0);
      expect(summary.completed).toBe(0);
      expect(summary.needingAttention).toBe(0);
      expect(summary.critical).toBe(0);
      expect(summary.pending).toBe(0);
      expect(summary.failed).toBe(0);
      expect(summary.unevaluated).toBe(0);

      const telemetry = aggregateFarmTelemetry({});
      expect(telemetry.totalReadings).toBe(0);
      expect(telemetry.activeSectorsReporting).toBe(0);
      expect(telemetry.avgSoilMoisture).toBeNull();
      expect(telemetry.avgTemperature).toBeNull();
    });
  });

  describe('Single Field (1 Field = 1 Row)', () => {
    const f1 = makeField('field-1', 'North Sector', 'Maize');

    it('renders 1 row with completed AI predictions when evaluation exists', () => {
      const analysis: MonitoringRecord = {
        id: 'anal-1',
        analysisId: 'anal-1',
        fieldId: 'field-1',
        farmId: 'farm-test-001',
        status: 'COMPLETED',
        predictedWaterNeed: 'Low',
        waterNeedConfidence: 0.96,
        predictedFieldStatus: 'Healthy',
        fieldStatusConfidence: 0.94,
        recommendedCrop: 'maize',
        diseaseDetectionStatus: 'MODEL_UNAVAILABLE',
        createdAt: '2026-11-22T01:30:00Z',
      };

      const row = buildFieldDecisionRow(f1, analysis);
      expect(row.fieldId).toBe('field-1');
      expect(row.fieldName).toBe('North Sector');
      expect(row.cropType).toBe('Maize');
      expect(row.status).toBe('COMPLETED');
      expect(row.waterNeed).toBe('Low');
      expect(row.waterNeedBadge).toBe('low');
      expect(row.fieldStatus).toBe('Healthy');
      expect(row.fieldStatusBadge).toBe('healthy');
      expect(row.recommendedCrop).toBe('maize');
      expect(row.diseaseStatus).toBe('MODEL_UNAVAILABLE');
      expect(row.decisionUrl).toBe('/dashboard/fields/field-1');

      const summary = computeFarmAiSummary([f1], { 'field-1': analysis });
      expect(summary.totalFields).toBe(1);
      expect(summary.completed).toBe(1);
      expect(summary.unevaluated).toBe(0);
    });

    it('renders 1 row with UNEVALUATED state when field has no AI evaluation yet', () => {
      const row = buildFieldDecisionRow(f1, undefined);
      expect(row.fieldId).toBe('field-1');
      expect(row.status).toBe('UNEVALUATED');
      expect(row.waterNeed).toBeNull();
      expect(row.fieldStatus).toBeNull();
      expect(row.recommendedCrop).toBeNull();
      expect(row.diseaseStatus).toBe('N/A');
      expect(row.formattedDate).toBe('No evaluation yet');

      const summary = computeFarmAiSummary([f1], {});
      expect(summary.totalFields).toBe(1);
      expect(summary.completed).toBe(0);
      expect(summary.unevaluated).toBe(1);
    });
  });

  describe('Two Fields (2 Fields = 2 Rows) & Cross-Field Isolation', () => {
    const f1 = makeField('field-alpha', 'Alpha Sector', 'Wheat');
    const f2 = makeField('field-beta', 'Beta Sector', 'Cotton');

    it('maintains strict isolation: Field 2 never inherits Field 1 predictions', () => {
      const a1: MonitoringRecord = {
        analysisId: 'anal-alpha',
        fieldId: 'field-alpha',
        status: 'COMPLETED',
        predictedWaterNeed: 'High',
        predictedFieldStatus: 'Attention',
        recommendedCrop: 'wheat',
        diseaseDetectionStatus: 'MODEL_UNAVAILABLE',
        createdAt: '2026-11-22T02:00:00Z',
      };

      const map = { 'field-alpha': a1 };

      const row1 = buildFieldDecisionRow(f1, map[f1.fieldId]);
      const row2 = buildFieldDecisionRow(f2, map[f2.fieldId]);

      // Row 1 has evaluated data
      expect(row1.fieldId).toBe('field-alpha');
      expect(row1.status).toBe('COMPLETED');
      expect(row1.waterNeed).toBe('High');
      expect(row1.waterNeedBadge).toBe('high');
      expect(row1.fieldStatus).toBe('Attention');
      expect(row1.fieldStatusBadge).toBe('attention');

      // Row 2 is completely isolated and unevaluated
      expect(row2.fieldId).toBe('field-beta');
      expect(row2.status).toBe('UNEVALUATED');
      expect(row2.waterNeed).toBeNull();
      expect(row2.fieldStatus).toBeNull();
      expect(row2.recommendedCrop).toBeNull();
      expect(row2.formattedDate).toBe('No evaluation yet');

      // Summary counts
      const summary = computeFarmAiSummary([f1, f2], map);
      expect(summary.totalFields).toBe(2);
      expect(summary.completed).toBe(1);
      expect(summary.needingAttention).toBe(1);
      expect(summary.unevaluated).toBe(1);
    });

    it('rejects cross-field record injection if analysis fieldId mismatches field canonical ID', () => {
      const leakedAnalysis: MonitoringRecord = {
        analysisId: 'anal-leak',
        fieldId: 'field-alpha', // Belongs to Alpha!
        status: 'COMPLETED',
        predictedWaterNeed: 'Urgent',
        predictedFieldStatus: 'Critical',
      };

      // Attempt to bind leaked analysis to Beta
      const row = buildFieldDecisionRow(f2, leakedAnalysis);
      // Must reject and stay UNEVALUATED
      expect(row.status).toBe('UNEVALUATED');
      expect(row.waterNeed).toBeNull();
      expect(row.fieldStatus).toBeNull();
    });
  });

  describe('Multiple Fields (N > 2 Rows with Mixed States)', () => {
    const fields: Field[] = [
      makeField('f-101', 'Sector 1 - North', 'Rice'),
      makeField('f-102', 'Sector 2 - East', 'Maize'),
      makeField('f-103', 'Sector 3 - South', 'Jute'),
      makeField('f-104', 'Sector 4 - West', 'Chickpea'),
      makeField('f-105', 'Sector 5 - Central', 'Potato'),
    ];

    it('dynamically maps exactly 5 rows with distinct lifecycle states', () => {
      const analyses: Record<string, MonitoringRecord> = {
        'f-101': {
          fieldId: 'f-101',
          status: 'COMPLETED',
          predictedWaterNeed: 'Low',
          predictedFieldStatus: 'Healthy',
          recommendedCrop: 'rice',
          diseaseDetectionStatus: 'MODEL_UNAVAILABLE',
        },
        'f-102': {
          fieldId: 'f-102',
          status: 'COMPLETED',
          predictedWaterNeed: 'Urgent',
          predictedFieldStatus: 'Critical',
          recommendedCrop: 'maize',
          diseaseDetectionStatus: 'MODEL_UNAVAILABLE',
        },
        'f-103': {
          fieldId: 'f-103',
          status: 'PENDING',
        },
        'f-104': {
          fieldId: 'f-104',
          status: 'FAILED',
        },
        // f-105 is unevaluated
      };

      const rows = fields.map((f) => buildFieldDecisionRow(f, analyses[f.fieldId]));
      expect(rows).toHaveLength(5);

      expect(rows[0].status).toBe('COMPLETED');
      expect(rows[0].waterNeedBadge).toBe('low');
      expect(rows[0].fieldStatusBadge).toBe('healthy');

      expect(rows[1].status).toBe('COMPLETED');
      expect(rows[1].waterNeedBadge).toBe('urgent');
      expect(rows[1].fieldStatusBadge).toBe('critical');

      expect(rows[2].status).toBe('PENDING');
      expect(rows[2].waterNeedBadge).toBe('pending');
      expect(rows[2].formattedDate).toBe('Analysis queued');

      expect(rows[3].status).toBe('FAILED');
      expect(rows[3].waterNeedBadge).toBe('failed');
      expect(rows[3].fieldStatusBadge).toBe('failed');

      expect(rows[4].status).toBe('UNEVALUATED');
      expect(rows[4].waterNeedBadge).toBe('none');
      expect(rows[4].formattedDate).toBe('No evaluation yet');

      // Summary verification
      const summary = computeFarmAiSummary(fields, analyses);
      expect(summary.totalFields).toBe(5);
      expect(summary.completed).toBe(2);
      expect(summary.critical).toBe(1); // f-102
      expect(summary.pending).toBe(1); // f-103
      expect(summary.failed).toBe(1); // f-104
      expect(summary.unevaluated).toBe(1); // f-105
    });

    it('deduplicates fields if input array contains duplicate field IDs', () => {
      const duplicated = [...fields, fields[0], fields[1]];
      expect(duplicated).toHaveLength(7);
      const summary = computeFarmAiSummary(duplicated, {});
      expect(summary.totalFields).toBe(5);
    });

    it('handles PROCESSING, INSUFFICIENT_DATA, and canonical/local field ID normalization', () => {
      const fieldWithLocal: Field = {
        fieldId: 'farm-aec1--F-1795',
        localFieldId: 'F-1795',
        farmId: 'farm-aec1',
        name: 'Potato Parcel',
        cropType: 'POTATO',
        areaHectares: 2.5,
        status: 'ACTIVE',
        version: 1,
        createdAt: '2026-11-20T10:00:00Z',
        updatedAt: '2026-11-20T10:00:00Z',
      };

      // Analysis record stored with localFieldId
      const analysisWithLocal: MonitoringRecord = {
        analysisId: 'an-local-1',
        fieldId: 'F-1795',
        status: 'PROCESSING',
      };

      const rowProcessing = buildFieldDecisionRow(fieldWithLocal, analysisWithLocal);
      expect(rowProcessing.status).toBe('PROCESSING');
      expect(rowProcessing.formattedDate).toBe('Analyzing...');
      expect(rowProcessing.waterNeedBadge).toBe('pending');

      // Analysis record stored with INSUFFICIENT_DATA
      const analysisInsufficient: MonitoringRecord = {
        analysisId: 'an-insufficient-1',
        fieldId: 'farm-aec1--F-1795',
        status: 'INSUFFICIENT_DATA',
      };

      const rowInsufficient = buildFieldDecisionRow(fieldWithLocal, analysisInsufficient);
      expect(rowInsufficient.status).toBe('INSUFFICIENT_DATA');
      expect(rowInsufficient.formattedDate).toBe('Insufficient data');
      expect(rowInsufficient.waterNeedBadge).toBe('attention');
    });

    it('correctly maps multi-alias properties (waterNeed, fieldStatus, recommendedCrop)', () => {
      const fieldTest: Field = {
        ...makeField('farm-aec1--F-1795', 'Potato Parcel', 'POTATO'),
        localFieldId: 'F-1795',
      };
      const aliasAnalysis: MonitoringRecord = {
        fieldId: 'farm-aec1--F-1795',
        status: 'COMPLETED',
        waterNeed: 'Moderate',
        fieldStatus: 'Needs Attention',
        optimalCrop: 'potato',
      };
      const row = buildFieldDecisionRow(fieldTest, aliasAnalysis);
      expect(row.status).toBe('COMPLETED');
      expect(row.waterNeed).toBe('Moderate');
      expect(row.waterNeedBadge).toBe('moderate');
      expect(row.fieldStatus).toBe('Needs Attention');
      expect(row.fieldStatusBadge).toBe('attention');
      expect(row.recommendedCrop).toBe('potato');
    });

    it('treats status as FAILED when tabularStatus is FAILED despite status being COMPLETED', () => {
      const fieldTest: Field = {
        ...makeField('farm-aec1--F-1795', 'Potato Parcel', 'POTATO'),
        localFieldId: 'F-1795',
      };
      const failedTabularAnalysis: MonitoringRecord = {
        fieldId: 'farm-aec1--F-1795',
        status: 'COMPLETED',
        tabularStatus: 'FAILED',
        tabularErrorMessage: 'AI service tabular request failed: 503',
      };
      const row = buildFieldDecisionRow(fieldTest, failedTabularAnalysis);
      expect(row.status).toBe('FAILED');
      expect(row.formattedDate).toBe('Analysis failed');
      expect(row.waterNeedBadge).toBe('failed');
      expect(row.fieldStatusBadge).toBe('failed');
    });
  });

  describe('Farm-Wide Telemetry Aggregation (No fieldsList[0] dependency)', () => {
    it('accurately computes real averages across multi-field sensor telemetry', () => {
      const telemetryMap: Record<string, MonitoringRecord[]> = {
        'field-1': [
          { measurementType: 'SOIL_MOISTURE', value: 20.0 },
          { measurementType: 'TEMPERATURE', value: 25.0 },
          { measurementType: 'HUMIDITY', value: 60.0 },
        ],
        'field-2': [
          { measurementType: 'SOIL_MOISTURE', value: 40.0 },
          { measurementType: 'TEMPERATURE', value: 27.0 },
          { measurementType: 'HUMIDITY', value: 80.0 },
        ],
        'field-3': [], // no readings for sector 3
      };

      const agg = aggregateFarmTelemetry(telemetryMap);
      expect(agg.totalReadings).toBe(6);
      expect(agg.activeSectorsReporting).toBe(2);
      expect(agg.avgSoilMoisture).toBe(30.0); // (20 + 40) / 2
      expect(agg.avgTemperature).toBe(26.0); // (25 + 27) / 2
      expect(agg.avgHumidity).toBe(70.0); // (60 + 80) / 2
    });
  });

  describe('Monitoring State & Telemetry 8 Parameter Extraction', () => {
    it('correctly calculates monitoring state LIVE, STALE, and NO_DATA', () => {
      const now = Date.now();
      expect(getMonitoringState([])).toBe('NO_DATA');
      expect(getMonitoringState(null)).toBe('NO_DATA');

      // 1 hour ago -> LIVE
      const liveReadings: MonitoringRecord[] = [
        { measurementType: 'SOIL_MOISTURE', observedAtEpochMs: now - 3600 * 1000 },
      ];
      expect(getMonitoringState(liveReadings)).toBe('LIVE');

      // 30 hours ago -> STALE
      const staleReadings: MonitoringRecord[] = [
        { measurementType: 'SOIL_MOISTURE', observedAtEpochMs: now - 30 * 3600 * 1000 },
      ];
      expect(getMonitoringState(staleReadings)).toBe('STALE');
    });

    it('formats confidence accurately', () => {
      expect(formatConfidence(null)).toBe('—');
      expect(formatConfidence(undefined)).toBe('—');
      expect(formatConfidence(0.553)).toBe('55.3%');
      expect(formatConfidence(1.0)).toBe('100%');
      expect(formatConfidence(0.34)).toBe('34%');
      expect(formatConfidence(85)).toBe('85%');
    });

    it('extracts all 8 telemetry parameters with proper fallback and validation status', () => {
      const readings: MonitoringRecord[] = [
        { measurementType: 'NITROGEN', value: 85, unit: 'mg/kg', validationStatus: 'VALID', observedAt: '2026-11-23T01:00:00Z' },
        { measurementType: 'SOIL_MOISTURE', value: 25.5, unit: '%', validationStatus: 'VALID', observedAt: '2026-11-23T01:00:00Z' },
        { measurementType: 'SOIL_PH', value: 15.0, unit: 'pH', validationStatus: 'OUT_OF_RANGE', warnings: ['pH out of range'] },
      ];

      const params = extractTelemetry8Parameters(readings);
      expect(params).toHaveLength(8);

      const n = params.find((p) => p.key === 'NITROGEN');
      expect(n?.value).toBe(85);
      expect(n?.validationStatus).toBe('VALID');

      const moisture = params.find((p) => p.key === 'SOIL_MOISTURE');
      expect(moisture?.value).toBe(25.5);
      expect(moisture?.validationStatus).toBe('VALID');

      const ph = params.find((p) => p.key === 'SOIL_PH');
      expect(ph?.value).toBe(15.0);
      expect(ph?.validationStatus).toBe('OUT_OF_RANGE');
      expect(ph?.warning).toBe('pH out of range');

      const k = params.find((p) => p.key === 'POTASSIUM');
      expect(k?.value).toBeNull();
      expect(k?.validationStatus).toBe('NO_DATA');
    });
  });
});

