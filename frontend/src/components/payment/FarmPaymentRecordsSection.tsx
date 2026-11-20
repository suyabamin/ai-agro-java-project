import React, { useState, useEffect, useCallback } from 'react';
import { paymentService } from '../../services/paymentService';
import type { PaymentRecord } from '../../types/payment';
import { RecordPaymentModal } from './RecordPaymentModal';

interface FarmPaymentRecordsSectionProps {
  farmId: string;
  isOwner: boolean;
}

export const FarmPaymentRecordsSection: React.FC<FarmPaymentRecordsSectionProps> = ({
  farmId,
  isOwner,
}) => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recordModalOpen, setRecordModalOpen] = useState(false);

  // Reversal state
  const [reversingPayment, setReversingPayment] = useState<PaymentRecord | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [reversalLoading, setReversalLoading] = useState(false);
  const [reversalError, setReversalError] = useState<string | null>(null);

  const loadPayments = useCallback(async () => {
    if (!farmId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await paymentService.listFarmPayments(farmId);
      setPayments(res.data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load payments';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const handleReverse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversingPayment || !reversalReason.trim()) return;

    setReversalLoading(true);
    setReversalError(null);
    try {
      await paymentService.reversePayment(reversingPayment.paymentId, {
        reversalReason: reversalReason.trim(),
      });
      setReversingPayment(null);
      setReversalReason('');
      loadPayments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reverse payment';
      setReversalError(msg);
    } finally {
      setReversalLoading(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '8px',
        border: '1px solid #E5E7EB',
        padding: '24px',
        marginTop: '24px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#1B4332' }}>
            💰 Farm Compensation & Payment Ledger
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6B7280' }}>
            Manual compensation records for farm tasks and field tenures (BDT).
          </p>
        </div>
        {isOwner && (
          <button
            onClick={() => setRecordModalOpen(true)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#2D6A4F',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            + Record Manual Payment
          </button>
        )}
      </div>

      <div
        style={{
          padding: '10px 14px',
          backgroundColor: '#F9FAFB',
          border: '1px solid #E5E7EB',
          borderRadius: '6px',
          fontSize: '12px',
          color: '#4B5563',
          marginBottom: '16px',
        }}
      >
        ℹ️ <strong>Audit Policy:</strong> Manual payment records cannot be deleted. Any adjustments require an audit-preserving reversal with a recorded rationale. Manual entries do not execute or represent bank transfers.
      </div>

      {error && (
        <div style={{ padding: '10px', backgroundColor: '#FEE2E2', color: '#991B1B', borderRadius: '6px', fontSize: '13px', marginBottom: '14px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '32px', color: '#6B7280', fontSize: '14px' }}>
          Loading payment entries...
        </div>
      ) : payments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px', color: '#6B7280', fontSize: '13px' }}>
          No payment records logged for this farm yet.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                <th style={{ padding: '10px 12px', color: '#374151' }}>Date</th>
                <th style={{ padding: '10px 12px', color: '#374151' }}>Farmer (Receiver)</th>
                <th style={{ padding: '10px 12px', color: '#374151' }}>Scope</th>
                <th style={{ padding: '10px 12px', color: '#374151' }}>Purpose</th>
                <th style={{ padding: '10px 12px', color: '#374151', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '10px 12px', color: '#374151' }}>Status</th>
                {isOwner && <th style={{ padding: '10px 12px', color: '#374151', textAlign: 'center' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.paymentId} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    {new Date(p.paymentDate).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 600, color: '#111827' }}>{p.farmerName || p.farmerUid}</div>
                    <div style={{ fontSize: '11px', color: '#6B7280' }}>UID: {p.farmerUid}</div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
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
                    {p.assignmentId && (
                      <div style={{ fontSize: '10px', color: '#6B7280', marginTop: '2px' }}>
                        {p.assignmentId}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div>{p.purpose}</div>
                    {p.notes && <div style={{ fontSize: '11px', color: '#6B7280', fontStyle: 'italic' }}>{p.notes}</div>}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#1B4332', whiteSpace: 'nowrap' }}>
                    {typeof p.amount === 'number' ? p.amount.toFixed(2) : p.amount} {p.currency}
                  </td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
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
                      <div style={{ fontSize: '10px', color: '#991B1B', marginTop: '2px' }} title={p.reversalReason || ''}>
                        Reversed: {p.reversalReason}
                      </div>
                    )}
                  </td>
                  {isOwner && (
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      {p.status === 'RECORDED' && (
                        <button
                          onClick={() => {
                            setReversingPayment(p);
                            setReversalReason('');
                            setReversalError(null);
                          }}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#FFFFFF',
                            border: '1px solid #FCA5A5',
                            color: '#991B1B',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Reverse
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={recordModalOpen}
        onClose={() => setRecordModalOpen(false)}
        farmId={farmId}
        onPaymentRecorded={loadPayments}
      />

      {/* Reverse Payment Modal */}
      {reversingPayment && (
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
              maxWidth: '460px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
          >
            <h4 style={{ margin: '0 0 12px', fontSize: '16px', color: '#991B1B' }}>
              Confirm Payment Reversal
            </h4>
            <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#4B5563' }}>
              Reversing payment record <code>{reversingPayment.paymentId}</code> ({reversingPayment.amount} BDT).
              This action preserves immutable audit history and marks the record as REVERSED.
            </p>

            {reversalError && (
              <div style={{ padding: '8px 10px', backgroundColor: '#FEE2E2', color: '#991B1B', borderRadius: '4px', fontSize: '12px', marginBottom: '12px' }}>
                {reversalError}
              </div>
            )}

            <form onSubmit={handleReverse}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                  Reason for Reversal (Required):
                </label>
                <textarea
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  maxLength={500}
                  rows={3}
                  required
                  placeholder="e.g. Inadvertent duplicate entry or erroneous amount..."
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid #D1D5DB',
                    fontSize: '12px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setReversingPayment(null)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #D1D5DB',
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reversalLoading}
                  style={{
                    padding: '6px 14px',
                    backgroundColor: '#DC2626',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: reversalLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {reversalLoading ? 'Reversing...' : 'Confirm Reversal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
