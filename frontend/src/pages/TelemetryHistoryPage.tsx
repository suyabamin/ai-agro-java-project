import React, { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { monitoringService, type MonitoringRecord, type MonitoringPage } from '../services/monitoringService';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';

export const TelemetryHistoryPage: React.FC = () => {
  const { activeFarm } = useFarm();
  const [searchParams] = useSearchParams();
  const fieldId = searchParams.get('fieldId') || '';
  const [measurementType, setMeasurementType] = useState('');
  const [page, setPage] = useState<MonitoringPage<MonitoringRecord> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cur?: string) => {
    if (!activeFarm || !fieldId) return;
    setLoading(true); setError(null);
    try {
      const res = await monitoringService.telemetryHistory(activeFarm.farmId, fieldId, measurementType || undefined, cur);
      setPage(res.data || { items: [], nextCursor: null, hasNext: false, pageSize: 50 });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load telemetry');
    } finally { setLoading(false); }
  }, [activeFarm, fieldId, measurementType]);

  useEffect(() => { if (fieldId) load(); }, [load, fieldId]);

  const items = page?.items || [];

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link to="/dashboard/monitoring" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Soil Monitoring
        </Link>
        <h1 className="text-lg font-bold text-on-surface">Telemetry History</h1>
      </div>

      {!fieldId && (
        <div className="p-8 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-center">
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant block mb-2">sensors</span>
          <p className="text-sm text-on-surface-variant">Navigate here from a field's monitoring panel to view telemetry history.</p>
          <Link to="/dashboard/monitoring" className="mt-3 inline-block px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold">Go to Monitoring</Link>
        </div>
      )}

      {fieldId && (
        <>
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-4 flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <label className="text-xs font-semibold text-on-surface-variant">Measurement Type</label>
              <select
                value={measurementType}
                onChange={e => setMeasurementType(e.target.value)}
                className="h-9 px-3 rounded-lg bg-surface-container text-on-surface text-xs outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All Types</option>
                <option value="SOIL_MOISTURE">Soil Moisture</option>
                <option value="TEMPERATURE">Temperature</option>
                <option value="HUMIDITY">Humidity</option>
                <option value="PH">pH Level</option>
                <option value="NITROGEN">Nitrogen</option>
                <option value="PHOSPHORUS">Phosphorus</option>
                <option value="POTASSIUM">Potassium</option>
              </select>
            </div>
            <button onClick={() => load()} className="h-9 px-4 rounded-lg bg-primary text-on-primary text-xs font-bold cursor-pointer hover:bg-primary/90">
              Apply Filter
            </button>
          </div>

          {loading && <LoadingSkeleton type="dashboard" />}

          {!loading && error && (
            <div className="p-6 rounded-2xl bg-error/10 border border-error/30 text-center">
              <p className="text-sm text-error">{error}</p>
              <button onClick={() => load()} className="mt-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold cursor-pointer">Retry</button>
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="p-10 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-center">
              <span className="material-symbols-outlined text-[48px] text-on-surface-variant block mb-2">sensors</span>
              <p className="text-sm font-semibold text-on-surface">No telemetry records</p>
              <p className="text-xs text-on-surface-variant mt-1">No sensor data has been submitted for this field yet.</p>
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-container border-b border-outline-variant/30">
                    <tr>
                      {['Type', 'Value', 'Unit', 'Source', 'Recorded At', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {items.map((item, i) => {
                      const id = String(item.id || item.telemetryId || i);
                      const type = String(item.measurementType || item.type || '—');
                      const value = item.value !== undefined ? String(item.value) : '—';
                      const unit = String(item.unit || '');
                      const source = String(item.source || item.deviceId || 'sensor');
                      const date = item.recordedAt || item.createdAt;
                      const dateStr = date ? new Date(String(date)).toLocaleString() : '—';
                      return (
                        <tr key={id} className="hover:bg-surface-container/50 transition-colors">
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                              <span className="material-symbols-outlined text-[13px]">sensors</span>
                              {type.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-on-surface">{value}</td>
                          <td className="px-4 py-3 text-xs text-on-surface-variant">{unit}</td>
                          <td className="px-4 py-3 text-xs text-on-surface-variant">{source}</td>
                          <td className="px-4 py-3 text-xs text-on-surface-variant">{dateStr}</td>
                          <td className="px-4 py-3">
                            <Link
                              to={`/dashboard/monitoring/telemetry/${encodeURIComponent(id)}?fieldId=${encodeURIComponent(fieldId)}`}
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
        </>
      )}
    </div>
  );
};
