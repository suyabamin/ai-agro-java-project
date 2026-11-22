import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { fieldService } from '../services/fieldService';
import { assignmentService } from '../services/assignmentService';
import { userService } from '../services/userService';
import {
  monitoringService,
  validateCropImageFile,
  type MonitoringRecord,
} from '../services/monitoringService';
import type { Field } from '../types/field';
import type { FieldAssignment } from '../types/assignment';
import { StatusBadge } from '../components/ui/StatusBadge';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import {
  buildFieldDecisionRow,
  extractTelemetry8Parameters,
  formatConfidence,
  getMonitoringState,
  type Telemetry8Param,
} from '../utils/farmAiInsights';

export const FieldDetailsPage: React.FC = () => {
  const { fieldId } = useParams<{ fieldId: string }>();
  const { activeFarm } = useFarm();

  const [field, setField] = useState<Field | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active assignment & farmer state
  const [activeAssignment, setActiveAssignment] = useState<FieldAssignment | null>(null);
  const [farmerDisplayName, setFarmerDisplayName] = useState<string | null>(null);
  const [loadingAssignment, setLoadingAssignment] = useState(false);

  // Telemetry & AI state
  const [telemetryReadings, setTelemetryReadings] = useState<MonitoringRecord[]>([]);
  const [latestAnalysis, setLatestAnalysis] = useState<MonitoringRecord | null>(null);
  const [historicalAnalyses, setHistoricalAnalyses] = useState<MonitoringRecord[]>([]);
  const [selectedAnalysisDetail, setSelectedAnalysisDetail] = useState<MonitoringRecord | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const pollTimerRef = useRef<number | null>(null);

  // Diagnostic & operational sub-panel states (preserving existing functionality)
  const [activeTab, setActiveTab] = useState<'overview' | 'operations' | 'history'>('overview');
  const [opMessage, setOpMessage] = useState('');
  const [opBusy, setOpBusy] = useState(false);
  const [modelAvailability, setModelAvailability] = useState<MonitoringRecord | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropPreview, setCropPreview] = useState('');
  const [manualTelemetryValue, setManualTelemetryValue] = useState('');
  const [manualMeasurementType, setManualMeasurementType] = useState('SOIL_MOISTURE');
  const [imagesList, setImagesList] = useState<MonitoringRecord[]>([]);
  const [irrigationPlans, setIrrigationPlans] = useState<MonitoringRecord[]>([]);
  const [activityHistory, setActivityHistory] = useState<MonitoringRecord[]>([]);

  // 1. Load Field Information
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

  // 2. Load Active Tenure & Farmer Information
  useEffect(() => {
    if (!activeFarm || !fieldId) return;

    let mounted = true;
    async function loadTenure() {
      setLoadingAssignment(true);
      try {
        const asgnResp = await assignmentService.fetchFieldAssignments(activeFarm!.farmId, fieldId!);
        const items = asgnResp.data?.items || [];
        const active = items.find((a) => a.status === 'ACTIVE') || null;

        if (mounted) {
          setActiveAssignment(active);
        }

        if (active) {
          if (active.farmerName && active.farmerName.trim().length > 0) {
            if (mounted) setFarmerDisplayName(active.farmerName);
          } else if (active.farmerUid) {
            try {
              const userResp = await userService.getPublicProfile(active.farmerUid);
              if (mounted && userResp.data?.fullName) {
                setFarmerDisplayName(userResp.data.fullName);
              } else if (mounted) {
                setFarmerDisplayName('Assigned Farmer');
              }
            } catch {
              if (mounted) setFarmerDisplayName('Assigned Farmer');
            }
          }
        } else {
          if (mounted) setFarmerDisplayName(null);
        }
      } catch {
        if (mounted) {
          setActiveAssignment(null);
          setFarmerDisplayName(null);
        }
      } finally {
        if (mounted) setLoadingAssignment(false);
      }
    }

    loadTenure();
    return () => {
      mounted = false;
    };
  }, [activeFarm, fieldId]);

  // 3. Load Telemetry, Latest Analysis & Diagnostic History
  const loadMonitoringData = useCallback(async () => {
    if (!activeFarm || !fieldId) return;

    setLoadingAi(true);
    try {
      const [telemetryResp, agriResp, availabilityResp, imagesResp, plansResp, historyResp] =
        await Promise.all([
          monitoringService.telemetry(activeFarm.farmId, fieldId).catch(() => ({ data: [] })),
          monitoringService
            .listAgriculturalAnalyses(activeFarm.farmId, fieldId, null, 10)
            .catch(() => ({ data: { items: [], nextCursor: null, hasNext: false, pageSize: 10 } })),
          monitoringService
            .diseaseAvailability(activeFarm.farmId, fieldId)
            .catch(() => ({ data: null })),
          monitoringService
            .listImages(activeFarm.farmId, fieldId, null, 10)
            .catch(() => ({ data: { items: [], nextCursor: null, hasNext: false, pageSize: 10 } })),
          monitoringService
            .irrigationPlans(activeFarm.farmId, fieldId, null, 10)
            .catch(() => ({ data: { items: [], nextCursor: null, hasNext: false, pageSize: 10 } })),
          monitoringService
            .history(activeFarm.farmId, fieldId, undefined, undefined)
            .catch(() => ({ data: { items: [], nextCursor: null, hasNext: false, pageSize: 10 } })),
        ]);

      setTelemetryReadings(telemetryResp.data || []);

      const analysesList = agriResp.data?.items || [];
      setHistoricalAnalyses(analysesList);
      if (analysesList.length > 0) {
        setLatestAnalysis(analysesList[0]);
      } else {
        setLatestAnalysis(null);
      }

      setModelAvailability(availabilityResp.data || null);
      setImagesList(imagesResp.data?.items || []);
      setIrrigationPlans(plansResp.data?.items || []);
      setActivityHistory(historyResp.data?.items || []);
    } catch (err: unknown) {
      console.warn('Could not load telemetry/analyses for field:', err);
    } finally {
      setLoadingAi(false);
    }
  }, [activeFarm, fieldId]);

  useEffect(() => {
    loadMonitoringData();
  }, [loadMonitoringData]);

  // 4. In-Flight AI Lifecycle Auto-Polling (2.5s)
  useEffect(() => {
    if (!latestAnalysis || !activeFarm || !fieldId) return;

    const rawStatus = String(latestAnalysis.status || '').toUpperCase();
    const rawTabularStatus = String(latestAnalysis.tabularStatus || '').toUpperCase();
    const isInFlight =
      rawStatus === 'PENDING' ||
      rawStatus === 'PROCESSING' ||
      rawTabularStatus === 'PENDING' ||
      rawTabularStatus === 'PROCESSING';

    if (isInFlight) {
      setIsPolling(true);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);

      pollTimerRef.current = window.setInterval(async () => {
        try {
          const resp = await monitoringService.listAgriculturalAnalyses(
            activeFarm.farmId,
            fieldId,
            null,
            1
          );
          const newest = resp.data?.items?.[0];
          if (newest) {
            setLatestAnalysis(newest);
            const status = String(newest.status || '').toUpperCase();
            const tabStatus = String(newest.tabularStatus || '').toUpperCase();
            const done =
              (status === 'COMPLETED' && tabStatus !== 'PENDING' && tabStatus !== 'PROCESSING') ||
              status === 'FAILED' ||
              status === 'INSUFFICIENT_DATA';
            if (done) {
              if (pollTimerRef.current) {
                clearInterval(pollTimerRef.current);
                pollTimerRef.current = null;
              }
              setIsPolling(false);
              // Refresh full monitoring list once terminal state reached
              loadMonitoringData();
            }
          }
        } catch {
          // Keep polling silently or let interval retry
        }
      }, 2500);
    } else {
      setIsPolling(false);
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [latestAnalysis, activeFarm, fieldId, loadMonitoringData]);

  // Cleanup object preview URL on unmount
  useEffect(() => {
    return () => {
      if (cropPreview) URL.revokeObjectURL(cropPreview);
    };
  }, [cropPreview]);

  // Operational Action Handlers (Upload image, manual telemetry, plans)
  const runOperation = async (action: () => Promise<unknown>, successMsg: string) => {
    setOpBusy(true);
    setOpMessage('');
    try {
      await action();
      await loadMonitoringData();
      setOpMessage(successMsg);
    } catch (err: unknown) {
      setOpMessage(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setOpBusy(false);
    }
  };

  const handleUploadCropImage = async () => {
    if (!cropFile || !activeFarm || !fieldId) return;
    setOpBusy(true);
    setOpMessage('');
    try {
      const uploaded = await monitoringService.uploadImage(activeFarm.farmId, fieldId, cropFile);
      const imgId = String(uploaded.data?.imageId || uploaded.data?.id || '');
      if (imgId) {
        const result = await monitoringService.analyzeDisease(activeFarm.farmId, fieldId, imgId);
        const status = String(result.data?.status || 'UNKNOWN');
        setOpMessage(
          status === 'MODEL_UNAVAILABLE'
            ? 'Crop image uploaded. Disease detection is MODEL_UNAVAILABLE (no diagnosis fabricated).'
            : `Analysis status: ${status}`
        );
      }
      setCropFile(null);
      setCropPreview('');
      await loadMonitoringData();
    } catch (err: unknown) {
      setOpMessage(err instanceof Error ? err.message : 'Image processing failed');
    } finally {
      setOpBusy(false);
    }
  };

  const handleManualTelemetry = async () => {
    if (!manualTelemetryValue || !activeFarm || !fieldId) return;
    const num = Number(manualTelemetryValue);
    if (isNaN(num)) {
      setOpMessage('Please enter a valid numeric value');
      return;
    }
    const def = extractTelemetry8Parameters([]).find((p) => p.key === manualMeasurementType);
    await runOperation(
      () =>
        monitoringService.submitTelemetry(activeFarm.farmId, fieldId, {
          measurementType: manualMeasurementType,
          value: num,
          unit: def?.unit || '%',
          observedAt: new Date().toISOString(),
          source: 'MANUAL',
        }),
      `Recorded manual ${manualMeasurementType} reading: ${num} ${def?.unit || ''}`
    );
    setManualTelemetryValue('');
  };

  // Derive Data Models
  const decisionModel = field ? buildFieldDecisionRow(field, latestAnalysis || undefined) : null;
  const telemetry8Params = extractTelemetry8Parameters(telemetryReadings);
  const monitoringState = getMonitoringState(
    telemetryReadings,
    latestAnalysis?.createdAt ? String(latestAnalysis.createdAt) : null
  );

  // Confidence calculations
  const waterNeedConf =
    latestAnalysis?.waterNeedConfidence ??
    latestAnalysis?.confidence ??
    (latestAnalysis?.confidences as Record<string, unknown> | undefined)?.waterNeed;
  const fieldStatusConf =
    latestAnalysis?.fieldStatusConfidence ??
    latestAnalysis?.confidence ??
    (latestAnalysis?.confidences as Record<string, unknown> | undefined)?.fieldStatus;
  const cropConf =
    latestAnalysis?.cropConfidence ??
    latestAnalysis?.confidence ??
    (latestAnalysis?.confidences as Record<string, unknown> | undefined)?.recommendedCrop;

  if (!activeFarm) {
    return (
      <div className="p-8 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/30 max-w-xl mx-auto my-12 shadow-sm">
        <span className="material-symbols-outlined text-[48px] text-primary mb-3">warehouse</span>
        <h2 className="text-xl font-bold text-on-surface">No Farm Selected</h2>
        <p className="text-sm text-on-surface-variant mt-1 mb-6">
          Please select an active farm holding to inspect agricultural intelligence.
        </p>
        <Link
          to="/dashboard/farms"
          className="px-5 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold shadow hover:bg-primary-container transition-all"
        >
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
      <div className="p-8 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/30 max-w-xl mx-auto my-12 shadow-sm">
        <span className="material-symbols-outlined text-[48px] text-error mb-3">error</span>
        <h2 className="text-xl font-bold text-on-surface">Field Zone Not Found</h2>
        <p className="text-sm text-on-surface-variant mt-1 mb-6">
          {error || 'The requested field zone was not located under the active farm holding.'}
        </p>
        <Link
          to="/dashboard/fields"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold shadow hover:bg-primary-container transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>Return to Field List</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-16">
      {/* 1. BREADCRUMBS & TOP BAR */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant">
          <Link to="/dashboard" className="hover:text-primary transition-colors">
            Dashboard
          </Link>
          <span>/</span>
          <Link to="/dashboard/fields" className="hover:text-primary transition-colors">
            Field Zones
          </Link>
          <span>/</span>
          <span className="text-on-surface font-bold truncate max-w-[200px] sm:max-w-xs">{field.name}</span>
        </nav>

        <div className="flex items-center gap-2.5">
          {/* Monitoring State Pill */}
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide border ${
              monitoringState === 'LIVE'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : monitoringState === 'STALE'
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : 'bg-surface-container text-on-surface-variant border-outline-variant/40'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                monitoringState === 'LIVE'
                  ? 'bg-emerald-500 animate-pulse'
                  : monitoringState === 'STALE'
                  ? 'bg-amber-500'
                  : 'bg-neutral-400'
              }`}
            />
            <span>{monitoringState === 'LIVE' ? 'LIVE TELEMETRY' : monitoringState === 'STALE' ? 'STALE (>24H)' : 'NO TELEMETRY'}</span>
          </span>

          <StatusBadge status={field.status} />

          <button
            onClick={() => loadMonitoringData()}
            disabled={loadingAi}
            title="Refresh Telemetry and AI Decisions"
            className="h-8 px-3 rounded-lg border border-outline-variant/40 hover:bg-surface-container text-on-surface text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[16px] ${loadingAi ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <Link
            to={`/dashboard/fields/${field.fieldId}/edit`}
            className="h-8 px-3 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-semibold flex items-center gap-1.5 transition-colors border border-outline-variant/30"
          >
            <span className="material-symbols-outlined text-[15px]">edit</span>
            <span>Edit Zone</span>
          </Link>
        </div>
      </div>

      {/* 2. FIELD ZONE HEADER & TENURE HERO (2 COLUMNS ON DESKTOP) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Field Overview Hero */}
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-2xl p-6 sm:p-7 shadow-sm border border-outline-variant/30 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-tertiary-fixed-dim" />

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-xs font-extrabold uppercase tracking-wider">
                {activeFarm.name}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-xs font-semibold">
                Sector Zone
              </span>
              <span className="text-xs text-on-surface-variant font-mono truncate max-w-[260px]">
                {field.fieldId}
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
                {field.name}
              </h1>
              <span className="px-3 py-1 rounded-xl bg-primary/10 text-primary font-bold text-xs uppercase tracking-wide border border-primary/20">
                {field.cropType}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-on-surface-variant mt-2 max-w-2xl leading-relaxed">
              {field.notes || 'Precision monitored agricultural field sector with telemetry probes and agronomic decision modeling.'}
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-outline-variant/20 text-xs">
            <div className="bg-surface-container-low/60 p-3 rounded-xl border border-outline-variant/20">
              <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Acreage</span>
              <div className="font-extrabold text-sm sm:text-base text-on-surface mt-0.5">
                {field.areaHectares} <span className="text-xs font-semibold text-on-surface-variant">ha</span>
              </div>
            </div>

            <div className="bg-surface-container-low/60 p-3 rounded-xl border border-outline-variant/20">
              <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Soil Profile</span>
              <div className="font-extrabold text-sm sm:text-base text-on-surface mt-0.5 truncate">
                {field.soilType || 'Loamy Clay'}
              </div>
            </div>

            <div className="bg-surface-container-low/60 p-3 rounded-xl border border-outline-variant/20">
              <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Irrigation Mode</span>
              <div className="font-extrabold text-sm sm:text-base text-on-surface mt-0.5 truncate">
                {field.irrigationType || 'Drip'}
              </div>
            </div>

            <div className="bg-surface-container-low/60 p-3 rounded-xl border border-outline-variant/20">
              <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Probes Online</span>
              <div className="font-extrabold text-sm sm:text-base text-emerald-700 mt-0.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">sensors</span>
                <span>{telemetryReadings.length} readings</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Active Tenure Card */}
        <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/30 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-extrabold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">badge</span>
                <span>Active Tenure</span>
              </span>
              {activeAssignment && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  <span>ACTIVE</span>
                </span>
              )}
            </div>

            {loadingAssignment ? (
              <div className="py-6 text-center text-xs text-on-surface-variant animate-pulse">
                Loading tenure profile...
              </div>
            ) : activeAssignment ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low border border-outline-variant/20">
                  <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                    <span className="material-symbols-outlined text-[22px]">person</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold text-on-surface-variant">Assigned Farmer</span>
                    <h3 className="font-extrabold text-sm text-on-surface truncate">
                      {farmerDisplayName || 'Assigned Farmer'}
                    </h3>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-on-surface-variant pt-1">
                  <div className="flex justify-between items-center py-1 border-b border-outline-variant/20">
                    <span className="text-on-surface-variant font-medium">Holding Farm:</span>
                    <span className="font-bold text-on-surface truncate max-w-[150px]">{activeFarm.name}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-outline-variant/20">
                    <span className="text-on-surface-variant font-medium">Assigned On:</span>
                    <span className="font-semibold text-on-surface">
                      {activeAssignment.assignedAt
                        ? new Date(activeAssignment.assignedAt).toLocaleDateString()
                        : 'Active'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-on-surface-variant font-medium">Assignment ID:</span>
                    <span className="font-mono text-[11px] text-on-surface truncate max-w-[130px]">
                      {activeAssignment.assignmentId}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center">
                <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 mx-auto flex items-center justify-center mb-2 border border-amber-200">
                  <span className="material-symbols-outlined text-[24px]">person_off</span>
                </div>
                <h4 className="font-bold text-xs text-on-surface">No Active Farmer Assigned</h4>
                <p className="text-[11px] text-on-surface-variant mt-1 mb-3">
                  This field sector currently has no active tenure manager assigned.
                </p>
                <Link
                  to="/dashboard/assignments/new"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary-container transition-colors shadow-sm"
                >
                  <span className="material-symbols-outlined text-[15px]">person_add</span>
                  <span>Assign Farmer</span>
                </Link>
              </div>
            )}
          </div>

          {activeAssignment && (
            <div className="mt-4 pt-3 border-t border-outline-variant/20 flex justify-end">
              <Link
                to="/dashboard/assignments"
                className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
              >
                <span>Manage Assignments</span>
                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* 3. IN-FLIGHT AUTO-POLLING NOTIFICATION BANNER */}
      {isPolling && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold flex items-center justify-between gap-3 shadow-sm animate-pulse">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[20px] text-amber-600 animate-spin">
              progress_activity
            </span>
            <span>
              Agricultural AI analysis is processing in real-time. Live auto-polling every 2.5 seconds...
            </span>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-200 text-amber-900">
            PROCESSING
          </span>
        </div>
      )}

      {/* 4. FIELD AI DECISION CARDS (4 PREMIUM GRAPHICAL CARDS) */}
      <section aria-labelledby="ai-decisions-heading" className="space-y-3" id="ai-decision">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">psychology</span>
            <h2 id="ai-decisions-heading" className="text-lg font-extrabold text-on-surface">
              Field AI Decisions & Recommendations
            </h2>
          </div>
          {latestAnalysis && (
            <span className="text-xs text-on-surface-variant font-medium">
              Evaluated {decisionModel?.formattedDate || 'Recently'}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Water Need */}
          <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/30 shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                Water Need
              </span>
              <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
                <span className="material-symbols-outlined text-[18px]">water_drop</span>
              </div>
            </div>

            <div className="my-2">
              <div className="text-2xl font-black text-on-surface tracking-tight">
                {decisionModel?.waterNeed || (decisionModel?.status === 'UNEVALUATED' ? 'Unevaluated' : '—')}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-semibold text-on-surface-variant">Confidence:</span>
                <span className="text-xs font-bold text-blue-700">
                  {formatConfidence(waterNeedConf)}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between">
              <span
                className={`text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full border ${
                  decisionModel?.waterNeedBadge === 'urgent'
                    ? 'bg-red-50 text-red-700 border-red-300'
                    : decisionModel?.waterNeedBadge === 'high'
                    ? 'bg-amber-50 text-amber-700 border-amber-300'
                    : decisionModel?.waterNeedBadge === 'moderate'
                    ? 'bg-blue-50 text-blue-700 border-blue-300'
                    : decisionModel?.waterNeedBadge === 'low'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-surface-container text-on-surface-variant border-outline-variant/40'
                }`}
              >
                {decisionModel?.waterNeed || 'NO EVALUATION'}
              </span>
              <span className="text-[10px] text-on-surface-variant font-mono">Baseline Model</span>
            </div>
          </div>

          {/* Card 2: Field Status */}
          <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/30 shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                Field Status
              </span>
              <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                <span className="material-symbols-outlined text-[18px]">vital_signs</span>
              </div>
            </div>

            <div className="my-2">
              <div className="text-2xl font-black text-on-surface tracking-tight">
                {decisionModel?.fieldStatus || (decisionModel?.status === 'UNEVALUATED' ? 'Unevaluated' : '—')}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-semibold text-on-surface-variant">Confidence:</span>
                <span className="text-xs font-bold text-emerald-700">
                  {formatConfidence(fieldStatusConf)}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between">
              <span
                className={`text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full border ${
                  decisionModel?.fieldStatusBadge === 'critical'
                    ? 'bg-red-50 text-red-700 border-red-300'
                    : decisionModel?.fieldStatusBadge === 'attention'
                    ? 'bg-amber-50 text-amber-700 border-amber-300'
                    : decisionModel?.fieldStatusBadge === 'healthy'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-surface-container text-on-surface-variant border-outline-variant/40'
                }`}
              >
                {decisionModel?.fieldStatus || 'NO STATUS'}
              </span>
              <span className="text-[10px] text-on-surface-variant font-mono">Multi-Class Classifier</span>
            </div>
          </div>

          {/* Card 3: Optimal Crop Recommendation */}
          <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/30 shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                Optimal Crop
              </span>
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                <span className="material-symbols-outlined text-[18px]">agriculture</span>
              </div>
            </div>

            <div className="my-2">
              <div className="text-2xl font-black text-primary capitalize tracking-tight truncate">
                {decisionModel?.recommendedCrop || (decisionModel?.status === 'UNEVALUATED' ? 'Unevaluated' : '—')}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-semibold text-on-surface-variant">Confidence:</span>
                <span className="text-xs font-bold text-primary">
                  {formatConfidence(cropConf)}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between">
              <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-primary-fixed/40 text-primary border border-primary/20">
                {decisionModel?.recommendedCrop ? 'AI RECOMMENDED' : 'NO EVALUATION'}
              </span>
              <span className="text-[10px] text-on-surface-variant font-mono">22-Class Agronomic</span>
            </div>
          </div>

          {/* Card 4: Disease Diagnostic (Fail-Closed MODEL_UNAVAILABLE) */}
          <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/30 shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                Disease Diagnostic
              </span>
              <div className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-600 flex items-center justify-center border border-neutral-300">
                <span className="material-symbols-outlined text-[18px]">health_and_safety</span>
              </div>
            </div>

            <div className="my-2">
              <div className="text-base font-extrabold text-on-surface tracking-tight truncate">
                {decisionModel?.diseaseStatus || 'MODEL_UNAVAILABLE'}
              </div>
              <p className="text-[11px] text-on-surface-variant mt-1 leading-snug">
                Production model unavailable. No unverified diagnosis fabricated.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between">
              <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-300">
                FAIL-CLOSED
              </span>
              <span className="text-[10px] text-on-surface-variant font-mono">CNN v1.0</span>
            </div>
          </div>
        </div>

        {/* 5. ANALYSIS PROVENANCE METADATA BAR */}
        {latestAnalysis && (
          <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-on-surface-variant font-semibold">Analysis ID:</span>
                <span className="font-mono text-on-surface font-bold bg-surface-container-lowest px-2 py-0.5 rounded border border-outline-variant/30">
                  {String(latestAnalysis.analysisId || latestAnalysis.id)}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-on-surface-variant font-semibold">Model Pipeline:</span>
                <span className="font-mono text-on-surface font-bold">
                  {String(latestAnalysis.tabularModelVersion || 'tabular-pipeline-v2.0')}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-on-surface-variant font-semibold">Provenance:</span>
                <span className="font-mono text-on-surface">
                  {String(latestAnalysis.labelProvenance || 'rule_derived')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-on-surface-variant font-semibold">Lifecycle:</span>
              <StatusBadge status={String(latestAnalysis.status || 'COMPLETED')} />
            </div>
          </div>
        )}
      </section>

      {/* 6. FIELD TELEMETRY MATRIX (8 IN-SITU MEASUREMENTS) */}
      <section aria-labelledby="telemetry-matrix-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">sensors</span>
            <h2 id="telemetry-matrix-heading" className="text-lg font-extrabold text-on-surface">
              Field Telemetry Matrix (8 Core Agronomic Indicators)
            </h2>
          </div>
          <span className="text-xs text-on-surface-variant font-semibold">
            {telemetryReadings.length} In-situ Observations
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {telemetry8Params.map((param: Telemetry8Param) => (
            <div
              key={param.key}
              className="bg-surface-container-lowest rounded-xl p-3.5 border border-outline-variant/30 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase font-bold text-on-surface-variant">
                    {param.name}
                  </span>
                  <span className="w-5 h-5 rounded-md bg-surface-container-low text-primary font-bold text-[10px] flex items-center justify-center">
                    {param.symbol}
                  </span>
                </div>

                <div className="text-lg font-extrabold text-on-surface mt-1">
                  {param.value !== null ? (
                    <>
                      <span>{param.value}</span>{' '}
                      <span className="text-[10px] font-semibold text-on-surface-variant">{param.unit}</span>
                    </>
                  ) : (
                    <span className="text-on-surface-variant text-sm font-normal">—</span>
                  )}
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-outline-variant/20 flex items-center justify-between">
                <span
                  className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                    param.validationStatus === 'VALID'
                      ? 'bg-emerald-50 text-emerald-700'
                      : param.validationStatus === 'OUT_OF_RANGE'
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  {param.validationStatus}
                </span>
                {param.observedAt && (
                  <span
                    className="material-symbols-outlined text-[13px] text-on-surface-variant"
                    title={`Observed: ${new Date(param.observedAt).toLocaleString()}`}
                  >
                    schedule
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 7. DIAGNOSTIC WORKFLOWS, HISTORICAL ANALYSES & OPERATIONAL TOOLS TABS */}
      <section className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-sm overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex border-b border-outline-variant/30 bg-surface-container-low/50 px-6 pt-3">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">history_edu</span>
            <span>Evaluation History ({historicalAnalyses.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('operations')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'operations'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
            <span>Field Diagnostics & Operations</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'history'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">list_alt</span>
            <span>Field Activity Log ({activityHistory.length})</span>
          </button>
        </div>

        <div className="p-6">
          {/* TAB 1: EVALUATION HISTORY */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-on-surface">
                    Historical Agricultural AI Evaluations
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Chronological audit trail of evidence summaries and tabular AI inferences for this field.
                  </p>
                </div>
                <button
                  disabled={opBusy}
                  onClick={() =>
                    runOperation(
                      () => monitoringService.createAnalysis(activeFarm.farmId, field.fieldId),
                      'Triggered new agricultural evaluation.'
                    )
                  }
                  className="px-3.5 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary-container transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                  <span>Trigger New Evaluation</span>
                </button>
              </div>

              {historicalAnalyses.length === 0 ? (
                <div className="py-10 text-center text-xs text-on-surface-variant bg-surface-container-low/40 rounded-xl">
                  No historical AI evaluations recorded yet for this field sector.
                </div>
              ) : (
                <div className="space-y-3">
                  {historicalAnalyses.map((item, idx) => (
                    <div
                      key={String(item.analysisId || item.id || idx)}
                      className={`p-4 rounded-xl border transition-all ${
                        idx === 0
                          ? 'border-primary/40 bg-primary/5 shadow-sm'
                          : 'border-outline-variant/30 bg-surface-container-low/40'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-xs text-on-surface">
                            {idx === 0 ? '★ Latest Decision' : `Decision #${historicalAnalyses.length - idx}`}
                          </span>
                          <StatusBadge status={String(item.status || 'COMPLETED')} />
                        </div>
                        <span className="text-[11px] text-on-surface-variant">
                          {item.createdAt ? new Date(String(item.createdAt)).toLocaleString() : 'N/A'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-2 text-xs">
                        <div className="bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/20">
                          <span className="text-[10px] text-on-surface-variant uppercase font-semibold">Water Need</span>
                          <div className="font-bold text-on-surface">
                            {String(item.predictedWaterNeed || item.waterNeed || item.water_need || '—')}
                          </div>
                        </div>

                        <div className="bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/20">
                          <span className="text-[10px] text-on-surface-variant uppercase font-semibold">Field Status</span>
                          <div className="font-bold text-on-surface">
                            {String(item.predictedFieldStatus || item.fieldStatus || item.field_status || '—')}
                          </div>
                        </div>

                        <div className="bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/20">
                          <span className="text-[10px] text-on-surface-variant uppercase font-semibold">Optimal Crop</span>
                          <div className="font-bold text-primary capitalize">
                            {String(item.recommendedCrop || item.recommended_crop || item.optimalCrop || '—')}
                          </div>
                        </div>

                        <div className="bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/20">
                          <span className="text-[10px] text-on-surface-variant uppercase font-semibold">Disease</span>
                          <div className="font-bold text-on-surface-variant">
                            {String(item.diseaseDetectionStatus || 'MODEL_UNAVAILABLE')}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-outline-variant/20 text-xs">
                        <span className="font-mono text-[11px] text-on-surface-variant">
                          ID: {String(item.analysisId || item.id)}
                        </span>
                        <button
                          onClick={() =>
                            setSelectedAnalysisDetail((prev) =>
                              prev?.analysisId === item.analysisId ? null : item
                            )
                          }
                          className="text-primary font-bold hover:underline flex items-center gap-1"
                        >
                          <span>{selectedAnalysisDetail?.analysisId === item.analysisId ? 'Hide Payload' : 'Inspect Payload'}</span>
                          <span className="material-symbols-outlined text-[14px]">
                            {selectedAnalysisDetail?.analysisId === item.analysisId ? 'expand_less' : 'expand_more'}
                          </span>
                        </button>
                      </div>

                      {selectedAnalysisDetail?.analysisId === item.analysisId && (
                        <pre className="mt-3 p-3 bg-surface-container-lowest text-on-surface text-[11px] font-mono rounded-lg border border-outline-variant/30 overflow-x-auto max-h-60">
                          {JSON.stringify(selectedAnalysisDetail, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FIELD DIAGNOSTICS & OPERATIONS (Preserving image upload, manual telemetry, irrigation plans) */}
          {activeTab === 'operations' && (
            <div className="space-y-6">
              {opMessage && (
                <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs font-semibold text-primary">
                  {opMessage}
                </div>
              )}

              {/* Disease Model Availability Badge */}
              <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-primary">biotech</span>
                  <span>
                    <strong>Disease Inference Model Status:</strong>{' '}
                    {String(modelAvailability?.status || 'MODEL_UNAVAILABLE')}
                  </span>
                </div>
                <span className="font-mono text-[11px] text-on-surface-variant">
                  {String(modelAvailability?.message || 'Production fail-closed')}
                </span>
              </div>

              {/* Crop Leaf Diagnostics Image Upload */}
              <div className="p-4 rounded-xl border border-outline-variant/30 bg-surface-container-low/30 space-y-3">
                <h4 className="font-extrabold text-xs text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                  <span>Crop Foliar Inspection (Image Upload)</span>
                </h4>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    aria-label="Upload foliar inspection image"
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(e) => {
                      const candidate = e.target.files?.[0] || null;
                      if (!candidate) {
                        setCropFile(null);
                        setCropPreview('');
                        return;
                      }
                      const valMsg = validateCropImageFile(candidate);
                      if (valMsg) {
                        setOpMessage(valMsg);
                        setCropFile(null);
                        setCropPreview('');
                        return;
                      }
                      setCropFile(candidate);
                      setCropPreview(URL.createObjectURL(candidate));
                    }}
                    className="text-xs text-on-surface-variant file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-on-primary hover:file:bg-primary-container cursor-pointer"
                  />
                  <button
                    disabled={opBusy || !cropFile}
                    onClick={handleUploadCropImage}
                    className="px-4 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary-container disabled:opacity-50"
                  >
                    Upload and Check Model Status
                  </button>
                </div>
                {cropPreview && (
                  <img
                    src={cropPreview}
                    alt="Upload preview"
                    className="w-40 h-28 object-cover rounded-lg border border-outline-variant/40 mt-2"
                  />
                )}

                {imagesList.length > 0 && (
                  <div className="pt-2">
                    <span className="text-[11px] font-bold text-on-surface-variant block mb-1.5">
                      Uploaded Field Images ({imagesList.length}):
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {imagesList.map((img) => (
                        <div
                          key={String(img.id || img.imageId)}
                          className="px-2.5 py-1 rounded bg-surface-container-lowest border border-outline-variant/30 text-[11px] flex items-center gap-2"
                        >
                          <span className="material-symbols-outlined text-[14px] text-primary">image</span>
                          <span className="font-mono truncate max-w-[140px]">
                            {String(img.originalFilename || img.imageId || img.id)}
                          </span>
                          <span className="text-on-surface-variant">({String(img.processingStatus || 'UPLOADED')})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Manual In-Situ Telemetry Entry */}
              <div className="p-4 rounded-xl border border-outline-variant/30 bg-surface-container-low/30 space-y-3">
                <h4 className="font-extrabold text-xs text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">edit_note</span>
                  <span>Record In-Situ Sensor Probe Reading</span>
                </h4>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <select
                    value={manualMeasurementType}
                    onChange={(e) => setManualMeasurementType(e.target.value)}
                    className="h-9 px-3 rounded-lg bg-surface-container-lowest border border-outline-variant/40 font-semibold text-on-surface text-xs"
                  >
                    <option value="SOIL_MOISTURE">Soil Moisture (%)</option>
                    <option value="AIR_TEMPERATURE">Air Temperature (°C)</option>
                    <option value="RELATIVE_HUMIDITY">Relative Humidity (%)</option>
                    <option value="SOIL_PH">Soil pH (pH)</option>
                    <option value="NITROGEN">Nitrogen (mg/kg)</option>
                    <option value="PHOSPHORUS">Phosphorus (mg/kg)</option>
                    <option value="POTASSIUM">Potassium (mg/kg)</option>
                    <option value="RAINFALL">Rainfall (mm)</option>
                  </select>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Enter measurement value..."
                    value={manualTelemetryValue}
                    onChange={(e) => setManualTelemetryValue(e.target.value)}
                    className="h-9 px-3 rounded-lg bg-surface-container-lowest border border-outline-variant/40 font-semibold text-on-surface text-xs w-48"
                  />
                  <button
                    disabled={opBusy || manualTelemetryValue === ''}
                    onClick={handleManualTelemetry}
                    className="h-9 px-4 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary-container disabled:opacity-50"
                  >
                    Save Reading
                  </button>
                </div>
              </div>

              {/* Irrigation Plans Management */}
              <div className="p-4 rounded-xl border border-outline-variant/30 bg-surface-container-low/30 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-xs text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">water</span>
                    <span>Irrigation Plans ({irrigationPlans.length})</span>
                  </h4>
                  <button
                    disabled={opBusy}
                    onClick={() =>
                      runOperation(
                        () => monitoringService.createIrrigationPlan(activeFarm.farmId, field.fieldId),
                        'Irrigation plan created.'
                      )
                    }
                    className="px-3 py-1 rounded-lg bg-secondary text-on-secondary text-xs font-bold hover:bg-secondary-container hover:text-on-secondary-container transition-colors disabled:opacity-50"
                  >
                    Generate Irrigation Plan
                  </button>
                </div>

                {irrigationPlans.length === 0 ? (
                  <p className="text-xs text-on-surface-variant">No irrigation plans currently active.</p>
                ) : (
                  <div className="space-y-2">
                    {irrigationPlans.map((p) => (
                      <div
                        key={String(p.planId || p.id)}
                        className="p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/20 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <span className="font-bold text-on-surface">{String(p.recommendationStatus || 'DRAFT')}</span>
                          <span className="mx-2 text-on-surface-variant">•</span>
                          <span className="text-on-surface-variant">{String(p.rationale || 'Regular cycle')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={String(p.status || 'DRAFT')} />
                          {p.status === 'DRAFT' && (
                            <button
                              disabled={opBusy}
                              onClick={() =>
                                runOperation(
                                  () =>
                                    monitoringService.updatePlanStatus(
                                      activeFarm.farmId,
                                      field.fieldId,
                                      String(p.planId || p.id),
                                      'SCHEDULED'
                                    ),
                                  'Marked plan scheduled.'
                                )
                              }
                              className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[11px] font-bold"
                            >
                              Schedule
                            </button>
                          )}
                          {p.status === 'SCHEDULED' && (
                            <button
                              disabled={opBusy}
                              onClick={() =>
                                runOperation(
                                  () =>
                                    monitoringService.updatePlanStatus(
                                      activeFarm.farmId,
                                      field.fieldId,
                                      String(p.planId || p.id),
                                      'COMPLETED'
                                    ),
                                  'Marked plan completed.'
                                )
                              }
                              className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold"
                            >
                              Complete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: ACTIVITY LOG */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <h3 className="text-sm font-extrabold text-on-surface mb-2">
                Field Activity Audit Trail
              </h3>
              {activityHistory.length === 0 ? (
                <p className="text-xs text-on-surface-variant">No activity logged for this field.</p>
              ) : (
                <div className="space-y-2">
                  {activityHistory.map((act) => (
                    <div
                      key={String(act.activityId || act.id || act.eventId)}
                      className="p-3 rounded-lg bg-surface-container-low/40 border border-outline-variant/20 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-primary">circle</span>
                        <span className="font-bold text-on-surface">{String(act.eventType)}</span>
                      </div>
                      <span className="text-on-surface-variant text-[11px]">
                        {act.createdAt ? new Date(String(act.createdAt)).toLocaleString() : 'Recent'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
