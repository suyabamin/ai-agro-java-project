import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { fieldService } from '../services/fieldService';
import type { Field } from '../types/field';
import { StatusBadge } from '../components/ui/StatusBadge';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { FieldMonitoringPanel } from '../components/monitoring/FieldMonitoringPanel';

export const FieldDetailsPage: React.FC = () => {
  const { fieldId } = useParams<{ fieldId: string }>();
  const { activeFarm } = useFarm();

  const [field, setField] = useState<Field | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeFarm || !fieldId) return;

    let mounted = true;
    async function loadField() {
      setLoading(true);
      setError(null);
      try {
        const resp = await fieldService.fetchFieldById(activeFarm!.farmId, fieldId!);
        if (mounted) {
          setField(resp.data || null);
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load field details');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadField();

    return () => {
      mounted = false;
    };
  }, [activeFarm, fieldId]);

  if (!activeFarm) {
    return (
      <div className="p-8 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/30">
        <h2 className="text-base font-bold text-on-surface">No Farm Selected</h2>
        <p className="text-xs text-on-surface-variant mt-1 mb-4">Please select an active farm holding.</p>
        <Link to="/dashboard/farms" className="px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold">
          Go to My Farms
        </Link>
      </div>
    );
  }

  if (loading) {
    return <LoadingSkeleton type="dashboard" />;
  }

  if (error || !field) {
    return (
      <div className="p-8 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/30">
        <span className="material-symbols-outlined text-[36px] text-error mb-2">error</span>
        <h2 className="text-lg font-bold text-on-surface">Field Zone Not Found</h2>
        <p className="text-xs text-on-surface-variant mt-1 mb-4">{error || 'Field zone not located in active farm'}</p>
        <Link
          to="/dashboard/fields"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold"
        >
          <span>Return to Field List</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Top Breadcrumb & Status */}
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard/fields"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Back to Field Zones</span>
        </Link>
        <div className="flex items-center gap-2">
          <StatusBadge status={field.status} />
          <Link
            to={`/dashboard/fields/${field.fieldId}/edit`}
            className="h-8 px-3 rounded-lg border border-outline-variant/40 hover:bg-surface-container text-on-surface text-xs font-semibold flex items-center gap-1 transition-colors"
          >
            <span className="material-symbols-outlined text-[15px]">edit</span>
            <span>Edit Zone</span>
          </Link>
        </div>
      </div>

      {/* Field Zone Hero Header */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-tertiary-fixed-dim" />

        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-xs font-bold uppercase tracking-wider">
              {activeFarm.name}
            </span>
            <span className="text-on-surface-variant text-xs">Acreage Sector</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
            {field.name}
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-1 max-w-2xl leading-relaxed">
            {field.notes || 'Monitored precision agricultural field zone.'}
          </p>
        </div>

        {/* Quick Spec Matrix */}
        <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs shrink-0">
          <div>
            <span className="text-[10px] text-on-surface-variant uppercase font-semibold">Crop</span>
            <div className="font-bold text-on-surface truncate">{field.cropType}</div>
          </div>
          <div>
            <span className="text-[10px] text-on-surface-variant uppercase font-semibold">Soil</span>
            <div className="font-bold text-on-surface truncate">{field.soilType}</div>
          </div>
          <div>
            <span className="text-[10px] text-on-surface-variant uppercase font-semibold">Area</span>
            <div className="font-bold text-on-surface">{field.areaHectares} ha</div>
          </div>
        </div>
      </div>

      {/* Embedded High-Fidelity Field Monitoring & In-situ Telemetry Panel */}
      <FieldMonitoringPanel
        farmId={activeFarm.farmId}
        fieldId={field.fieldId}
      />
    </div>
  );
};
