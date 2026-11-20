import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFarm } from '../context/FarmContext';
import { assignmentService } from '../services/assignmentService';
import type { FieldAssignment } from '../types/assignment';
import { StatusBadge } from '../components/ui/StatusBadge';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { AssignmentReviewModal } from '../components/review/AssignmentReviewModal';
import { RecordPaymentModal } from '../components/payment/RecordPaymentModal';

export const AssignmentDetailsPage: React.FC = () => {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { user } = useAuth();
  const { activeFarm } = useFarm();

  const [assignment, setAssignment] = useState<FieldAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  // Release
  const [releaseReason, setReleaseReason] = useState('');
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false);

  const loadAssignment = useCallback(async () => {
    if (!activeFarm || !assignmentId) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await assignmentService.fetchFarmAssignments(activeFarm.farmId);
      const items = resp.data?.items || [];
      const match = items.find((a) => a.assignmentId === assignmentId);
      if (match) {
        setAssignment(match);
      } else {
        setError('Assignment record not found under active farm holding.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load assignment details');
    } finally {
      setLoading(false);
    }
  }, [activeFarm, assignmentId]);

  useEffect(() => {
    loadAssignment();
  }, [loadAssignment]);

  const handleConfirmRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFarm || !assignment) return;
    setReleaseLoading(true);
    try {
      await assignmentService.releaseAssignment(
        activeFarm.farmId,
        assignment.fieldId,
        assignment.assignmentId,
        {
          releaseReason: releaseReason.trim() || 'Work completed for season',
          expectedVersion: assignment.version,
        }
      );
      setShowReleaseConfirm(false);
      setReleaseReason('');
      await loadAssignment();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to release assignment');
    } finally {
      setReleaseLoading(false);
    }
  };

  if (!activeFarm) {
    return (
      <div className="p-8 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/30">
        <h2 className="text-base font-bold text-on-surface">No Farm Selected</h2>
        <Link to="/dashboard/farms" className="mt-3 inline-block px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold">
          Go to My Farms
        </Link>
      </div>
    );
  }

  if (loading) {
    return <LoadingSkeleton type="dashboard" />;
  }

  if (error || !assignment) {
    return (
      <div className="p-8 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/30 space-y-3">
        <h2 className="text-base font-bold text-on-surface">Assignment Not Found</h2>
        <p className="text-xs text-on-surface-variant">{error || 'Could not locate assignment tenure.'}</p>
        <Link to="/dashboard/assignments" className="inline-block px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold">
          Back to Assignments
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard/assignments"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Back to Assignments</span>
        </Link>
        <span className="px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface-variant text-xs font-bold uppercase tracking-wider">
          {activeFarm.name}
        </span>
      </div>

      {/* Main Dossier Card */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30 relative overflow-hidden space-y-6">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-tertiary-fixed-dim" />

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary-container text-on-primary flex items-center justify-center font-bold text-xl shadow-md shrink-0">
              {(assignment.farmerName || 'F').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Operational Tenure
                </span>
                <StatusBadge status={assignment.status} />
              </div>
              <h1 className="text-2xl font-extrabold text-on-surface tracking-tight">
                {assignment.farmerName || 'Assigned Field Specialist'}
              </h1>
              <p className="text-xs text-on-surface-variant font-mono mt-0.5">
                Farmer UID: {assignment.farmerUid} • Assignment ID: {assignment.assignmentId}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPaymentModalOpen(true)}
              className="h-10 px-4 rounded-xl bg-primary hover:bg-secondary text-on-primary font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">payments</span>
              <span>Record Payment</span>
            </button>

            <button
              type="button"
              onClick={() => setReviewModalOpen(true)}
              className="h-10 px-4 rounded-xl border border-outline-variant/40 hover:bg-surface-container text-on-surface font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">rate_review</span>
              <span>Write Review</span>
            </button>

            {assignment.status === 'ACTIVE' && (
              <button
                type="button"
                onClick={() => setShowReleaseConfirm(true)}
                className="h-10 px-4 rounded-xl border border-error/40 text-error hover:bg-error-container/30 font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">person_remove</span>
                <span>Release Specialist</span>
              </button>
            )}
          </div>
        </div>

        {/* Matrix Parameters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs">
          <div>
            <span className="text-[10px] text-on-surface-variant uppercase font-semibold">Assigned Sector</span>
            <div className="mt-0.5">
              <Link
                to={`/dashboard/fields/${assignment.fieldId}`}
                className="font-bold text-primary hover:underline font-mono"
              >
                {assignment.fieldId.substring(0, 14)}...
              </Link>
            </div>
          </div>
          <div>
            <span className="text-[10px] text-on-surface-variant uppercase font-semibold">Assigned Date</span>
            <div className="font-bold text-on-surface mt-0.5">
              {new Date(assignment.assignedAt).toLocaleDateString()}
            </div>
          </div>
          <div>
            <span className="text-[10px] text-on-surface-variant uppercase font-semibold">Assigned By</span>
            <div className="font-mono text-on-surface mt-0.5 truncate">{assignment.assignedByUid}</div>
          </div>
          <div>
            <span className="text-[10px] text-on-surface-variant uppercase font-semibold">Version Schema</span>
            <div className="font-bold text-secondary mt-0.5">v{assignment.version}</div>
          </div>
        </div>

        {/* Permissions */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-on-surface">Field Operational Scope & Permissions</h2>
          <div className="flex flex-wrap gap-2">
            {assignment.permissions && assignment.permissions.length > 0 ? (
              assignment.permissions.map((p) => (
                <span
                  key={p}
                  className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface font-semibold text-xs flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px] text-primary">check_circle</span>
                  <span>{p}</span>
                </span>
              ))
            ) : (
              <span className="text-xs text-on-surface-variant italic">No special permissions granted.</span>
            )}
          </div>
        </div>

        {/* Release Status if not active */}
        {assignment.releasedAt && (
          <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 text-xs space-y-1">
            <span className="font-bold text-error">Tenure Concluded on {new Date(assignment.releasedAt).toLocaleDateString()}</span>
            <p className="text-on-surface-variant">Reason: {assignment.releaseReason || 'Completed season'}</p>
          </div>
        )}
      </div>

      {/* Release Confirmation Dialog */}
      {showReleaseConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl p-6 max-w-md w-full shadow-2xl border border-outline-variant/30 space-y-4">
            <h3 className="text-base font-bold text-on-surface">Confirm Specialist Release</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              This action concludes the active tenure for <strong className="text-on-surface">{assignment.farmerName || assignment.farmerUid}</strong> on this field.
            </p>

            <form onSubmit={handleConfirmRelease} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface" htmlFor="rel-reason">
                  Release Reason / Concluding Notes *
                </label>
                <input
                  id="rel-reason"
                  type="text"
                  required
                  value={releaseReason}
                  onChange={(e) => setReleaseReason(e.target.value)}
                  placeholder="e.g. End of seasonal harvesting cycle"
                  className="w-full h-10 px-3 rounded-lg bg-surface-container-low text-on-surface text-xs outline-none focus:ring-2 focus:ring-primary border border-transparent shadow-inner"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReleaseConfirm(false)}
                  className="h-9 px-4 rounded-xl border border-outline-variant/40 hover:bg-surface-container text-on-surface text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={releaseLoading || !releaseReason.trim()}
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
      {reviewModalOpen && (
        <AssignmentReviewModal
          isOpen={reviewModalOpen}
          assignmentId={assignment.assignmentId}
          farmId={assignment.farmId}
          fieldId={assignment.fieldId}
          farmerUid={assignment.farmerUid}
          farmerName={assignment.farmerName}
          isOwner={true}
          currentUserUid={user?.uid || ''}
          onClose={() => setReviewModalOpen(false)}
        />
      )}

      {/* Payment Modal */}
      {paymentModalOpen && (
        <RecordPaymentModal
          isOpen={paymentModalOpen}
          farmId={assignment.farmId}
          defaultAssignmentId={assignment.assignmentId}
          defaultFarmerUid={assignment.farmerUid}
          onClose={() => setPaymentModalOpen(false)}
          onPaymentRecorded={() => {
            setPaymentModalOpen(false);
            loadAssignment();
          }}
        />
      )}
    </div>
  );
};
