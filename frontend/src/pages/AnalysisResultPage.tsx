import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { monitoringService, type MonitoringRecord } from '../services/monitoringService';
import { StatusBadge } from '../components/ui/StatusBadge';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';

export const AnalysisResultPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const fieldId = searchParams.get('fieldId') || '';
  const { activeFarm } = useFarm();
  const navigate = useNavigate();

  const [record, setRecord] = useState<MonitoringRecord | null>(null);
  const [availability, setAvailability] = useState<MonitoringRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!activeFarm || !fieldId) return;
    setLoading(true);
    setError(null);
    try {
      const availRes = await monitoringService.diseaseAvailability(activeFarm.farmId, fieldId).catch(() => ({ data: { available: false, status: 'MODEL_UNAVAILABLE' } }));
      setAvailability(availRes.data || { available: false, status: 'MODEL_UNAVAILABLE' });

      // Fetch analyses list to find this record
      const analysesRes = await monitoringService.analyses(activeFarm.farmId, fieldId).catch(() => ({ data: { items: [] } }));
      const items = analysesRes.data?.items || [];
      const match = items.find((r) => String(r.id || '') === id) || items[0] || null;
      setRecord(match);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve diagnostic result');
    } finally {
      setLoading(false);
    }
  }, [activeFarm, fieldId, id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!activeFarm) {
    return (
      <div className="p-8 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/30">
        <h2 className="text-base font-bold text-on-surface">No Farm Selected</h2>
        <Link to="/dashboard/farms" className="mt-3 inline-block px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold">
          Go to My Farms
        </Link>
      </div>
    );
  }

  if (loading) {
    return <LoadingSkeleton type="dashboard" />;
  }

  const isModelOnline = availability?.available === true || availability?.status === 'AVAILABLE';

  return (
    <div className="space-y-6 max-w-[1000px] mx-auto">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard/ai"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Back to AI Studio</span>
        </Link>
        <span className="px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface-variant text-xs font-bold uppercase tracking-wider">
          {activeFarm.name}
        </span>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-error-container text-error text-xs font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Main Diagnostic Dossier */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30 relative overflow-hidden space-y-6">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-tertiary-fixed-dim" />

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Foliar Diagnostic Report
              </span>
              <StatusBadge status={isModelOnline ? 'AVAILABLE' : 'MODEL_UNAVAILABLE'} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
              Crop Disease Analysis Result
            </h1>
            <p className="text-xs text-on-surface-variant font-mono mt-0.5">
              Image ID: {id} • Zone: {fieldId || 'Primary Field'}
            </p>
          </div>

          <Link
            to={`/dashboard/ai/upload?fieldId=${encodeURIComponent(fieldId)}`}
            className="h-10 px-4 rounded-xl bg-primary hover:bg-secondary text-on-primary font-bold text-xs shadow-sm flex items-center gap-1.5 no-underline active:scale-95 transition-all shrink-0"
          >
            <span className="material-symbols-outlined text-[16px]">add_a_photo</span>
            <span>Test Another Leaf</span>
          </Link>
        </div>

        {/* Strict Honesty Notice regarding MODEL_UNAVAILABLE */}
        {!isModelOnline ? (
          <div className="p-5 rounded-2xl bg-surface-container-low border border-outline-variant/40 space-y-3">
            <div className="flex items-center gap-2 text-on-surface font-bold text-sm">
              <span className="material-symbols-outlined text-[20px] text-amber-600">info</span>
              <span>Model Inactive: Transparent Contract Enforcement</span>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              The edge deep-learning inference service is currently reported as <strong>MODEL_UNAVAILABLE</strong>. In adherence to AgroAI core architecture integrity, no simulated disease classifications, fictitious pathogen classes, or synthetic accuracy percentages are generated.
            </p>
            <div className="p-3 rounded-xl bg-surface-container-lowest text-xs text-on-surface space-y-1">
              <span className="font-bold block">Standard Agronomic Next Steps:</span>
              <ul className="list-disc pl-4 space-y-0.5 text-on-surface-variant">
                <li>Inspect canopy for physical signs of chlorosis, necrosis, or pest infestation.</li>
                <li>Verify IoT soil moisture probes to rule out drought stress or waterlogging.</li>
                <li>Dispatch a verified field specialist through the <Link to="/dashboard/farmers" className="text-primary font-semibold hover:underline">Farmer Directory</Link> for physical ground evaluation.</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="p-5 rounded-2xl bg-secondary-container/20 border border-secondary/30 space-y-3">
            <div className="flex items-center gap-2 text-primary font-bold text-sm">
              <span className="material-symbols-outlined text-[20px]">check_circle</span>
              <span>Neural Network Inference Available</span>
            </div>
            <p className="text-xs text-on-surface leading-relaxed">
              Edge convolutional model evaluated the leaf canopy. Status: <strong>{String(record?.status || 'PROCESSED')}</strong>.
            </p>
          </div>
        )}

        {/* Meta Info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs">
          <div>
            <span className="text-[10px] text-on-surface-variant uppercase font-semibold">Evaluation Target</span>
            <div className="font-bold text-on-surface mt-0.5">{fieldId || 'Zone Alpha'}</div>
          </div>
          <div>
            <span className="text-[10px] text-on-surface-variant uppercase font-semibold">Ingestion Timestamp</span>
            <div className="font-bold text-on-surface mt-0.5">
              {record?.createdAt ? new Date(String(record.createdAt)).toLocaleDateString() : 'Just now'}
            </div>
          </div>
          <div>
            <span className="text-[10px] text-on-surface-variant uppercase font-semibold">Classification Model</span>
            <div className="font-mono text-primary font-bold mt-0.5">AgroVision-Edge-v1</div>
          </div>
          <div>
            <span className="text-[10px] text-on-surface-variant uppercase font-semibold">Inference Status</span>
            <div className="font-bold text-secondary mt-0.5">
              {String(record?.status || 'MODEL_UNAVAILABLE')}
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-outline-variant/20 flex items-center justify-between text-xs">
          <Link
            to="/dashboard/ai/history"
            className="text-primary font-semibold hover:underline flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">history</span>
            <span>View Full Foliar History</span>
          </Link>
          <button
            type="button"
            onClick={() => navigate('/dashboard/ai')}
            className="h-9 px-4 rounded-xl border border-outline-variant/40 hover:bg-surface-container text-on-surface font-semibold text-xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
