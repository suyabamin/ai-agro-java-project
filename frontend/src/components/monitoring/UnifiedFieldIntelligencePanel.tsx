import React, { useEffect, useState } from 'react';
import { monitoringService, type MonitoringRecord } from '../../services/monitoringService';
import { StatusBadge } from '../ui/StatusBadge';

interface UnifiedFieldIntelligencePanelProps {
  farmId: string;
  fieldId: string;
  refreshKey?: number;
}

const TELEMETRY_LABELS: Array<{ key: string; label: string; unit: string }> = [
  { key: 'SOIL_MOISTURE', label: 'Soil Moisture', unit: '%' },
  { key: 'HUMIDITY', label: 'Humidity', unit: '%' },
  { key: 'TEMPERATURE', label: 'Temperature', unit: '°C' },
  { key: 'PH', label: 'Soil pH', unit: '' },
  { key: 'N', label: 'Nitrogen (N)', unit: 'mg/kg' },
  { key: 'P', label: 'Phosphorus (P)', unit: 'mg/kg' },
  { key: 'K', label: 'Potassium (K)', unit: 'mg/kg' },
  { key: 'RAINFALL', label: 'Rainfall', unit: 'mm' },
];

export const UnifiedFieldIntelligencePanel: React.FC<UnifiedFieldIntelligencePanelProps> = ({
  farmId,
  fieldId,
  refreshKey = 0,
}) => {
  const [data, setData] = useState<MonitoringRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    monitoringService
      .fieldIntelligence(farmId, fieldId)
      .then((res) => {
        if (active) setData(res.data || null);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load field intelligence');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [farmId, fieldId, refreshKey]);

  if (loading) {
    return (
      <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface-variant">
        Loading unified field intelligence...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-2xl bg-error-container/40 border border-error/30 text-xs text-error">
        Unified Field Intelligence unavailable: {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-xs text-on-surface-variant">
        No intelligence data available for this field yet.
      </div>
    );
  }

  const telemetry = (data.latestTelemetry as Record<string, MonitoringRecord> | undefined) || {};
  const agri = (data.latestAgriculturalAnalysis as MonitoringRecord | undefined) || null;
  const disease = (data.latestDiseaseAnalysis as MonitoringRecord | undefined) || null;
  const avail = (data.diseaseAvailability as MonitoringRecord | undefined) || null;
  const irrigation = (data.latestIrrigationPlan as MonitoringRecord | undefined) || null;
  const summaryNotes = Array.isArray(data.intelligenceSummary) ? (data.intelligenceSummary as string[]) : [];
  const hasStale = Boolean(data.hasStaleTelemetry);

  const researchSnap = (disease?.researchReport as Record<string, unknown> | undefined) || undefined;

  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
            Unified Intelligence Overview
          </span>
          <h3 className="text-sm font-extrabold text-on-surface">
            {String(data.fieldName || fieldId)} {data.cropType ? `• ${String(data.cropType)}` : ''}
          </h3>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-on-surface-variant font-mono">
          {hasStale && (
            <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold">
              STALE TELEMETRY (&gt;24h)
            </span>
          )}
          {Boolean(data.generatedAt) && (
            <span>Synced: {new Date(String(data.generatedAt)).toLocaleTimeString()}</span>
          )}
        </div>
      </div>

      {/* A. Field Overview & Telemetry */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {TELEMETRY_LABELS.map(({ key, label, unit }) => {
          const rec = telemetry[key];
          const val = rec && typeof rec.rawValue === 'number' ? rec.rawValue : null;
          const isStale = Boolean(rec?.isStale);
          return (
            <div key={key} className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-semibold text-on-surface-variant">{label}</span>
                {isStale && <span className="text-[9px] font-bold text-amber-600">STALE</span>}
              </div>
              <div className="text-sm font-extrabold text-on-surface mt-0.5">
                {val !== null ? `${val}${unit ? ` ${unit}` : ''}` : '—'}
              </div>
              {Boolean(rec?.observedAt) && (
                <div className="text-[9px] text-on-surface-variant truncate">
                  {new Date(String(rec.observedAt)).toLocaleDateString()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* B & C. Disease Intelligence + Irrigation Intelligence */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/25 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              Disease Intelligence
            </span>
            <StatusBadge status={String(disease?.status || avail?.status || 'MODEL_UNAVAILABLE')} />
          </div>
          {disease?.status === 'COMPLETED' ? (
            <div className="text-xs text-on-surface space-y-0.5">
              <p className="font-bold">
                {String(disease.diseaseName || disease.predictedClass || 'Unknown').replace(/_/g, ' ')}
                {typeof disease.confidence === 'number' ? ` (${disease.confidence.toFixed(1)}%)` : ''}
              </p>
              <p className="text-[11px] text-on-surface-variant">
                Research: <strong>{String(disease.researchStatus || 'NOT_REQUESTED')}</strong>
                {researchSnap?.evidenceQuality ? ` • Evidence Quality: ${String(researchSnap.evidenceQuality)}` : ''}
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-on-surface-variant">
              No completed leaf diagnosis yet. Engine: {String(avail?.status || 'MODEL_UNAVAILABLE')}.
            </p>
          )}
        </div>

        <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/25 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              Irrigation & Agronomic Intelligence
            </span>
            <StatusBadge status={String(irrigation?.recommendationStatus || agri?.predictedWaterNeed || 'NONE')} />
          </div>
          <div className="text-xs text-on-surface space-y-0.5">
            <p className="font-semibold">
              Water Need: {String(agri?.predictedWaterNeed || 'Unavailable')} • Field Status: {String(agri?.predictedFieldStatus || 'Unavailable')}
            </p>
            <p className="text-[11px] text-on-surface-variant">
              {irrigation
                ? `Plan ${String(irrigation.status || 'DRAFT')}: ${String(irrigation.rationale || irrigation.recommendationStatus)}`
                : 'No irrigation plan generated yet.'}
            </p>
          </div>
        </div>
      </div>

      {/* D. Intelligence Summary */}
      {summaryNotes.length > 0 && (
        <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/20 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block">
            Intelligence Summary (Persisted Data Only)
          </span>
          <ul className="text-[11px] text-on-surface-variant list-disc list-inside space-y-0.5">
            {summaryNotes.map((note, idx) => (
              <li key={idx}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
