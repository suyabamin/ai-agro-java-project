import React, { useState, useEffect, useCallback } from 'react';
import { reviewService } from '../../services/reviewService';
import type { AssignmentReview } from '../../types/review';

interface AssignmentReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignmentId: string;
  farmId: string;
  fieldId: string;
  farmerUid: string;
  farmerName?: string | null;
  isOwner: boolean;
  currentUserUid: string;
}

export const AssignmentReviewModal: React.FC<AssignmentReviewModalProps> = ({
  isOpen,
  onClose,
  assignmentId,
  farmId,
  fieldId,
  farmerUid,
  farmerName,
  isOwner,
  currentUserUid,
}) => {
  const [review, setReview] = useState<AssignmentReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const loadReview = useCallback(async () => {
    if (!assignmentId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await reviewService.fetchReview(assignmentId);
      if (res.data) {
        setReview(res.data);
        setRating(res.data.rating);
        setComment(res.data.comment || '');
      } else {
        setReview(null);
      }
    } catch {
      // 404 means no review yet
      setReview(null);
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccess(null);
      setIsEditing(false);
      loadReview();
    }
  }, [isOpen, loadReview]);

  if (!isOpen) return null;

  const isAuthor = review?.authorUid === currentUserUid;
  const isWithin24Hours = review
    ? Date.now() - new Date(review.createdAt).getTime() < 24 * 60 * 60 * 1000
    : true;
  const canEdit = isOwner && isAuthor && isWithin24Hours;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      if (review) {
        const res = await reviewService.updateReview(assignmentId, {
          rating,
          comment: comment.trim() || null,
        });
        setReview(res.data || null);
        setSuccess('Review updated successfully.');
        setIsEditing(false);
      } else {
        const res = await reviewService.createReview(assignmentId, {
          rating,
          comment: comment.trim() || null,
        });
        setReview(res.data || null);
        setSuccess('Review recorded successfully.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save review';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '8px',
          padding: '24px',
          width: '100%',
          maxWidth: '540px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#1B4332' }}>
            ⭐ Assignment Review
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6B7280' }}
          >
            ✕
          </button>
        </div>

        <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '16px', backgroundColor: '#F9FAFB', padding: '10px', borderRadius: '6px' }}>
          <div><strong>Assignment Tenure:</strong> {assignmentId}</div>
          <div><strong>Farm:</strong> {farmId} | <strong>Field:</strong> {fieldId} | <strong>Farmer:</strong> {farmerName || farmerUid}</div>
          <div style={{ marginTop: '4px', fontStyle: 'italic' }}>
            Private review: strictly visible only to the Farm Owner and the assigned Farmer.
          </div>
        </div>

        {error && (
          <div style={{ padding: '10px', backgroundColor: '#FEE2E2', color: '#991B1B', borderRadius: '6px', fontSize: '13px', marginBottom: '14px' }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ padding: '10px', backgroundColor: '#D1FAE5', color: '#065F46', borderRadius: '6px', fontSize: '13px', marginBottom: '14px' }}>
            {success}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '24px', color: '#6B7280' }}>Loading review details...</div>
        ) : review && !isEditing ? (
          <div>
            <div style={{ marginBottom: '16px', padding: '14px', border: '1px solid #E5E7EB', borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '20px', color: '#F59E0B' }}>
                  {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                </span>
                <span style={{ fontSize: '12px', color: '#6B7280' }}>
                  {new Date(review.createdAt).toLocaleString()}
                </span>
              </div>
              <p style={{ margin: '8px 0', fontSize: '14px', color: '#1F2937', whiteSpace: 'pre-wrap' }}>
                {review.comment || <em style={{ color: '#9CA3AF' }}>No comment provided.</em>}
              </p>
              {review.revisions && review.revisions.length > 0 && (
                <div style={{ marginTop: '12px', borderTop: '1px solid #F3F4F6', paddingTop: '8px', fontSize: '11px', color: '#6B7280' }}>
                  <strong>Audit History:</strong> Edited {review.revisions.length} time(s). Last updated at {new Date(review.updatedAt).toLocaleString()}.
                </div>
              )}
            </div>

            {canEdit && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: '#2D6A4F',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  ✏️ Edit Review (24h Window)
                </button>
              </div>
            )}
            {!canEdit && isOwner && isAuthor && !isWithin24Hours && (
              <p style={{ fontSize: '12px', color: '#9CA3AF', textAlign: 'right' }}>
                The 24-hour edit window for this review has expired.
              </p>
            )}
          </div>
        ) : isOwner ? (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Rating (1 to 5 Stars):
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '28px',
                      cursor: 'pointer',
                      color: star <= rating ? '#F59E0B' : '#D1D5DB',
                      padding: 0,
                    }}
                  >
                    ★
                  </button>
                ))}
                <span style={{ marginLeft: '8px', fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                  {rating} of 5
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Review Comment (Optional, max 1,000 characters):
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={1000}
                rows={4}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #D1D5DB',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
                placeholder="Describe performance, reliability, field care, and tenure outcomes..."
              />
              <span style={{ fontSize: '11px', color: '#6B7280', display: 'block', textAlign: 'right', marginTop: '2px' }}>
                {comment.length} / 1000
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              {isEditing && (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#2D6A4F',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'Saving...' : review ? 'Update Review' : 'Submit Review'}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px', color: '#6B7280', fontSize: '14px' }}>
            No review has been authored by the Farm Owner for this assignment tenure yet.
          </div>
        )}
      </div>
    </div>
  );
};
