import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { monitoringService, type MonitoringRecord } from '../services/monitoringService';
import { StatusBadge } from '../components/ui/StatusBadge';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-outline-variant/15 last:border-0">
      <span className="text-xs font-semibold text-on-surface-variant w-44 shrink-0">{label}</span>
      <span className="text-xs text-on-surface text-right break-all">{value}</span>
    </div>
  );
}

export const ActivityDetailsPage: React.FC = () => {
  const { activityId } = useParams<{ activityId: string }>();
  const [searchParams] = useSearchParams();
  const fieldId = searchParams.get('fieldId') || '';
  const { activeFarm } = useFarm();

  const [record, setRecord] = useState<MonitoringRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeFarm || !fieldId || !activityId) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const res = await monitoringService.historyItem(activeFarm.farmId, fieldId, activityId);
      setRecord(res.data || null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load activity detail');
    } finally { setLoading(false); }
  }, [activeFarm, fieldId, activityId]);

  useEffect(() => { load(); }, [load]);

  const r = record as Record<string, unknown> | null;

  return (
    <div className="space-y-6 max-w-[800px] mx-auto">
      <div className="flex items-center gap-2">
        <Link to="/dashboard/activity" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Activity Log
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-[22px]">history</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-on-surface">Activity Detail</h1>
          <p className="text-xs text-on-surface-variant font-mono mt-0.5">{activityId}</p>
        </div>
      </div>

      {loading && <LoadingSkeleton type="dashboard" />}

      {!loading && error && (
        <div className="p-6 rounded-2xl bg-error/10 border border-error/30">
          <p className="text-sm text-error">{error}</p>
          <button onClick={load} className="mt-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold cursor-pointer">Retry</button>
        </div>
      )}

      {!loading && !error && record && (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-6 space-y-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-on-surface">Event Details</h2>
            {Boolean(r?.eventType) && <StatusBadge status={String(r?.eventType)} />}
          </div>
          <DetailRow label="Activity ID" value={String(r?.id || r?.activityId || activityId)} />
          <DetailRow label="Event Type" value={String(r?.eventType || r?.type || '—').replace(/_/g, ' ')} />
          <DetailRow label="Actor" value={String(r?.actor || r?.performedBy || r?.actorUid || '—')} />
          <DetailRow label="Actor Role" value={String(r?.actorRole || r?.role || '—')} />
          <DetailRow label="Field ID" value={fieldId} />
          <DetailRow label="Farm ID" value={activeFarm?.farmId || '—'} />
          <DetailRow label="Timestamp" value={r?.timestamp ? new Date(String(r.timestamp)).toLocaleString() : (r?.createdAt ? new Date(String(r.createdAt)).toLocaleString() : '—')} />
          {Boolean(r?.description) && <DetailRow label="Description" value={String(r?.description)} />}
          {Boolean(r?.metadata) && (
            <div className="pt-3">
              <p className="text-xs font-semibold text-on-surface-variant mb-2">Event Metadata</p>
              <pre className="text-xs font-mono bg-surface-container p-3 rounded-lg overflow-auto max-h-48 text-on-surface-variant whitespace-pre-wrap">
                {JSON.stringify(r?.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {!loading && !error && !record && (
        <div className="p-10 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-center">
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant block mb-2">history</span>
          <p className="text-sm font-semibold text-on-surface">Activity Not Found</p>
          <p className="text-xs text-on-surface-variant mt-1">No activity record found. It may have been archived.</p>
        </div>
      )}
    </div>
  );
};
