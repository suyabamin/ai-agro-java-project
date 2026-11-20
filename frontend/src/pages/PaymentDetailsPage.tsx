import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { paymentService } from '../services/paymentService';
import type { PaymentRecord } from '../types/payment';
import { StatusBadge } from '../components/ui/StatusBadge';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-outline-variant/15 last:border-0">
      <span className="text-xs font-semibold text-on-surface-variant w-44 shrink-0">{label}</span>
      <span className="text-xs text-on-surface text-right break-all">{value}</span>
    </div>
  );
}

export const PaymentDetailsPage: React.FC = () => {
  const { paymentId } = useParams<{ paymentId: string }>();
  const navigate = useNavigate();

  const [payment, setPayment] = useState<PaymentRecord | null>(null);
  const [loading, setLoading] = useState(true);
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

  return (
    <div className="space-y-6 max-w-[800px] mx-auto">
      <div className="flex items-center gap-2">
        <Link to="/dashboard/payments" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Payment Dashboard
        </Link>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-[22px]">payments</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-on-surface">Payment Record</h1>
            <p className="text-xs text-on-surface-variant font-mono mt-0.5">{paymentId}</p>
          </div>
        </div>
        {payment && <StatusBadge status={payment.status} />}
      </div>

      {loading && <LoadingSkeleton type="dashboard" />}

      {!loading && error && (
        <div className="p-6 rounded-2xl bg-error/10 border border-error/30">
          <p className="text-sm text-error">{error}</p>
          <button onClick={load} className="mt-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold cursor-pointer">Retry</button>
        </div>
      )}

      {!loading && !error && payment && (
        <>
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-6 space-y-1">
            <h2 className="text-sm font-bold text-on-surface mb-3">Transaction Details</h2>
            <DetailRow label="Payment ID" value={payment.paymentId} />
            <DetailRow label="Status" value={payment.status} />
            <DetailRow label="Amount" value={`${payment.amount} ${payment.currency}`} />
            <DetailRow label="Purpose" value={payment.purpose} />
            <DetailRow label="Farmer" value={payment.farmerName || payment.farmerUid} />
            <DetailRow label="Payer" value={payment.payerName || payment.payerUid} />
            <DetailRow label="Scope" value={payment.scope} />
            {payment.assignmentId && <DetailRow label="Assignment ID" value={payment.assignmentId} />}
            <DetailRow label="Payment Date" value={new Date(payment.paymentDate).toLocaleDateString()} />
            <DetailRow label="Recorded At" value={new Date(payment.createdAt).toLocaleString()} />
            {payment.notes && <DetailRow label="Notes" value={payment.notes} />}
          </div>

          {payment.status === 'REVERSED' && (
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-6 space-y-1">
              <h2 className="text-sm font-bold text-error mb-3">Reversal Details</h2>
              <DetailRow label="Reversed At" value={payment.reversedAt ? new Date(payment.reversedAt).toLocaleString() : '—'} />
              <DetailRow label="Reversed By" value={payment.reversedBy || '—'} />
              <DetailRow label="Reversal Reason" value={payment.reversalReason || '—'} />
            </div>
          )}

          {payment.status === 'RECORDED' && (
            <div className="flex justify-end">
              <button
                onClick={() => navigate(`/dashboard/payments/${encodeURIComponent(payment.paymentId)}/reverse`)}
                className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-error/10 hover:bg-error/20 text-error font-semibold text-sm cursor-pointer border border-error/20"
              >
                <span className="material-symbols-outlined text-[18px]">undo</span>
                Reverse Payment
              </button>
            </div>
          )}
        </>
      )}

      {!loading && !error && !payment && (
        <div className="p-10 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-center">
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant block mb-2">payments</span>
          <p className="text-sm font-semibold text-on-surface">Payment Not Found</p>
        </div>
      )}
    </div>
  );
};
