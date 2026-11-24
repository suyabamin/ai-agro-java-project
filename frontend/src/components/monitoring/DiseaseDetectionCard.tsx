import React from 'react';
import type { MonitoringRecord } from '../../services/monitoringService';
import { StatusBadge } from '../ui/StatusBadge';

export interface TopPredictionItem {
  classIndex?: number;
  className?: string;
  confidence?: number;
}

export function formatDiseaseLabel(raw: string | undefined | null): string {
  if (!raw) return 'Unknown';
  return raw.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

export function parseConfidencePercent(record: MonitoringRecord | null | undefined): number | null {
  if (!record) return null;
  if (typeof record.confidence === 'number' && Number.isFinite(record.confidence)) {
    return record.confidence;
  }
  if (typeof record.confidenceScore === 'number' && Number.isFinite(record.confidenceScore)) {
    return Math.round(record.confidenceScore * 1000) / 10;
  }
  return null;
}

interface DiseaseDetectionCardProps {
  analysis: MonitoringRecord | null;
  onRetry?: () => void;
  title?: string;
}

export const DiseaseDetectionCard: React.FC<DiseaseDetectionCardProps> = ({
  analysis,
  onRetry,
  title = 'Disease Inference Result',
}) => {
  if (!analysis) {
    return (
      <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs text-on-surface-variant flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px]">biotech</span>
        <span>No crop leaf disease scan recorded for this field yet.</span>
      </div>
    );
  }

  const status = String(analysis.status || 'UNKNOWN').toUpperCase();
  const analysisId = String(analysis.analysisId || analysis.id || '');
  const diseaseRaw = analysis.diseaseName || analysis.predictedClass;
  const diseaseName = diseaseRaw ? formatDiseaseLabel(String(diseaseRaw)) : null;
  const confidencePct = parseConfidencePercent(analysis);
  const isHealthy = typeof analysis.isHealthy === 'boolean' ? analysis.isHealthy : null;
  const modelName = analysis.modelName ? String(analysis.modelName) : 'crop_disease_model';
  const modelVersion = analysis.modelVersion ? String(analysis.modelVersion) : null;
  const timestamp = analysis.completedAt || analysis.updatedAt || analysis.createdAt;
  const topPredictions = Array.isArray(analysis.topPredictions)
    ? (analysis.topPredictions as TopPredictionItem[])
    : [];

  return (
    <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-primary">biotech</span>
          <span className="text-xs font-bold text-on-surface">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {analysisId && (
            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
              {analysisId.length > 20 ? `${analysisId.substring(0, 20)}...` : analysisId}
            </span>
          )}
          <StatusBadge status={status} />
        </div>
      </div>

      {/* Pending / Processing */}
      {(status === 'PENDING' || status === 'PROCESSING') && (
        <div className="p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/20 flex items-center gap-2.5 text-xs text-on-surface-variant">
          <span className="material-symbols-outlined text-[18px] text-primary animate-spin">progress_activity</span>
          <span>Running TFLite disease model on uploaded leaf image...</span>
        </div>
      )}

      {/* Unavailable / Failed */}
      {(status === 'MODEL_UNAVAILABLE' || status === 'FAILED') && (
        <div className="p-3 rounded-lg bg-error/10 border border-error/30 space-y-2">
          <p className="text-xs text-error font-medium leading-relaxed">
            {String(
              analysis.errorMessage ||
                analysis.failureReason ||
                'Disease inference could not be completed. No healthy status or prediction was produced.'
            )}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-[11px] font-bold hover:bg-secondary transition-colors cursor-pointer"
            >
              Retry Analysis
            </button>
          )}
        </div>
      )}

      {/* Completed Result */}
      {status === 'COMPLETED' && diseaseName && confidencePct !== null && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/25 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                {isHealthy === true ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    Healthy
                  </span>
                ) : isHealthy === false ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    Disease Detected
                  </span>
                ) : null}
                <span className="text-sm font-extrabold text-on-surface">{diseaseName}</span>
              </div>
              <p className="text-[11px] text-on-surface-variant font-mono">
                Raw class: {String(diseaseRaw)}
              </p>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block">
                Confidence
              </span>
              <span className="text-lg font-extrabold text-primary">{confidencePct.toFixed(1)}%</span>
            </div>
          </div>

          {/* Top 3 Predictions */}
          {topPredictions.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block">
                Top 3 Model Predictions
              </span>
              <div className="space-y-1.5">
                {topPredictions.slice(0, 3).map((pred, idx) => {
                  const pct = typeof pred.confidence === 'number' ? pred.confidence : 0;
                  return (
                    <div
                      key={`${pred.classIndex ?? idx}-${pred.className ?? idx}`}
                      className="p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/20 space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-on-surface">
                          {idx + 1}. {formatDiseaseLabel(pred.className)}
                        </span>
                        <span className="font-mono font-bold text-primary">{pct.toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-surface-container overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Metadata & Limitations */}
          <div className="pt-2 border-t border-outline-variant/20 flex flex-wrap items-center justify-between gap-2 text-[10px] text-on-surface-variant">
            <span>
              Evaluated: {timestamp ? new Date(String(timestamp)).toLocaleString() : 'Recent'}
            </span>
            <span className="font-mono">
              {modelName}{modelVersion ? `@${modelVersion}` : ''}
            </span>
          </div>
          <p className="text-[10px] text-on-surface-variant italic">
            AI-assisted disease prediction only; not a guaranteed agronomic diagnosis.
          </p>
        </div>
      )}
    </div>
  );
};
