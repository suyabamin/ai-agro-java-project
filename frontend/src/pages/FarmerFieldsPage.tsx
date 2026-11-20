import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { assignmentService } from '../services/assignmentService';
import type { FieldAssignment } from '../types/assignment';
import type { Field } from '../types/field';
import { StatusBadge } from '../components/ui/StatusBadge';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { FieldMonitoringPanel } from '../components/monitoring/FieldMonitoringPanel';

export const FarmerFieldsPage: React.FC = () => {
  const [assignments, setAssignments] = useState<FieldAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Field details modal
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await assignmentService.fetchMyActiveAssignments();
      setAssignments(resp.data?.items || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load assigned fields');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const handleInspect = async (fieldId: string) => {
    setInspectLoading(true);
    try {
      const resp = await assignmentService.fetchMyAssignedField(fieldId);
      setSelectedField(resp.data || null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to inspect field details');
    } finally {
      setInspectLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-tertiary-fixed-dim" />

        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Agronomic Scope</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
          My Assigned Field Sectors
        </h1>
        <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
          Parcel sectors under your direct operational stewardship. Maintain crop health and log field observations.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-error-container text-error text-xs font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <LoadingSkeleton count={3} />
      ) : assignments.length === 0 ? (
        <EmptyState
          icon="grass"
          title="No Fields Currently Assigned"
          description="You are not actively assigned to any field parcels. When farm owners approve your job applications or direct appointments, your fields will appear here."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assignments.map((a) => (
            <div
              key={a.assignmentId}
              className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/30 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className="font-mono text-[11px] text-on-surface-variant">
                    {a.fieldId.substring(0, 14)}...
                  </span>
                  <StatusBadge status={a.status} />
                </div>

                <h3 className="font-bold text-base text-on-surface mb-2">
                  {a.farmerName || 'Assigned Field Zone'}
                </h3>

                <div className="p-3.5 rounded-xl bg-surface-container-low text-xs space-y-1.5 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-on-surface-variant">Assigned Date</span>
                    <span className="font-semibold text-on-surface">
                      {new Date(a.assignedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-on-surface-variant">Holding Farm</span>
                    <span className="font-mono font-bold text-primary">{a.farmId.substring(0, 12)}...</span>
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
                  onClick={() => handleInspect(a.fieldId)}
                  disabled={inspectLoading}
                  className="h-9 px-3 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-all"
                  title="Quick View"
                >
                  <span className="material-symbols-outlined text-[16px]">visibility</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Field Inspection Modal */}
      {selectedField && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-outline-variant/30 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-on-surface">{selectedField.name}</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {selectedField.cropType} • {selectedField.soilType || 'Loam'} • {selectedField.areaHectares} ha
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedField(null)}
                className="w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center text-on-surface-variant cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 text-xs">
              <span className="font-bold text-on-surface block mb-1">Directives & Boundary Notes</span>
              <p className="text-on-surface-variant leading-relaxed">
                {selectedField.notes || 'Standard agronomic care directives apply.'}
              </p>
            </div>

            <div className="border border-outline-variant/30 rounded-xl p-4">
              <FieldMonitoringPanel
                farmId={selectedField.farmId}
                fieldId={selectedField.fieldId}
                compact={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
