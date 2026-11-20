import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { assignmentService } from '../services/assignmentService';
import { paymentService } from '../services/paymentService';
import type { FieldAssignment } from '../types/assignment';
import type { Field } from '../types/field';
import type { PaymentRecord } from '../types/payment';
import { FieldMonitoringPanel } from '../components/monitoring/FieldMonitoringPanel';
import { AssignmentReviewModal } from '../components/review/AssignmentReviewModal';

export const FarmerWorkspacePage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'active' | 'history' | 'payments'>('active');
  const [assignments, setAssignments] = useState<FieldAssignment[]>([]);
  const [historyAssignments, setHistoryAssignments] = useState<FieldAssignment[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [reviewModalAssignment, setReviewModalAssignment] = useState<FieldAssignment | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCursor, setActiveCursor] = useState<string | null>(null);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(false);

  // Field details modal
  const [selectedFieldDetails, setSelectedFieldDetails] = useState<Field | null>(null);

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'active') {
        const resp = await assignmentService.fetchMyActiveAssignments();
        setAssignments(resp.data?.items || []);
        setActiveCursor(resp.data?.nextCursor || null);
      } else if (activeTab === 'history') {
        const resp = await assignmentService.fetchMyAssignmentHistory();
        setHistoryAssignments(resp.data?.items || []);
        setHistoryCursor(resp.data?.nextCursor || null);
      } else {
        const resp = await paymentService.listMyPayments();
        setPayments(resp.data || []);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load workspace data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  const loadMore = async () => {
    const cursor = activeTab === 'active' ? activeCursor : historyCursor;
    if (!cursor) return;
    setPageLoading(true);
    setError(null);
    try {
      const resp = activeTab === 'active'
        ? await assignmentService.fetchMyActiveAssignments(cursor)
        : await assignmentService.fetchMyAssignmentHistory(cursor);
      const items = resp.data?.items || [];
      if (activeTab === 'active') {
        setAssignments((previous) => [...previous, ...items.filter((next) => !previous.some((item) => item.assignmentId === next.assignmentId))]);
        setActiveCursor(resp.data?.nextCursor || null);
      } else {
        setHistoryAssignments((previous) => [...previous, ...items.filter((next) => !previous.some((item) => item.assignmentId === next.assignmentId))]);
        setHistoryCursor(resp.data?.nextCursor || null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load the next page');
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const handleInspectField = async (fieldId: string) => {
    setError(null);
    try {
      const resp = await assignmentService.fetchMyAssignedField(fieldId);
      setSelectedFieldDetails(resp.data || null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load field operational details';
      setError(msg);
    }
  };

  return (
    <div>
      {/* Header */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          padding: '24px',
          borderRadius: '8px',
          border: '1px solid #E5E7EB',
          marginBottom: '24px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: '0 0 6px', fontSize: '22px', color: '#1B4332' }}>
              🌾 Farmer Operational Workspace
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: '#6B7280' }}>
              Field-scoped access to fields you are actively assigned to. Crop analysis and soil telemetry are not available in this milestone.
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '11px', color: '#6B7280', display: 'block' }}>Farmer UID:</span>
            <code style={{ fontSize: '12px', color: '#1B4332', fontWeight: 600 }}>{user?.uid}</code>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '20px', borderBottom: '1px solid #E5E7EB', paddingBottom: '8px' }}>
          <button
            onClick={() => setActiveTab('active')}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              backgroundColor: activeTab === 'active' ? '#2D6A4F' : '#F3F4F6',
              color: activeTab === 'active' ? '#FFFFFF' : '#4B5563',
            }}
          >
            Active Field Assignments ({assignments.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              backgroundColor: activeTab === 'history' ? '#2D6A4F' : '#F3F4F6',
              color: activeTab === 'history' ? '#FFFFFF' : '#4B5563',
            }}
          >
            Assignment History
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              backgroundColor: activeTab === 'payments' ? '#2D6A4F' : '#F3F4F6',
              color: activeTab === 'payments' ? '#FFFFFF' : '#4B5563',
            }}
          >
            💰 Payments Received ({payments.length})
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', backgroundColor: '#FEE2E2', color: '#991B1B', borderRadius: '6px', fontSize: '14px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: '#6B7280', fontSize: '14px' }}>
          Loading your assigned fields...
        </div>
      ) : activeTab === 'active' ? (
        <div>
          {assignments.length === 0 ? (
            <div style={{ backgroundColor: '#FFFFFF', padding: '40px', borderRadius: '8px', border: '1px solid #E5E7EB', textAlign: 'center' }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>🌱</div>
              <h3 style={{ margin: '0 0 8px', fontSize: '18px', color: '#1B4332' }}>No Active Field Assignments</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#6B7280', maxWidth: '440px', marginInline: 'auto' }}>
                You do not currently have any active field assignments. Once a farm manager or owner assigns you to a field, it will appear here.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              {assignments.map((asgn) => (
                <div
                  key={asgn.assignmentId}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '8px',
                    border: '1px solid #E5E7EB',
                    padding: '20px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <span style={{ fontSize: '11px', color: '#2D6A4F', fontWeight: 600, textTransform: 'uppercase' }}>
                        Farm: {asgn.farmId}
                      </span>
                      <h4 style={{ margin: '4px 0 0', fontSize: '16px', color: '#111827' }}>
                        {asgn.fieldId}
                      </h4>
                    </div>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        backgroundColor: '#D1FAE5',
                        color: '#065F46',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}
                    >
                      ACTIVE
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', color: '#4B5563', marginBottom: '8px' }}>
                    <strong>Permissions:</strong> {asgn.permissions.join(', ')}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '16px' }}>
                    Assigned on {new Date(asgn.assignedAt).toLocaleDateString()} by manager
                  </div>

                  <button
                    onClick={() => handleInspectField(asgn.fieldId)}
                    style={{
                      width: '100%',
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
                    🔍 View Operational Details
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : activeTab === 'history' ? (
        /* History Tab */
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          {historyAssignments.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#6B7280', fontSize: '13px' }}>
              No past assignment records found.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  <th style={{ padding: '12px 16px', color: '#374151' }}>Field ID</th>
                  <th style={{ padding: '12px 16px', color: '#374151' }}>Farm ID</th>
                  <th style={{ padding: '12px 16px', color: '#374151' }}>Status</th>
                  <th style={{ padding: '12px 16px', color: '#374151' }}>Assigned Date</th>
                  <th style={{ padding: '12px 16px', color: '#374151' }}>Release Reason</th>
                  <th style={{ padding: '12px 16px', color: '#374151', textAlign: 'center' }}>Review</th>
                </tr>
              </thead>
              <tbody>
                {historyAssignments.map((h) => (
                  <tr key={h.assignmentId} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{h.fieldId}</td>
                    <td style={{ padding: '12px 16px', color: '#4B5563' }}>{h.farmId}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor: h.status === 'ACTIVE' ? '#D1FAE5' : '#FEE2E2',
                          color: h.status === 'ACTIVE' ? '#065F46' : '#991B1B',
                        }}
                      >
                        {h.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#6B7280' }}>
                      {new Date(h.assignedAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#6B7280', fontStyle: h.releaseReason ? 'italic' : 'normal' }}>
                      {h.releaseReason || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button
                        onClick={() => setReviewModalAssignment(h)}
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        /* Payments Tab */
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: '#1B4332' }}>
              💰 Recorded Compensation Entries
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6B7280' }}>
              Payments recorded by farm owners for your completed assignments and farm tasks (BDT).
            </p>
          </div>

          {payments.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#6B7280', fontSize: '13px' }}>
              No payments recorded for your profile yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                    <th style={{ padding: '12px 16px', color: '#374151' }}>Date</th>
                    <th style={{ padding: '12px 16px', color: '#374151' }}>Farm ID</th>
                    <th style={{ padding: '12px 16px', color: '#374151' }}>Scope</th>
                    <th style={{ padding: '12px 16px', color: '#374151' }}>Purpose</th>
                    <th style={{ padding: '12px 16px', color: '#374151', textAlign: 'right' }}>Amount</th>
                    <th style={{ padding: '12px 16px', color: '#374151' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.paymentId} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        {new Date(p.paymentDate).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#4B5563' }}>{p.farmId}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 600,
                            backgroundColor: p.scope === 'ASSIGNMENT' ? '#E0F2FE' : '#F3F4F6',
                            color: p.scope === 'ASSIGNMENT' ? '#0369A1' : '#4B5563',
                          }}
                        >
                          {p.scope}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div>{p.purpose}</div>
                        {p.notes && <div style={{ fontSize: '11px', color: '#6B7280', fontStyle: 'italic' }}>{p.notes}</div>}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#1B4332', whiteSpace: 'nowrap' }}>
                        {typeof p.amount === 'number' ? p.amount.toFixed(2) : p.amount} {p.currency}
                      </td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: p.status === 'RECORDED' ? '#D1FAE5' : '#FEE2E2',
                            color: p.status === 'RECORDED' ? '#065F46' : '#991B1B',
                          }}
                        >
                          {p.status}
                        </span>
                        {p.status === 'REVERSED' && (
                          <div style={{ fontSize: '10px', color: '#991B1B', marginTop: '2px' }}>
                            Reversed: {p.reversalReason}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Review Modal */}
      {reviewModalAssignment && (
        <AssignmentReviewModal
          isOpen={true}
          onClose={() => setReviewModalAssignment(null)}
          assignmentId={reviewModalAssignment.assignmentId}
          farmId={reviewModalAssignment.farmId}
          fieldId={reviewModalAssignment.fieldId}
          farmerUid={reviewModalAssignment.farmerUid}
          farmerName={reviewModalAssignment.farmerName}
          isOwner={false}
          currentUserUid={user?.uid || ''}
        />
      )}

      {(activeTab === 'active' ? activeCursor : historyCursor) && !loading && (
        <div style={{ textAlign: 'center', margin: '20px 0' }}>
          <button onClick={loadMore} disabled={pageLoading} style={{ padding: '8px 16px', cursor: pageLoading ? 'wait' : 'pointer' }}>
            {pageLoading ? 'Loading…' : 'Load more assignments'}
          </button>
        </div>
      )}

      {/* Field Inspection Modal */}
      {selectedFieldDetails && (
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
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              width: 'min(960px, 94vw)',
              maxWidth: '94vw',
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#2D6A4F', fontWeight: 600 }}>OPERATIONAL FIELD INSPECTION</span>
                <h3 style={{ margin: '2px 0 0', fontSize: '18px', color: '#1B4332' }}>
                  {selectedFieldDetails.name} ({selectedFieldDetails.localFieldId})
                </h3>
              </div>
              <button
                onClick={() => setSelectedFieldDetails(null)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6B7280' }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div style={{ padding: '10px', backgroundColor: '#F9FAFB', borderRadius: '6px' }}>
                <span style={{ fontSize: '11px', color: '#6B7280' }}>Land Area:</span>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                  {selectedFieldDetails.areaHectares} Hectares
                </div>
              </div>
              <div style={{ padding: '10px', backgroundColor: '#F9FAFB', borderRadius: '6px' }}>
                <span style={{ fontSize: '11px', color: '#6B7280' }}>Crop Type:</span>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                  {selectedFieldDetails.cropType || 'None specified'}
                </div>
              </div>
              <div style={{ padding: '10px', backgroundColor: '#F9FAFB', borderRadius: '6px' }}>
                <span style={{ fontSize: '11px', color: '#6B7280' }}>Soil Classification:</span>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                  {selectedFieldDetails.soilType || 'Unspecified'}
                </div>
              </div>
              <div style={{ padding: '10px', backgroundColor: '#F9FAFB', borderRadius: '6px' }}>
                <span style={{ fontSize: '11px', color: '#6B7280' }}>Irrigation Type:</span>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                  {selectedFieldDetails.irrigationType || 'Rainfed'}
                </div>
              </div>
            </div>

            {selectedFieldDetails.notes && (
              <div style={{ padding: '12px', backgroundColor: '#F0FDF4', borderRadius: '6px', fontSize: '12px', color: '#166534', marginBottom: '20px' }}>
                <strong>Agronomy Notes:</strong> {selectedFieldDetails.notes}
              </div>
            )}

            <FieldMonitoringPanel farmId={selectedFieldDetails.farmId} fieldId={selectedFieldDetails.fieldId} compact />

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedFieldDetails(null)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#2D6A4F',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
