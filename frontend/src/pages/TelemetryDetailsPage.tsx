import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { monitoringService, type MonitoringRecord } from '../services/monitoringService';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-outline-variant/15 last:border-0">
      <span className="text-xs font-semibold text-on-surface-variant w-40 shrink-0">{label}</span>
      <span className="text-xs text-on-surface text-right break-all">{value}</span>
    </div>
  );
}

export const TelemetryDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const fieldId = searchParams.get('fieldId') || '';
  const { activeFarm } = useFarm();

  const [record, setRecord] = useState<MonitoringRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeFarm || !fieldId || !id) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      // Telemetry history returns a paginated list; we find by scanning or use specific record if available
      const res = await monitoringService.telemetryHistory(activeFarm.farmId, fieldId);
      const items = res.data?.items || [];
      const match = items.find(item => String(item.id || item.telemetryId) === id);
      if (match) {
        setRecord(match);
      } else {
        setError('Telemetry record not found. It may have been archived or the ID is incorrect.');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load telemetry record');
    } finally { setLoading(false); }
  }, [activeFarm, fieldId, id]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6 max-w-[800px] mx-auto">
      <div className="flex items-center gap-2">
        <Link
          to={`/dashboard/monitoring/telemetry?fieldId=${encodeURIComponent(fieldId)}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Telemetry History
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-[22px]">sensors</span>
        </div>
        <div>
          <h1 className="text-lg font-bold text-on-surface">Telemetry Record</h1>
          <p className="text-xs text-on-surface-variant font-mono">{id}</p>
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
          <h2 className="text-sm font-bold text-on-surface mb-3">Sensor Reading Details</h2>
          <DetailRow label="Record ID" value={String(record.id || record.telemetryId || '—')} />
          <DetailRow label="Measurement Type" value={String(record.measurementType || record.type || '—').replace(/_/g, ' ')} />
          <DetailRow label="Value" value={`${record.value !== undefined ? String(record.value) : '—'} ${record.unit ? String(record.unit) : ''}`} />
          <DetailRow label="Source / Device" value={String(record.source || record.deviceId || 'IoT Sensor')} />
          <DetailRow label="Field ID" value={fieldId} />
          <DetailRow label="Farm ID" value={activeFarm?.farmId || '—'} />
          <DetailRow label="Recorded At" value={record.recordedAt ? new Date(String(record.recordedAt)).toLocaleString() : '—'} />
          <DetailRow label="Created At" value={record.createdAt ? new Date(String(record.createdAt)).toLocaleString() : '—'} />
          {Boolean(record.status) && <DetailRow label="Validation Status" value={String(record.status)} />}
          {Boolean(record.validationMessage) && <DetailRow label="Validation Message" value={String(record.validationMessage)} />}
        </div>
      )}

      {!loading && !error && !record && !error && (
        <div className="p-10 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-center">
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant block mb-2">sensors_off</span>
          <p className="text-sm font-semibold text-on-surface">Record Not Found</p>
        </div>
      )}
    </div>
  );
};
