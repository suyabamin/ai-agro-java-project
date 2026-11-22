import type { Field } from '../types/field';
import type { MonitoringRecord } from '../services/monitoringService';

export type EvaluationRowStatus = 'COMPLETED' | 'PENDING' | 'PROCESSING' | 'FAILED' | 'INSUFFICIENT_DATA' | 'UNEVALUATED';
export type BadgeSeverity = 'urgent' | 'high' | 'moderate' | 'low' | 'healthy' | 'attention' | 'critical' | 'pending' | 'failed' | 'none';

export interface FieldAiDecisionViewModel {
  fieldId: string;
  fieldName: string;
  cropType: string;
  status: EvaluationRowStatus;
  waterNeed: string | null;
  waterNeedBadge: BadgeSeverity;
  fieldStatus: string | null;
  fieldStatusBadge: BadgeSeverity;
  recommendedCrop: string | null;
  diseaseStatus: string;
  evaluatedAt: string | null;
  formattedDate: string;
  decisionUrl: string;
}

export interface FarmAiSummaryMetrics {
  totalFields: number;
  completed: number;
  needingAttention: number;
  critical: number;
  pending: number;
  failed: number;
  unevaluated: number;
}

export interface FarmAggregatedTelemetry {
  totalReadings: number;
  activeSectorsReporting: number;
  avgSoilMoisture: number | null;
  avgTemperature: number | null;
  avgHumidity: number | null;
}

/**
 * Builds an independent, isolated View Model for a field and its optional AI analysis record.
 * Guarantees that evaluation data belongs strictly to the canonical fieldId.
 */
export function buildFieldDecisionRow(field: Field, analysis?: MonitoringRecord): FieldAiDecisionViewModel {
  const canonicalFieldId = field.fieldId;
  const decisionUrl = `/dashboard/fields/${encodeURIComponent(canonicalFieldId)}`;

  if (!analysis) {
    return {
      fieldId: canonicalFieldId,
      fieldName: field.name || 'Unnamed Field',
      cropType: field.cropType || 'General',
      status: 'UNEVALUATED',
      waterNeed: null,
      waterNeedBadge: 'none',
      fieldStatus: null,
      fieldStatusBadge: 'none',
      recommendedCrop: null,
      diseaseStatus: 'N/A',
      evaluatedAt: null,
      formattedDate: 'No evaluation yet',
      decisionUrl,
    };
  }

  // Cross-field sanity verification: if analysis contains a fieldId that does not match canonical or local, reject association
  const analysisFieldId = analysis.fieldId ? String(analysis.fieldId) : undefined;
  const matchesCanonical = analysisFieldId === canonicalFieldId;
  const matchesLocal = Boolean(
    (field.localFieldId && analysisFieldId === field.localFieldId) ||
    (analysisFieldId && field.localFieldId && analysisFieldId.endsWith(`--${field.localFieldId}`)) ||
    (canonicalFieldId && analysisFieldId && canonicalFieldId.endsWith(`--${analysisFieldId}`))
  );

  if (analysisFieldId && !matchesCanonical && !matchesLocal) {
    console.warn(`Cross-field mismatch detected! Analysis fieldId=${analysisFieldId} does not match field=${canonicalFieldId}`);
    return buildFieldDecisionRow(field, undefined);
  }

  const rawStatus = String(analysis.status || '').toUpperCase();
  const rawTabularStatus = String(analysis.tabularStatus || '').toUpperCase();
  let status: EvaluationRowStatus = 'COMPLETED';

  if (rawStatus === 'PENDING' || rawTabularStatus === 'PENDING') {
    status = 'PENDING';
  } else if (rawStatus === 'PROCESSING' || rawTabularStatus === 'PROCESSING') {
    status = 'PROCESSING';
  } else if (rawStatus === 'FAILED' || rawTabularStatus === 'FAILED') {
    status = 'FAILED';
  } else if (
    rawStatus === 'INSUFFICIENT_DATA' ||
    rawStatus === 'INSUFFICIENT_TELEMETRY' ||
    rawTabularStatus === 'INSUFFICIENT_DATA' ||
    rawTabularStatus === 'INSUFFICIENT_TELEMETRY'
  ) {
    status = 'INSUFFICIENT_DATA';
  }

  // Multi-alias extraction for Water Need (supporting predictedWaterNeed, waterNeed, water_need, nested predictions)
  const rawWn =
    analysis.predictedWaterNeed ??
    analysis.waterNeed ??
    analysis.water_need ??
    (analysis.predictions as Record<string, unknown> | undefined)?.waterNeed ??
    (analysis.predictions as Record<string, unknown> | undefined)?.predictedWaterNeed ??
    (analysis.predictions as Record<string, unknown> | undefined)?.water_need ??
    (analysis.tabularResult as Record<string, unknown> | undefined)?.waterNeed ??
    (analysis.tabularResult as Record<string, unknown> | undefined)?.water_need;
  const wn = rawWn != null ? String(rawWn) : null;

  // Multi-alias extraction for Field Status (supporting predictedFieldStatus, fieldStatus, field_status, nested predictions)
  const rawFs =
    analysis.predictedFieldStatus ??
    analysis.fieldStatus ??
    analysis.field_status ??
    (analysis.predictions as Record<string, unknown> | undefined)?.fieldStatus ??
    (analysis.predictions as Record<string, unknown> | undefined)?.predictedFieldStatus ??
    (analysis.predictions as Record<string, unknown> | undefined)?.field_status ??
    (analysis.tabularResult as Record<string, unknown> | undefined)?.fieldStatus ??
    (analysis.tabularResult as Record<string, unknown> | undefined)?.field_status;
  const fs = rawFs != null ? String(rawFs) : null;

  // Multi-alias extraction for Recommended Crop (supporting recommendedCrop, recommended_crop, optimalCrop, nested)
  const rawCrop =
    analysis.recommendedCrop ??
    analysis.recommended_crop ??
    analysis.optimalCrop ??
    (analysis.predictions as Record<string, unknown> | undefined)?.recommendedCrop ??
    (analysis.predictions as Record<string, unknown> | undefined)?.recommended_crop ??
    (analysis.tabularResult as Record<string, unknown> | undefined)?.recommendedCrop;
  const recCrop = rawCrop != null ? String(rawCrop) : null;

  // If status is marked COMPLETED but neither Water Need nor Field Status predictions exist:
  if (status === 'COMPLETED' && !wn && !fs) {
    if (rawTabularStatus === 'FAILED' || analysis.errorMessage || analysis.tabularErrorMessage) {
      status = 'FAILED';
    } else {
      status = 'INSUFFICIENT_DATA';
    }
  }

  // Water need badge mapping
  let wnBadge: BadgeSeverity = 'none';
  if (status === 'PENDING' || status === 'PROCESSING') {
    wnBadge = 'pending';
  } else if (status === 'FAILED') {
    wnBadge = 'failed';
  } else if (status === 'INSUFFICIENT_DATA') {
    wnBadge = 'attention';
  } else if (wn) {
    const wnLower = wn.toLowerCase();
    if (wnLower.includes('urgent')) wnBadge = 'urgent';
    else if (wnLower.includes('high')) wnBadge = 'high';
    else if (wnLower.includes('moderate')) wnBadge = 'moderate';
    else wnBadge = 'low';
  }

  // Field status badge mapping
  let fsBadge: BadgeSeverity = 'none';
  if (status === 'PENDING' || status === 'PROCESSING') {
    fsBadge = 'pending';
  } else if (status === 'FAILED') {
    fsBadge = 'failed';
  } else if (status === 'INSUFFICIENT_DATA') {
    fsBadge = 'attention';
  } else if (fs) {
    const fsLower = fs.toLowerCase();
    if (fsLower.includes('critical')) fsBadge = 'critical';
    else if (fsLower.includes('attention')) fsBadge = 'attention';
    else fsBadge = 'healthy';
  }

  const dateStr = analysis.createdAt ? String(analysis.createdAt) : null;
  let formattedDate = 'Recent';
  if (status === 'PENDING') {
    formattedDate = 'Analysis queued';
  } else if (status === 'PROCESSING') {
    formattedDate = 'Analyzing...';
  } else if (status === 'FAILED') {
    formattedDate = 'Analysis failed';
  } else if (status === 'INSUFFICIENT_DATA') {
    formattedDate = 'Insufficient data';
  } else if (dateStr) {
    try {
      formattedDate = new Date(dateStr).toLocaleString();
    } catch {
      formattedDate = dateStr;
    }
  }

  return {
    fieldId: canonicalFieldId,
    fieldName: field.name || 'Unnamed Field',
    cropType: field.cropType || 'General',
    status,
    waterNeed: wn,
    waterNeedBadge: wnBadge,
    fieldStatus: fs,
    fieldStatusBadge: fsBadge,
    recommendedCrop: recCrop,
    diseaseStatus: String(analysis.diseaseDetectionStatus || 'MODEL_UNAVAILABLE'),
    evaluatedAt: dateStr,
    formattedDate,
    decisionUrl,
  };
}

export type MonitoringState = 'LIVE' | 'STALE' | 'NO_DATA';

export interface Telemetry8Param {
  key: string;
  name: string;
  symbol: string;
  value: number | null;
  unit: string;
  observedAt: string | null;
  validationStatus: 'VALID' | 'OUT_OF_RANGE' | 'NO_DATA';
  warning?: string;
}

export const TELEMETRY_8_DEFINITIONS: Array<{ key: string; name: string; symbol: string; unit: string; min: number; max: number }> = [
  { key: 'NITROGEN', name: 'Nitrogen', symbol: 'N', unit: 'mg/kg', min: 0, max: 10000 },
  { key: 'PHOSPHORUS', name: 'Phosphorus', symbol: 'P', unit: 'mg/kg', min: 0, max: 10000 },
  { key: 'POTASSIUM', name: 'Potassium', symbol: 'K', unit: 'mg/kg', min: 0, max: 10000 },
  { key: 'AIR_TEMPERATURE', name: 'Air Temperature', symbol: 'Temp', unit: '°C', min: -20, max: 60 },
  { key: 'RELATIVE_HUMIDITY', name: 'Relative Humidity', symbol: 'RH', unit: '%', min: 0, max: 100 },
  { key: 'SOIL_PH', name: 'Soil pH', symbol: 'pH', unit: 'pH', min: 0, max: 14 },
  { key: 'RAINFALL', name: 'Rainfall', symbol: 'Rain', unit: 'mm', min: 0, max: 10000 },
  { key: 'SOIL_MOISTURE', name: 'Soil Moisture', symbol: 'Moist', unit: '%', min: 0, max: 100 },
];

export function formatConfidence(confidence: unknown): string {
  if (confidence == null) return '—';
  const num = Number(confidence);
  if (isNaN(num)) return String(confidence);
  if (num >= 0 && num <= 1) {
    return `${Math.round(num * 1000) / 10}%`;
  }
  return `${Math.round(num * 10) / 10}%`;
}

export function getMonitoringState(
  readings?: MonitoringRecord[] | null,
  fallbackDate?: string | null
): MonitoringState {
  if (!readings || readings.length === 0) {
    if (!fallbackDate) return 'NO_DATA';
    const dateMs = Date.parse(fallbackDate);
    if (isNaN(dateMs)) return 'NO_DATA';
    const diff = Date.now() - dateMs;
    return diff <= 24 * 60 * 60 * 1000 ? 'LIVE' : 'STALE';
  }
  let latestEpoch = 0;
  for (const r of readings) {
    const epoch =
      Number(r.observedAtEpochMs || r.createdAtEpochMs) ||
      Date.parse(String(r.observedAt || r.createdAt || ''));
    if (!isNaN(epoch) && epoch > latestEpoch) {
      latestEpoch = epoch;
    }
  }
  if (latestEpoch === 0) return 'NO_DATA';
  const diff = Date.now() - latestEpoch;
  return diff <= 24 * 60 * 60 * 1000 ? 'LIVE' : 'STALE';
}

export function extractTelemetry8Parameters(readings: MonitoringRecord[]): Telemetry8Param[] {
  const map = new Map<string, MonitoringRecord>();
  for (const r of readings) {
    const type = String(r.measurementType || '').toUpperCase();
    if (!map.has(type)) {
      map.set(type, r);
    }
  }

  return TELEMETRY_8_DEFINITIONS.map((def) => {
    const found = map.get(def.key);
    if (!found) {
      return {
        key: def.key,
        name: def.name,
        symbol: def.symbol,
        value: null,
        unit: def.unit,
        observedAt: null,
        validationStatus: 'NO_DATA',
      };
    }
    const val = Number(found.value ?? found.rawValue);
    const isNum = !isNaN(val);
    const status =
      String(found.validationStatus || '').toUpperCase() === 'OUT_OF_RANGE'
        ? 'OUT_OF_RANGE'
        : 'VALID';
    const warnings = Array.isArray(found.warnings)
      ? found.warnings.map(String).join('; ')
      : undefined;

    return {
      key: def.key,
      name: def.name,
      symbol: def.symbol,
      value: isNum ? val : null,
      unit: String(found.unit || def.unit),
      observedAt: found.observedAt ? String(found.observedAt) : null,
      validationStatus: status,
      warning: warnings,
    };
  });
}

/**
 * Computes aggregated farm-wide AI summary metrics from fields and canonical analysis map.
 */
export function computeFarmAiSummary(
  fields: Field[],
  analysesMap: Record<string, MonitoringRecord>
): FarmAiSummaryMetrics {
  const uniqueFields = Array.from(new Map(fields.map((f) => [f.fieldId, f])).values());
  const totalFields = uniqueFields.length;

  let completed = 0;
  let needingAttention = 0;
  let critical = 0;
  let pending = 0;
  let failed = 0;
  let unevaluated = 0;

  for (const field of uniqueFields) {
    const ai = analysesMap[field.fieldId] || (field.localFieldId ? analysesMap[field.localFieldId] : undefined);
    if (!ai) {
      unevaluated++;
      continue;
    }

    const row = buildFieldDecisionRow(field, ai);
    if (row.status === 'UNEVALUATED') {
      unevaluated++;
    } else if (row.status === 'PENDING' || row.status === 'PROCESSING') {
      pending++;
    } else if (row.status === 'FAILED') {
      failed++;
    } else if (row.status === 'INSUFFICIENT_DATA') {
      needingAttention++;
    } else if (row.status === 'COMPLETED') {
      completed++;
      const fs = String(row.fieldStatus || '').toLowerCase();
      const wn = String(row.waterNeed || '').toLowerCase();

      if (fs.includes('critical') || wn.includes('urgent')) {
        critical++;
      } else if (fs.includes('attention') || wn.includes('moderate') || wn.includes('high')) {
        needingAttention++;
      }
    }
  }

  return {
    totalFields,
    completed,
    needingAttention,
    critical,
    pending,
    failed,
    unevaluated,
  };
}

/**
 * Aggregates live or recent telemetry readings across all farm field sectors.
 * Computes real mathematical averages across all available sensor observations.
 */
export function aggregateFarmTelemetry(
  fieldTelemetryMap: Record<string, MonitoringRecord[]>
): FarmAggregatedTelemetry {
  let totalReadings = 0;
  let activeSectorsReporting = 0;

  const moistureVals: number[] = [];
  const tempVals: number[] = [];
  const humidityVals: number[] = [];

  for (const fieldId of Object.keys(fieldTelemetryMap)) {
    const list = fieldTelemetryMap[fieldId] || [];
    if (list.length > 0) {
      activeSectorsReporting++;
      totalReadings += list.length;

      for (const item of list) {
        const type = String(item.measurementType || '').toUpperCase();
        const num = Number(item.value ?? item.rawValue);
        if (!isNaN(num)) {
          if (type.includes('MOISTURE')) moistureVals.push(num);
          else if (type.includes('TEMP')) tempVals.push(num);
          else if (type.includes('HUMID')) humidityVals.push(num);
        }
      }
    }
  }

  const avg = (arr: number[]): number | null =>
    arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;

  return {
    totalReadings,
    activeSectorsReporting,
    avgSoilMoisture: avg(moistureVals),
    avgTemperature: avg(tempVals),
    avgHumidity: avg(humidityVals),
  };
}
