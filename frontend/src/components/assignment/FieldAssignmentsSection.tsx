import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { assignmentService } from '../../services/assignmentService';
import type { FieldAssignment, AssignmentHistory } from '../../types/assignment';
import { AssignFarmerModal } from './AssignFarmerModal';
import { AssignmentReviewModal } from '../review/AssignmentReviewModal';
import { RecordPaymentModal } from '../payment/RecordPaymentModal';

interface FieldAssignmentsSectionProps {
  farmId: string;
  fieldId: string;
  fieldName: string;
  canManage: boolean;
}

export const FieldAssignmentsSection: React.FC<FieldAssignmentsSectionProps> = ({
  farmId,
  fieldId,
  fieldName,
  canManage,
}) => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<FieldAssignment[]>([]);
  const [assignmentsCursor, setAssignmentsCursor] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);

  // Review & Payment modal state
  const [reviewModalAssignment, setReviewModalAssignment] = useState<FieldAssignment | null>(null);
  const [paymentModalAssignment, setPaymentModalAssignment] = useState<FieldAssignment | null>(null);

  // Release state
  const [releasingAssignment, setReleasingAssignment] = useState<FieldAssignment | null>(null);
  const [releaseReason, setReleaseReason] = useState('');
  const [releaseLoading, setReleaseLoading] = useState(false);

  // History state
  const [selectedAssignmentHistory, setSelectedAssignmentHistory] = useState<AssignmentHistory[] | null>(null);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);

  const loadAssignments = useCallback(async () => {
    if (!farmId || !fieldId) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await assignmentService.fetchFieldAssignments(farmId, fieldId);
      setAssignments(resp.data?.items || []);
      setAssignmentsCursor(resp.data?.nextCursor || null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load assignments';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [farmId, fieldId]);

  const loadMoreAssignments = async () => {
    if (!assignmentsCursor) return;
    setPageLoading(true);
    setError(null);
    try {
      const resp = await assignmentService.fetchFieldAssignments(farmId, fieldId, assignmentsCursor);
      const items = resp.data?.items || [];
      setAssignments((previous) => [...previous, ...items.filter((item) => !previous.some((old) => old.assignmentId === item.assignmentId))]);
      setAssignmentsCursor(resp.data?.nextCursor || null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load the next page');
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const handleRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!releasingAssignment) return;

    setReleaseLoading(true);
    try {
      await assignmentService.releaseAssignment(farmId, fieldId, releasingAssignment.assignmentId, {
        releaseReason: releaseReason.trim() || null,
        expectedVersion: releasingAssignment.version,
      });
      setReleasingAssignment(null);
      setReleaseReason('');
      loadAssignments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to release assignment';
      setError(msg);
    } finally {
      setReleaseLoading(false);
    }
  };

  const handleViewHistory = async (assignmentId: string) => {
    try {
      const resp = await assignmentService.fetchAssignmentHistory(farmId, fieldId, assignmentId);
      setSelectedAssignmentHistory(resp.data?.items || []);
      setHistoryCursor(resp.data?.nextCursor || null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load history';
      setError(msg);
    }
  };

  const loadMoreHistory = async (assignmentId: string) => {
    if (!historyCursor) return;
    setPageLoading(true);
    try {
      const resp = await assignmentService.fetchAssignmentHistory(farmId, fieldId, assignmentId, historyCursor);
      const items = resp.data?.items || [];
      setSelectedAssignmentHistory((previous) => [...(previous || []), ...items.filter((item) => !(previous || []).some((old) => old.historyId === item.historyId))]);
      setHistoryCursor(resp.data?.nextCursor || null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load more history');
    } finally {
      setPageLoading(false);
    }
  };

  const activeAssignments = assignments.filter((a) => a.status === 'ACTIVE');

  return (
    <div style={{ marginTop: '16px', borderTop: '1px solid #E5E7EB', paddingTop: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '14px', color: '#1B4332', fontWeight: 600 }}>
            👨‍🌾 Assigned Farmers ({activeAssignments.length} Active)
          </h4>
          <span style={{ fontSize: '11px', color: '#6B7280' }}>
            Only actively assigned farmers can view operational field details.
          </span>
        </div>
        {canManage && (
          <button
            onClick={() => setAssignModalOpen(true)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: '#2D6A4F',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            + Assign Farmer
          </button>
        )}
      </div>

      {error && (
        <div style={{ padding: '8px 12px', backgroundColor: '#FEE2E2', color: '#991B1B', borderRadius: '4px', fontSize: '12px', marginBottom: '10px' }}>
          {error}
        </div>
      )}

      {assignmentsCursor && !loading && (
        <div style={{ textAlign: 'center', marginTop: '12px' }}>
          <button onClick={loadMoreAssignments} disabled={pageLoading}>
            {pageLoading ? 'Loading…' : 'Load more assignment records'}
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: '12px', color: '#6B7280', padding: '8px 0' }}>Loading assignments...</div>
      ) : assignments.length === 0 ? (
        <div style={{ padding: '12px', backgroundColor: '#F9FAFB', borderRadius: '6px', fontSize: '12px', color: '#6B7280', textAlign: 'center' }}>
          No assignment records for this field.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {assignments.map((asgn) => (
            <div
              key={asgn.assignmentId}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                backgroundColor: '#F9FAFB',
                border: '1px solid #E5E7EB',
                borderRadius: '6px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong style={{ fontSize: '13px', color: '#111827' }}>
                    {asgn.farmerName || asgn.farmerUid}
                  </strong>
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: asgn.status === 'ACTIVE' ? '#D1FAE5' : '#F3F4F6',
                      color: asgn.status === 'ACTIVE' ? '#065F46' : '#4B5563',
                      fontWeight: 600,
                    }}
                  >
                    {asgn.status}
                  </span>
                  <span style={{ fontSize: '11px', color: '#6B7280' }}>
                    v{asgn.version}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#4B5563', marginTop: '4px' }}>
                  Permissions: {asgn.permissions.join(', ')}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => handleViewHistory(asgn.assignmentId)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    border: '1px solid #D1D5DB',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Audit History
                </button>
                {canManage && (
                  <button
                    onClick={() => setPaymentModalAssignment(asgn)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      border: '1px solid #BBF7D0',
                      backgroundColor: '#F0FDF4',
                      color: '#166534',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    💰 Pay
                  </button>
                )}
                {asgn.status !== 'ACTIVE' && (
                  <button
                    onClick={() => setReviewModalAssignment(asgn)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      border: '1px solid #FDE68A',
                      backgroundColor: '#FEF3C7',
                      color: '#92400E',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    ⭐ Review
                  </button>
                )}
                {canManage && asgn.status === 'ACTIVE' && (
                  <button
                    onClick={() => {
                      setReleasingAssignment(asgn);
                      setReleaseReason('');
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      border: '1px solid #FCA5A5',
                      backgroundColor: '#FEE2E2',
                      color: '#991B1B',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Release
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Release Confirmation Modal */}
      {releasingAssignment && (
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
            zIndex: 1100,
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              width: '420px',
              padding: '20px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h4 style={{ margin: '0 0 8px', fontSize: '16px', color: '#991B1B' }}>
              Release Farmer Assignment
            </h4>
            <p style={{ fontSize: '12px', color: '#4B5563', margin: '0 0 14px', lineHeight: 1.4 }}>
              Releasing <strong>{releasingAssignment.farmerName || releasingAssignment.farmerUid}</strong> will immediately revoke access to this field.
            </p>

            <form onSubmit={handleRelease}>
              <div style={{ marginBottom: '14px' }}>
                <label htmlFor="assignment-release-reason" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                  Reason for Release (Optional)
                </label>
                <textarea
                  id="assignment-release-reason"
                  value={releaseReason}
                  onChange={(e) => setReleaseReason(e.target.value)}
                  placeholder="e.g. Harvest season completed, shift transferred..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px solid #D1D5DB',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setReleasingAssignment(null)}
                  disabled={releaseLoading}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #D1D5DB',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={releaseLoading}
                  style={{
                    padding: '6px 14px',
                    border: 'none',
                    backgroundColor: '#DC2626',
                    color: '#FFFFFF',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: releaseLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {releaseLoading ? 'Releasing...' : 'Confirm Release'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Viewer Modal */}
      {selectedAssignmentHistory && (
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
            zIndex: 1100,
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              width: '520px',
              maxHeight: '80vh',
              overflowY: 'auto',
              padding: '20px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h4 style={{ margin: 0, fontSize: '16px', color: '#1B4332' }}>
                📜 Assignment Audit Trail
              </h4>
              <button
                onClick={() => setSelectedAssignmentHistory(null)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            {selectedAssignmentHistory.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#6B7280', padding: '12px 0' }}>No history records found.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedAssignmentHistory.map((hist) => (
                  <div
                    key={hist.historyId}
                    style={{
                      padding: '10px 12px',
                      backgroundColor: '#F9FAFB',
                      border: '1px solid #E5E7EB',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          color: hist.eventType === 'ASSIGNED' ? '#065F46' : '#991B1B',
                        }}
                      >
                        {hist.eventType}
                      </span>
                      <span style={{ color: '#6B7280', fontSize: '11px' }}>
                        {new Date(hist.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ color: '#374151', marginBottom: '2px' }}>
                      By UID: {hist.performedByUid} ({hist.performedByRole})
                    </div>
                    {hist.reason && (
                      <div style={{ color: '#6B7280', fontStyle: 'italic' }}>
                        "{hist.reason}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {historyCursor && (
              <div style={{ textAlign: 'center', marginTop: '12px' }}>
                <button onClick={() => loadMoreHistory(selectedAssignmentHistory[0]?.assignmentId || '')} disabled={pageLoading}>
                  {pageLoading ? 'Loading…' : 'Load more history'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Assign Modal */}
      <AssignFarmerModal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        farmId={farmId}
        fieldId={fieldId}
        fieldName={fieldName}
        onSuccess={() => loadAssignments()}
      />

      {/* Review Modal */}
      {reviewModalAssignment && (
        <AssignmentReviewModal
          isOpen={true}
          onClose={() => setReviewModalAssignment(null)}
          assignmentId={reviewModalAssignment.assignmentId}
          farmId={farmId}
          fieldId={fieldId}
          farmerUid={reviewModalAssignment.farmerUid}
          farmerName={reviewModalAssignment.farmerName}
          isOwner={canManage}
          currentUserUid={user?.uid || ''}
        />
      )}

      {/* Payment Modal */}
      {paymentModalAssignment && (
        <RecordPaymentModal
          isOpen={true}
          onClose={() => setPaymentModalAssignment(null)}
          farmId={farmId}
          defaultAssignmentId={paymentModalAssignment.assignmentId}
          defaultFarmerUid={paymentModalAssignment.farmerUid}
        />
      )}
    </div>
  );
};
