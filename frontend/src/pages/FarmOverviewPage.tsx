import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { farmService } from '../services/farmService';
import { fieldService } from '../services/fieldService';
import type { Farm } from '../types/farm';
import type { Field } from '../types/field';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { useFarm } from '../context/FarmContext';

export const FarmOverviewPage: React.FC = () => {
  const { farmId } = useParams<{ farmId: string }>();
  const { setActiveFarmId } = useFarm();

  const [farm, setFarm] = useState<Farm | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!farmId) return;

    let mounted = true;
    async function fetchFarmData() {
      setLoading(true);
      setError(null);
      try {
        const farmResp = await farmService.fetchFarmById(farmId!);
        if (mounted) {
          setFarm(farmResp.data || null);
          setActiveFarmId(farmId!);
        }

        const fieldsResp = await fieldService.fetchFields(farmId!);
        if (mounted) {
          setFields(fieldsResp.data || []);
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load farm details');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchFarmData();

    return () => {
      mounted = false;
    };
  }, [farmId, setActiveFarmId]);

  if (loading) {
    return <LoadingSkeleton type="dashboard" />;
  }

  if (error || !farm) {
    return (
      <div className="p-8 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/30">
        <span className="material-symbols-outlined text-[36px] text-error mb-2">error</span>
        <h2 className="text-lg font-bold text-on-surface">Unable to Load Farm</h2>
        <p className="text-xs text-on-surface-variant mt-1 mb-4">{error || 'Farm not found'}</p>
        <Link
          to="/dashboard/farms"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold"
        >
          <span>Return to Farms</span>
        </Link>
      </div>
    );
  }

  const cultivatedArea = fields.reduce((acc, f) => acc + (f.areaHectares || 0), 0);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard/farms"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Back to All Farms</span>
        </Link>
        <div className="flex items-center gap-2">
          <StatusBadge status={farm.status} />
          <StatusBadge status={farm.visibility} />
        </div>
      </div>

      {/* Hero Overview Banner */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-tertiary-fixed-dim" />

        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-xs font-bold uppercase tracking-wider">
              {farm.myRole} WORKSPACE
            </span>
            <span className="text-on-surface-variant text-xs">
              {farm.district}, {farm.division}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
            {farm.name}
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-1 max-w-2xl leading-relaxed">
            {farm.description || 'Enterprise precision agricultural plot network.'}
          </p>
          {farm.detailedAddress && (
            <div className="flex items-center gap-1 mt-2 text-xs text-on-surface font-medium">
              <span className="material-symbols-outlined text-[16px] text-primary">location_on</span>
              <span>{farm.detailedAddress}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link
            to={`/dashboard/fields/new`}
            className="h-10 px-4 rounded-xl bg-primary hover:bg-secondary text-on-primary font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 no-underline active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">add_location_alt</span>
            <span>Add Field</span>
          </Link>
          <Link
            to={`/dashboard/settings/farm`}
            className="h-10 px-4 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-bold text-xs border border-outline-variant/40 transition-colors flex items-center gap-1.5 no-underline"
          >
            <span className="material-symbols-outlined text-[18px] text-primary">tune</span>
            <span>Farm Settings</span>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Plots"
          value={fields.filter((f) => f.status === 'ACTIVE').length}
          subtitle={`${fields.length} registered zones`}
          icon="crop_free"
          badgeText="Active"
        />
        <StatCard
          title="Total Area"
          value={`${farm.totalAreaHectares || 0} ha`}
          subtitle={`${cultivatedArea.toFixed(1)} ha partitioned`}
          icon="square_foot"
          badgeText="Boundary"
          accentColor="secondary"
        />
        <StatCard
          title="Telemetry Link"
          value="148 Nodes"
          subtitle="LoRaWAN Active"
          icon="sensors"
          badgeText="Online"
        />
        <StatCard
          title="Governance Role"
          value={farm.myRole}
          subtitle={`Version ${farm.version}`}
          icon="admin_panel_settings"
          badgeText={farm.visibility}
          accentColor="tertiary"
        />
      </div>

      {/* Fields List Under This Farm */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/30 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">grass</span>
            <h2 className="text-base font-bold text-on-surface">Field Zones ({fields.length})</h2>
          </div>
          <Link
            to="/dashboard/fields/new"
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
          >
            <span>+ Add Field</span>
          </Link>
        </div>

        {fields.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-surface-container-low/50 border border-dashed border-outline-variant/50">
            <p className="text-sm font-semibold text-on-surface mb-1">No Fields Registered in This Farm</p>
            <p className="text-xs text-on-surface-variant mb-4">
              Create fields to define crop varieties, soil types, and telemetry sensor assignments.
            </p>
            <Link
              to="/dashboard/fields/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold"
            >
              <span>Create First Field</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fields.map((field) => (
              <div
                key={field.fieldId}
                className="p-4 rounded-xl bg-surface-container-low/60 hover:bg-surface-container-low border border-outline-variant/30 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-bold text-sm text-on-surface">{field.name}</span>
                    <StatusBadge status={field.status} />
                  </div>
                  <div className="text-xs text-on-surface-variant space-y-1 mb-3">
                    <div>Crop: <strong className="text-on-surface">{field.cropType}</strong></div>
                    <div>Soil: <strong className="text-on-surface">{field.soilType}</strong></div>
                    <div>Area: <strong className="text-on-surface">{field.areaHectares} ha</strong></div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-outline-variant/20">
                  <Link
                    to={`/dashboard/fields/${field.fieldId}`}
                    className="flex-1 h-8 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold flex items-center justify-center gap-1 no-underline"
                  >
                    <span className="material-symbols-outlined text-[15px] text-primary">insights</span>
                    <span>Field Telemetry</span>
                  </Link>
                  <Link
                    to={`/dashboard/fields/${field.fieldId}/edit`}
                    className="h-8 px-2.5 rounded-lg border border-outline-variant/40 hover:bg-surface-container text-on-surface-variant text-xs flex items-center justify-center"
                    title="Edit Field"
                  >
                    <span className="material-symbols-outlined text-[15px]">edit</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
