import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { paymentService } from '../services/paymentService';
import type { PaymentRecord } from '../types/payment';
import { StatusBadge } from '../components/ui/StatusBadge';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';

export const ReversePaymentPage: React.FC = () => {
  const { paymentId } = useParams<{ paymentId: string }>();
  const navigate = useNavigate();

  const [payment, setPayment] = useState<PaymentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [reversing, setReversing] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!paymentId) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const res = await paymentService.getPayment(paymentId);
      setPayment(res.data || null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load payment record');
    } finally { setLoading(false); }
  }, [paymentId]);

  useEffect(() => { load(); }, [load]);

  const handleReverse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentId || !reason.trim()) return;
    setReversing(true); setError(null);
    try {
      await paymentService.reversePayment(paymentId, { reversalReason: reason.trim() });
      navigate(`/dashboard/payments/${encodeURIComponent(paymentId)}`, { replace: true });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to reverse payment');
      setReversing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[700px] mx-auto">
      <div className="flex items-center gap-2">
        <Link
          to={`/dashboard/payments/${paymentId}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Payment Details
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-error/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-error text-[22px]">undo</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-on-surface">Reverse Payment</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">This action is irreversible and creates an audit trail.</p>
        </div>
      </div>

      {loading && <LoadingSkeleton type="dashboard" />}

      {!loading && error && !reversing && (
        <div className="p-6 rounded-2xl bg-error/10 border border-error/30">
          <p className="text-sm text-error">{error}</p>
          <button onClick={load} className="mt-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold cursor-pointer">Retry</button>
        </div>
      )}

      {!loading && payment && payment.status === 'REVERSED' && (
        <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200">
          <p className="text-sm font-semibold text-amber-800">This payment has already been reversed.</p>
          <p className="text-xs text-amber-700 mt-1">Reason: {payment.reversalReason || '—'}</p>
          <Link to={`/dashboard/payments/${paymentId}`} className="mt-3 inline-block px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold">View Payment</Link>
        </div>
      )}

      {!loading && payment && payment.status === 'RECORDED' && (
        <>
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-6 space-y-3">
            <h2 className="text-sm font-bold text-on-surface">Payment to Be Reversed</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-on-surface-variant">Amount</p>
                <p className="text-sm font-bold text-on-surface">{payment.amount} {payment.currency}</p>
              </div>
              <div>
                <p className="text-xs text-on-surface-variant">Status</p>
                <StatusBadge status={payment.status} />
              </div>
              <div>
                <p className="text-xs text-on-surface-variant">Farmer</p>
                <p className="text-sm text-on-surface">{payment.farmerName || payment.farmerUid}</p>
              </div>
              <div>
                <p className="text-xs text-on-surface-variant">Payment Date</p>
                <p className="text-sm text-on-surface">{new Date(payment.paymentDate).toLocaleDateString()}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-on-surface-variant">Purpose</p>
                <p className="text-sm text-on-surface">{payment.purpose}</p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-error/10 border border-error/20">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-error text-[18px] mt-0.5">warning</span>
              <div>
                <p className="text-xs font-semibold text-error">Audit-Preserving Reversal</p>
                <p className="text-xs text-error/80 mt-0.5 leading-relaxed">
                  Reversing a payment does not delete the record. The original payment entry remains in the audit log.
                  A reversal entry is created with your reason. This action cannot be undone.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleReverse} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-6 space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-on-surface" htmlFor="rev-reason">
                Reversal Reason <span className="text-error">*</span>
              </label>
              <textarea
                id="rev-reason"
                required
                rows={4}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Explain why this payment is being reversed…"
                className="w-full px-3 py-2 rounded-lg bg-surface-container text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary border border-transparent resize-none"
              />
              <p className="text-xs text-on-surface-variant">This reason will be permanently stored in the audit log.</p>
            </div>

            {error && reversing && (
              <div className="p-3 rounded-lg bg-error/10 border border-error/30">
                <p className="text-xs text-error">{error}</p>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Link
                to={`/dashboard/payments/${paymentId}`}
                className="h-10 px-5 inline-flex items-center rounded-xl border border-outline-variant/40 hover:bg-surface-container text-on-surface text-sm font-semibold"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={reversing || !reason.trim()}
                className="h-10 px-6 rounded-xl bg-error hover:bg-error/90 text-white font-bold text-sm shadow-sm cursor-pointer disabled:opacity-60 flex items-center gap-2"
              >
                {reversing ? (
                  <><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span> Reversing…</>
                ) : (
                  <><span className="material-symbols-outlined text-[16px]">undo</span> Confirm Reversal</>
                )}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
};
