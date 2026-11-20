import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFarm } from '../context/FarmContext';
import { assignmentService } from '../services/assignmentService';
import type { FieldAssignment } from '../types/assignment';
import { StatusBadge } from '../components/ui/StatusBadge';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { AssignmentReviewModal } from '../components/review/AssignmentReviewModal';
import { RecordPaymentModal } from '../components/payment/RecordPaymentModal';

export const AssignmentManagementPage: React.FC = () => {
  const { user } = useAuth();
  const { activeFarm } = useFarm();
  const navigate = useNavigate();

  const [assignments, setAssignments] = useState<FieldAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [reviewAssignment, setReviewAssignment] = useState<FieldAssignment | null>(null);
  const [paymentAssignment, setPaymentAssignment] = useState<FieldAssignment | null>(null);
  const [releasingAssignment, setReleasingAssignment] = useState<FieldAssignment | null>(null);
  const [releaseReason, setReleaseReason] = useState('');
  const [releaseLoading, setReleaseLoading] = useState(false);

  const loadAssignments = useCallback(async () => {
    if (!activeFarm) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await assignmentService.fetchFarmAssignments(activeFarm.farmId);
      setAssignments(resp.data?.items || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, [activeFarm]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const handleConfirmRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFarm || !releasingAssignment) return;
    setReleaseLoading(true);
    try {
      await assignmentService.releaseAssignment(
        activeFarm.farmId,
        releasingAssignment.fieldId,
        releasingAssignment.assignmentId,
        {
          releaseReason: releaseReason.trim() || 'Work completed for season',
          expectedVersion: releasingAssignment.version,
        }
      );
      setReleasingAssignment(null);
      setReleaseReason('');
      await loadAssignments();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to release assignment');
    } finally {
      setReleaseLoading(false);
    }
  };

  if (!activeFarm) {
    return (
      <EmptyState
        icon="warehouse"
        title="No Farm Selected"
        description="Select an active farm to manage field worker assignments."
        actionText="My Farms"
        onAction={() => navigate('/dashboard/farms')}
      />
    );
  }

  const filtered = assignments.filter((a) => {
    const matchesSearch =
      (a.farmerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.farmerUid.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.fieldId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Operational Tenures
            </span>
            <span className="text-xs text-on-surface-variant">• {activeFarm.name}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
            Field Workforce Assignments
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Track active farmer tenures, field-level operational permissions, and performance records.
          </p>
        </div>

        <Link
          to="/dashboard/assignments/new"
          className="h-11 px-5 rounded-xl bg-primary hover:bg-secondary text-on-primary font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 no-underline active:scale-95 shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
          <span>Assign Farmer to Field</span>
        </Link>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-error-container text-error text-xs font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/30">
        <div className="relative w-full sm:w-80 flex items-center">
          <span className="absolute left-3 text-on-surface-variant pointer-events-none">
            <span className="material-symbols-outlined text-[18px]">search</span>
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search farmer name, UID, field..."
            className="w-full h-10 pl-9 pr-3 rounded-lg bg-surface-container-low text-on-surface text-xs placeholder:text-outline outline-none focus:ring-2 focus:ring-primary border border-transparent shadow-inner"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-on-surface-variant font-semibold">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 rounded-lg bg-surface-container-low text-on-surface text-xs outline-none focus:ring-2 focus:ring-primary border border-transparent cursor-pointer font-medium"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="RELEASED">RELEASED</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="TERMINATED">TERMINATED</option>
          </select>
        </div>
      </div>

      {/* Grid or Empty */}
      {loading ? (
        <LoadingSkeleton count={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="how_to_reg"
          title={assignments.length === 0 ? 'No Farmer Assignments Yet' : 'No Matching Assignments'}
          description={
            assignments.length === 0
              ? `There are no field assignments currently recorded under "${activeFarm.name}". Assign specialists to your agricultural field zones.`
              : 'No assignments match your search criteria.'
          }
          actionText={assignments.length === 0 ? 'Assign Farmer' : undefined}
          onAction={assignments.length === 0 ? () => navigate('/dashboard/assignments/new') : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((a) => (
            <div
              key={a.assignmentId}
              className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/30 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="font-mono text-[11px] text-on-surface-variant">
                    {a.assignmentId.substring(0, 12)}...
                  </span>
                  <StatusBadge status={a.status} />
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center font-bold text-sm shadow-sm">
                    {(a.farmerName || 'F').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-on-surface">
                      {a.farmerName || 'Assigned Farmer'}
                    </h3>
                    <p className="text-[10px] text-on-surface-variant font-mono">UID: {a.farmerUid}</p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-surface-container-low text-xs space-y-1.5 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-on-surface-variant">Field Zone:</span>
                    <Link
                      to={`/dashboard/fields/${a.fieldId}`}
                      className="font-bold text-primary hover:underline font-mono"
                    >
                      {a.fieldId.substring(0, 14)}...
                    </Link>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-on-surface-variant">Assigned Date:</span>
                    <span className="text-on-surface font-medium">
                      {new Date(a.assignedAt).toLocaleDateString()}
                    </span>
                  </div>
                  {a.releasedAt && (
                    <div className="flex justify-between items-center text-error">
                      <span>Released:</span>
                      <span>{new Date(a.releasedAt).toLocaleDateString()}</span>
                    </div>
                  )}
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

              <div className="pt-3 border-t border-outline-variant/20 space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentAssignment(a)}
                    className="flex-1 h-8 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">payments</span>
                    <span>Pay</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewAssignment(a)}
                    className="flex-1 h-8 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">rate_review</span>
                    <span>Review</span>
                  </button>

                  {a.status === 'ACTIVE' && (
                    <button
                      type="button"
                      onClick={() => setReleasingAssignment(a)}
                      className="h-8 px-2.5 rounded-lg border border-error/40 text-error hover:bg-error-container/30 font-semibold text-[11px] flex items-center justify-center cursor-pointer"
                      title="Release Farmer"
                    >
                      <span className="material-symbols-outlined text-[16px]">person_remove</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Release Confirmation Dialog */}
      {releasingAssignment && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl p-6 max-w-md w-full shadow-2xl border border-outline-variant/30 space-y-4">
            <h3 className="text-base font-bold text-on-surface">Release Farmer from Field</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Confirm release of farmer <strong className="text-on-surface">{releasingAssignment.farmerName || releasingAssignment.farmerUid}</strong> from field zone.
            </p>

            <form onSubmit={handleConfirmRelease} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface" htmlFor="rel-reason">
                  Release Reason / Notes
                </label>
                <input
                  id="rel-reason"
                  type="text"
                  value={releaseReason}
                  onChange={(e) => setReleaseReason(e.target.value)}
                  placeholder="e.g. Completed harvest season"
                  className="w-full h-10 px-3 rounded-lg bg-surface-container-low text-on-surface text-xs outline-none focus:ring-2 focus:ring-primary border border-transparent shadow-inner"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReleasingAssignment(null)}
                  className="h-9 px-4 rounded-xl border border-outline-variant/40 hover:bg-surface-container text-on-surface text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={releaseLoading}
                  className="h-9 px-4 rounded-xl bg-error hover:bg-error/90 text-white font-bold text-xs shadow-sm cursor-pointer disabled:opacity-60"
                >
                  {releaseLoading ? 'Releasing...' : 'Confirm Release'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewAssignment && (
        <AssignmentReviewModal
          isOpen={!!reviewAssignment}
          assignmentId={reviewAssignment.assignmentId}
          farmId={reviewAssignment.farmId}
          fieldId={reviewAssignment.fieldId}
          farmerUid={reviewAssignment.farmerUid}
          farmerName={reviewAssignment.farmerName}
          isOwner={true}
          currentUserUid={user?.uid || ''}
          onClose={() => {
            setReviewAssignment(null);
            loadAssignments();
          }}
        />
      )}

      {/* Payment Modal */}
      {paymentAssignment && (
        <RecordPaymentModal
          isOpen={!!paymentAssignment}
          farmId={paymentAssignment.farmId}
          defaultAssignmentId={paymentAssignment.assignmentId}
          defaultFarmerUid={paymentAssignment.farmerUid}
          onClose={() => setPaymentAssignment(null)}
          onPaymentRecorded={() => {
            setPaymentAssignment(null);
            loadAssignments();
          }}
        />
      )}
    </div>
  );
};
