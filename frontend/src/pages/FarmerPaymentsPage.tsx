import React, { useEffect, useState, useCallback } from 'react';
import { paymentService } from '../services/paymentService';
import type { PaymentRecord } from '../types/payment';
import { StatusBadge } from '../components/ui/StatusBadge';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';

export const FarmerPaymentsPage: React.FC = () => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await paymentService.listMyPayments(100);
      setPayments(res.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load compensation records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const activePayments = payments.filter((p) => p.status === 'RECORDED');
  const totalEarned = activePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-tertiary-fixed-dim" />

        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Earnings & Ledger</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
          My Compensation & Wage Receipts
        </h1>
        <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
          Audited record of all field labor payments, daily wages, and seasonal disbursement ledger entries.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-error-container text-error text-xs font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Wages Received"
          value={`${totalEarned.toLocaleString()} BDT`}
          subtitle="Audited Net Earnings"
          icon="payments"
        />
        <StatCard
          title="Confirmed Disbursements"
          value={activePayments.length}
          subtitle="Receipts on Ledger"
          icon="receipt_long"
        />
        <StatCard
          title="Recent Payout Date"
          value={payments.length > 0 ? new Date(payments[0].paymentDate).toLocaleDateString() : 'N/A'}
          subtitle="Latest Transaction"
          icon="event"
        />
      </div>

      {/* Payments Table */}
      {loading ? (
        <LoadingSkeleton count={4} />
      ) : payments.length === 0 ? (
        <EmptyState
          icon="payments"
          title="No Payment Records Found"
          description="You do not have any recorded labor disbursements on file yet. Once farm owners record your compensation, it will be catalogued here."
        />
      ) : (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container-low border-b border-outline-variant/30 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Disbursement Date</th>
                  <th className="py-3 px-4">Payer / Farm Holding</th>
                  <th className="py-3 px-4">Service Purpose</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {payments.map((p) => (
                  <tr key={p.paymentId} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-on-surface">
                        {new Date(p.paymentDate).toLocaleDateString()}
                      </div>
                      <div className="text-[10px] text-on-surface-variant font-mono">
                        {p.paymentId.substring(0, 10)}...
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-on-surface">{p.payerName || 'Farm Holding'}</div>
                      <div className="text-[10px] text-on-surface-variant font-mono">{p.farmId.substring(0, 12)}...</div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-on-surface">
                      {p.purpose}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-primary text-sm">
                        {Number(p.amount).toLocaleString()} {p.currency}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="py-3.5 px-4 text-on-surface-variant italic">
                      {p.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
