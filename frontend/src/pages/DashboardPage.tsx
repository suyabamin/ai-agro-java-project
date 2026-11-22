import React, { useEffect, useState, useMemo } from 'react';
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
import {
  buildFieldDecisionRow,
  computeFarmAiSummary,
  aggregateFarmTelemetry,
  type BadgeSeverity,
} from '../utils/farmAiInsights';

export const DashboardPage: React.FC = () => {
  const { perspective } = useAuth();
  const { activeFarm, loading: farmLoading } = useFarm();
  const navigate = useNavigate();

  const [fields, setFields] = useState<Field[]>([]);
  const [fieldAnalyses, setFieldAnalyses] = useState<Record<string, MonitoringRecord>>({});
  const [fieldTelemetryMap, setFieldTelemetryMap] = useState<Record<string, MonitoringRecord[]>>({});
  const [selectedTelemetrySector, setSelectedTelemetrySector] = useState<string>('ALL');
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
        setFieldAnalyses({});
        setFieldTelemetryMap({});
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const fieldsResp = await fieldService.fetchFields(activeFarm.farmId);
        const fieldsList = fieldsResp.data || [];
        if (mounted) {
          setFields(fieldsList);
        }

        // Fetch latest agricultural analyses and telemetry for ALL fields
        if (fieldsList.length > 0) {
          const analysesMap: Record<string, MonitoringRecord> = {};
          const telMap: Record<string, MonitoringRecord[]> = {};

          // 1. Efficient farm-level batch retrieval (avoids N+1 roundtrips)
          try {
            const [batchAnalysesRes, batchTelemetryRes] = await Promise.allSettled([
              monitoringService.latestFarmAgriculturalAnalyses(activeFarm.farmId),
              monitoringService.latestFarmTelemetry(activeFarm.farmId),
            ]);

            if (batchAnalysesRes.status === 'fulfilled' && batchAnalysesRes.value?.data) {
              Object.assign(analysesMap, batchAnalysesRes.value.data);
            }
            if (batchTelemetryRes.status === 'fulfilled' && batchTelemetryRes.value?.data) {
              Object.assign(telMap, batchTelemetryRes.value.data);
            }
          } catch {
            // Batch endpoint fallback
          }

          // 2. Fallback per-field retrieval for any field missing from batch
          const missingFields = fieldsList.filter(f => !analysesMap[f.fieldId] || !telMap[f.fieldId]);
          if (missingFields.length > 0) {
            await Promise.allSettled(
              missingFields.map(async (f) => {
                if (!analysesMap[f.fieldId]) {
                  try {
                    const aRes = await monitoringService.listAgriculturalAnalyses(activeFarm.farmId, f.fieldId, null, 1);
                    if (aRes.data?.items && aRes.data.items.length > 0) {
                      analysesMap[f.fieldId] = aRes.data.items[0];
                      if (f.localFieldId) analysesMap[f.localFieldId] = aRes.data.items[0];
                    }
                  } catch {
                    // Ignore per-field fallback error
                  }
                }
                if (!telMap[f.fieldId]) {
                  try {
                    const tRes = await monitoringService.telemetry(activeFarm.farmId, f.fieldId);
                    if (tRes.data) {
                      telMap[f.fieldId] = tRes.data;
                      if (f.localFieldId) telMap[f.localFieldId] = tRes.data;
                    }
                  } catch {
                    telMap[f.fieldId] = [];
                  }
                }
              })
            );
          }

          if (mounted) {
            setFieldAnalyses(analysesMap);
            setFieldTelemetryMap(telMap);
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

  // Automatic polling when any field has PENDING or PROCESSING analysis
  useEffect(() => {
    if (!activeFarm) return;
    const hasActiveAnalysis = Object.values(fieldAnalyses).some(
      (a) => a && (
        a.status === 'PENDING' || a.status === 'PROCESSING' ||
        a.tabularStatus === 'PENDING' || a.tabularStatus === 'PROCESSING'
      )
    );

    if (!hasActiveAnalysis) return;

    let attempts = 0;
    const maxAttempts = 20; // 50 seconds max polling duration

    const intervalId = window.setInterval(async () => {
      attempts++;
      try {
        const batchRes = await monitoringService.latestFarmAgriculturalAnalyses(activeFarm.farmId);
        if (batchRes?.data) {
          setFieldAnalyses((prev) => ({ ...prev, ...batchRes.data }));
          const stillActive = Object.values(batchRes.data).some(
            (a) => a && (
              a.status === 'PENDING' || a.status === 'PROCESSING' ||
              a.tabularStatus === 'PENDING' || a.tabularStatus === 'PROCESSING'
            )
          );
          if (!stillActive || attempts >= maxAttempts) {
            window.clearInterval(intervalId);
          }
        }
      } catch {
        if (attempts >= maxAttempts) {
          window.clearInterval(intervalId);
        }
      }
    }, 2500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fieldAnalyses, activeFarm]);

  // Unique fields array
  const uniqueFields = useMemo(() => {
    return Array.from(new Map(fields.map((f) => [f.fieldId, f])).values());
  }, [fields]);

  const totalArea = uniqueFields.reduce((acc, f) => acc + (f.areaHectares || 0), 0);
  const activeFieldsCount = uniqueFields.filter((f) => f.status === 'ACTIVE').length;

  // Farm AI Insights counts calculated from real persisted records via utility
  const metrics = useMemo(() => {
    return computeFarmAiSummary(uniqueFields, fieldAnalyses);
  }, [uniqueFields, fieldAnalyses]);

  // Farm-wide telemetry aggregation
  const aggregatedTelemetry = useMemo(() => {
    return aggregateFarmTelemetry(fieldTelemetryMap);
  }, [fieldTelemetryMap]);

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
          subtitle={`${uniqueFields.length} total plots mapped`}
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
          value={
            aggregatedTelemetry.totalReadings > 0
              ? `${aggregatedTelemetry.totalReadings} Packets`
              : `${uniqueFields.length * 8} Sensor Slots`
          }
          subtitle={
            aggregatedTelemetry.totalReadings > 0
              ? `${aggregatedTelemetry.activeSectorsReporting} of ${uniqueFields.length} sectors active`
              : 'Mesh awaiting telemetry'
          }
          icon="sensors"
          badgeText={aggregatedTelemetry.totalReadings > 0 ? 'Online' : 'Standby'}
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

      {/* Farm AI Insights Section */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-primary text-[24px]">psychiatry</span>
              <h2 className="text-lg sm:text-xl font-bold text-on-surface">Farm AI Insights</h2>
            </div>
            <p className="text-xs text-on-surface-variant">
              Persisted agronomic intelligence, water requirements, and field condition evaluations across all farm sectors. Shared canonically with assigned farmers.
            </p>
          </div>
          <Link
            to="/dashboard/ai"
            className="h-9 px-4 rounded-xl bg-primary hover:bg-secondary text-on-primary font-bold text-xs flex items-center gap-1.5 no-underline shadow-sm transition-all self-start sm:self-auto"
          >
            <span className="material-symbols-outlined text-[16px]">analytics</span>
            <span>AI Diagnostics Center</span>
          </Link>
        </div>

        {/* AI Metric Summary Strip (Calculated dynamically from real persisted records) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-center">
            <span className="text-[10px] font-bold uppercase text-on-surface-variant block">Total Fields</span>
            <span className="text-xl font-extrabold text-on-surface mt-1 block">{metrics.totalFields}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-center">
            <span className="text-[10px] font-bold uppercase text-primary block">Completed</span>
            <span className="text-xl font-extrabold text-primary mt-1 block">{metrics.completed}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-center">
            <span className="text-[10px] font-bold uppercase text-amber-600 block">Needs Attention</span>
            <span className="text-xl font-extrabold text-amber-600 mt-1 block">{metrics.needingAttention}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-center">
            <span className="text-[10px] font-bold uppercase text-error block">Critical / Urgent</span>
            <span className="text-xl font-extrabold text-error mt-1 block">{metrics.critical}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-center">
            <span className="text-[10px] font-bold uppercase text-secondary block">Pending</span>
            <span className="text-xl font-extrabold text-secondary mt-1 block">{metrics.pending}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-center">
            <span className="text-[10px] font-bold uppercase text-on-surface-variant block">Failed</span>
            <span className="text-xl font-extrabold text-on-surface-variant mt-1 block">{metrics.failed}</span>
          </div>
        </div>

        {/* Field-wise AI Decision Table (Dynamically renders exactly N rows for N active fields) */}
        <div className="overflow-x-auto rounded-xl border border-outline-variant/30">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-container-low text-on-surface uppercase text-[10px] font-bold tracking-wider border-b border-outline-variant/30">
              <tr>
                <th className="px-4 py-3">Field Zone</th>
                <th className="px-4 py-3">Crop Variety</th>
                <th className="px-4 py-3">Latest Evaluation</th>
                <th className="px-4 py-3">Water Need</th>
                <th className="px-4 py-3">Field Status</th>
                <th className="px-4 py-3">Recommended Crop</th>
                <th className="px-4 py-3">Disease Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20 bg-surface-container-lowest">
              {uniqueFields.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-on-surface-variant text-xs">
                    No field parcels registered under this farm holding.
                  </td>
                </tr>
              ) : (
                uniqueFields.map((f) => {
                  const analysis = fieldAnalyses[f.fieldId] || (f.localFieldId ? fieldAnalyses[f.localFieldId] : undefined);
                  const row = buildFieldDecisionRow(f, analysis);

                  const getBadgeClass = (badge: BadgeSeverity): string => {
                    switch (badge) {
                      case 'urgent':
                      case 'critical':
                        return 'bg-error/15 text-error font-extrabold border border-error/30';
                      case 'high':
                      case 'attention':
                        return 'bg-amber-500/15 text-amber-700 font-bold border border-amber-500/30';
                      case 'moderate':
                        return 'bg-amber-400/15 text-amber-800 font-semibold border border-amber-400/20';
                      case 'low':
                        return 'bg-primary/15 text-primary font-bold border border-primary/30';
                      case 'healthy':
                        return 'bg-secondary/15 text-secondary font-bold border border-secondary/30';
                      case 'pending':
                        return 'bg-secondary/15 text-secondary font-bold animate-pulse border border-secondary/30';
                      case 'failed':
                        return 'bg-error/15 text-error font-bold border border-error/30';
                      default:
                        return 'text-outline italic';
                    }
                  };

                  return (
                    <tr key={`ai-row-${f.fieldId}`} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="px-4 py-3.5">
                        <Link
                          to={row.decisionUrl}
                          className="font-bold text-on-surface hover:text-primary no-underline block"
                        >
                          {row.fieldName}
                        </Link>
                        <span className="font-mono text-[10px] text-on-surface-variant">{row.fieldId}</span>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-on-surface">
                        {row.cropType}
                      </td>
                      <td className="px-4 py-3.5 text-on-surface-variant">
                        {row.status === 'PENDING' ? (
                          <span className="inline-flex items-center gap-1.5 text-secondary font-bold">
                            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                            Analysis queued
                          </span>
                        ) : row.status === 'PROCESSING' ? (
                          <span className="inline-flex items-center gap-1.5 text-primary font-bold">
                            <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                            Analyzing...
                          </span>
                        ) : row.status === 'FAILED' ? (
                          <span className="inline-flex items-center gap-1 text-error font-medium" title={analysis?.errorMessage ? String(analysis.errorMessage) : undefined}>
                            <span className="material-symbols-outlined text-[14px]">error</span>
                            Analysis failed
                          </span>
                        ) : row.status === 'INSUFFICIENT_DATA' ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                            <span className="material-symbols-outlined text-[14px]">warning</span>
                            Insufficient data
                          </span>
                        ) : row.status === 'UNEVALUATED' ? (
                          <span className="text-outline italic">No evaluation yet</span>
                        ) : (
                          <span>{row.formattedDate}</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {row.status === 'UNEVALUATED' ? (
                          <span className="text-outline">—</span>
                        ) : row.status === 'PENDING' ? (
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${getBadgeClass(row.waterNeedBadge)}`}>
                            Queued
                          </span>
                        ) : row.status === 'PROCESSING' ? (
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${getBadgeClass(row.waterNeedBadge)}`}>
                            Analyzing...
                          </span>
                        ) : row.status === 'FAILED' ? (
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${getBadgeClass(row.waterNeedBadge)}`}>
                            Failed
                          </span>
                        ) : row.status === 'INSUFFICIENT_DATA' ? (
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${getBadgeClass(row.waterNeedBadge)}`}>
                            Insufficient data
                          </span>
                        ) : (
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getBadgeClass(row.waterNeedBadge)}`}>
                            {row.waterNeed || 'N/A'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {row.status === 'UNEVALUATED' ? (
                          <span className="text-outline">—</span>
                        ) : row.status === 'PENDING' ? (
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${getBadgeClass(row.fieldStatusBadge)}`}>
                            Queued
                          </span>
                        ) : row.status === 'PROCESSING' ? (
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${getBadgeClass(row.fieldStatusBadge)}`}>
                            Analyzing...
                          </span>
                        ) : row.status === 'FAILED' ? (
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${getBadgeClass(row.fieldStatusBadge)}`}>
                            Failed
                          </span>
                        ) : row.status === 'INSUFFICIENT_DATA' ? (
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${getBadgeClass(row.fieldStatusBadge)}`}>
                            Insufficient data
                          </span>
                        ) : (
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getBadgeClass(row.fieldStatusBadge)}`}>
                            {row.fieldStatus || 'N/A'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {row.status === 'COMPLETED' ? (
                          <span className="capitalize font-semibold text-on-surface">
                            {row.recommendedCrop || '—'}
                          </span>
                        ) : row.status === 'PENDING' ? (
                          <span className="text-secondary italic text-xs">Queued</span>
                        ) : row.status === 'PROCESSING' ? (
                          <span className="text-primary italic text-xs">Analyzing...</span>
                        ) : row.status === 'FAILED' ? (
                          <span className="text-error italic text-xs">Failed</span>
                        ) : row.status === 'INSUFFICIENT_DATA' ? (
                          <span className="text-amber-700 italic text-xs">Insufficient data</span>
                        ) : (
                          <span className="text-outline">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="px-2 py-0.5 rounded bg-surface-container font-mono text-[10px] text-on-surface-variant">
                          {row.diseaseStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          to={row.decisionUrl}
                          className="h-8 px-3 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs inline-flex items-center gap-1 no-underline transition-colors"
                        >
                          <span>View Decision</span>
                          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
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

            {/* Field Sector Selector (Dynamic Multi-Field View) */}
            {uniqueFields.length > 0 && (
              <div className="space-y-1">
                <label
                  htmlFor="telemetry-sector-select"
                  className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block"
                >
                  Sector Telemetry View
                </label>
                <select
                  id="telemetry-sector-select"
                  value={selectedTelemetrySector}
                  onChange={(e) => setSelectedTelemetrySector(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-surface-container-low text-on-surface text-xs border border-outline-variant/30 font-medium cursor-pointer outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="ALL">All Farm Sectors (Aggregated Summary)</option>
                  {uniqueFields.map((f) => (
                    <option key={f.fieldId} value={f.fieldId}>
                      {f.name} ({f.cropType || 'General'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Telemetry Data Display */}
            {selectedTelemetrySector === 'ALL' ? (
              aggregatedTelemetry.totalReadings > 0 ? (
                <>
                  <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-on-surface-variant">Average Soil Moisture</span>
                      <span className="font-extrabold text-on-surface">
                        {aggregatedTelemetry.avgSoilMoisture !== null ? `${aggregatedTelemetry.avgSoilMoisture}%` : '—'}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{
                          width: `${Math.min(100, Math.max(0, (aggregatedTelemetry.avgSoilMoisture || 0) * 2))}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-on-surface-variant">
                      <span>Reporting Sectors: {aggregatedTelemetry.activeSectorsReporting} / {uniqueFields.length}</span>
                      <span className="text-secondary font-semibold">Active Mesh</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-surface-container-low flex flex-col">
                      <span className="text-[11px] text-on-surface-variant font-medium">Mean Humidity</span>
                      <span className="text-base font-bold text-on-surface mt-0.5">
                        {aggregatedTelemetry.avgHumidity !== null ? `${aggregatedTelemetry.avgHumidity}%` : '—'}
                      </span>
                      <span className="text-[10px] text-secondary font-semibold">Ambient Air</span>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-container-low flex flex-col">
                      <span className="text-[11px] text-on-surface-variant font-medium">Mean Temp</span>
                      <span className="text-base font-bold text-on-surface mt-0.5">
                        {aggregatedTelemetry.avgTemperature !== null ? `${aggregatedTelemetry.avgTemperature} °C` : '—'}
                      </span>
                      <span className="text-[10px] text-primary font-semibold">Canopy Zone</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-6 rounded-xl bg-surface-container-low border border-outline-variant/20 text-center space-y-2">
                  <span className="material-symbols-outlined text-[32px] text-outline">sensors_off</span>
                  <p className="text-xs font-bold text-on-surface">No Telemetry Recorded</p>
                  <p className="text-[11px] text-on-surface-variant">
                    Submit in-situ measurements from field workdesks to activate live mesh insights.
                  </p>
                </div>
              )
            ) : (
              // Specific sector view
              (() => {
                const sectorReadings = fieldTelemetryMap[selectedTelemetrySector] || [];
                const moisture = sectorReadings.find((r) =>
                  String(r.measurementType || '').toUpperCase().includes('MOISTURE')
                );
                const temp = sectorReadings.find((r) =>
                  String(r.measurementType || '').toUpperCase().includes('TEMP')
                );
                const humidity = sectorReadings.find((r) =>
                  String(r.measurementType || '').toUpperCase().includes('HUMID')
                );

                return sectorReadings.length > 0 ? (
                  <>
                    <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-on-surface-variant">Sector Soil Moisture</span>
                        <span className="font-extrabold text-on-surface">
                          {moisture ? `${moisture.value ?? moisture.rawValue}%` : '—'}
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(0, Number(moisture?.value ?? moisture?.rawValue ?? 0) * 2)
                            )}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-on-surface-variant">
                        <span>Readings: {sectorReadings.length} packets</span>
                        <span className="text-primary font-semibold">Synchronized</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-surface-container-low flex flex-col">
                        <span className="text-[11px] text-on-surface-variant font-medium">Humidity</span>
                        <span className="text-base font-bold text-on-surface mt-0.5">
                          {humidity ? `${humidity.value ?? humidity.rawValue}%` : '—'}
                        </span>
                        <span className="text-[10px] text-secondary font-semibold">Relative</span>
                      </div>
                      <div className="p-3 rounded-xl bg-surface-container-low flex flex-col">
                        <span className="text-[11px] text-on-surface-variant font-medium">Temperature</span>
                        <span className="text-base font-bold text-on-surface mt-0.5">
                          {temp ? `${temp.value ?? temp.rawValue} °C` : '—'}
                        </span>
                        <span className="text-[10px] text-primary font-semibold">Sensor Probe</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-6 rounded-xl bg-surface-container-low border border-outline-variant/20 text-center space-y-2">
                    <span className="material-symbols-outlined text-[32px] text-outline">sensors_off</span>
                    <p className="text-xs font-bold text-on-surface">No Sector Telemetry</p>
                    <p className="text-[11px] text-on-surface-variant">
                      This field sector has no telemetry readings recorded yet.
                    </p>
                    <Link
                      to={`/dashboard/fields/${selectedTelemetrySector}`}
                      className="inline-block mt-2 px-3 py-1.5 rounded-lg bg-primary text-on-primary text-[11px] font-bold no-underline"
                    >
                      Record Telemetry
                    </Link>
                  </div>
                );
              })()
            )}

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
