import React, { useCallback, useEffect, useRef, useState } from 'react';
import { monitoringService, type MonitoringRecord } from '../../services/monitoringService';
import { StatusBadge } from '../ui/StatusBadge';

type HistoryTab = 'research' | 'disease' | 'telemetry' | 'agricultural' | 'irrigation';

interface FieldHistoryTabsProps {
  farmId: string;
  fieldId: string;
  refreshKey?: number;
}

export const FieldHistoryTabs: React.FC<FieldHistoryTabsProps> = ({
  farmId,
  fieldId,
  refreshKey = 0,
}) => {
  const [tab, setTab] = useState<HistoryTab>('research');
  const [items, setItems] = useState<MonitoringRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const reqSeqRef = useRef(0);

  const fetchTab = useCallback(
    async (cursor?: string | null, append = false) => {
      const seq = ++reqSeqRef.current;
      setLoading(true);
      setError(null);
      try {
        let pageData: { items: MonitoringRecord[]; nextCursor: string | null; hasNext: boolean } = {
          items: [],
          nextCursor: null,
          hasNext: false,
        };
        if (tab === 'research') {
          const activeStatus = statusFilter !== 'ALL' ? statusFilter : undefined;
          const res = await monitoringService.listFieldResearch(farmId, fieldId, cursor, 15, activeStatus);
          if (res.data) pageData = res.data;
        } else if (tab === 'disease') {
          const res = await monitoringService.analyses(farmId, fieldId, cursor, 15);
          if (res.data) pageData = res.data;
        } else if (tab === 'telemetry') {
          const res = await monitoringService.telemetryHistory(farmId, fieldId, undefined, cursor || undefined);
          if (res.data) pageData = res.data;
        } else if (tab === 'agricultural') {
          const res = await monitoringService.listAgriculturalAnalyses(farmId, fieldId, cursor, 15);
          if (res.data) pageData = res.data;
        } else if (tab === 'irrigation') {
          const res = await monitoringService.irrigationPlans(farmId, fieldId, cursor, 15);
          if (res.data) pageData = res.data;
        }
        if (seq !== reqSeqRef.current) return;
        setItems((prev) => (append ? [...prev, ...(pageData.items || [])] : pageData.items || []));
        setNextCursor(pageData.nextCursor || null);
        setHasNext(Boolean(pageData.hasNext));
      } catch (e: unknown) {
        if (seq !== reqSeqRef.current) return;
        setError(e instanceof Error ? e.message : 'Failed to load field history');
      } finally {
        if (seq === reqSeqRef.current) setLoading(false);
      }
    },
    [farmId, fieldId, tab, statusFilter]
  );

  useEffect(() => {
    setItems([]);
    setNextCursor(null);
    setHasNext(false);
    fetchTab(null, false);
  }, [fetchTab, refreshKey]);

  const handleTabChange = (nextTab: HistoryTab) => {
    setStatusFilter('ALL');
    setTab(nextTab);
  };

  const handleFilterChange = (nextStatus: string) => {
    setItems([]);
    setNextCursor(null);
    setHasNext(false);
    setStatusFilter(nextStatus);
  };

  const isServerFiltered = tab === 'research';
  const filteredItems = isServerFiltered
    ? items
    : items.filter((item) => {
        if (statusFilter === 'ALL') return true;
        const st = String(
          item.researchStatus || item.status || item.recommendationStatus || item.validationStatus || ''
        ).toUpperCase();
        return st === statusFilter;
      });

  const tabs: Array<{ id: HistoryTab; label: string }> = [
    { id: 'research', label: 'Research & Advisory' },
    { id: 'disease', label: 'Disease Detections' },
    { id: 'telemetry', label: 'Telemetry' },
    { id: 'agricultural', label: 'Agronomic Analyses' },
    { id: 'irrigation', label: 'Irrigation Plans' },
  ];

  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
            Unified Field History
          </span>
          <h3 className="text-sm font-extrabold text-on-surface">
            Preserved Chronological Records
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {statusFilter !== 'ALL' && !isServerFiltered && (
            <span className="text-[10px] text-on-surface-variant">
              Filtered loaded pages ({items.length})
            </span>
          )}
          <select
            aria-label="Filter history status"
            value={statusFilter}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="h-8 px-2.5 rounded-lg bg-surface-container text-on-surface text-xs border border-outline-variant/30"
          >
            <option value="ALL">All Statuses</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="VALID">VALID</option>
            <option value="BLOCKED">BLOCKED</option>
            <option value="FAILED">FAILED</option>
            <option value="INSUFFICIENT_EVIDENCE">INSUFFICIENT_EVIDENCE</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-outline-variant/20 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => handleTabChange(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              tab === t.id
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-error-container/40 border border-error/30 text-xs text-error">
          {error}
        </div>
      )}

      {!loading && !error && filteredItems.length === 0 && (
        <div className="p-6 text-center text-xs text-on-surface-variant bg-surface-container-low rounded-xl border border-outline-variant/20">
          No historical records found in this category.
        </div>
      )}

      {filteredItems.length > 0 && (
        <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
          {filteredItems.map((item, idx) => {
            const id = String(
              item.researchId || item.analysisId || item.planId || item.telemetryId || item.id || idx
            );
            const status = String(
              item.researchStatus || item.status || item.recommendationStatus || item.validationStatus || 'RECORDED'
            );
            const ts = item.createdAt || item.observedAt || item.updatedAt;
            return (
              <div
                key={`${tab}-${id}-${idx}`}
                className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[10px] text-on-surface-variant">{id}</span>
                    {idx === 0 && statusFilter === 'ALL' && (
                      <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-bold uppercase">
                        Latest
                      </span>
                    )}
                    {Boolean(item.evidenceQuality) && (
                      <span className="px-1.5 py-0.5 rounded bg-surface-container text-[10px] font-mono">
                        Evidence: {String(item.evidenceQuality)}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-on-surface font-medium truncate max-w-[560px]">
                    {tab === 'research' &&
                      `${String(item.diseaseName || 'Research').replace(/_/g, ' ')} • Attempt #${String(item.attemptNumber || 1)}${
                        item.analysisId ? ` • Analysis: ${String(item.analysisId)}` : ''
                      }`}
                    {tab === 'disease' &&
                      `${String(item.diseaseName || item.predictedClass || 'Pending').replace(/_/g, ' ')}${
                        typeof item.confidence === 'number' ? ` (${item.confidence.toFixed(1)}%)` : ''
                      }`}
                    {tab === 'telemetry' &&
                      `${String(item.measurementType || 'Reading')}: ${String(item.rawValue ?? '—')} ${String(item.unit || '')}`}
                    {tab === 'agricultural' &&
                      `Water: ${String(item.predictedWaterNeed || '—')} • Status: ${String(item.predictedFieldStatus || '—')} • Crop: ${String(item.recommendedCrop || '—')}`}
                    {tab === 'irrigation' &&
                      `${String(item.recommendationStatus || '—')} • ${String(item.rationale || '')}`}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-on-surface-variant">
                    {ts ? new Date(String(ts)).toLocaleString() : '—'}
                  </span>
                  <StatusBadge status={status} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {loading && (
        <div className="text-xs text-on-surface-variant text-center py-2">Loading records...</div>
      )}

      {hasNext && nextCursor && !loading && (
        <div className="pt-1 text-center">
          <button
            type="button"
            onClick={() => fetchTab(nextCursor, true)}
            className="px-4 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-on-surface border border-outline-variant/30 cursor-pointer"
          >
            Load More History
          </button>
        </div>
      )}
    </div>
  );
};
