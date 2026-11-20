import React, { useState } from 'react';
import { paymentService } from '../../services/paymentService';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  farmId: string;
  defaultAssignmentId?: string | null;
  defaultFarmerUid?: string | null;
  onPaymentRecorded?: () => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  farmId,
  defaultAssignmentId,
  defaultFarmerUid,
  onPaymentRecorded,
}) => {
  const [farmerUid, setFarmerUid] = useState(defaultFarmerUid || '');
  const [assignmentId, setAssignmentId] = useState(defaultAssignmentId || '');
  const [amount, setAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().substring(0, 10)
  );
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Amount must be a positive number greater than 0.');
      return;
    }
    if (!farmerUid.trim()) {
      setError('Recipient farmer UID is required.');
      return;
    }
    if (!purpose.trim()) {
      setError('Payment purpose is required.');
      return;
    }

    setLoading(true);
    try {
      await paymentService.recordPayment(farmId, {
        farmerUid: farmerUid.trim(),
        assignmentId: assignmentId.trim() || null,
        amount: parsedAmount,
        currency: 'BDT',
        paymentDate: new Date(paymentDate).toISOString(),
        purpose: purpose.trim(),
        notes: notes.trim() || null,
      });
      if (onPaymentRecorded) onPaymentRecorded();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record payment';
      setError(msg);
    } finally {
      setLoading(false);
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
          maxWidth: '520px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#1B4332' }}>
            💰 Record Manual Payment Entry
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6B7280' }}
          >
            ✕
          </button>
        </div>

        {/* Financial integrity disclaimer */}
        <div
          style={{
            padding: '12px',
            backgroundColor: '#FEF3C7',
            border: '1px solid #FCD34D',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '12px',
            color: '#92400E',
            lineHeight: 1.4,
          }}
        >
          <strong>⚠️ Manual Record Notice:</strong> AgroAI does not process monetary transfers or connect to financial institutions. This entry is a manual administrative ledger record for work completed and does not constitute verification of an automated electronic transfer.
        </div>

        {error && (
          <div style={{ padding: '10px', backgroundColor: '#FEE2E2', color: '#991B1B', borderRadius: '6px', fontSize: '13px', marginBottom: '14px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
              Recipient Farmer UID:
            </label>
            <input
              type="text"
              value={farmerUid}
              onChange={(e) => setFarmerUid(e.target.value)}
              placeholder="e.g. farmer-uid-123"
              required
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid #D1D5DB',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
              Linked Assignment ID (Optional for Farm-level compensation):
            </label>
            <input
              type="text"
              value={assignmentId}
              onChange={(e) => setAssignmentId(e.target.value)}
              placeholder="e.g. asgn_fld_plot-01::uid_abc (leave blank for general farm work)"
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid #D1D5DB',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                Payment Amount:
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 5000.00"
                required
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #D1D5DB',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                Currency:
              </label>
              <input
                type="text"
                value="BDT"
                readOnly
                disabled
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #E5E7EB',
                  backgroundColor: '#F3F4F6',
                  color: '#4B5563',
                  fontSize: '13px',
                  fontWeight: 600,
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
              Payment Date:
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid #D1D5DB',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
              Purpose of Payment:
            </label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Weekly field weeding and irrigation upkeep"
              maxLength={255}
              required
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid #D1D5DB',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
              Additional Notes (Optional):
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              rows={2}
              placeholder="Receipt / voucher reference or cash disbursement notes..."
              style={{
                width: '100%',
                padding: '8px 10px',
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
              onClick={onClose}
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
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '8px 16px',
                backgroundColor: '#2D6A4F',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
