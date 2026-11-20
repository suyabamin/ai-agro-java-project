import React, { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { monitoringService, type MonitoringRecord, type MonitoringPage } from '../services/monitoringService';
import { StatusBadge } from '../components/ui/StatusBadge';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';

export const IrrigationHistoryPage: React.FC = () => {
  const { activeFarm } = useFarm();
  const [searchParams] = useSearchParams();
  const preFieldId = searchParams.get('fieldId') || '';
  const [fieldId] = useState(preFieldId);

  const [page, setPage] = useState<MonitoringPage<MonitoringRecord> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cur?: string | null) => {
    if (!activeFarm || !fieldId) return;
    setLoading(true); setError(null);
    try {
      const res = await monitoringService.irrigationPlans(activeFarm.farmId, fieldId, cur);
      setPage(res.data || { items: [], nextCursor: null, hasNext: false, pageSize: 25 });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load irrigation history');
    } finally { setLoading(false); }
  }, [activeFarm, fieldId]);

  useEffect(() => { if (fieldId) load(null); }, [load, fieldId]);

  const items = page?.items || [];

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link to="/dashboard/irrigation" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Irrigation Dashboard
        </Link>
        <h1 className="text-lg font-bold text-on-surface">Irrigation History</h1>
      </div>

      {!fieldId && (
        <div className="p-8 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-center">
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant block mb-2">water_drop</span>
          <p className="text-sm text-on-surface-variant">Navigate here from the Irrigation Dashboard with a field selected.</p>
          <Link to="/dashboard/irrigation" className="mt-3 inline-block px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold">Go to Dashboard</Link>
        </div>
      )}

      {fieldId && loading && <LoadingSkeleton type="dashboard" />}

      {fieldId && !loading && error && (
        <div className="p-6 rounded-2xl bg-error/10 border border-error/30 text-center">
          <p className="text-sm text-error">{error}</p>
          <button onClick={() => load(null)} className="mt-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold cursor-pointer">Retry</button>
        </div>
      )}

      {fieldId && !loading && !error && items.length === 0 && (
        <div className="p-10 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-center">
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant block mb-2">water_drop</span>
          <p className="text-sm font-semibold text-on-surface">No irrigation plans</p>
          <p className="text-xs text-on-surface-variant mt-1">No irrigation plans have been generated for this field yet.</p>
          <Link to={`/dashboard/irrigation/new?fieldId=${encodeURIComponent(fieldId)}`} className="mt-3 inline-block px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold">Create Plan</Link>
        </div>
      )}

      {fieldId && !loading && !error && items.length > 0 && (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-container border-b border-outline-variant/30">
                <tr>
                  {['Plan ID', 'Status', 'Decision', 'Volume (L)', 'Created', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {items.map((item, i) => {
                  const p = item as Record<string, unknown>;
                  const id = String(p.id || p.planId || i);
                  const status = String(p.status || p.planStatus || 'UNKNOWN');
                  const decision = String(p.decision || p.irrigationDecision || '—').replace(/_/g, ' ');
                  const volume = p.recommendedVolumeL !== undefined ? String(p.recommendedVolumeL) : '—';
                  const date = p.createdAt ? new Date(String(p.createdAt)).toLocaleDateString() : '—';
                  return (
                    <tr key={id} className="hover:bg-surface-container/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-on-surface-variant">{id.slice(0, 12)}…</td>
                      <td className="px-4 py-3"><StatusBadge status={status} /></td>
                      <td className="px-4 py-3 text-xs text-on-surface">{decision}</td>
                      <td className="px-4 py-3 text-xs text-on-surface">{volume}</td>
                      <td className="px-4 py-3 text-xs text-on-surface-variant">{date}</td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/dashboard/irrigation/${encodeURIComponent(id)}?fieldId=${encodeURIComponent(fieldId)}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20"
                        >
                          <span className="material-symbols-outlined text-[14px]">open_in_new</span> View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {page?.hasNext && (
            <div className="flex justify-center p-4 border-t border-outline-variant/20">
              <button onClick={() => load(page.nextCursor)} className="px-6 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold cursor-pointer">Load More</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
