import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { paymentService } from '../services/paymentService';
import type { PaymentRecord } from '../types/payment';
import { StatusBadge } from '../components/ui/StatusBadge';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';
import { RecordPaymentModal } from '../components/payment/RecordPaymentModal';

export const PaymentDashboardPage: React.FC = () => {
  const { activeFarm } = useFarm();
  const navigate = useNavigate();

  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recordModalOpen, setRecordModalOpen] = useState(false);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Reversal
  const [reversingPayment, setReversingPayment] = useState<PaymentRecord | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [reversalLoading, setReversalLoading] = useState(false);

  const loadPayments = useCallback(async () => {
    if (!activeFarm) return;
    setLoading(true);
    setError(null);
    try {
      const res = await paymentService.listFarmPayments(activeFarm.farmId);
      setPayments(res.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load payment ledger');
    } finally {
      setLoading(false);
    }
  }, [activeFarm]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const handleReverse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversingPayment || !reversalReason.trim()) return;

    setReversalLoading(true);
    try {
      await paymentService.reversePayment(reversingPayment.paymentId, {
        reversalReason: reversalReason.trim(),
      });
      setReversingPayment(null);
      setReversalReason('');
      await loadPayments();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to reverse payment record');
    } finally {
      setReversalLoading(false);
    }
  };

  if (!activeFarm) {
    return (
      <EmptyState
        icon="warehouse"
        title="No Farm Selected"
        description="Select an active farm to inspect the labor payment records and ledger."
        actionText="My Farms"
        onAction={() => navigate('/dashboard/farms')}
      />
    );
  }

  const validPayments = payments.filter((p) => p.status === 'RECORDED');
  const totalDisbursed = validPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const reversedCount = payments.filter((p) => p.status === 'REVERSED').length;

  const filtered = payments.filter((p) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (p.farmerName || '').toLowerCase().includes(term) ||
      p.farmerUid.toLowerCase().includes(term) ||
      p.purpose.toLowerCase().includes(term);
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Finance & Ledger
            </span>
            <span className="text-xs text-on-surface-variant">• {activeFarm.name}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
            Labor Compensation Ledger
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Administrative record of disbursements, field wages, and contractual compensation.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setRecordModalOpen(true)}
          className="h-11 px-5 rounded-xl bg-primary hover:bg-secondary text-on-primary font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>Record Disbursement</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-error-container text-error text-xs font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Disbursed"
          value={`${totalDisbursed.toLocaleString()} BDT`}
          subtitle="+ Active Ledger"
          icon="payments"
        />
        <StatCard
          title="Active Payment Records"
          value={validPayments.length}
          subtitle="Audited Entries"
          icon="receipt_long"
        />
        <StatCard
          title="Reversed Transactions"
          value={reversedCount}
          subtitle="Administrative Adjustments"
          icon="undo"
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/30">
        <div className="relative w-full sm:w-80 flex items-center">
          <span className="absolute left-3 text-on-surface-variant pointer-events-none">
            <span className="material-symbols-outlined text-[18px]">search</span>
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search farmer name, UID, purpose..."
            className="w-full h-10 pl-9 pr-3 rounded-lg bg-surface-container-low text-on-surface text-xs placeholder:text-outline outline-none focus:ring-2 focus:ring-primary border border-transparent shadow-inner"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-on-surface-variant font-semibold">Ledger Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 rounded-lg bg-surface-container-low text-on-surface text-xs outline-none focus:ring-2 focus:ring-primary border border-transparent cursor-pointer font-medium"
          >
            <option value="ALL">All Entries</option>
            <option value="RECORDED">RECORDED</option>
            <option value="REVERSED">REVERSED</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSkeleton count={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="payments"
          title={payments.length === 0 ? 'No Payment Records' : 'No Matching Records'}
          description={
            payments.length === 0
              ? `No disbursements have been recorded under "${activeFarm.name}" yet.`
              : 'No payment entries match your search criteria.'
          }
          actionText={payments.length === 0 ? 'Record Disbursement' : undefined}
          onAction={payments.length === 0 ? () => setRecordModalOpen(true) : undefined}
        />
      ) : (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container-low border-b border-outline-variant/30 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Disbursement Date</th>
                  <th className="py-3 px-4">Specialist / Recipient</th>
                  <th className="py-3 px-4">Purpose & Scope</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {filtered.map((p) => (
                  <tr key={p.paymentId} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-on-surface">
                        {new Date(p.paymentDate).toLocaleDateString()}
                      </div>
                      <div className="text-[10px] text-on-surface-variant font-mono">
                        ID: {p.paymentId.substring(0, 10)}...
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-on-surface">{p.farmerName || 'Specialist'}</div>
                      <div className="text-[10px] text-on-surface-variant font-mono">UID: {p.farmerUid}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-on-surface">{p.purpose}</div>
                      <div className="text-[11px] text-on-surface-variant">
                        Scope: {p.scope} {p.notes ? `• ${p.notes}` : ''}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-primary text-sm">
                        {Number(p.amount).toLocaleString()} {p.currency}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {p.status === 'RECORDED' ? (
                        <button
                          type="button"
                          onClick={() => setReversingPayment(p)}
                          className="h-7 px-2.5 rounded-lg border border-error/40 text-error hover:bg-error-container/30 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <span className="material-symbols-outlined text-[13px]">undo</span>
                          <span>Reverse</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-on-surface-variant italic">
                          {p.reversalReason || 'Reversed'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reverse Modal */}
      {reversingPayment && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl p-6 max-w-md w-full shadow-2xl border border-outline-variant/30 space-y-4">
            <h3 className="text-base font-bold text-on-surface">Reverse Disbursement Entry</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Are you sure you want to reverse payment of <strong className="text-primary">{reversingPayment.amount} {reversingPayment.currency}</strong> to <strong className="text-on-surface">{reversingPayment.farmerName || reversingPayment.farmerUid}</strong>?
            </p>

            <form onSubmit={handleReverse} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface" htmlFor="rev-reason">
                  Reversal Audit Reason *
                </label>
                <input
                  id="rev-reason"
                  type="text"
                  required
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="e.g. Inadvertent duplicate entry or incorrect field attribution"
                  className="w-full h-10 px-3 rounded-lg bg-surface-container-low text-on-surface text-xs outline-none focus:ring-2 focus:ring-primary border border-transparent shadow-inner"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReversingPayment(null)}
                  className="h-9 px-4 rounded-xl border border-outline-variant/40 hover:bg-surface-container text-on-surface text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reversalLoading || !reversalReason.trim()}
                  className="h-9 px-4 rounded-xl bg-error hover:bg-error/90 text-white font-bold text-xs shadow-sm cursor-pointer disabled:opacity-60"
                >
                  {reversalLoading ? 'Reversing...' : 'Confirm Reversal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {recordModalOpen && (
        <RecordPaymentModal
          isOpen={recordModalOpen}
          farmId={activeFarm.farmId}
          onClose={() => setRecordModalOpen(false)}
          onPaymentRecorded={() => {
            setRecordModalOpen(false);
            loadPayments();
          }}
        />
      )}
    </div>
  );
};
