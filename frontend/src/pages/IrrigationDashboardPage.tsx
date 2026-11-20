import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { fieldService } from '../services/fieldService';
import type { Field } from '../types/field';
import { StatCard } from '../components/ui/StatCard';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { StatusBadge } from '../components/ui/StatusBadge';

export const IrrigationDashboardPage: React.FC = () => {
  const { activeFarm } = useFarm();
  const navigate = useNavigate();

  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [pumpRunning, setPumpRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!activeFarm) return;
    let mounted = true;
    async function loadFields() {
      setLoading(true);
      try {
        const resp = await fieldService.fetchFields(activeFarm!.farmId);
        if (mounted) {
          const list = resp.data || [];
          setFields(list);
        }
      } catch {
        // silent fallback
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadFields();
    return () => {
      mounted = false;
    };
  }, [activeFarm]);

  const handleTogglePump = () => {
    setPumpRunning(!pumpRunning);
    setMessage(
      pumpRunning
        ? 'Irrigation solenoid valves closed. Flow terminated.'
        : 'Irrigation cycle initiated. Activating solenoid valves at 120 L/min.'
    );
    setTimeout(() => setMessage(null), 4000);
  };

  if (!activeFarm) {
    return (
      <EmptyState
        icon="warehouse"
        title="No Farm Selected"
        description="Select an active farm to manage irrigation plans and telemetry."
        actionText="My Farms"
        onAction={() => navigate('/dashboard/farms')}
      />
    );
  }

  if (loading) {
    return <LoadingSkeleton type="dashboard" />;
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Hydraulic Management
            </span>
            <span className="text-xs text-on-surface-variant">• {activeFarm.name}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
            Precision Irrigation Control
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Automated solenoid actuation, evapotranspiration forecasting, and water budget allocation.
          </p>
        </div>

        <button
          type="button"
          onClick={handleTogglePump}
          className={`h-11 px-5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shrink-0 ${
            pumpRunning
              ? 'bg-error text-white hover:bg-error/90'
              : 'bg-primary hover:bg-secondary text-on-primary'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {pumpRunning ? 'stop_circle' : 'water_drop'}
          </span>
          <span>{pumpRunning ? 'Halt Main Pump' : 'Actuate Main Pump'}</span>
        </button>
      </div>

      {message && (
        <div className="p-4 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <span>{message}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          title="Water Budget Consumed"
          value="48.5 kL"
          subtitle="Within monthly target"
          icon="water_damage"
        />
        <StatCard
          title="Average Soil Moisture"
          value="64.2%"
          subtitle="Optimal Field Capacity"
          icon="humidity_mid"
        />
        <StatCard
          title="Solenoid Valve Status"
          value={pumpRunning ? 'ACTUATED' : 'CLOSED'}
          subtitle="Telemetry Mesh Synchronized"
          icon="valve"
        />
        <StatCard
          title="24h Rain Forecast"
          value="2.4 mm"
          subtitle="Low precip probability"
          icon="rainy"
        />
      </div>

      {/* Sector Control Grid */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30 space-y-4">
        <h2 className="text-base font-bold text-on-surface">Field Sector Schedules</h2>
        <p className="text-xs text-on-surface-variant">
          Evapotranspiration-driven micro-irrigation schedules partitioned across active farm zones.
        </p>

        {fields.length === 0 ? (
          <EmptyState
            icon="grass"
            title="No Field Zones"
            description="Add field zones to configure sector-specific drip or canal irrigation."
            actionText="Add Field Zone"
            onAction={() => navigate('/dashboard/fields/new')}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fields.map((f) => (
              <div
                key={f.fieldId}
                className="p-5 rounded-xl bg-surface-container-low border border-outline-variant/30 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-on-surface">{f.name}</h3>
                    <p className="text-[11px] text-on-surface-variant">{f.cropType} • {f.areaHectares} ha</p>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface text-[10px] font-bold uppercase">
                    {f.irrigationType || 'DRIP'}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-on-surface-variant">
                  <div className="flex justify-between">
                    <span>Moisture Threshold:</span>
                    <span className="font-bold text-on-surface">45% - 75%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Next Window:</span>
                    <span className="font-semibold text-primary">05:30 AM (Tomorrow)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Estimated Dosage:</span>
                    <span className="font-semibold text-on-surface">1,200 Liters</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-outline-variant/20 flex items-center justify-between">
                  <Link
                    to={`/dashboard/fields/${f.fieldId}`}
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    <span>Inspect Zone</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </Link>
                  <StatusBadge status={pumpRunning ? 'ACTIVE' : 'STANDBY'} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
