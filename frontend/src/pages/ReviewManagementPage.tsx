import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFarm } from '../context/FarmContext';
import { assignmentService } from '../services/assignmentService';
import type { FieldAssignment } from '../types/assignment';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { StatusBadge } from '../components/ui/StatusBadge';
import { AssignmentReviewModal } from '../components/review/AssignmentReviewModal';

export const ReviewManagementPage: React.FC = () => {
  const { user } = useAuth();
  const { activeFarm } = useFarm();
  const navigate = useNavigate();

  const [assignments, setAssignments] = useState<FieldAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Selected assignment for review modal
  const [reviewAssignment, setReviewAssignment] = useState<FieldAssignment | null>(null);

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

  if (!activeFarm) {
    return (
      <EmptyState
        icon="warehouse"
        title="No Farm Selected"
        description="Select an active farm to manage specialist performance reviews."
        actionText="My Farms"
        onAction={() => navigate('/dashboard/farms')}
      />
    );
  }

  const filtered = assignments.filter((a) => {
    const term = searchTerm.toLowerCase();
    return (
      (a.farmerName || '').toLowerCase().includes(term) ||
      a.farmerUid.toLowerCase().includes(term) ||
      a.fieldId.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Performance & Evaluation
            </span>
            <span className="text-xs text-on-surface-variant">• {activeFarm.name}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
            Specialist Reviews & Feedback
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Rate field agronomist execution, provide peer review commentary, and establish verified credentials.
          </p>
        </div>

        <Link
          to="/dashboard/assignments"
          className="h-11 px-5 rounded-xl border border-outline-variant/40 hover:bg-surface-container text-on-surface font-semibold text-xs flex items-center justify-center gap-2 no-underline transition-colors shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
          <span>View All Assignments</span>
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
      </div>

      {/* Assignments List */}
      {loading ? (
        <LoadingSkeleton count={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="rate_review"
          title={assignments.length === 0 ? 'No Assignments to Review' : 'No Matching Tenures'}
          description={
            assignments.length === 0
              ? `There are no field worker assignments recorded under "${activeFarm.name}" yet.`
              : 'No assignments match your search criteria.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((a) => (
            <div
              key={a.assignmentId}
              className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/30 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className="font-mono text-[11px] text-on-surface-variant">
                    {a.assignmentId.substring(0, 12)}...
                  </span>
                  <StatusBadge status={a.status} />
                </div>

                <div className="flex items-center gap-3 mb-4">
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
                    <span className="text-on-surface-variant">Field Sector</span>
                    <span className="font-mono font-bold text-primary">{a.fieldId.substring(0, 14)}...</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-on-surface-variant">Assigned Date</span>
                    <span className="text-on-surface font-medium">{new Date(a.assignedAt).toLocaleDateString()}</span>
                  </div>
                  {a.releasedAt && (
                    <div className="flex justify-between items-center text-on-surface-variant">
                      <span>Tenure Concluded</span>
                      <span>{new Date(a.releasedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setReviewAssignment(a)}
                  className="w-full h-9 rounded-lg bg-primary hover:bg-secondary text-on-primary font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">rate_review</span>
                  <span>Write / Edit Review</span>
                </button>
              </div>
            </div>
          ))}
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
    </div>
  );
};
