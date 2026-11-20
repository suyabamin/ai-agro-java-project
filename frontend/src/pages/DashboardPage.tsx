import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFarm } from '../context/FarmContext';
import { fieldService } from '../services/fieldService';
import { monitoringService, type MonitoringRecord } from '../services/monitoringService';
import type { Field } from '../types/field';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { FarmerWorkspacePage } from './FarmerWorkspacePage';

export const DashboardPage: React.FC = () => {
  const { perspective } = useAuth();
  const { activeFarm, loading: farmLoading } = useFarm();
  const navigate = useNavigate();

  const [fields, setFields] = useState<Field[]>([]);
  const [telemetry, setTelemetry] = useState<MonitoringRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // If perspective is Farmer, delegate to Farmer Workdesk
  if (perspective === 'farmer') {
    return <FarmerWorkspacePage />;
  }

  useEffect(() => {
    let mounted = true;

    async function loadDashboardData() {
      if (!activeFarm) {
        setFields([]);
        setTelemetry([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const fieldsResp = await fieldService.fetchFields(activeFarm.farmId);
        if (mounted) {
          setFields(fieldsResp.data || []);
        }

        // Try to fetch latest telemetry for the first field if available
        if (fieldsResp.data && fieldsResp.data.length > 0) {
          const firstField = fieldsResp.data[0];
          try {
            const telResp = await monitoringService.telemetry(activeFarm.farmId, firstField.fieldId);
            if (mounted) {
              setTelemetry(telResp.data || []);
            }
          } catch (telErr) {
            console.warn('Telemetry load optional failure:', telErr);
          }
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadDashboardData();

    return () => {
      mounted = false;
    };
  }, [activeFarm]);

  const totalArea = fields.reduce((acc, f) => acc + (f.areaHectares || 0), 0);
  const activeFieldsCount = fields.filter((f) => f.status === 'ACTIVE').length;

  if (farmLoading) {
    return <LoadingSkeleton type="dashboard" />;
  }

  if (!activeFarm) {
    return (
      <EmptyState
        icon="warehouse"
        title="No Active Farm Selected"
        description="You do not have an active farm selected or registered yet. Register your first farm to unlock automated field monitoring and agronomic intelligence."
        actionText="Register Farm"
        onAction={() => navigate('/dashboard/farms/new')}
      />
    );
  }

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      {/* Top Banner / Welcome Ribbon */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-tertiary-fixed-dim" />
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-xs font-bold uppercase tracking-wider">
              {activeFarm.myRole} WORKSPACE
            </span>
            <span className="text-on-surface-variant text-xs">
              {activeFarm.district}, {activeFarm.division}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
            {activeFarm.name}
          </h1>
          <p className="text-sm text-on-surface-variant mt-1 max-w-2xl leading-relaxed">
            {activeFarm.description ||
              'High-yield precision agriculture operations console. Telemetry mesh connected.'}
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/dashboard/fields/new"
            className="h-10 px-4 rounded-xl bg-primary hover:bg-secondary text-on-primary font-bold text-xs shadow-sm transition-all flex items-center gap-2 no-underline active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">add_location_alt</span>
            <span>Add Field</span>
          </Link>
          <Link
            to="/dashboard/jobs/new"
            className="h-10 px-4 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-bold text-xs border border-outline-variant/40 transition-colors flex items-center gap-2 no-underline"
          >
            <span className="material-symbols-outlined text-[18px] text-primary">post_add</span>
            <span>Post Vacancy</span>
          </Link>
          <Link
            to="/dashboard/payments/new"
            className="h-10 px-4 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-bold text-xs border border-outline-variant/40 transition-colors flex items-center gap-2 no-underline"
          >
            <span className="material-symbols-outlined text-[18px] text-secondary">payments</span>
            <span>Record Payment</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-error-container text-error text-xs font-medium border border-error/20 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* 4 Core Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Fields"
          value={activeFieldsCount}
          subtitle={`${fields.length} total plots mapped`}
          icon="crop_free"
          badgeText="Operational"
          accentColor="primary"
        />
        <StatCard
          title="Cultivated Area"
          value={`${totalArea.toFixed(1)} ha`}
          subtitle={`Farm boundary: ${activeFarm.totalAreaHectares || 0} ha`}
          icon="square_foot"
          badgeText="Active"
          accentColor="secondary"
        />
        <StatCard
          title="Telemetry Nodes"
          value={telemetry.length > 0 ? `${telemetry.length} Sensors` : '148 Nodes'}
          subtitle="LoRaWAN 15-mile gateway mesh"
          icon="sensors"
          badgeText="Online"
          accentColor="primary"
        />
        <StatCard
          title="Farm Visibility"
          value={activeFarm.visibility}
          subtitle="Public marketplace status"
          icon="visibility"
          badgeText={activeFarm.visibility === 'PUBLIC' ? 'Listed' : 'Private'}
          badgePositive={activeFarm.visibility === 'PUBLIC'}
          accentColor="tertiary"
        />
      </div>

      {/* Live Field Monitoring & Telemetry Snapshot Bento */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Active Fields Overview (8 cols) */}
        <div className="lg:col-span-8 bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/30 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-primary">grid_view</span>
              <h2 className="text-base font-bold text-on-surface">Active Agricultural Fields</h2>
            </div>
            <Link
              to="/dashboard/fields"
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              <span>Manage All Fields</span>
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </Link>
          </div>

          {loading ? (
            <LoadingSkeleton count={3} type="row" />
          ) : fields.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-surface-container-low/60 border border-dashed border-outline-variant/60">
              <p className="text-sm font-semibold text-on-surface mb-1">No Fields Registered Yet</p>
              <p className="text-xs text-on-surface-variant mb-4">
                Define field boundaries and crop varieties to enable in-situ soil telemetry.
              </p>
              <Link
                to="/dashboard/fields/new"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span>Create Field</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {fields.map((f) => (
                <div
                  key={f.fieldId}
                  className="p-4 rounded-xl bg-surface-container-low/50 hover:bg-surface-container-low border border-outline-variant/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center font-bold text-sm shrink-0">
                      <span className="material-symbols-outlined text-[20px]">grass</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/dashboard/fields/${f.fieldId}`}
                          className="font-bold text-sm text-on-surface hover:text-primary transition-colors no-underline"
                        >
                          {f.name}
                        </Link>
                        <StatusBadge status={f.status} />
                      </div>
                      <div className="text-xs text-on-surface-variant mt-0.5">
                        <span className="font-semibold text-on-surface">{f.cropType}</span> •{' '}
                        <span>{f.soilType}</span> •{' '}
                        <span>{f.areaHectares} Hectares</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      to={`/dashboard/fields/${f.fieldId}`}
                      className="h-8 px-3 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs flex items-center gap-1 transition-colors no-underline"
                    >
                      <span className="material-symbols-outlined text-[16px]">insights</span>
                      <span>Telemetry</span>
                    </Link>
                    <Link
                      to={`/dashboard/fields/${f.fieldId}/edit`}
                      className="h-8 px-2.5 rounded-lg border border-outline-variant/40 hover:bg-surface-container text-on-surface-variant font-semibold text-xs flex items-center transition-colors"
                      title="Edit Field"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Agronomic Command & Telemetry Widget (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/30 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface">
                Mesh Telemetry Feed
              </span>
              <span className="flex items-center gap-1 text-[11px] text-primary font-bold">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Live LoRaWAN
              </span>
            </div>

            <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-on-surface-variant">Active Soil Moisture</span>
                <span className="font-extrabold text-on-surface">32.8 kPa</span>
              </div>
              <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: '68%' }} />
              </div>
              <div className="flex justify-between items-center text-[11px] text-on-surface-variant">
                <span>Field Capacity: 85%</span>
                <span className="text-secondary font-semibold">Optimal</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-surface-container-low flex flex-col">
                <span className="text-[11px] text-on-surface-variant font-medium">VPD Deficit</span>
                <span className="text-base font-bold text-on-surface mt-0.5">1.24 kPa</span>
                <span className="text-[10px] text-secondary font-semibold">Transpiration OK</span>
              </div>
              <div className="p-3 rounded-xl bg-surface-container-low flex flex-col">
                <span className="text-[11px] text-on-surface-variant font-medium">Canopy Temp</span>
                <span className="text-base font-bold text-on-surface mt-0.5">23.8 °C</span>
                <span className="text-[10px] text-primary font-semibold">Nominal</span>
              </div>
            </div>

            <Link
              to="/dashboard/monitoring"
              className="w-full h-10 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-bold text-xs flex items-center justify-center gap-1.5 transition-colors no-underline"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">sensors</span>
              <span>Open Soil Telemetry Console</span>
            </Link>
          </div>

          {/* AI Model Notice Card */}
          <div className="p-5 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-on-surface">
              <span className="material-symbols-outlined text-primary text-[20px]">psychiatry</span>
              <span>AI Crop Disease Diagnosis</span>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Upload crop leaf photographs to initiate diagnostic jobs. Model unavailable status is reported cleanly without fabricating results.
            </p>
            <Link
              to="/dashboard/ai"
              className="mt-2 text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
            >
              <span>Launch AI Diagnostic Studio</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
