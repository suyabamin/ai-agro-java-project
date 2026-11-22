import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { fieldService } from '../services/fieldService';
import { assignmentService } from '../services/assignmentService';
import { userService } from '../services/userService';
import {
  monitoringService,
  type MonitoringRecord,
} from '../services/monitoringService';
import type { Field } from '../types/field';
import type { FieldAssignment } from '../types/assignment';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';
import {
  buildFieldDecisionRow,
  computeFarmAiSummary,
  aggregateFarmTelemetry,
  extractTelemetry8Parameters,
  getMonitoringState,
  type Telemetry8Param,
  type MonitoringState,
} from '../utils/farmAiInsights';

export const SoilMonitoringDashboardPage: React.FC = () => {
  const { activeFarm } = useFarm();
  const navigate = useNavigate();

  // Core state
  const [fields, setFields] = useState<Field[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>('Just now');

  // Farm-wide batch data maps
  const [farmTelemetryMap, setFarmTelemetryMap] = useState<Record<string, MonitoringRecord[]>>({});
  const [farmAnalysesMap, setFarmAnalysesMap] = useState<Record<string, MonitoringRecord>>({});
  const [assignmentsMap, setAssignmentsMap] = useState<Record<string, FieldAssignment>>({});
  const [farmerNamesMap, setFarmerNamesMap] = useState<Record<string, string>>({});

  // Graphical Analytics State (for selected field)
  const [selectedMetric, setSelectedMetric] = useState<'SOIL_MOISTURE' | 'AIR_TEMPERATURE' | 'RELATIVE_HUMIDITY'>('SOIL_MOISTURE');
  const [chartHistory, setChartHistory] = useState<MonitoringRecord[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);

  // 1. Fetch Farm Fields, Batch Telemetry, Batch AI Analyses, and Farm Assignments
  const loadDashboardData = useCallback(async () => {
    if (!activeFarm) return;
    setError(null);

    try {
      // First fetch field list
      const fieldsResp = await fieldService.fetchFields(activeFarm.farmId);
      const fieldsList = fieldsResp.data || [];
      setFields(fieldsList);

      if (fieldsList.length > 0 && !selectedFieldId) {
        setSelectedFieldId(fieldsList[0].fieldId);
      }

      // Batch queries in parallel
      const [telemetryBatch, analysesBatch, assignmentsBatch] = await Promise.all([
        monitoringService.latestFarmTelemetry(activeFarm.farmId).catch(() => ({ data: {} })),
        monitoringService.latestFarmAgriculturalAnalyses(activeFarm.farmId).catch(() => ({ data: {} })),
        assignmentService.fetchFarmAssignments(activeFarm.farmId).catch(() => ({ data: { items: [], nextCursor: null, hasNext: false, pageSize: 50 } })),
      ]);

      const tMap = telemetryBatch.data || {};
      const aMap = analysesBatch.data || {};
      setFarmTelemetryMap(tMap);
      setFarmAnalysesMap(aMap);

      // Build assignments lookup by fieldId
      const asgnList = assignmentsBatch.data?.items || [];
      const asgnLookup: Record<string, FieldAssignment> = {};
      const namesLookup: Record<string, string> = {};

      for (const asgn of asgnList) {
        if (asgn.status === 'ACTIVE') {
          asgnLookup[asgn.fieldId] = asgn;
          if (asgn.farmerName && asgn.farmerName.trim().length > 0) {
            namesLookup[asgn.farmerUid] = asgn.farmerName;
          }
        }
      }
      setAssignmentsMap(asgnLookup);
      setFarmerNamesMap(namesLookup);

      // Resolve missing farmer names asynchronously via public profiles
      const missingUids = asgnList
        .filter((a) => a.status === 'ACTIVE' && (!a.farmerName || a.farmerName.trim().length === 0) && a.farmerUid)
        .map((a) => a.farmerUid);

      const uniqueMissingUids = Array.from(new Set(missingUids));
      if (uniqueMissingUids.length > 0) {
        Promise.all(
          uniqueMissingUids.map(async (uid) => {
            try {
              const prof = await userService.getPublicProfile(uid);
              if (prof.data?.fullName) {
                return { uid, name: prof.data.fullName };
              }
            } catch {
              // fallback gracefully
            }
            return { uid, name: 'Assigned Farmer' };
          })
        ).then((resolved) => {
          setFarmerNamesMap((prev) => {
            const next = { ...prev };
            for (const r of resolved) {
              if (r) next[r.uid] = r.name;
            }
            return next;
          });
        });
      }

      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load monitoring dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeFarm, selectedFieldId]);

  useEffect(() => {
    setLoading(true);
    loadDashboardData();
  }, [loadDashboardData]);

  // 2. Fetch Graphical Telemetry History for Selected Field & Metric
  useEffect(() => {
    if (!activeFarm || !selectedFieldId) return;

    let mounted = true;
    async function loadMetricHistory() {
      setLoadingChart(true);
      try {
        const resp = await monitoringService.telemetryHistory(
          activeFarm!.farmId,
          selectedFieldId,
          selectedMetric
        );
        if (mounted) {
          const items = resp.data?.items || [];
          setChartHistory(items);
        }
      } catch {
        if (mounted) setChartHistory([]);
      } finally {
        if (mounted) setLoadingChart(false);
      }
    }

    loadMetricHistory();
    return () => {
      mounted = false;
    };
  }, [activeFarm, selectedFieldId, selectedMetric]);

  // Handle Manual Refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
  };

  // Derive Summary Metrics
  const aiSummary = computeFarmAiSummary(fields, farmAnalysesMap);
  const telemetrySummary = aggregateFarmTelemetry(farmTelemetryMap);

  // Count active monitored fields (fields with at least 1 reading)
  const activeMonitoredFieldsCount = fields.filter((f) => {
    const list = farmTelemetryMap[f.fieldId] || (f.localFieldId ? farmTelemetryMap[f.localFieldId] : []);
    return list && list.length > 0;
  }).length;

  if (!activeFarm) {
    return (
      <EmptyState
        icon="warehouse"
        title="No Farm Selected"
        description="Select an active farm holding to inspect IoT sensor telemetry and agronomic monitoring."
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

  // Helper to get farmer name for a field
  const getFarmerNameForField = (field: Field): string => {
    const asgn = assignmentsMap[field.fieldId] || (field.localFieldId ? assignmentsMap[field.localFieldId] : undefined);
    if (!asgn) return 'Unassigned';
    if (asgn.farmerName && asgn.farmerName.trim().length > 0) return asgn.farmerName;
    if (farmerNamesMap[asgn.farmerUid]) return farmerNamesMap[asgn.farmerUid];
    return 'Assigned Farmer';
  };

  // Chronological chart data points
  const sortedChartPoints = chartHistory.slice().reverse();
  const numericValues = sortedChartPoints
    .map((item) => Number(item.value ?? item.rawValue))
    .filter((v) => !isNaN(v));

  const chartMin = numericValues.length > 0 ? Math.min(...numericValues) : 0;
  const chartMax = numericValues.length > 0 ? Math.max(...numericValues) : 100;
  const chartRange = chartMax === chartMin ? 1 : chartMax - chartMin;
  const chartAvg =
    numericValues.length > 0
      ? Math.round((numericValues.reduce((a, b) => a + b, 0) / numericValues.length) * 10) / 10
      : null;
  const chartLatest = numericValues.length > 0 ? numericValues[numericValues.length - 1] : null;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-16">
      {/* 1. HEADER & FARM SECTOR OVERVIEW */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest rounded-2xl p-6 sm:p-7 shadow-sm border border-outline-variant/30 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-tertiary-fixed-dim" />

        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-xs font-extrabold uppercase tracking-wider">
              {activeFarm.name}
            </span>
            <span className="text-xs text-on-surface-variant font-medium">
              IoT Sensor Network & Agronomic Center
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
            Farm Monitoring Center
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-1 max-w-2xl">
            Live multi-depth sensor telemetry, environmental microclimates, and field-by-field agronomic AI health intelligence.
          </p>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <span className="text-[11px] text-on-surface-variant font-medium block">Last refreshed</span>
            <span className="text-xs font-bold text-on-surface">{lastRefreshed}</span>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-9 px-4 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary-container transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[18px] ${refreshing ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>{refreshing ? 'Refreshing...' : 'Refresh Telemetry'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-error-container text-error text-xs font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* 2. SUMMARY METRICS CARDS (TOP ROW - 5 CARDS) */}
      <section aria-labelledby="farm-summary-heading" className="space-y-2">
        <h2 id="farm-summary-heading" className="sr-only">
          Farm Monitoring Summary
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Card 1: Total Fields */}
          <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/30 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-on-surface-variant">
              <span className="text-[11px] uppercase font-bold tracking-wider">Total Fields</span>
              <span className="material-symbols-outlined text-[20px] text-primary">grid_view</span>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-black text-on-surface">{fields.length}</div>
              <span className="text-[11px] text-on-surface-variant font-medium">Configured sectors</span>
            </div>
          </div>

          {/* Card 2: Active Monitored Fields */}
          <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/30 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-on-surface-variant">
              <span className="text-[11px] uppercase font-bold tracking-wider">Monitored Fields</span>
              <span className="material-symbols-outlined text-[20px] text-emerald-600">sensors</span>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-black text-emerald-700">
                {activeMonitoredFieldsCount} <span className="text-sm font-semibold text-on-surface-variant">/ {fields.length}</span>
              </div>
              <span className="text-[11px] text-on-surface-variant font-medium">Transmitting telemetry</span>
            </div>
          </div>

          {/* Card 3: Total Sensor Readings */}
          <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/30 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-on-surface-variant">
              <span className="text-[11px] uppercase font-bold tracking-wider">Sensor Readings</span>
              <span className="material-symbols-outlined text-[20px] text-blue-600">insights</span>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-black text-on-surface">{telemetrySummary.totalReadings}</div>
              <span className="text-[11px] text-on-surface-variant font-medium">In-situ observations</span>
            </div>
          </div>

          {/* Card 4: Fields Needing Attention */}
          <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/30 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-on-surface-variant">
              <span className="text-[11px] uppercase font-bold tracking-wider">Attention Needed</span>
              <span className="material-symbols-outlined text-[20px] text-amber-600">warning</span>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-black text-amber-700">{aiSummary.needingAttention}</div>
              <span className="text-[11px] text-on-surface-variant font-medium">Moderate/High water / alerts</span>
            </div>
          </div>

          {/* Card 5: Critical Fields */}
          <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/30 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-on-surface-variant">
              <span className="text-[11px] uppercase font-bold tracking-wider">Critical Sectors</span>
              <span className="material-symbols-outlined text-[20px] text-red-600">crisis_alert</span>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-black text-red-700">{aiSummary.critical}</div>
              <span className="text-[11px] text-on-surface-variant font-medium">Urgent water / critical status</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. FIELD MONITORING CARD GRID */}
      <section aria-labelledby="field-grid-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">view_quilt</span>
            <h2 id="field-grid-heading" className="text-lg font-extrabold text-on-surface">
              Field Sectors & In-situ Telemetry
            </h2>
          </div>
          <span className="text-xs text-on-surface-variant font-semibold">
            {fields.length} Field Zones
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {fields.map((fieldItem) => {
            const readings = farmTelemetryMap[fieldItem.fieldId] || (fieldItem.localFieldId ? farmTelemetryMap[fieldItem.localFieldId] : []) || [];
            const analysis = farmAnalysesMap[fieldItem.fieldId] || (fieldItem.localFieldId ? farmAnalysesMap[fieldItem.localFieldId] : undefined);
            const decisionRow = buildFieldDecisionRow(fieldItem, analysis);
            const state: MonitoringState = getMonitoringState(
              readings,
              analysis?.createdAt ? String(analysis.createdAt) : null
            );
            const farmerName = getFarmerNameForField(fieldItem);
            const params8 = extractTelemetry8Parameters(readings);
            const isSelected = fieldItem.fieldId === selectedFieldId;

            return (
              <div
                key={fieldItem.fieldId}
                className={`bg-surface-container-lowest rounded-2xl p-5 border transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-primary ring-2 ring-primary/20 shadow-md'
                    : 'border-outline-variant/30 hover:shadow-md'
                }`}
              >
                <div>
                  {/* Card Header: Name, Crop & Monitoring State */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-extrabold uppercase tracking-wider border border-primary/20">
                          {fieldItem.cropType}
                        </span>
                        <span className="text-[11px] text-on-surface-variant font-semibold">
                          {fieldItem.areaHectares} ha
                        </span>
                      </div>
                      <h3 className="font-extrabold text-base text-on-surface tracking-tight">
                        {fieldItem.name}
                      </h3>
                    </div>

                    {/* Monitoring State Indicator Badge */}
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider border uppercase shrink-0 ${
                        state === 'LIVE'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : state === 'STALE'
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : 'bg-surface-container text-on-surface-variant border-outline-variant/40'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          state === 'LIVE'
                            ? 'bg-emerald-500 animate-pulse'
                            : state === 'STALE'
                            ? 'bg-amber-500'
                            : 'bg-neutral-400'
                        }`}
                      />
                      <span>{state}</span>
                    </span>
                  </div>

                  {/* Assigned Farmer & Latest Observation */}
                  <div className="space-y-1 text-xs text-on-surface-variant mb-4 pb-3 border-b border-outline-variant/20">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Assigned Farmer:</span>
                      <span className="font-bold text-on-surface flex items-center gap-1 truncate max-w-[170px]">
                        <span className="material-symbols-outlined text-[14px] text-primary">person</span>
                        <span>{farmerName}</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-medium">Latest Telemetry:</span>
                      <span className="font-semibold text-on-surface">
                        {readings.length > 0 && readings[0]?.observedAt
                          ? new Date(String(readings[0].observedAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : 'No readings'}
                      </span>
                    </div>
                  </div>

                  {/* 8 Compact Sensor Metric Pills */}
                  <div className="mb-4">
                    <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider block mb-2">
                      Agronomic Telemetry Indicators
                    </span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {params8.map((param: Telemetry8Param) => (
                        <div
                          key={param.key}
                          className="bg-surface-container-low/60 p-1.5 rounded-lg border border-outline-variant/20 text-center"
                          title={`${param.name}: ${param.value !== null ? `${param.value} ${param.unit}` : 'No data'}`}
                        >
                          <div className="text-[9px] font-bold text-on-surface-variant uppercase truncate">
                            {param.symbol}
                          </div>
                          <div className="text-[11px] font-extrabold text-on-surface mt-0.5 truncate">
                            {param.value !== null ? `${param.value}` : '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Decision Badges */}
                  <div className="p-3 rounded-xl bg-surface-container-low/50 border border-outline-variant/20 space-y-2 mb-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-on-surface-variant flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px] text-blue-600">water_drop</span>
                        <span>Water Need:</span>
                      </span>
                      <span
                        className={`text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full border ${
                          decisionRow.waterNeedBadge === 'urgent'
                            ? 'bg-red-50 text-red-700 border-red-300'
                            : decisionRow.waterNeedBadge === 'high'
                            ? 'bg-amber-50 text-amber-700 border-amber-300'
                            : decisionRow.waterNeedBadge === 'moderate'
                            ? 'bg-blue-50 text-blue-700 border-blue-300'
                            : decisionRow.waterNeedBadge === 'low'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-surface-container text-on-surface-variant border-outline-variant/40'
                        }`}
                      >
                        {decisionRow.waterNeed || 'UNCHECKED'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-on-surface-variant flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px] text-emerald-600">vital_signs</span>
                        <span>Field Status:</span>
                      </span>
                      <span
                        className={`text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full border ${
                          decisionRow.fieldStatusBadge === 'critical'
                            ? 'bg-red-50 text-red-700 border-red-300'
                            : decisionRow.fieldStatusBadge === 'attention'
                            ? 'bg-amber-50 text-amber-700 border-amber-300'
                            : decisionRow.fieldStatusBadge === 'healthy'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-surface-container text-on-surface-variant border-outline-variant/40'
                        }`}
                      >
                        {decisionRow.fieldStatus || 'NO STATUS'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Action Links */}
                <div className="pt-3 border-t border-outline-variant/20 flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/dashboard/fields/${fieldItem.fieldId}`}
                      className="text-primary hover:underline flex items-center gap-0.5"
                    >
                      <span>View Field</span>
                      <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                    </Link>

                    <Link
                      to={`/dashboard/fields/${fieldItem.fieldId}#ai-decision`}
                      className="text-secondary hover:underline flex items-center gap-0.5"
                    >
                      <span>AI Decision</span>
                    </Link>
                  </div>

                  <button
                    onClick={() => setSelectedFieldId(fieldItem.fieldId)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                      isSelected
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
                    }`}
                  >
                    Telemetry History
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. GRAPHICAL ANALYTICS (REAL PERSISTED SENSOR TELEMETRY) */}
      <section aria-labelledby="analytics-heading" className="bg-surface-container-lowest rounded-2xl p-6 sm:p-7 shadow-sm border border-outline-variant/30 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-primary">show_chart</span>
              <h2 id="analytics-heading" className="text-lg font-extrabold text-on-surface">
                Telemetry Analytics: {selectedField.name}
              </h2>
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Historical sensor readings captured from physical probe deployments in sector {selectedField.fieldId}.
            </p>
          </div>

          {/* Metric Selector Tabs */}
          <div className="flex items-center p-1 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs font-bold shrink-0">
            <button
              onClick={() => setSelectedMetric('SOIL_MOISTURE')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedMetric === 'SOIL_MOISTURE'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Soil Moisture (%)
            </button>
            <button
              onClick={() => setSelectedMetric('AIR_TEMPERATURE')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedMetric === 'AIR_TEMPERATURE'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Air Temp (°C)
            </button>
            <button
              onClick={() => setSelectedMetric('RELATIVE_HUMIDITY')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedMetric === 'RELATIVE_HUMIDITY'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Humidity (%)
            </button>
          </div>
        </div>

        {/* Metric Quick Stats Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-surface-container-low/50 rounded-xl border border-outline-variant/20">
            <span className="text-[10px] text-on-surface-variant uppercase font-bold">Latest Reading</span>
            <div className="text-xl font-extrabold text-on-surface mt-0.5">
              {chartLatest !== null ? `${chartLatest}` : '—'}{' '}
              <span className="text-xs font-semibold text-on-surface-variant">
                {selectedMetric === 'SOIL_MOISTURE' || selectedMetric === 'RELATIVE_HUMIDITY' ? '%' : '°C'}
              </span>
            </div>
          </div>

          <div className="p-3 bg-surface-container-low/50 rounded-xl border border-outline-variant/20">
            <span className="text-[10px] text-on-surface-variant uppercase font-bold">Historical Average</span>
            <div className="text-xl font-extrabold text-primary mt-0.5">
              {chartAvg !== null ? `${chartAvg}` : '—'}{' '}
              <span className="text-xs font-semibold text-on-surface-variant">
                {selectedMetric === 'SOIL_MOISTURE' || selectedMetric === 'RELATIVE_HUMIDITY' ? '%' : '°C'}
              </span>
            </div>
          </div>

          <div className="p-3 bg-surface-container-low/50 rounded-xl border border-outline-variant/20">
            <span className="text-[10px] text-on-surface-variant uppercase font-bold">Minimum Recorded</span>
            <div className="text-xl font-extrabold text-on-surface mt-0.5">
              {numericValues.length > 0 ? `${chartMin}` : '—'}{' '}
              <span className="text-xs font-semibold text-on-surface-variant">
                {selectedMetric === 'SOIL_MOISTURE' || selectedMetric === 'RELATIVE_HUMIDITY' ? '%' : '°C'}
              </span>
            </div>
          </div>

          <div className="p-3 bg-surface-container-low/50 rounded-xl border border-outline-variant/20">
            <span className="text-[10px] text-on-surface-variant uppercase font-bold">Maximum Recorded</span>
            <div className="text-xl font-extrabold text-on-surface mt-0.5">
              {numericValues.length > 0 ? `${chartMax}` : '—'}{' '}
              <span className="text-xs font-semibold text-on-surface-variant">
                {selectedMetric === 'SOIL_MOISTURE' || selectedMetric === 'RELATIVE_HUMIDITY' ? '%' : '°C'}
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic SVG Trend Line Chart */}
        {loadingChart ? (
          <div className="h-64 flex items-center justify-center text-xs text-on-surface-variant animate-pulse bg-surface-container-low/30 rounded-xl">
            Loading telemetry historical trendline...
          </div>
        ) : sortedChartPoints.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-surface-container-low/30 rounded-xl border border-outline-variant/20">
            <span className="material-symbols-outlined text-[36px] text-on-surface-variant mb-2">
              query_stats
            </span>
            <h4 className="font-extrabold text-sm text-on-surface">No Historical {selectedMetric} Telemetry</h4>
            <p className="text-xs text-on-surface-variant mt-1 max-w-sm">
              Sensor probes have not yet transmitted time-series telemetry for this measurement in {selectedField.name}.
            </p>
          </div>
        ) : (
          <div className="p-4 bg-surface-container-low/30 rounded-xl border border-outline-variant/20">
            <div className="h-60 w-full relative">
              <svg
                role="img"
                aria-label={`${selectedMetric} time-series chart`}
                viewBox="0 0 800 240"
                className="w-full h-full overflow-visible"
              >
                {/* Horizontal grid lines */}
                <line x1="40" y1="20" x2="780" y2="20" stroke="#E5E7EB" strokeDasharray="4 4" />
                <line x1="40" y1="80" x2="780" y2="80" stroke="#E5E7EB" strokeDasharray="4 4" />
                <line x1="40" y1="140" x2="780" y2="140" stroke="#E5E7EB" strokeDasharray="4 4" />
                <line x1="40" y1="200" x2="780" y2="200" stroke="#D1D5DB" />

                {/* Y-Axis Labels */}
                <text x="35" y="24" fontSize="10" textAnchor="end" fill="#6B7280" fontWeight="bold">
                  {chartMax}
                </text>
                <text x="35" y="144" fontSize="10" textAnchor="end" fill="#6B7280" fontWeight="bold">
                  {Math.round(((chartMax + chartMin) / 2) * 10) / 10}
                </text>
                <text x="35" y="204" fontSize="10" textAnchor="end" fill="#6B7280" fontWeight="bold">
                  {chartMin}
                </text>

                {/* Area Fill & Path Line */}
                {sortedChartPoints.length > 1 && (
                  <>
                    {/* Area under curve */}
                    <polygon
                      points={`
                        40,200
                        ${sortedChartPoints
                          .map((pt, idx) => {
                            const val = Number(pt.value ?? pt.rawValue) || 0;
                            const x = 40 + idx * (740 / Math.max(1, sortedChartPoints.length - 1));
                            const y = 200 - ((val - chartMin) / chartRange) * 180;
                            return `${x},${y}`;
                          })
                          .join(' ')}
                        780,200
                      `}
                      fill="#006a38"
                      fillOpacity="0.1"
                    />

                    {/* Polyline */}
                    <polyline
                      fill="none"
                      stroke="#006a38"
                      strokeWidth="2.5"
                      points={sortedChartPoints
                        .map((pt, idx) => {
                          const val = Number(pt.value ?? pt.rawValue) || 0;
                          const x = 40 + idx * (740 / Math.max(1, sortedChartPoints.length - 1));
                          const y = 200 - ((val - chartMin) / chartRange) * 180;
                          return `${x},${y}`;
                        })
                        .join(' ')}
                    />
                  </>
                )}

                {/* Individual Data Points */}
                {sortedChartPoints.map((pt, idx) => {
                  const val = Number(pt.value ?? pt.rawValue) || 0;
                  const x = 40 + idx * (740 / Math.max(1, sortedChartPoints.length - 1));
                  const y = 200 - ((val - chartMin) / chartRange) * 180;
                  const obsDate = pt.observedAt ? new Date(String(pt.observedAt)).toLocaleString() : 'Recent';

                  return (
                    <g key={String(pt.id || pt.telemetryId || idx)}>
                      <circle
                        cx={x}
                        cy={y}
                        r="4"
                        fill="#006a38"
                        stroke="#ffffff"
                        strokeWidth="2"
                        className="cursor-pointer hover:r-6 transition-all"
                      >
                        <title>{`${val} ${pt.unit || ''} at ${obsDate}`}</title>
                      </circle>
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className="flex items-center justify-between text-[11px] text-on-surface-variant font-semibold mt-3 pt-2 border-t border-outline-variant/20">
              <span>Oldest Ingested ({sortedChartPoints.length} points)</span>
              <span>Latest Transmitted ({selectedField.name})</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
