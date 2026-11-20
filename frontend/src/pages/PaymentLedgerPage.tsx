import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { paymentService } from '../services/paymentService';
import type { PaymentRecord } from '../types/payment';
import { StatusBadge } from '../components/ui/StatusBadge';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';

export const PaymentLedgerPage: React.FC = () => {
  const { activeFarm } = useFarm();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const load = useCallback(async () => {
    if (!activeFarm) return;
    setLoading(true); setError(null);
    try {
      const res = await paymentService.listFarmPayments(activeFarm.farmId, undefined, 200);
      setPayments(res.data || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load payment ledger');
    } finally { setLoading(false); }
  }, [activeFarm]);

  useEffect(() => { load(); }, [load]);

  const filtered = payments.filter(p => {
    const matchSearch = !search || [p.paymentId, p.farmerName, p.farmerUid, p.purpose].some(v => v && String(v).toLowerCase().includes(search.toLowerCase()));
    const matchStatus = !statusFilter || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalRecorded = payments.filter(p => p.status === 'RECORDED').reduce((s, p) => s + Number(p.amount), 0);
  const totalReversed = payments.filter(p => p.status === 'REVERSED').reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link to="/dashboard/payments" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Payment Dashboard
        </Link>
        <Link
          to="/dashboard/payments/new"
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90"
        >
          <span className="material-symbols-outlined text-[16px]">add_card</span> Record Payment
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-bold text-on-surface">Payment Ledger</h1>
        <p className="text-xs text-on-surface-variant mt-1">Complete record of all farm payment transactions.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Payments', value: payments.length.toString(), icon: 'receipt_long', color: 'text-primary' },
          { label: 'Total Recorded (BDT)', value: totalRecorded.toLocaleString(), icon: 'payments', color: 'text-green-600' },
          { label: 'Total Reversed (BDT)', value: totalReversed.toLocaleString(), icon: 'undo', color: 'text-error' },
        ].map(c => (
          <div key={c.label} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-5">
            <div className="flex items-center gap-2 mb-1">
              <span className={`material-symbols-outlined text-[20px] ${c.color}`}>{c.icon}</span>
              <span className="text-xs text-on-surface-variant font-semibold">{c.label}</span>
            </div>
            <p className="text-xl font-bold text-on-surface">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by farmer, ID, or purpose…"
          className="h-9 px-3 rounded-lg bg-surface-container-low text-on-surface text-xs outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30 flex-1 min-w-[200px]"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-9 px-3 rounded-lg bg-surface-container-low text-on-surface text-xs outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
        >
          <option value="">All Statuses</option>
          <option value="RECORDED">Recorded</option>
          <option value="REVERSED">Reversed</option>
        </select>
      </div>

      {loading && <LoadingSkeleton type="dashboard" />}

      {!loading && error && (
        <div className="p-6 rounded-2xl bg-error/10 border border-error/30 text-center">
          <p className="text-sm text-error">{error}</p>
          <button onClick={load} className="mt-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold cursor-pointer">Retry</button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="p-10 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-center">
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant block mb-2">receipt_long</span>
          <p className="text-sm font-semibold text-on-surface">{search || statusFilter ? 'No matching payments' : 'No payment records yet'}</p>
          <Link to="/dashboard/payments/new" className="mt-3 inline-block px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold">Record First Payment</Link>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-container border-b border-outline-variant/30">
                <tr>
                  {['ID', 'Farmer', 'Amount', 'Purpose', 'Date', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-on-surface-variant uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {filtered.map(p => (
                  <tr key={p.paymentId} className="hover:bg-surface-container/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-on-surface-variant">{p.paymentId.slice(0, 10)}…</td>
                    <td className="px-4 py-3 text-xs text-on-surface">{p.farmerName || p.farmerUid.slice(0, 8) + '…'}</td>
                    <td className="px-4 py-3 text-xs font-bold text-on-surface">{p.amount} {p.currency}</td>
                    <td className="px-4 py-3 text-xs text-on-surface max-w-[160px] truncate">{p.purpose}</td>
                    <td className="px-4 py-3 text-xs text-on-surface-variant">{new Date(p.paymentDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/dashboard/payments/${encodeURIComponent(p.paymentId)}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20"
                      >
                        <span className="material-symbols-outlined text-[14px]">open_in_new</span> View
                      </Link>
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
