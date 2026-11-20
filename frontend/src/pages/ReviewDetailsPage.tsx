import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { reviewService } from '../services/reviewService';
import type { AssignmentReview } from '../types/review';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';

function StarDisplay({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <span
          key={star}
          className={`material-symbols-outlined text-[20px] ${star <= value ? 'text-amber-400' : 'text-on-surface-variant/30'}`}
          style={{ fontVariationSettings: "'FILL' 1" }}
        >star</span>
      ))}
    </div>
  );
}

export const ReviewDetailsPage: React.FC = () => {
  const { reviewId } = useParams<{ reviewId: string }>();

  const [review, setReview] = useState<AssignmentReview | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editRating, setEditRating] = useState(5);
  const [editComment, setEditComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!reviewId) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      // reviewId here is actually an assignmentId
      const res = await reviewService.fetchReview(reviewId);
      setReview(res.data || null);
      if (res.data) {
        setEditRating(res.data.rating);
        setEditComment(res.data.comment || '');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load review');
    } finally { setLoading(false); }
  }, [reviewId]);

  useEffect(() => { load(); }, [load]);

  const isEditable = review ? (() => {
    const created = new Date(review.createdAt).getTime();
    const now = Date.now();
    return (now - created) < 24 * 60 * 60 * 1000;
  })() : false;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewId) return;
    setSaving(true); setError(null);
    try {
      const res = await reviewService.updateReview(reviewId, { rating: editRating, comment: editComment.trim() || null });
      setReview(res.data || null);
      setEditMode(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update review');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 max-w-[800px] mx-auto">
      <div className="flex items-center gap-2">
        <Link to="/dashboard/reviews" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Reviews
        </Link>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-[22px]">rate_review</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-on-surface">Review Details</h1>
            <p className="text-xs text-on-surface-variant font-mono mt-0.5">Assignment: {reviewId}</p>
          </div>
        </div>
        {review && isEditable && !editMode && (
          <button
            onClick={() => setEditMode(true)}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">edit</span> Edit Review
          </button>
        )}
      </div>

      {loading && <LoadingSkeleton type="dashboard" />}

      {!loading && error && (
        <div className="p-6 rounded-2xl bg-error/10 border border-error/30">
          <p className="text-sm text-error">{error}</p>
          <button onClick={load} className="mt-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold cursor-pointer">Retry</button>
        </div>
      )}

      {!loading && !error && review && (
        <>
          {!editMode ? (
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-6 space-y-4">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <StarDisplay value={review.rating} />
                  <p className="text-sm font-bold text-on-surface mt-1">{review.rating}/5 stars</p>
                </div>
                {!isEditable && (
                  <span className="px-2 py-1 rounded-full bg-surface-container text-on-surface-variant text-xs font-semibold">Locked — 24h window closed</span>
                )}
                {isEditable && (
                  <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">Editable</span>
                )}
              </div>

              {review.comment && (
                <div>
                  <p className="text-xs font-semibold text-on-surface-variant mb-1">Comment</p>
                  <p className="text-sm text-on-surface leading-relaxed">{review.comment}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-on-surface-variant">Created</span>
                  <p className="font-semibold text-on-surface">{new Date(review.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-on-surface-variant">Last Updated</span>
                  <p className="font-semibold text-on-surface">{new Date(review.updatedAt).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-on-surface-variant">Farm</span>
                  <p className="font-mono text-on-surface">{review.farmId.slice(0, 12)}…</p>
                </div>
                <div>
                  <span className="text-on-surface-variant">Farmer</span>
                  <p className="font-mono text-on-surface">{review.farmerUid.slice(0, 12)}…</p>
                </div>
              </div>

              {review.revisions && review.revisions.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-on-surface mb-2">Revision History</h3>
                  <div className="space-y-2">
                    {review.revisions.map(rev => (
                      <div key={rev.revisionNumber} className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/20">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-on-surface">Revision #{rev.revisionNumber}</span>
                          <span className="text-xs text-on-surface-variant">{new Date(rev.editedAt).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1 mb-1">
                          {[1,2,3,4,5].map(s => (
                            <span key={s} className={`material-symbols-outlined text-[14px] ${s <= rev.rating ? 'text-amber-400' : 'text-on-surface-variant/30'}`} style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                          ))}
                          <span className="text-xs text-on-surface-variant ml-1">{rev.rating}/5</span>
                        </div>
                        {rev.comment && <p className="text-xs text-on-surface-variant">{rev.comment}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSave} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-6 space-y-5">
              <h2 className="text-sm font-bold text-on-surface">Edit Review</h2>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-on-surface">Rating</label>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(star => (
                    <button key={star} type="button" onClick={() => setEditRating(star)} className={`text-[32px] cursor-pointer ${star <= editRating ? 'text-amber-400' : 'text-on-surface-variant/30'}`}>
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-on-surface" htmlFor="edit-comment">Comment</label>
                <textarea
                  id="edit-comment"
                  rows={4}
                  value={editComment}
                  onChange={e => setEditComment(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-container text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary border border-transparent resize-none"
                />
              </div>
              {error && <p className="text-xs text-error">{error}</p>}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setEditMode(false)} className="h-10 px-5 rounded-xl border border-outline-variant/40 hover:bg-surface-container text-on-surface text-sm font-semibold cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving} className="h-10 px-6 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-bold text-sm cursor-pointer disabled:opacity-60 flex items-center gap-2">
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}
        </>
      )}

      {!loading && !error && !review && (
        <div className="p-10 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-center">
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant block mb-2">rate_review</span>
          <p className="text-sm font-semibold text-on-surface">Review Not Found</p>
          <p className="text-xs text-on-surface-variant mt-1">No review exists for this assignment.</p>
          <Link to="/dashboard/reviews/new" className="mt-3 inline-block px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold">Write a Review</Link>
        </div>
      )}
    </div>
  );
};
