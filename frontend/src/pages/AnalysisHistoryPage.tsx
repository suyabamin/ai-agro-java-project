import React, { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { monitoringService, type MonitoringRecord, type MonitoringPage } from '../services/monitoringService';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { StatusBadge } from '../components/ui/StatusBadge';

export const AnalysisHistoryPage: React.FC = () => {
  const { activeFarm } = useFarm();
  const [searchParams] = useSearchParams();
  const fieldId = searchParams.get('fieldId') || '';

  const [page, setPage] = useState<MonitoringPage<MonitoringRecord> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cur?: string | null) => {
    if (!activeFarm || !fieldId) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const res = await monitoringService.analyses(activeFarm.farmId, fieldId, cur);
      setPage(res.data || { items: [], nextCursor: null, hasNext: false, pageSize: 25 });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load analysis history');
    } finally { setLoading(false); }
  }, [activeFarm, fieldId]);

  useEffect(() => { load(null); }, [load]);

  const items = page?.items || [];

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between">
        <Link to="/dashboard/ai" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>AI Analysis Dashboard</span>
        </Link>
        <h1 className="text-lg font-bold text-on-surface">Analysis History</h1>
      </div>

      {!fieldId && (
        <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-center">
          <span className="material-symbols-outlined text-[40px] text-on-surface-variant mb-2 block">info</span>
          <p className="text-sm text-on-surface-variant">Select a field from the AI Analysis Dashboard to view its history.</p>
          <Link to="/dashboard/ai" className="mt-3 inline-block px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold">Go to Dashboard</Link>
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
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant block mb-2">biotech</span>
          <p className="text-sm font-semibold text-on-surface">No analyses found</p>
          <p className="text-xs text-on-surface-variant mt-1">No disease analysis records exist for this field yet.</p>
          <Link to="/dashboard/ai/upload" className="mt-3 inline-block px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold">Upload Crop Image</Link>
        </div>
      )}

      {fieldId && !loading && !error && items.length > 0 && (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-container border-b border-outline-variant/30">
                <tr>
                  {['Analysis ID', 'Status', 'Disease', 'Confidence', 'Date', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {items.map((item, i) => {
                  const id = String(item.id || item.analysisId || i);
                  const disease = String(item.diseaseName || item.disease || 'N/A');
                  const confidence = item.confidence ? `${(Number(item.confidence) * 100).toFixed(0)}%` : '—';
                  const status = String(item.status || 'UNKNOWN');
                  const date = item.createdAt ? new Date(String(item.createdAt)).toLocaleDateString() : '—';
                  return (
                    <tr key={id} className="hover:bg-surface-container/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-on-surface-variant">{id.slice(0, 12)}…</td>
                      <td className="px-4 py-3"><StatusBadge status={status} /></td>
                      <td className="px-4 py-3 text-sm text-on-surface">{disease}</td>
                      <td className="px-4 py-3 text-sm text-on-surface">{confidence}</td>
                      <td className="px-4 py-3 text-xs text-on-surface-variant">{date}</td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/dashboard/ai/results/${encodeURIComponent(id)}?fieldId=${encodeURIComponent(fieldId)}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
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
              <button
                onClick={() => load(page.nextCursor || null)}
                className="px-6 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold cursor-pointer hover:bg-primary/90"
              >
                Load More
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
