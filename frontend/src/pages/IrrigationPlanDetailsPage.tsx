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

export const IrrigationPlanDetailsPage: React.FC = () => {
  const { planId } = useParams<{ planId: string }>();
  const [searchParams] = useSearchParams();
  const fieldId = searchParams.get('fieldId') || '';
  const { activeFarm } = useFarm();

  const [plan, setPlan] = useState<MonitoringRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    if (!activeFarm || !fieldId || !planId) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const res = await monitoringService.irrigationPlan(activeFarm.farmId, fieldId, planId);
      setPlan(res.data || null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load irrigation plan');
    } finally { setLoading(false); }
  }, [activeFarm, fieldId, planId]);

  useEffect(() => { load(); }, [load]);

  const handleStatusUpdate = async (status: string) => {
    if (!activeFarm || !fieldId || !planId) return;
    setUpdating(true);
    try {
      const res = await monitoringService.updatePlanStatus(activeFarm.farmId, fieldId, planId, status);
      setPlan(res.data || null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to update plan status');
    } finally { setUpdating(false); }
  };

  const p = plan as Record<string, unknown> | null;
  const status = String(p?.status || p?.planStatus || 'UNKNOWN');
  const isInsufficient = status === 'INSUFFICIENT_DATA' || String(p?.decision || '').includes('INSUFFICIENT');

  return (
    <div className="space-y-6 max-w-[800px] mx-auto">
      <div className="flex items-center gap-2">
        <Link to="/dashboard/irrigation" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Irrigation Dashboard
        </Link>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-[22px]">water_drop</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-on-surface">Irrigation Plan</h1>
            <p className="text-xs text-on-surface-variant font-mono mt-0.5">{planId}</p>
          </div>
        </div>
        {plan && <StatusBadge status={status} />}
      </div>

      {loading && <LoadingSkeleton type="dashboard" />}

      {!loading && error && (
        <div className="p-6 rounded-2xl bg-error/10 border border-error/30">
          <p className="text-sm text-error">{error}</p>
          <button onClick={load} className="mt-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold cursor-pointer">Retry</button>
        </div>
      )}

      {!loading && !error && isInsufficient && (
        <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-amber-600 text-[24px]">warning</span>
            <div>
              <p className="text-sm font-bold text-amber-800">INSUFFICIENT_DATA</p>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                This irrigation plan could not be completed because there is not enough telemetry data for the field.
                Submit soil moisture, temperature, and humidity sensor readings to enable plan generation.
              </p>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && plan && (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-6 space-y-1">
          <h2 className="text-sm font-bold text-on-surface mb-3">Plan Details</h2>
          <DetailRow label="Plan ID" value={String(p?.id || p?.planId || planId)} />
          <DetailRow label="Status" value={status.replace(/_/g, ' ')} />
          <DetailRow label="Decision" value={String(p?.decision || p?.irrigationDecision || '—').replace(/_/g, ' ')} />
          <DetailRow label="Recommended Volume (L)" value={p?.recommendedVolumeL !== undefined ? String(p.recommendedVolumeL) : '—'} />
          <DetailRow label="Duration (min)" value={p?.durationMinutes !== undefined ? String(p.durationMinutes) : '—'} />
          <DetailRow label="Moisture Level (%)" value={p?.soilMoisturePercent !== undefined ? String(p.soilMoisturePercent) : '—'} />
          <DetailRow label="Field ID" value={fieldId} />
          <DetailRow label="Created At" value={p?.createdAt ? new Date(String(p.createdAt)).toLocaleString() : '—'} />
          {Boolean(p?.reason) && <DetailRow label="Reasoning" value={String(p?.reason)} />}
        </div>
      )}

      {!loading && !error && plan && !isInsufficient && (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-6">
          <h2 className="text-sm font-bold text-on-surface mb-4">Update Plan Status</h2>
          <div className="flex flex-wrap gap-3">
            {['ACTIVE', 'COMPLETED', 'CANCELLED'].map(s => (
              <button
                key={s}
                onClick={() => handleStatusUpdate(s)}
                disabled={updating || status === s}
                className="px-4 py-2 rounded-xl border border-outline-variant/40 text-xs font-semibold text-on-surface hover:bg-surface-container cursor-pointer disabled:opacity-50"
              >
                {updating ? 'Updating…' : s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
