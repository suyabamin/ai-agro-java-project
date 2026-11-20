import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { fieldService } from '../services/fieldService';
import { monitoringService } from '../services/monitoringService';
import type { Field } from '../types/field';

export const CreateIrrigationPlanPage: React.FC = () => {
  const { activeFarm } = useFarm();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preFieldId = searchParams.get('fieldId') || '';

  const [fields, setFields] = useState<Field[]>([]);
  const [fieldId, setFieldId] = useState(preFieldId);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadFields = useCallback(async () => {
    if (!activeFarm) return;
    setLoading(true);
    try {
      const res = await fieldService.fetchFields(activeFarm.farmId);
      setFields(res.data || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load fields');
    } finally { setLoading(false); }
  }, [activeFarm]);

  useEffect(() => { loadFields(); }, [loadFields]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFarm || !fieldId) return;
    setCreating(true); setError(null); setSuccess(null);
    try {
      const res = await monitoringService.createIrrigationPlan(activeFarm.farmId, fieldId);
      const planId = String((res.data as Record<string, unknown>)?.planId || (res.data as Record<string, unknown>)?.id || 'new');
      setSuccess('Irrigation plan created successfully.');
      setTimeout(() => navigate(`/dashboard/irrigation/${encodeURIComponent(planId)}?fieldId=${encodeURIComponent(fieldId)}`), 1200);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create irrigation plan';
      if (msg.includes('INSUFFICIENT_DATA') || msg.includes('insufficient')) {
        setError('INSUFFICIENT_DATA — Not enough telemetry readings to generate an irrigation plan. Submit soil moisture and temperature sensor data first.');
      } else {
        setError(msg);
      }
    } finally { setCreating(false); }
  };

  return (
    <div className="space-y-6 max-w-[700px] mx-auto">
      <div className="flex items-center gap-2">
        <Link to="/dashboard/irrigation" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Irrigation Dashboard
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-[22px]">water_drop</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-on-surface">Create Irrigation Plan</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">AI-driven plan generated from field telemetry data.</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <span className="material-symbols-outlined text-amber-600 text-[18px] mt-0.5">info</span>
          <div>
            <p className="text-xs font-semibold text-amber-800">Data Requirement</p>
            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
              Irrigation plans are generated from real sensor telemetry. If the field has insufficient soil moisture, temperature, or humidity data, the system will return an <strong>INSUFFICIENT_DATA</strong> status and no plan will be created.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleCreate} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-6 space-y-6">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-on-surface" htmlFor="field-select">Target Field *</label>
          <select
            id="field-select"
            required
            value={fieldId}
            onChange={e => setFieldId(e.target.value)}
            disabled={loading}
            className="w-full h-10 px-3 rounded-lg bg-surface-container text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary border border-transparent"
          >
            <option value="">Select a field…</option>
            {fields.map(f => (
              <option key={f.fieldId} value={f.fieldId}>{f.name} {f.cropType ? `— ${f.cropType}` : ''}</option>
            ))}
          </select>
          {!activeFarm && <p className="text-xs text-error">No active farm selected. Select a farm first.</p>}
        </div>

        <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20">
          <p className="text-xs text-on-surface-variant leading-relaxed">
            The irrigation plan will be automatically generated by the AI service using the field's latest telemetry readings.
            You cannot manually configure parameters — the system uses sensor data to determine optimal irrigation timing and volume.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-error/10 border border-error/30">
            <p className="text-xs text-error font-semibold">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-4 rounded-xl bg-green-50 border border-green-200">
            <p className="text-xs text-green-700 font-semibold">{success}</p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Link to="/dashboard/irrigation" className="h-10 px-5 inline-flex items-center rounded-xl border border-outline-variant/40 hover:bg-surface-container text-on-surface text-sm font-semibold">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={creating || !fieldId || !activeFarm}
            className="h-10 px-6 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-bold text-sm shadow-sm cursor-pointer disabled:opacity-60 flex items-center gap-2"
          >
            {creating ? (
              <><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span> Generating…</>
            ) : (
              <><span className="material-symbols-outlined text-[16px]">water_drop</span> Generate Plan</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
