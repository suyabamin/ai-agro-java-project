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
import heroAgricultureImg from '../assets/landing/hero-agriculture.jpg';

const getBadgeClass = (badge: BadgeSeverity): string => {
  switch (badge) {
    case 'urgent':
    case 'critical':
      return 'bg-[#faecea] dark:bg-[#3b1816] text-[#a82a1d] dark:text-[#f28b82] font-semibold border border-[#f2cfcb] dark:border-[#5c1c17]';
    case 'high':
    case 'attention':
      return 'bg-[#fbf4e8] dark:bg-[#3d2605] text-[#935b13] dark:text-[#f5ba5e] font-semibold border border-[#f0debe] dark:border-[#633e08]';
    case 'moderate':
      return 'bg-[#f8f6ee] dark:bg-[#362f13] text-[#786118] dark:text-[#dfc36b] font-semibold border border-[#eadebf] dark:border-[#5a4e1d]';
    case 'low':
    case 'healthy':
      return 'bg-[#eaf4ee] dark:bg-[#143521] text-[#1b4d32] dark:text-[#6ec28d] font-semibold border border-[#cce5d6] dark:border-[#1e4a30]';
    case 'pending':
      return 'bg-[#f0ede4] dark:bg-[#232924] text-[#5e584e] dark:text-[#a39f95] font-semibold border border-[#ded9cd] dark:border-[#38423a]';
    case 'failed':
      return 'bg-[#faecea] dark:bg-[#3b1816] text-[#a82a1d] dark:text-[#f28b82] font-semibold border border-[#f2cfcb] dark:border-[#5c1c17]';
    default:
      return 'text-outline italic';
  }
};

export const DashboardPage: React.FC = () => {
  const { user, perspective } = useAuth();
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
          const missingFields = fieldsList.filter(
            (f) => !analysesMap[f.fieldId] || !telMap[f.fieldId]
          );
          if (missingFields.length > 0) {
            await Promise.allSettled(
              missingFields.map(async (f) => {
                if (!analysesMap[f.fieldId]) {
                  try {
                    const aRes = await monitoringService.listAgriculturalAnalyses(
                      activeFarm.farmId,
                      f.fieldId,
                      null,
                      1
                    );
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
      (a) =>
        a &&
        (a.status === 'PENDING' ||
          a.status === 'PROCESSING' ||
          a.tabularStatus === 'PENDING' ||
          a.tabularStatus === 'PROCESSING')
    );

    if (!hasActiveAnalysis) return;

    let attempts = 0;
    const maxAttempts = 20;

    const intervalId = window.setInterval(async () => {
      attempts++;
      try {
        const batchRes = await monitoringService.latestFarmAgriculturalAnalyses(activeFarm.farmId);
        if (batchRes?.data) {
          setFieldAnalyses((prev) => ({ ...prev, ...batchRes.data }));
          const stillActive = Object.values(batchRes.data).some(
            (a) =>
              a &&
              (a.status === 'PENDING' ||
                a.status === 'PROCESSING' ||
                a.tabularStatus === 'PENDING' ||
                a.tabularStatus === 'PROCESSING')
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

  const uniqueFields = useMemo(() => {
    return Array.from(new Map(fields.map((f) => [f.fieldId, f])).values());
  }, [fields]);

  const totalArea = uniqueFields.reduce((acc, f) => acc + (f.areaHectares || 0), 0);
  const activeFieldsCount = uniqueFields.filter((f) => f.status === 'ACTIVE').length;

  const metrics = useMemo(() => {
    return computeFarmAiSummary(uniqueFields, fieldAnalyses);
  }, [uniqueFields, fieldAnalyses]);

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

  const ownerDisplayName = user?.fullName || user?.name || activeFarm.name;

  const renderEvaluationCell = (
    row: ReturnType<typeof buildFieldDecisionRow>,
    analysis: MonitoringRecord | undefined
  ) => {
    if (row.status === 'PENDING') {
      return (
        <span className="inline-flex items-center gap-1.5 text-secondary font-medium text-[11px]">
          <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
          Analysis queued
        </span>
      );
    }
    if (row.status === 'PROCESSING') {
      return (
        <span className="inline-flex items-center gap-1.5 text-primary font-medium text-[11px]">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Analyzing...
        </span>
      );
    }
    if (row.status === 'FAILED') {
      return (
        <span
          className="inline-flex items-center gap-1 text-[#a82a1d] font-medium text-[11px]"
          title={analysis?.errorMessage ? String(analysis.errorMessage) : undefined}
        >
          <span className="material-symbols-outlined text-[14px]">error</span>
          Analysis failed
        </span>
      );
    }
    if (row.status === 'INSUFFICIENT_DATA') {
      return (
        <span className="inline-flex items-center gap-1 text-[#935b13] font-medium text-[11px]">
          <span className="material-symbols-outlined text-[14px]">warning</span>
          Insufficient data
        </span>
      );
    }
    if (row.status === 'UNEVALUATED') {
      return <span className="text-outline italic text-[11px]">No evaluation yet</span>;
    }
    return <span className="tabular-nums font-mono text-[11px]">{row.formattedDate}</span>;
  };

  const renderStatusPill = (
    row: ReturnType<typeof buildFieldDecisionRow>,
    value: string | null | undefined,
    badge: BadgeSeverity
  ) => {
    if (row.status === 'UNEVALUATED') return <span className="text-outline">—</span>;
    const text =
      row.status === 'PENDING'
        ? 'Queued'
        : row.status === 'PROCESSING'
          ? 'Analyzing...'
          : row.status === 'FAILED'
            ? 'Failed'
            : row.status === 'INSUFFICIENT_DATA'
              ? 'Insufficient data'
              : value || 'N/A';
    return (
      <span className={`px-2 py-0.5 rounded-md text-[11px] inline-block ${getBadgeClass(badge)}`}>
        {text}
      </span>
    );
  };

  return (
    <div className="space-y-6 sm:space-y-7 max-w-[1520px] mx-auto">
      {/* Top Welcome Hero Banner */}
      <div className="agro-hero-enter relative rounded-3xl overflow-hidden shadow-md border border-outline-variant/30 bg-[#103823] text-white">
        <img
          src={heroAgricultureImg}
          alt="Sunlit agricultural field"
          className="absolute inset-0 w-full h-full object-cover object-center opacity-55"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#0b2b1a]/95 via-[#103823]/80 to-[#103823]/40"
        />

        <div className="relative p-6 sm:p-8 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-400/20 border border-emerald-300/30 text-emerald-100 text-[11px] font-bold capitalize">
                <span className="material-symbols-outlined text-[14px]">workspace_premium</span>
                {t('dashboard.ownerWorkspace', {
                  role: activeFarm.myRole?.toLowerCase() || t('badge.owner'),
                })}
              </span>
              {(activeFarm.district || activeFarm.division) && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-100/85 font-medium">
                  <span className="material-symbols-outlined text-[14px]">location_on</span>
                  {[activeFarm.district, activeFarm.division].filter(Boolean).join(', ')}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Welcome back, <span className="text-emerald-300">{ownerDisplayName}</span>
            </h1>

            <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
              <strong className="text-white">{activeFarm.name}</strong> —{' '}
              {activeFarm.description || t('dashboard.defaultDescription')}
            </p>

            {/* Quick Action Buttons (Preserved) */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <Link
                to="/dashboard/fields/new"
                className="h-9 px-4 rounded-full bg-emerald-500 hover:bg-emerald-400 text-[#082415] font-bold text-xs shadow-sm transition-all active:scale-95 flex items-center gap-1.5 no-underline"
              >
                <span className="material-symbols-outlined text-[16px]">add_location_alt</span>
                <span>{t('dashboard.addField')}</span>
              </Link>
              <Link
                to="/dashboard/jobs/new"
                className="h-9 px-4 rounded-full bg-white/15 hover:bg-white/25 text-white font-semibold text-xs border border-white/25 backdrop-blur-xs transition-all flex items-center gap-1.5 no-underline"
              >
                <span className="material-symbols-outlined text-[16px]">post_add</span>
                <span>{t('dashboard.postVacancy')}</span>
              </Link>
              <Link
                to="/dashboard/payments/new"
                className="h-9 px-4 rounded-full bg-white/15 hover:bg-white/25 text-white font-semibold text-xs border border-white/25 backdrop-blur-xs transition-all flex items-center gap-1.5 no-underline"
              >
                <span className="material-symbols-outlined text-[16px]">payments</span>
                <span>{t('dashboard.recordPayment')}</span>
              </Link>
            </div>
          </div>

          {/* Right Quote Pill */}
          <div className="hidden xl:flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 shadow-lg shrink-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-400/25 flex items-center justify-center text-emerald-200">
              <span className="material-symbols-outlined text-[22px]">eco</span>
            </div>
            <p className="text-xs font-bold text-white leading-snug max-w-[180px]">
              &ldquo;Smart Farming for a Prosperous Tomorrow&rdquo;
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-error-container text-error text-xs font-medium border border-error/20 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* 4 Summary Metric Cards */}
      <div className="agro-hero-enter-delay-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('dashboard.statTotalFields')}
          value={formatNumber(activeFieldsCount)}
          subtitle={`${formatNumber(uniqueFields.length)} ${t('dashboard.activePlots', {
            count: uniqueFields.length,
          })}`}
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
              ? `${formatNumber(aggregatedTelemetry.activeSectorsReporting)} of ${formatNumber(
                  uniqueFields.length
                )} sectors active`
              : t('dashboard.awaitingFields')
          }
          icon="sensors"
          badgeText={
            aggregatedTelemetry.totalReadings > 0 ? t('badge.online') : t('dashboard.standby')
          }
          accentColor="blue"
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
      <div className="agro-hero-enter-delay-2 bg-surface-container-lowest rounded-3xl p-5 sm:p-7 shadow-sm border border-outline-variant/30 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">psychiatry</span>
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-on-surface tracking-tight">
                {t('dashboard.aiInsightsTitle')}
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {t('dashboard.aiInsightsSubtitle')}
              </p>
            </div>
          </div>
          <Link
            to="/dashboard/ai"
            className="h-10 px-4 rounded-xl bg-[#0e3b24] hover:bg-[#175133] text-white font-bold text-xs flex items-center gap-1.5 no-underline shadow-sm transition-all active:scale-95 self-start sm:self-auto"
          >
            <span className="material-symbols-outlined text-[16px]">analytics</span>
            <span>{t('dashboard.aiCenterButton')}</span>
            <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
          </Link>
        </div>

        {/* AI Metric Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            {
              label: t('dashboard.totalFields'),
              val: metrics.totalFields,
              icon: 'grass',
              box: 'bg-surface-container-low border-outline-variant/30',
              text: 'text-on-surface',
              iconBg: 'bg-primary/10 text-primary',
            },
            {
              label: t('dashboard.completed'),
              val: metrics.completed,
              icon: 'check_circle',
              box: 'bg-emerald-500/5 border-emerald-500/20',
              text: 'text-emerald-700 dark:text-emerald-300',
              iconBg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
            },
            {
              label: t('dashboard.needingAttention'),
              val: metrics.needingAttention,
              icon: 'priority_high',
              box: 'bg-amber-500/5 border-amber-500/20',
              text: 'text-amber-700 dark:text-amber-300',
              iconBg: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
            },
            {
              label: t('dashboard.critical'),
              val: metrics.critical,
              icon: 'warning',
              box: 'bg-rose-500/5 border-rose-500/20',
              text: 'text-error',
              iconBg: 'bg-rose-500/15 text-error',
            },
            {
              label: t('dashboard.pending'),
              val: metrics.pending,
              icon: 'schedule',
              box: 'bg-sky-500/5 border-sky-500/20',
              text: 'text-sky-700 dark:text-sky-300',
              iconBg: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
            },
            {
              label: t('dashboard.failed'),
              val: metrics.failed,
              icon: 'cancel',
              box: 'bg-surface-container-low border-outline-variant/30',
              text: 'text-on-surface-variant',
              iconBg: 'bg-surface-container text-on-surface-variant',
            },
          ].map((pill) => (
            <div
              key={pill.label}
              className={`p-3.5 rounded-2xl border ${pill.box} flex items-center gap-3`}
            >
              <div
                className={`w-8 h-8 rounded-lg ${pill.iconBg} flex items-center justify-center shrink-0`}
              >
                <span className="material-symbols-outlined text-[17px]">{pill.icon}</span>
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-semibold text-on-surface-variant block truncate">
                  {pill.label}
                </span>
                <span className={`text-xl font-extrabold tabular-nums font-mono ${pill.text}`}>
                  {formatNumber(pill.val)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop & Tablet Table */}
        <div className="hidden md:block overflow-x-auto rounded-2xl border border-outline-variant/30">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-container-low text-on-surface-variant text-xs font-bold border-b border-outline-variant/30">
              <tr>
                <th className="px-4 py-3.5">{t('dashboard.colField')}</th>
                <th className="px-4 py-3.5">{t('dashboard.colCrop')}</th>
                <th className="px-4 py-3.5">{t('dashboard.colEvaluation')}</th>
                <th className="px-4 py-3.5">{t('dashboard.colWater')}</th>
                <th className="px-4 py-3.5">{t('dashboard.colCondition')}</th>
                <th className="px-4 py-3.5">{t('dashboard.colRecommendedCrop')}</th>
                <th className="px-4 py-3.5">{t('dashboard.colDisease')}</th>
                <th className="px-4 py-3.5 text-right">{t('dashboard.colAction')}</th>
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
                  const analysis =
                    fieldAnalyses[f.fieldId] ||
                    (f.localFieldId ? fieldAnalyses[f.localFieldId] : undefined);
                  const disease =
                    fieldDiseaseMap[f.fieldId] ||
                    (f.localFieldId ? fieldDiseaseMap[f.localFieldId] : undefined);
                  const row = buildFieldDecisionRow(f, analysis, disease);

                  return (
                    <tr
                      key={`ai-row-${f.fieldId}`}
                      className="hover:bg-emerald-500/5 transition-colors"
                    >
                      <td className="px-4 py-3.5 max-w-[230px]">
                        <Link
                          to={row.decisionUrl}
                          className="font-bold text-on-surface hover:text-primary no-underline block truncate"
                        >
                          {row.fieldName}
                        </Link>
                        <span className="font-mono text-[10px] text-on-surface-variant break-all block">
                          {row.fieldId}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-on-surface">
                        {row.cropType}
                      </td>
                      <td className="px-4 py-3.5 text-on-surface-variant">
                        {renderEvaluationCell(row, analysis)}
                      </td>
                      <td className="px-4 py-3.5">
                        {renderStatusPill(row, row.waterNeed, row.waterNeedBadge)}
                      </td>
                      <td className="px-4 py-3.5">
                        {renderStatusPill(row, row.fieldStatus, row.fieldStatusBadge)}
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
                          className="h-8 px-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-primary font-bold text-xs inline-flex items-center gap-1 no-underline transition-colors border border-emerald-500/20"
                        >
                          <span>{t('dashboard.viewDecision')}</span>
                          <span className="material-symbols-outlined text-[14px]">
                            arrow_forward
                          </span>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Accessible Field Evaluation Cards (preserves every column on <768px) */}
        <div className="md:hidden space-y-3">
          {uniqueFields.length === 0 ? (
            <div className="p-6 text-center rounded-2xl bg-surface-container-low text-xs text-on-surface-variant">
              {t('dashboard.noFields')}
            </div>
          ) : (
            uniqueFields.map((f) => {
              const analysis =
                fieldAnalyses[f.fieldId] ||
                (f.localFieldId ? fieldAnalyses[f.localFieldId] : undefined);
              const disease =
                fieldDiseaseMap[f.fieldId] ||
                (f.localFieldId ? fieldDiseaseMap[f.localFieldId] : undefined);
              const row = buildFieldDecisionRow(f, analysis, disease);

              return (
                <div
                  key={`ai-card-${f.fieldId}`}
                  className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        to={row.decisionUrl}
                        className="font-bold text-sm text-on-surface hover:text-primary no-underline block"
                      >
                        {row.fieldName}
                      </Link>
                      <span className="font-mono text-[10px] text-on-surface-variant break-all block">
                        {row.fieldId}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-surface-container font-mono text-[10px] text-on-surface-variant shrink-0">
                      {row.cropType}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-on-surface-variant block">
                        {t('dashboard.colEvaluation')}
                      </span>
                      {renderEvaluationCell(row, analysis)}
                    </div>
                    <div>
                      <span className="text-[10px] text-on-surface-variant block">
                        {t('dashboard.colDisease')}
                      </span>
                      <span className="font-mono text-[11px] text-on-surface">
                        {row.diseaseStatus}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-on-surface-variant block">
                        {t('dashboard.colWater')}
                      </span>
                      {renderStatusPill(row, row.waterNeed, row.waterNeedBadge)}
                    </div>
                    <div>
                      <span className="text-[10px] text-on-surface-variant block">
                        {t('dashboard.colCondition')}
                      </span>
                      {renderStatusPill(row, row.fieldStatus, row.fieldStatusBadge)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20 text-xs">
                    <span className="text-on-surface-variant">
                      {t('dashboard.colRecommendedCrop')}:{' '}
                      <strong className="text-on-surface">
                        {row.status === 'COMPLETED' ? row.recommendedCrop || '—' : '—'}
                      </strong>
                    </span>
                    <Link
                      to={row.decisionUrl}
                      className="h-8 px-3 rounded-lg bg-primary text-on-primary font-bold text-xs inline-flex items-center gap-1 no-underline"
                    >
                      <span>{t('dashboard.viewDecision')}</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Lower Bento: Active Agricultural Fields (8 cols) + Telemetry & AI Studio (4 cols) */}
      <div className="agro-hero-enter-delay-3 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Active Fields */}
        <div className="lg:col-span-8 bg-surface-container-lowest rounded-3xl p-5 sm:p-6 shadow-sm border border-outline-variant/30 flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">grid_view</span>
              </div>
              <h2 className="text-base font-extrabold text-on-surface">
                Active Agricultural Fields
              </h2>
            </div>
            <Link
              to="/dashboard/fields"
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1 no-underline"
            >
              <span>Manage All Fields</span>
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </Link>
          </div>

          {loading ? (
            <LoadingSkeleton count={3} type="row" />
          ) : fields.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-surface-container-low/60 border border-dashed border-outline-variant/60">
              <p className="text-sm font-bold text-on-surface mb-1">No Fields Registered Yet</p>
              <p className="text-xs text-on-surface-variant mb-4">
                Define field boundaries and crop varieties to enable in-situ soil telemetry.
              </p>
              <Link
                to="/dashboard/fields/new"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-sm no-underline"
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
                  className="p-4 rounded-2xl bg-surface-container-low/60 hover:bg-surface-container-low border border-outline-variant/30 hover:border-primary/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[20px]">grass</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
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
                        <span className="tabular-nums font-mono">{f.areaHectares} ha</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      to={`/dashboard/fields/${f.fieldId}`}
                      className="h-9 px-3.5 rounded-xl bg-surface-container-lowest hover:bg-surface-container text-on-surface font-semibold text-xs flex items-center gap-1.5 transition-colors no-underline border border-outline-variant/40"
                    >
                      <span className="material-symbols-outlined text-[16px] text-primary">
                        insights
                      </span>
                      <span>Telemetry</span>
                    </Link>
                    <Link
                      to={`/dashboard/fields/${f.fieldId}/edit`}
                      className="h-9 w-9 rounded-xl bg-surface-container-lowest border border-outline-variant/40 hover:bg-surface-container text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-colors"
                      title="Edit Field"
                      aria-label={`Edit ${f.name}`}
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Field Telemetry + AI Crop Disease Diagnosis */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-surface-container-lowest rounded-3xl p-5 sm:p-6 shadow-sm border border-outline-variant/30 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-extrabold text-on-surface">Field Telemetry</span>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                In-situ telemetry
              </span>
            </div>

            {uniqueFields.length > 0 && (
              <div className="space-y-1">
                <label
                  htmlFor="telemetry-sector-select"
                  className="text-[11px] font-semibold text-on-surface-variant block"
                >
                  Sector view
                </label>
                <select
                  id="telemetry-sector-select"
                  value={selectedTelemetrySector}
                  onChange={(e) => setSelectedTelemetrySector(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl bg-surface-container-low text-on-surface text-xs border border-outline-variant/40 font-semibold cursor-pointer outline-none focus:ring-2 focus:ring-primary"
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

            {selectedTelemetrySector === 'ALL' ? (
              aggregatedTelemetry.totalReadings > 0 ? (
                <>
                  <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-on-surface-variant font-medium">
                        Average Soil Moisture
                      </span>
                      <span className="font-extrabold text-base text-primary tabular-nums font-mono">
                        {aggregatedTelemetry.avgSoilMoisture !== null
                          ? `${aggregatedTelemetry.avgSoilMoisture}%`
                          : '—'}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#1b4d32] to-emerald-500 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(0, Number(aggregatedTelemetry.avgSoilMoisture || 0))
                          )}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-on-surface-variant">
                      <span>
                        Reporting sectors:{' '}
                        <strong className="tabular-nums font-mono font-bold text-on-surface">
                          {aggregatedTelemetry.activeSectorsReporting} / {uniqueFields.length}
                        </strong>
                      </span>
                      <span className="text-emerald-700 dark:text-emerald-300 font-semibold">
                        Synchronized
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/25 flex flex-col">
                      <span className="text-[11px] text-on-surface-variant font-semibold">
                        Mean humidity
                      </span>
                      <span className="text-lg font-extrabold text-on-surface mt-0.5 tabular-nums font-mono">
                        {aggregatedTelemetry.avgHumidity !== null
                          ? `${aggregatedTelemetry.avgHumidity}%`
                          : '—'}
                      </span>
                      <span className="text-[10px] text-on-surface-variant">Ambient air</span>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/25 flex flex-col">
                      <span className="text-[11px] text-on-surface-variant font-semibold">
                        Mean temperature
                      </span>
                      <span className="text-lg font-extrabold text-on-surface mt-0.5 tabular-nums font-mono">
                        {aggregatedTelemetry.avgTemperature !== null
                          ? `${aggregatedTelemetry.avgTemperature} °C`
                          : '—'}
                      </span>
                      <span className="text-[10px] text-on-surface-variant">Canopy zone</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/20 text-center space-y-2">
                  <span className="material-symbols-outlined text-[32px] text-outline">
                    sensors_off
                  </span>
                  <p className="text-xs font-bold text-on-surface">No Telemetry Recorded</p>
                  <p className="text-[11px] text-on-surface-variant">
                    Submit in-situ measurements from field workdesks to activate live mesh insights.
                  </p>
                </div>
              )
            ) : (
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
                    <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-on-surface-variant font-medium">
                          {t('dashboard.sectorMoisture')}
                        </span>
                        <span className="font-extrabold text-base text-primary tabular-nums font-mono">
                          {moisture
                            ? `${formatNumber(String(moisture.value ?? moisture.rawValue))}%`
                            : '—'}
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#1b4d32] to-emerald-500 rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(0, Number(moisture?.value ?? moisture?.rawValue ?? 0))
                            )}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-on-surface-variant">
                        <span>
                          {t('dashboard.readingsPackets', { count: sectorReadings.length })}
                        </span>
                        <span className="text-emerald-700 dark:text-emerald-300 font-semibold">
                          {t('dashboard.synchronizedStatus')}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/25 flex flex-col">
                        <span className="text-[11px] text-on-surface-variant font-semibold">
                          {t('dashboard.humidity')}
                        </span>
                        <span className="text-lg font-extrabold text-on-surface mt-0.5 tabular-nums font-mono">
                          {humidity
                            ? `${formatNumber(String(humidity.value ?? humidity.rawValue))}%`
                            : '—'}
                        </span>
                        <span className="text-[10px] text-on-surface-variant">
                          {t('dashboard.relative')}
                        </span>
                      </div>
                      <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/25 flex flex-col">
                        <span className="text-[11px] text-on-surface-variant font-semibold">
                          {t('dashboard.temperature')}
                        </span>
                        <span className="text-lg font-extrabold text-on-surface mt-0.5 tabular-nums font-mono">
                          {temp
                            ? `${formatNumber(String(temp.value ?? temp.rawValue))} °C`
                            : '—'}
                        </span>
                        <span className="text-[10px] text-on-surface-variant">
                          {t('dashboard.sensorProbe')}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-6 rounded-2xl bg-surface-container-low border border-outline-variant/20 text-center space-y-2">
                    <span className="material-symbols-outlined text-[32px] text-outline">
                      sensors_off
                    </span>
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
              className="w-full h-10 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-bold text-xs flex items-center justify-center gap-1.5 transition-colors no-underline border border-outline-variant/40"
            >
              <span className="material-symbols-outlined text-[16px] text-primary">sensors</span>
              <span>{t('dashboard.openTelemetry')}</span>
            </Link>
          </div>

          {/* AI Crop Disease Diagnosis Card */}
          <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#eef7f0] to-[#dff0e3] dark:from-[#15281d] dark:to-[#102017] border border-emerald-500/25 shadow-sm flex flex-col gap-3">
            <div className="flex items-center gap-2.5 text-sm font-extrabold text-on-surface">
              <div className="w-9 h-9 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-xs">
                <span className="material-symbols-outlined text-[19px]">psychiatry</span>
              </div>
              <span>{t('dashboard.aiCropNotice')}</span>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {t('dashboard.aiCropDesc')}
            </p>
            <Link
              to="/dashboard/ai"
              className="mt-1 h-9 px-4 rounded-xl bg-primary hover:bg-secondary text-on-primary text-xs font-bold inline-flex items-center justify-center gap-1.5 no-underline shadow-xs transition-all active:scale-95 self-start"
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
