import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFarm } from '../context/FarmContext';
import { useLanguage } from '../context/LanguageContext';
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
  const { t, formatNumber } = useLanguage();
  const navigate = useNavigate();

  const [fields, setFields] = useState<Field[]>([]);
  const [fieldAnalyses, setFieldAnalyses] = useState<Record<string, MonitoringRecord>>({});
  const [fieldDiseaseMap, setFieldDiseaseMap] = useState<Record<string, MonitoringRecord>>({});
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
        setFieldDiseaseMap({});
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

        // Fetch latest agricultural analyses, disease analyses, and telemetry for ALL fields
        if (fieldsList.length > 0) {
          const analysesMap: Record<string, MonitoringRecord> = {};
          const diseaseMap: Record<string, MonitoringRecord> = {};
          const telMap: Record<string, MonitoringRecord[]> = {};

          // 1. Efficient farm-level batch retrieval (avoids N+1 roundtrips)
          try {
            const [batchAnalysesRes, batchDiseaseRes, batchTelemetryRes] = await Promise.allSettled([
              monitoringService.latestFarmAgriculturalAnalyses(activeFarm.farmId),
              monitoringService.latestFarmDiseaseAnalyses(activeFarm.farmId),
              monitoringService.latestFarmTelemetry(activeFarm.farmId),
            ]);

            if (batchAnalysesRes.status === 'fulfilled' && batchAnalysesRes.value?.data) {
              Object.assign(analysesMap, batchAnalysesRes.value.data);
            }
            if (batchDiseaseRes.status === 'fulfilled' && batchDiseaseRes.value?.data) {
              Object.assign(diseaseMap, batchDiseaseRes.value.data);
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
            setFieldDiseaseMap(diseaseMap);
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
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 rounded-md bg-secondary-container text-on-secondary-container text-xs font-medium capitalize">
              {t('dashboard.ownerWorkspace', { role: activeFarm.myRole?.toLowerCase() || t('badge.owner') })}
            </span>
            <span className="text-on-surface-variant text-xs">
              {activeFarm.district}, {activeFarm.division}
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-on-surface tracking-tight">
            {activeFarm.name}
          </h1>
          <p className="text-sm text-on-surface-variant mt-1 max-w-2xl leading-relaxed">
            {activeFarm.description || t('dashboard.defaultDescription')}
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/dashboard/fields/new"
            className="h-9 px-3.5 rounded-lg bg-primary hover:bg-secondary text-on-primary font-medium text-xs shadow-sm transition-colors flex items-center gap-1.5 no-underline"
          >
            <span className="material-symbols-outlined text-[16px]">add_location_alt</span>
            <span>{t('dashboard.addField')}</span>
          </Link>
          <Link
            to="/dashboard/jobs/new"
            className="h-9 px-3.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-medium text-xs border border-outline-variant/50 transition-colors flex items-center gap-1.5 no-underline"
          >
            <span className="material-symbols-outlined text-[16px] text-primary">post_add</span>
            <span>{t('dashboard.postVacancy')}</span>
          </Link>
          <Link
            to="/dashboard/payments/new"
            className="h-9 px-3.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-medium text-xs border border-outline-variant/50 transition-colors flex items-center gap-1.5 no-underline"
          >
            <span className="material-symbols-outlined text-[16px] text-secondary">payments</span>
            <span>{t('dashboard.recordPayment')}</span>
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
          title={t('dashboard.statTotalFields')}
          value={formatNumber(activeFieldsCount)}
          subtitle={`${formatNumber(uniqueFields.length)} ${t('dashboard.activePlots', { count: uniqueFields.length })}`}
          icon="crop_free"
          badgeText={t('badge.active')}
          accentColor="primary"
        />
        <StatCard
          title={t('dashboard.statTotalArea')}
          value={`${formatNumber(totalArea.toFixed(1))} ha`}
          subtitle={`Farm boundary: ${formatNumber(activeFarm.totalAreaHectares || 0)} ha`}
          icon="square_foot"
          badgeText={t('badge.active')}
          accentColor="secondary"
        />
        <StatCard
          title={t('dashboard.statTelemetryLink')}
          value={
            aggregatedTelemetry.totalReadings > 0
              ? `${formatNumber(aggregatedTelemetry.totalReadings)} Packets`
              : `${formatNumber(uniqueFields.length * 8)} Sensor Slots`
          }
          subtitle={
            aggregatedTelemetry.totalReadings > 0
              ? `${formatNumber(aggregatedTelemetry.activeSectorsReporting)} of ${formatNumber(uniqueFields.length)} sectors active`
              : t('dashboard.awaitingFields')
          }
          icon="sensors"
          badgeText={aggregatedTelemetry.totalReadings > 0 ? t('badge.online') : t('dashboard.standby')}
          accentColor="primary"
        />
        <StatCard
          title={t('dashboard.statGovernanceRole')}
          value={activeFarm.visibility === 'PUBLIC' ? t('farm.public') : t('farm.private')}
          subtitle={t('common.status')}
          icon="visibility"
          badgeText={activeFarm.visibility === 'PUBLIC' ? t('farm.public') : t('farm.private')}
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
              <h2 className="text-lg sm:text-xl font-bold text-on-surface">{t('dashboard.aiInsightsTitle')}</h2>
            </div>
            <p className="text-xs text-on-surface-variant">
              {t('dashboard.aiInsightsSubtitle')}
            </p>
          </div>
          <Link
            to="/dashboard/ai"
            className="h-9 px-3.5 rounded-lg bg-primary hover:bg-secondary text-on-primary font-medium text-xs flex items-center gap-1.5 no-underline shadow-sm transition-colors self-start sm:self-auto"
          >
            <span className="material-symbols-outlined text-[16px]">analytics</span>
            <span>{t('dashboard.aiCenterButton')}</span>
          </Link>
        </div>

        {/* AI Metric Summary Strip (Calculated dynamically from real persisted records) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-center">
            <span className="text-xs font-medium text-on-surface-variant block">{t('dashboard.totalFields')}</span>
            <span className="text-2xl font-semibold text-on-surface mt-0.5 block tabular-nums font-mono">{formatNumber(metrics.totalFields)}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-center">
            <span className="text-xs font-medium text-primary block">{t('dashboard.completed')}</span>
            <span className="text-2xl font-semibold text-primary mt-0.5 block tabular-nums font-mono">{formatNumber(metrics.completed)}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-center">
            <span className="text-xs font-medium text-amber-700 block">{t('dashboard.needingAttention')}</span>
            <span className="text-2xl font-semibold text-amber-700 mt-0.5 block tabular-nums font-mono">{formatNumber(metrics.needingAttention)}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-center">
            <span className="text-xs font-medium text-error block">{t('dashboard.critical')}</span>
            <span className="text-2xl font-semibold text-error mt-0.5 block tabular-nums font-mono">{formatNumber(metrics.critical)}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-center">
            <span className="text-xs font-medium text-secondary block">{t('dashboard.pending')}</span>
            <span className="text-2xl font-semibold text-secondary mt-0.5 block tabular-nums font-mono">{formatNumber(metrics.pending)}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-center">
            <span className="text-xs font-medium text-on-surface-variant block">{t('dashboard.failed')}</span>
            <span className="text-2xl font-semibold text-on-surface-variant mt-0.5 block tabular-nums font-mono">{formatNumber(metrics.failed)}</span>
          </div>
        </div>

        {/* Field-wise AI Decision Table (Dynamically renders exactly N rows for N active fields) */}
        <div className="overflow-x-auto rounded-xl border border-outline-variant/30">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-container-low text-on-surface-variant text-xs font-medium border-b border-outline-variant/30">
              <tr>
                <th className="px-4 py-3 font-medium">{t('dashboard.colField')}</th>
                <th className="px-4 py-3 font-medium">{t('dashboard.colCrop')}</th>
                <th className="px-4 py-3 font-medium">{t('dashboard.colEvaluation')}</th>
                <th className="px-4 py-3 font-medium">{t('dashboard.colWater')}</th>
                <th className="px-4 py-3 font-medium">{t('dashboard.colCondition')}</th>
                <th className="px-4 py-3 font-medium">{t('dashboard.colRecommendedCrop')}</th>
                <th className="px-4 py-3 font-medium">{t('dashboard.colDisease')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('dashboard.colAction')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20 bg-surface-container-lowest">
              {uniqueFields.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-on-surface-variant text-xs">
                    {t('dashboard.noFields')}
                  </td>
                </tr>
              ) : (
                uniqueFields.map((f) => {
                  const analysis = fieldAnalyses[f.fieldId] || (f.localFieldId ? fieldAnalyses[f.localFieldId] : undefined);
                  const disease = fieldDiseaseMap[f.fieldId] || (f.localFieldId ? fieldDiseaseMap[f.localFieldId] : undefined);
                  const row = buildFieldDecisionRow(f, analysis, disease);

                  const getBadgeClass = (badge: BadgeSeverity): string => {
                    switch (badge) {
                      case 'urgent':
                      case 'critical':
                        return 'bg-[#faecea] dark:bg-[#3b1816] text-[#a82a1d] dark:text-[#f28b82] font-medium border border-[#f2cfcb] dark:border-[#5c1c17]';
                      case 'high':
                      case 'attention':
                        return 'bg-[#fbf4e8] dark:bg-[#3d2605] text-[#935b13] dark:text-[#f5ba5e] font-medium border border-[#f0debe] dark:border-[#633e08]';
                      case 'moderate':
                        return 'bg-[#f8f6ee] dark:bg-[#362f13] text-[#786118] dark:text-[#dfc36b] font-medium border border-[#eadebf] dark:border-[#5a4e1d]';
                      case 'low':
                      case 'healthy':
                        return 'bg-[#eaf4ee] dark:bg-[#143521] text-[#1b4d32] dark:text-[#6ec28d] font-medium border border-[#cce5d6] dark:border-[#1e4a30]';
                      case 'pending':
                        return 'bg-[#f0ede4] dark:bg-[#232924] text-[#5e584e] dark:text-[#a39f95] font-medium border border-[#ded9cd] dark:border-[#38423a]';
                      case 'failed':
                        return 'bg-[#faecea] dark:bg-[#3b1816] text-[#a82a1d] dark:text-[#f28b82] font-medium border border-[#f2cfcb] dark:border-[#5c1c17]';
                      default:
                        return 'text-outline italic';
                    }
                  };

                  return (
                    <tr key={`ai-row-${f.fieldId}`} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="px-4 py-3.5">
                        <Link
                          to={row.decisionUrl}
                          className="font-medium text-on-surface hover:text-primary no-underline block"
                        >
                          {row.fieldName}
                        </Link>
                        <span className="font-mono text-[10px] text-on-surface-variant">{row.fieldId}</span>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-on-surface">
                        {row.cropType}
                      </td>
                      <td className="px-4 py-3.5 text-on-surface-variant">
                        {row.status === 'PENDING' ? (
                          <span className="inline-flex items-center gap-1.5 text-secondary font-medium text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                            Analysis queued
                          </span>
                        ) : row.status === 'PROCESSING' ? (
                          <span className="inline-flex items-center gap-1.5 text-primary font-medium text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                            Analyzing...
                          </span>
                        ) : row.status === 'FAILED' ? (
                          <span className="inline-flex items-center gap-1 text-[#a82a1d] font-medium text-[11px]" title={analysis?.errorMessage ? String(analysis.errorMessage) : undefined}>
                            <span className="material-symbols-outlined text-[14px]">error</span>
                            Analysis failed
                          </span>
                        ) : row.status === 'INSUFFICIENT_DATA' ? (
                          <span className="inline-flex items-center gap-1 text-[#935b13] font-medium text-[11px]">
                            <span className="material-symbols-outlined text-[14px]">warning</span>
                            Insufficient data
                          </span>
                        ) : row.status === 'UNEVALUATED' ? (
                          <span className="text-outline italic text-[11px]">No evaluation yet</span>
                        ) : (
                          <span className="tabular-nums font-mono text-[11px]">{row.formattedDate}</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {row.status === 'UNEVALUATED' ? (
                          <span className="text-outline">—</span>
                        ) : row.status === 'PENDING' ? (
                          <span className={`px-2 py-0.5 rounded-md font-medium text-[11px] ${getBadgeClass(row.waterNeedBadge)}`}>
                            Queued
                          </span>
                        ) : row.status === 'PROCESSING' ? (
                          <span className={`px-2 py-0.5 rounded-md font-medium text-[11px] ${getBadgeClass(row.waterNeedBadge)}`}>
                            Analyzing...
                          </span>
                        ) : row.status === 'FAILED' ? (
                          <span className={`px-2 py-0.5 rounded-md font-medium text-[11px] ${getBadgeClass(row.waterNeedBadge)}`}>
                            Failed
                          </span>
                        ) : row.status === 'INSUFFICIENT_DATA' ? (
                          <span className={`px-2 py-0.5 rounded-md font-medium text-[11px] ${getBadgeClass(row.waterNeedBadge)}`}>
                            Insufficient data
                          </span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${getBadgeClass(row.waterNeedBadge)}`}>
                            {row.waterNeed || 'N/A'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {row.status === 'UNEVALUATED' ? (
                          <span className="text-outline">—</span>
                        ) : row.status === 'PENDING' ? (
                          <span className={`px-2 py-0.5 rounded-md font-medium text-[11px] ${getBadgeClass(row.fieldStatusBadge)}`}>
                            Queued
                          </span>
                        ) : row.status === 'PROCESSING' ? (
                          <span className={`px-2 py-0.5 rounded-md font-medium text-[11px] ${getBadgeClass(row.fieldStatusBadge)}`}>
                            Analyzing...
                          </span>
                        ) : row.status === 'FAILED' ? (
                          <span className={`px-2 py-0.5 rounded-md font-medium text-[11px] ${getBadgeClass(row.fieldStatusBadge)}`}>
                            Failed
                          </span>
                        ) : row.status === 'INSUFFICIENT_DATA' ? (
                          <span className={`px-2 py-0.5 rounded-md font-medium text-[11px] ${getBadgeClass(row.fieldStatusBadge)}`}>
                            Insufficient data
                          </span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${getBadgeClass(row.fieldStatusBadge)}`}>
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
                        <span className="px-2 py-0.5 rounded-md bg-surface-container font-mono text-[10px] text-on-surface-variant">
                          {row.diseaseStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          to={row.decisionUrl}
                          className="h-8 px-3 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-medium text-xs inline-flex items-center gap-1 no-underline transition-colors border border-outline-variant/40"
                        >
                          <span>{t('dashboard.viewDecision')}</span>
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
                  className="p-4 rounded-xl bg-surface-container-low/50 hover:bg-surface-container-low border border-outline-variant/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-lg bg-surface-container text-primary flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[18px]">grass</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/dashboard/fields/${f.fieldId}`}
                          className="font-medium text-sm text-on-surface hover:text-primary transition-colors no-underline"
                        >
                          {f.name}
                        </Link>
                        <StatusBadge status={f.status} />
                      </div>
                      <div className="text-xs text-on-surface-variant mt-0.5">
                        <span className="font-medium text-on-surface">{f.cropType}</span> •{' '}
                        <span>{f.soilType}</span> •{' '}
                        <span className="tabular-nums font-mono">{f.areaHectares} ha</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      to={`/dashboard/fields/${f.fieldId}`}
                      className="h-8 px-3 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-medium text-xs flex items-center gap-1.5 transition-colors no-underline border border-outline-variant/40"
                    >
                      <span className="material-symbols-outlined text-[15px]">insights</span>
                      <span>Telemetry</span>
                    </Link>
                    <Link
                      to={`/dashboard/fields/${f.fieldId}/edit`}
                      className="h-8 px-2.5 rounded-lg border border-outline-variant/40 hover:bg-surface-container text-on-surface-variant font-medium text-xs flex items-center transition-colors"
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

        {/* Right Column: Agronomic Command & Telemetry Widget (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/30 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-on-surface">
                Field telemetry feed
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-secondary font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                In-situ telemetry
              </span>
            </div>

            {/* Field Sector Selector (Dynamic Multi-Field View) */}
            {uniqueFields.length > 0 && (
              <div className="space-y-1">
                <label
                  htmlFor="telemetry-sector-select"
                  className="text-xs font-medium text-on-surface-variant block mb-1"
                >
                  Sector view
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
                      <span className="font-medium text-sm text-on-surface tabular-nums font-mono">
                        {aggregatedTelemetry.avgSoilMoisture !== null ? `${aggregatedTelemetry.avgSoilMoisture}%` : '—'}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, Math.max(0, Number(aggregatedTelemetry.avgSoilMoisture || 0)))}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-on-surface-variant">
                      <span>Reporting sectors: <strong className="tabular-nums font-mono font-medium">{aggregatedTelemetry.activeSectorsReporting} / {uniqueFields.length}</strong></span>
                      <span className="text-secondary font-medium">Synchronized</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/20 flex flex-col">
                      <span className="text-[11px] text-on-surface-variant font-medium">Mean humidity</span>
                      <span className="text-base font-medium text-on-surface mt-0.5 tabular-nums font-mono">
                        {aggregatedTelemetry.avgHumidity !== null ? `${aggregatedTelemetry.avgHumidity}%` : '—'}
                      </span>
                      <span className="text-[10px] text-on-surface-variant">Ambient air</span>
                    </div>
                    <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/20 flex flex-col">
                      <span className="text-[11px] text-on-surface-variant font-medium">Mean temperature</span>
                      <span className="text-base font-medium text-on-surface mt-0.5 tabular-nums font-mono">
                        {aggregatedTelemetry.avgTemperature !== null ? `${aggregatedTelemetry.avgTemperature} °C` : '—'}
                      </span>
                      <span className="text-[10px] text-on-surface-variant">Canopy zone</span>
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
                        <span className="text-on-surface-variant">{t('dashboard.sectorMoisture')}</span>
                        <span className="font-medium text-sm text-on-surface tabular-nums font-mono">
                          {moisture ? `${formatNumber(String(moisture.value ?? moisture.rawValue))}%` : '—'}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(0, Number(moisture?.value ?? moisture?.rawValue ?? 0))
                            )}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-on-surface-variant">
                        <span>{t('dashboard.readingsPackets', { count: sectorReadings.length })}</span>
                        <span className="text-secondary font-medium">{t('dashboard.synchronizedStatus')}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/20 flex flex-col">
                        <span className="text-[11px] text-on-surface-variant font-medium">{t('dashboard.humidity')}</span>
                        <span className="text-base font-medium text-on-surface mt-0.5 tabular-nums font-mono">
                          {humidity ? `${formatNumber(String(humidity.value ?? humidity.rawValue))}%` : '—'}
                        </span>
                        <span className="text-[10px] text-on-surface-variant">{t('dashboard.relative')}</span>
                      </div>
                      <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/20 flex flex-col">
                        <span className="text-[11px] text-on-surface-variant font-medium">{t('dashboard.temperature')}</span>
                        <span className="text-base font-medium text-on-surface mt-0.5 tabular-nums font-mono">
                          {temp ? `${formatNumber(String(temp.value ?? temp.rawValue))} °C` : '—'}
                        </span>
                        <span className="text-[10px] text-on-surface-variant">{t('dashboard.sensorProbe')}</span>
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
              className="w-full h-9 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-medium text-xs flex items-center justify-center gap-1.5 transition-colors no-underline border border-outline-variant/40"
            >
              <span className="material-symbols-outlined text-[16px] text-primary">sensors</span>
              <span>{t('dashboard.openTelemetry')}</span>
            </Link>
          </div>

          {/* AI Model Notice Card */}
          <div className="p-5 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-medium text-on-surface">
              <span className="material-symbols-outlined text-primary text-[18px]">psychiatry</span>
              <span>{t('dashboard.aiCropNotice')}</span>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {t('dashboard.aiCropDesc')}
            </p>
            <Link
              to="/dashboard/ai"
              className="mt-1 text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              <span>{t('dashboard.launchStudio')}</span>
              <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
