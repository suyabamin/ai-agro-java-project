import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { fieldService } from '../services/fieldService';
import type { Field } from '../types/field';
import { FieldMonitoringPanel } from '../components/monitoring/FieldMonitoringPanel';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';

export const SoilMonitoringDashboardPage: React.FC = () => {
  const { activeFarm } = useFarm();
  const navigate = useNavigate();

  const [fields, setFields] = useState<Field[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeFarm) return;
    let mounted = true;

    async function loadFields() {
      setLoading(true);
      setError(null);
      try {
        const resp = await fieldService.fetchFields(activeFarm!.farmId);
        if (mounted) {
          const list = resp.data || [];
          setFields(list);
          if (list.length > 0) {
            setSelectedFieldId(list[0].fieldId);
          }
        }
      } catch (err: unknown) {
        if (mounted) setError(err instanceof Error ? err.message : 'Failed to load fields');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadFields();
    return () => {
      mounted = false;
    };
  }, [activeFarm]);

  if (!activeFarm) {
    return (
      <EmptyState
        icon="warehouse"
        title="No Farm Selected"
        description="Select an active farm to inspect IoT probe telemetry and soil dielectric monitoring."
        actionText="My Farms"
        onAction={() => navigate('/dashboard/farms')}
      />
    );
  }

  if (loading) {
    return <LoadingSkeleton type="dashboard" />;
  }

  if (fields.length === 0) {
    return (
      <EmptyState
        icon="sensors"
        title="No Field Zones Configured"
        description={`There are no monitored field zones configured under "${activeFarm.name}". Add a field zone to begin capturing IoT telemetry.`}
        actionText="Add Field Zone"
        onAction={() => navigate('/dashboard/fields/new')}
      />
    );
  }

  const selectedField = fields.find((f) => f.fieldId === selectedFieldId) || fields[0];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              IoT Sensor Network
            </span>
            <span className="text-xs text-on-surface-variant">• {activeFarm.name}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
            Soil Probes & Telemetry
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Real-time multi-depth volumetric water content, soil conductivity, and microclimate telemetry.
          </p>
        </div>

        {/* Field Zone Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-on-surface-variant font-semibold">Active Sector:</span>
          <select
            value={selectedFieldId}
            onChange={(e) => setSelectedFieldId(e.target.value)}
            className="h-10 px-3 rounded-lg bg-surface-container-low text-on-surface text-xs outline-none focus:ring-2 focus:ring-primary border border-transparent cursor-pointer font-bold"
          >
            {fields.map((f) => (
              <option key={f.fieldId} value={f.fieldId}>
                {f.name} — {f.cropType} ({f.areaHectares} ha)
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-error-container text-error text-xs font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Field Overview Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-xs shadow-sm">
        <div>
          <span className="text-[10px] text-on-surface-variant uppercase font-semibold">Zone Identifier</span>
          <div className="font-bold text-on-surface text-sm">{selectedField.name}</div>
        </div>
        <div>
          <span className="text-[10px] text-on-surface-variant uppercase font-semibold">Crop Variety</span>
          <div className="font-bold text-primary text-sm">{selectedField.cropType}</div>
        </div>
        <div>
          <span className="text-[10px] text-on-surface-variant uppercase font-semibold">Soil Classification</span>
          <div className="font-bold text-on-surface text-sm">{selectedField.soilType || 'Loamy'}</div>
        </div>
        <div>
          <span className="text-[10px] text-on-surface-variant uppercase font-semibold">Acreage</span>
          <div className="font-bold text-secondary text-sm">{selectedField.areaHectares} Hectares</div>
        </div>
      </div>

      {/* Embedded High-Fidelity Field Monitoring & Telemetry Panel */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30">
        <FieldMonitoringPanel
          farmId={activeFarm.farmId}
          fieldId={selectedField.fieldId}
          canManage={true}
        />
      </div>
    </div>
  );
};
