import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { assignmentService } from '../services/assignmentService';
import { reviewService } from '../services/reviewService';
import type { FieldAssignment } from '../types/assignment';

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`text-[32px] cursor-pointer transition-colors ${star <= value ? 'text-amber-400' : 'text-on-surface-variant/30'}`}
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
        </button>
      ))}
    </div>
  );
}

export const CreateReviewPage: React.FC = () => {
  const { activeFarm } = useFarm();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preAssignmentId = searchParams.get('assignmentId') || '';

  const [assignments, setAssignments] = useState<FieldAssignment[]>([]);
  const [assignmentId, setAssignmentId] = useState(preAssignmentId);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAssignments = useCallback(async () => {
    if (!activeFarm) return;
    setLoading(true);
    try {
      const res = await assignmentService.fetchFarmAssignments(activeFarm.farmId);
      setAssignments(res.data?.items || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load assignments');
    } finally { setLoading(false); }
  }, [activeFarm]);

  useEffect(() => { loadAssignments(); }, [loadAssignments]);

  const selectedAssignment = assignments.find(a => a.assignmentId === assignmentId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentId || rating < 1 || rating > 5) return;
    setSubmitting(true); setError(null);
    try {
      await reviewService.createReview(assignmentId, {
        rating,
        comment: comment.trim() || null,
      });
      navigate(`/dashboard/reviews`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create review');
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[700px] mx-auto">
      <div className="flex items-center gap-2">
        <Link to="/dashboard/reviews" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Reviews
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-[22px]">rate_review</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-on-surface">Write a Review</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">Reviews are assignment-specific. Only one review per assignment.</p>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20">
        <div className="flex items-start gap-2">
          <span className="material-symbols-outlined text-primary text-[16px] mt-0.5">schedule</span>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Reviews can be edited within <strong className="text-on-surface">24 hours</strong> of creation. After that, they become permanent.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-6 space-y-6">
        {/* Assignment selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-on-surface" htmlFor="assign-sel">Assignment <span className="text-error">*</span></label>
          <select
            id="assign-sel"
            required
            value={assignmentId}
            onChange={e => setAssignmentId(e.target.value)}
            disabled={loading}
            className="w-full h-10 px-3 rounded-lg bg-surface-container text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary border border-transparent"
          >
            <option value="">Select an assignment…</option>
            {assignments.map(a => (
              <option key={a.assignmentId} value={a.assignmentId}>
                {a.assignmentId.slice(0, 8)}… — {a.farmerName || a.farmerUid} ({a.status})
              </option>
            ))}
          </select>
          {selectedAssignment && (
            <p className="text-xs text-on-surface-variant">
              Farmer: <strong className="text-on-surface">{selectedAssignment.farmerName || selectedAssignment.farmerUid}</strong>
              {' · '}Status: <strong className="text-on-surface">{selectedAssignment.status}</strong>
            </p>
          )}
        </div>

        {/* Star Rating */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-on-surface">Rating <span className="text-error">*</span></label>
          <StarRating value={rating} onChange={setRating} />
          <p className="text-xs text-on-surface-variant">{rating} out of 5 stars</p>
        </div>

        {/* Comment */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-on-surface" htmlFor="comment">Comment (optional)</label>
          <textarea
            id="comment"
            rows={5}
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Share your experience working with this farmer on this field…"
            className="w-full px-3 py-2 rounded-lg bg-surface-container text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary border border-transparent resize-none"
          />
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-error/10 border border-error/30">
            <p className="text-xs text-error">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Link to="/dashboard/reviews" className="h-10 px-5 inline-flex items-center rounded-xl border border-outline-variant/40 hover:bg-surface-container text-on-surface text-sm font-semibold">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || !assignmentId || rating < 1 || !activeFarm}
            className="h-10 px-6 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-bold text-sm shadow-sm cursor-pointer disabled:opacity-60 flex items-center gap-2"
          >
            {submitting ? (
              <><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span> Submitting…</>
            ) : (
              <><span className="material-symbols-outlined text-[16px]">rate_review</span> Submit Review</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
