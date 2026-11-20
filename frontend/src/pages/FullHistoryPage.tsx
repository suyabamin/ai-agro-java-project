import React, { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { monitoringService, type MonitoringRecord, type MonitoringPage } from '../services/monitoringService';
import { StatusBadge } from '../components/ui/StatusBadge';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';

export const FullHistoryPage: React.FC = () => {
  const { activeFarm } = useFarm();
  const [searchParams] = useSearchParams();
  const preFieldId = searchParams.get('fieldId') || '';
  const [fieldId, setFieldId] = useState(preFieldId);
  const [eventType, setEventType] = useState('');

  const [page, setPage] = useState<MonitoringPage<MonitoringRecord> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cur?: string) => {
    if (!activeFarm || !fieldId) return;
    setLoading(true); setError(null);
    try {
      const res = await monitoringService.history(activeFarm.farmId, fieldId, cur, eventType || undefined);
      setPage(res.data || { items: [], nextCursor: null, hasNext: false, pageSize: 25 });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load history');
    } finally { setLoading(false); }
  }, [activeFarm, fieldId, eventType]);

  useEffect(() => { if (fieldId) load(); }, [load, fieldId]);

  const items = page?.items || [];

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link to="/dashboard/activity" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Activity Dashboard
        </Link>
        <h1 className="text-lg font-bold text-on-surface">Full Event History</h1>
      </div>

      {/* Filters */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <label className="text-xs font-semibold text-on-surface-variant shrink-0">Field ID</label>
          <input
            type="text"
            value={fieldId}
            onChange={e => setFieldId(e.target.value)}
            placeholder="Enter field ID…"
            className="h-9 px-3 rounded-lg bg-surface-container text-on-surface text-xs outline-none focus:ring-2 focus:ring-primary flex-1"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-on-surface-variant shrink-0">Event Type</label>
          <select
            value={eventType}
            onChange={e => setEventType(e.target.value)}
            className="h-9 px-3 rounded-lg bg-surface-container text-on-surface text-xs outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Events</option>
            <option value="IMAGE_UPLOADED">Image Uploaded</option>
            <option value="ANALYSIS_COMPLETED">Analysis Completed</option>
            <option value="TELEMETRY_SUBMITTED">Telemetry Submitted</option>
            <option value="IRRIGATION_PLAN_CREATED">Irrigation Plan Created</option>
            <option value="FIELD_UPDATED">Field Updated</option>
          </select>
        </div>
        <button onClick={() => load()} disabled={!fieldId} className="h-9 px-4 rounded-lg bg-primary text-on-primary text-xs font-bold cursor-pointer hover:bg-primary/90 disabled:opacity-50">
          Apply
        </button>
      </div>

      {!fieldId && (
        <div className="p-8 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-center">
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant block mb-2">history</span>
          <p className="text-sm text-on-surface-variant">Enter a Field ID above to view its full history.</p>
        </div>
      )}

      {fieldId && loading && <LoadingSkeleton type="dashboard" />}

      {fieldId && !loading && error && (
        <div className="p-6 rounded-2xl bg-error/10 border border-error/30 text-center">
          <p className="text-sm text-error">{error}</p>
          <button onClick={() => load()} className="mt-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold cursor-pointer">Retry</button>
        </div>
      )}

      {fieldId && !loading && !error && items.length === 0 && (
        <div className="p-10 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-center">
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant block mb-2">history</span>
          <p className="text-sm font-semibold text-on-surface">No history found</p>
          <p className="text-xs text-on-surface-variant mt-1">No activity records match the selected filters.</p>
        </div>
      )}

      {fieldId && !loading && !error && items.length > 0 && (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-container border-b border-outline-variant/30">
                <tr>
                  {['ID', 'Event Type', 'Actor', 'Role', 'Timestamp', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {items.map((item, i) => {
                  const r = item as Record<string, unknown>;
                  const id = String(r.id || r.activityId || i);
                  const type = String(r.eventType || r.type || '—').replace(/_/g, ' ');
                  const actor = String(r.actor || r.actorUid || r.performedBy || '—');
                  const role = String(r.actorRole || r.role || '—');
                  const ts = r.timestamp || r.createdAt;
                  const tsStr = ts ? new Date(String(ts)).toLocaleString() : '—';
                  return (
                    <tr key={id} className="hover:bg-surface-container/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-on-surface-variant">{id.slice(0, 10)}…</td>
                      <td className="px-4 py-3"><StatusBadge status={type} /></td>
                      <td className="px-4 py-3 text-xs text-on-surface">{actor.slice(0, 12)}…</td>
                      <td className="px-4 py-3 text-xs text-on-surface-variant">{role}</td>
                      <td className="px-4 py-3 text-xs text-on-surface-variant">{tsStr}</td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/dashboard/activity/${encodeURIComponent(id)}?fieldId=${encodeURIComponent(fieldId)}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20"
                        >
                          <span className="material-symbols-outlined text-[14px]">open_in_new</span> Detail
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
              <button onClick={() => load(page.nextCursor || undefined)} className="px-6 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold cursor-pointer">Load More</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
