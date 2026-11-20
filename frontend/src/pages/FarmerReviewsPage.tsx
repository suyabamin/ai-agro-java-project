import React, { useEffect, useState, useCallback } from 'react';
import { assignmentService } from '../services/assignmentService';
import { reviewService } from '../services/reviewService';
import type { FieldAssignment } from '../types/assignment';
import type { AssignmentReview } from '../types/review';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { StatusBadge } from '../components/ui/StatusBadge';

export const FarmerReviewsPage: React.FC = () => {
  const [assignments, setAssignments] = useState<FieldAssignment[]>([]);
  const [reviews, setReviews] = useState<Record<string, AssignmentReview | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [activeRes, histRes] = await Promise.all([
        assignmentService.fetchMyActiveAssignments().catch(() => ({ data: { items: [] } })),
        assignmentService.fetchMyAssignmentHistory().catch(() => ({ data: { items: [] } })),
      ]);
      const all = [...(activeRes.data?.items || []), ...(histRes.data?.items || [])];
      setAssignments(all);

      // Fetch reviews for these assignments
      const reviewMap: Record<string, AssignmentReview | null> = {};
      await Promise.all(
        all.map(async (a) => {
          try {
            const r = await reviewService.fetchReview(a.assignmentId);
            reviewMap[a.assignmentId] = r.data || null;
          } catch {
            reviewMap[a.assignmentId] = null;
          }
        })
      );
      setReviews(reviewMap);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-tertiary-fixed-dim" />

        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Reputation & Trust</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
          Performance Reviews & Feedback
        </h1>
        <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
          Verified owner assessments, agronomic tenure ratings, and skill evaluations from completed holding contracts.
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
          icon="rate_review"
          title="No Field Tenures on File"
          description="You do not have any active or past assignments. When farm owners review your work upon tenure conclusion, feedback will be catalogued here."
        />
      ) : (
        <div className="space-y-4">
          {assignments.map((a) => {
            const rev = reviews[a.assignmentId];
            return (
              <div
                key={a.assignmentId}
                className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/30 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-on-surface">
                      Assignment: {a.assignmentId.substring(0, 14)}...
                    </span>
                    <StatusBadge status={a.status} />
                  </div>

                  <p className="text-xs text-on-surface-variant">
                    Field Sector: <span className="font-mono font-bold text-primary">{a.fieldId}</span> • Assigned: {new Date(a.assignedAt).toLocaleDateString()}
                  </p>

                  {rev ? (
                    <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 space-y-2 mt-3">
                      <div className="flex items-center gap-1.5 text-amber-500 font-bold text-sm">
                        {'★'.repeat(rev.rating)}
                        {'☆'.repeat(5 - rev.rating)}
                        <span className="ml-2 text-xs text-on-surface font-extrabold">{rev.rating} / 5</span>
                      </div>
                      <p className="text-xs text-on-surface leading-relaxed italic">
                        "{rev.comment || 'No written comment provided.'}"
                      </p>
                      <div className="text-[10px] text-on-surface-variant">
                        Reviewed: {new Date(rev.createdAt).toLocaleDateString()}
                        {rev.revisions && rev.revisions.length > 0 && ` • (${rev.revisions.length} revision[s])`}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-surface-container-low/60 text-xs text-on-surface-variant italic">
                      Pending owner review. Owner has not yet published an evaluation for this tenure.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
