import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { assignmentService } from '../services/assignmentService';
import { paymentService } from '../services/paymentService';
import type { FieldAssignment } from '../types/assignment';
import type { PaymentRecord } from '../types/payment';
import type { Field } from '../types/field';
import { monitoringService, type MonitoringRecord } from '../services/monitoringService';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { FieldMonitoringPanel } from '../components/monitoring/FieldMonitoringPanel';

export const FarmerDashboardPage: React.FC = () => {
  const { user } = useAuth();

  const [activeAssignments, setActiveAssignments] = useState<FieldAssignment[]>([]);
  const [historyAssignments, setHistoryAssignments] = useState<FieldAssignment[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [fieldAnalyses, setFieldAnalyses] = useState<Record<string, MonitoringRecord>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Field Inspection
  const [inspectingField, setInspectingField] = useState<Field | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [activeRes, histRes, payRes] = await Promise.all([
        assignmentService.fetchMyActiveAssignments().catch(() => ({ data: { items: [] } })),
        assignmentService.fetchMyAssignmentHistory().catch(() => ({ data: { items: [] } })),
        paymentService.listMyPayments().catch(() => ({ data: [] })),
      ]);
      const activeList = activeRes.data?.items || [];
      setActiveAssignments(activeList);
      setHistoryAssignments(histRes.data?.items || []);
      setPayments(payRes.data || []);

      // Fetch latest AI decisions for currently assigned fields
      if (activeList.length > 0) {
        const analysesMap: Record<string, MonitoringRecord> = {};
        await Promise.allSettled(
          activeList.map(async (a) => {
            try {
              const [analRes, disRes, availRes] = await Promise.allSettled([
                monitoringService.listAgriculturalAnalyses(a.farmId, a.fieldId, null, 1),
                monitoringService.analyses(a.farmId, a.fieldId, null, 1),
                monitoringService.diseaseAvailability(a.farmId, a.fieldId),
              ]);
              if (analRes.status === 'fulfilled' && analRes.value.data?.items?.length) {
                const merged = { ...analRes.value.data.items[0] };
                const latestDis = disRes.status === 'fulfilled' ? disRes.value.data?.items?.[0] : undefined;
                const avail = availRes.status === 'fulfilled' ? availRes.value.data : undefined;
                if (latestDis && latestDis.status === 'COMPLETED' && (latestDis.diseaseName || latestDis.predictedClass)) {
                  const label = String(latestDis.diseaseName || latestDis.predictedClass).replace(/_/g, ' ');
                  const conf = typeof latestDis.confidence === 'number' ? ` (${latestDis.confidence.toFixed(1)}%)` : '';
                  merged.diseaseDetectionStatus = `${label}${conf}`;
                } else if (avail?.available && (!merged.diseaseDetectionStatus || merged.diseaseDetectionStatus === 'MODEL_UNAVAILABLE')) {
                  merged.diseaseDetectionStatus = 'AVAILABLE';
                }
                analysesMap[a.fieldId] = merged;
              }
            } catch {
              // Ignore individual field load errors
            }
          })
        );
        setFieldAnalyses(analysesMap);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load farmer workspace data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleInspectField = async (fieldId: string) => {
    setInspectLoading(true);
    setError(null);
    try {
      const resp = await assignmentService.fetchMyAssignedField(fieldId);
      setInspectingField(resp.data || null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Field access restricted or unauthorized');
    } finally {
      setInspectLoading(false);
    }
  };

  const totalEarned = payments.reduce((sum, p) => sum + (p.status === 'RECORDED' ? Number(p.amount || 0) : 0), 0);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-tertiary-fixed-dim" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Specialist Workdesk
              </span>
              <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold uppercase tracking-wider">
                Authorized Fieldworker
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
              Farmer Operational Workdesk
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
              Field-scoped access to assigned precision parcels, maintenance logs, and verified compensation.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-right shrink-0">
            <span className="text-[10px] text-on-surface-variant block uppercase font-bold">Identity Claim (UID)</span>
            <code className="text-xs font-bold text-primary">{user?.uid || 'Authenticating...'}</code>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-error-container text-error text-xs font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          title="Active Field Tenures"
          value={activeAssignments.length}
          subtitle="Currently Authorized"
          icon="grass"
        />
        <StatCard
          title="Historical Tenures"
          value={historyAssignments.length}
          subtitle="Completed Contracts"
          icon="history"
        />
        <StatCard
          title="Total Wages Received"
          value={`${totalEarned.toLocaleString()} BDT`}
          subtitle="Verified Ledger"
          icon="payments"
        />
        <StatCard
          title="Payment Records"
          value={payments.length}
          subtitle="Disbursement Receipts"
          icon="receipt_long"
        />
      </div>

      {/* My Field AI Insights Section */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-primary text-[22px]">psychiatry</span>
              <h2 className="text-lg font-bold text-on-surface">My Field AI Insights</h2>
            </div>
            <p className="text-xs text-on-surface-variant">
              Persisted agronomic intelligence, water requirements, and field condition evaluations across your assigned sectors.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider self-start sm:self-auto">
            Synchronized with Owner Dashboard
          </span>
        </div>

        {loading ? (
          <LoadingSkeleton type="card" count={2} />
        ) : activeAssignments.length === 0 ? (
          <EmptyState
            icon="psychiatry"
            title="No Field AI Data Available"
            description="You do not currently have any active field assignments. Once appointed to a field, uploaded telemetry triggers AI agronomic decisions here."
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {activeAssignments.map((a) => {
              const ai = fieldAnalyses[a.fieldId];
              return (
                <div
                  key={`ai-${a.assignmentId}`}
                  className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/30 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-on-surface-variant">
                            Zone {a.fieldId.substring(0, 12)}...
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold uppercase">
                            Active Tenure
                          </span>
                        </div>
                        <h3 className="font-bold text-base text-on-surface mt-1">
                          {a.farmerName || 'Assigned Precision Zone'}
                        </h3>
                        <p className="text-[11px] text-on-surface-variant font-mono">
                          Holding Farm: {a.farmId.substring(0, 14)}...
                        </p>
                      </div>
                      <StatusBadge status={ai?.status || 'PENDING'} />
                    </div>

                    {/* AI Decision Cards */}
                    {ai ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                          {/* Water Need */}
                          <div className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/30">
                            <span className="text-[10px] font-bold uppercase text-on-surface-variant flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px] text-primary">water_drop</span>
                              Water Need
                            </span>
                            <p className="text-sm font-extrabold text-on-surface mt-1">
                              {String(ai.predictedWaterNeed || 'Sufficient')}
                            </p>
                            {ai.waterNeedConfidence !== undefined && (
                              <span className="text-[10px] text-on-surface-variant font-medium">
                                Conf: {(Number(ai.waterNeedConfidence) * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>

                          {/* Field Status */}
                          <div className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/30">
                            <span className="text-[10px] font-bold uppercase text-on-surface-variant flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px] text-secondary">eco</span>
                              Field Status
                            </span>
                            <p className="text-sm font-extrabold text-on-surface mt-1">
                              {String(ai.predictedFieldStatus || 'Healthy')}
                            </p>
                            {ai.fieldStatusConfidence !== undefined && (
                              <span className="text-[10px] text-on-surface-variant font-medium">
                                Conf: {(Number(ai.fieldStatusConfidence) * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>

                          {/* Recommended Crop */}
                          <div className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/30 col-span-2 sm:col-span-1">
                            <span className="text-[10px] font-bold uppercase text-on-surface-variant flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px] text-tertiary">agriculture</span>
                              Optimal Crop
                            </span>
                            <p className="text-sm font-extrabold text-on-surface mt-1 capitalize">
                              {String(ai.recommendedCrop || 'Optimal')}
                            </p>
                            {ai.cropConfidence !== undefined && (
                              <span className="text-[10px] text-on-surface-variant font-medium">
                                Conf: {(Number(ai.cropConfidence) * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Disease Detection Notice */}
                        <div className="p-2.5 rounded-xl bg-surface-container-lowest/80 border border-outline-variant/20 flex items-center justify-between text-xs">
                          <span className="text-[11px] text-on-surface-variant flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px] text-outline">verified</span>
                            Disease Diagnostic Status:
                          </span>
                          <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-mono text-[10px] font-bold">
                            {String(ai.diseaseDetectionStatus || 'MODEL_UNAVAILABLE')}
                          </span>
                        </div>

                        {/* Metadata Footer */}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-on-surface-variant pt-1 border-t border-outline-variant/20">
                          <span>
                            Evaluated: {ai.createdAt ? new Date(String(ai.createdAt)).toLocaleString() : 'Recent'}
                          </span>
                          {Boolean(ai.tabularModelVersion) && (
                            <span className="font-mono text-[10px] bg-surface-container px-2 py-0.5 rounded">
                              {String(ai.tabularModelVersion)}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-center space-y-2">
                        <span className="material-symbols-outlined text-primary/60 text-[28px]">pending_actions</span>
                        <p className="text-xs font-semibold text-on-surface">No Telemetry Recorded Yet</p>
                        <p className="text-[11px] text-on-surface-variant">
                          Submit your first 8 soil measurements in the field workdesk to generate AI decisions.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-outline-variant/20 flex items-center gap-2">
                    <Link
                      to={`/farmer/fields/${a.fieldId}`}
                      className="flex-1 h-9 rounded-xl bg-primary hover:bg-secondary text-on-primary font-bold text-xs flex items-center justify-center gap-1.5 no-underline shadow-sm transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px]">upload_file</span>
                      <span>Upload Data & Workdesk</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleInspectField(a.fieldId)}
                      disabled={inspectLoading}
                      className="h-9 px-3.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs flex items-center justify-center gap-1 cursor-pointer transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px]">monitoring</span>
                      <span>Logs</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Field Assignments Grid */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-on-surface">Currently Authorized Fields</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Only fields to which you have an active, validated assignment record are accessible.
            </p>
          </div>
          <Link
            to="/jobs"
            className="h-9 px-4 rounded-xl bg-primary hover:bg-secondary text-on-primary font-bold text-xs flex items-center gap-1.5 no-underline shadow-sm transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">work</span>
            <span>Explore Open Jobs</span>
          </Link>
        </div>

        {loading ? (
          <LoadingSkeleton count={3} />
        ) : activeAssignments.length === 0 ? (
          <EmptyState
            icon="grass"
            title="No Active Field Assignments"
            description="You do not currently hold an active field assignment. Browse job opportunities in the marketplace to get appointed by farm owners."
            actionText="Find Jobs"
            onAction={() => {}}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeAssignments.map((a) => (
              <div
                key={a.assignmentId}
                className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/30 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="font-mono text-[11px] text-on-surface-variant">
                      Zone {a.fieldId.substring(0, 10)}...
                    </span>
                    <StatusBadge status={a.status} />
                  </div>

                  <h3 className="font-bold text-base text-on-surface mb-2">
                    {a.farmerName || 'Assigned Field Zone'}
                  </h3>

                  <div className="p-3 rounded-xl bg-surface-container-lowest text-xs space-y-1.5 mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-on-surface-variant">Assigned Date</span>
                      <span className="font-semibold text-on-surface">
                        {new Date(a.assignedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-on-surface-variant">Holding Farm</span>
                      <span className="font-mono font-bold text-primary">{a.farmId.substring(0, 10)}...</span>
                    </div>
                  </div>

                  {a.permissions && a.permissions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {a.permissions.map((p) => (
                        <span
                          key={p}
                          className="px-2 py-0.5 rounded bg-surface-container text-on-surface text-[10px] font-semibold"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-outline-variant/20 flex gap-2">
                  <Link
                    to={`/farmer/fields/${a.fieldId}`}
                    className="flex-1 h-9 rounded-lg bg-primary hover:bg-secondary text-on-primary font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all no-underline"
                  >
                    <span className="material-symbols-outlined text-[16px]">dashboard</span>
                    <span>Field Dashboard</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleInspectField(a.fieldId)}
                    disabled={inspectLoading}
                    className="h-9 px-3 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-all"
                    title="Quick Preview"
                  >
                    <span className="material-symbols-outlined text-[16px]">visibility</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Field Inspection Drawer / Modal */}
      {inspectingField && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-outline-variant/30 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  Authorized Field Parcel
                </span>
                <h3 className="text-xl font-extrabold text-on-surface">{inspectingField.name}</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Crop: {inspectingField.cropType} • Soil: {inspectingField.soilType || 'Loam'} • Area: {inspectingField.areaHectares} ha
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectingField(null)}
                className="w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center text-on-surface-variant cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 text-xs space-y-2">
              <span className="font-bold text-on-surface block">Agronomic Parameters & Notes</span>
              <p className="text-on-surface-variant leading-relaxed">
                {inspectingField.notes || 'No specific agronomic directives assigned.'}
              </p>
            </div>

            {/* Embedded Monitoring for authorized farmer */}
            <div className="border border-outline-variant/30 rounded-xl p-4">
              <FieldMonitoringPanel
                farmId={inspectingField.farmId}
                fieldId={inspectingField.fieldId}
                compact={true}
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setInspectingField(null)}
                className="h-9 px-5 rounded-xl bg-primary text-on-primary font-bold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
