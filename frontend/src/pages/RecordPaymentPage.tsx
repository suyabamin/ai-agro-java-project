import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { paymentService } from '../services/paymentService';
import { assignmentService } from '../services/assignmentService';
import type { FieldAssignment } from '../types/assignment';

export const RecordPaymentPage: React.FC = () => {
  const { activeFarm } = useFarm();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preAssignmentId = searchParams.get('assignmentId') || '';
  const preFarmerUid = searchParams.get('farmerUid') || '';

  const [assignments, setAssignments] = useState<FieldAssignment[]>([]);
  const [assignmentId, setAssignmentId] = useState(preAssignmentId);
  const [farmerUid, setFarmerUid] = useState(preFarmerUid);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('BDT');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAssignments = useCallback(async () => {
    if (!activeFarm) return;
    setLoading(true);
    try {
      const res = await assignmentService.fetchFarmAssignments(activeFarm.farmId);
      const items = res.data?.items || [];
      setAssignments(items.filter(a => a.status === 'ACTIVE'));
      if (!farmerUid && preAssignmentId) {
        const match = items.find(a => a.assignmentId === preAssignmentId);
        if (match) setFarmerUid(match.farmerUid);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load assignments');
    } finally { setLoading(false); }
  }, [activeFarm, preAssignmentId, farmerUid]);

  useEffect(() => { loadAssignments(); }, [loadAssignments]);

  const handleAssignmentChange = (id: string) => {
    setAssignmentId(id);
    if (id) {
      const match = assignments.find(a => a.assignmentId === id);
      if (match) setFarmerUid(match.farmerUid);
    } else {
      setFarmerUid('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFarm || !farmerUid || !amount || !purpose) return;
    setSubmitting(true); setError(null);
    try {
      const res = await paymentService.recordPayment(activeFarm.farmId, {
        assignmentId: assignmentId || null,
        farmerUid,
        amount: parseFloat(amount),
        currency,
        paymentDate,
        purpose: purpose.trim(),
        notes: notes.trim() || null,
      });
      const id = res.data?.paymentId;
      if (id) navigate(`/dashboard/payments/${encodeURIComponent(id)}`);
      else navigate('/dashboard/payments');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to record payment');
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[700px] mx-auto">
      <div className="flex items-center gap-2">
        <Link to="/dashboard/payments" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Payment Dashboard
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-[22px]">add_card</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-on-surface">Record Payment</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">Manually record a BDT payment to a farmer.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-6 space-y-5">
        {/* Assignment (optional) */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-on-surface" htmlFor="assign-sel">Assignment (optional)</label>
          <select
            id="assign-sel"
            value={assignmentId}
            onChange={e => handleAssignmentChange(e.target.value)}
            disabled={loading}
            className="w-full h-10 px-3 rounded-lg bg-surface-container text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary border border-transparent"
          >
            <option value="">— No assignment (farm-level payment) —</option>
            {assignments.map(a => (
              <option key={a.assignmentId} value={a.assignmentId}>
                {a.assignmentId.slice(0, 8)}… — {a.farmerName || a.farmerUid} (Field: {a.fieldId.slice(0, 8)}…)
              </option>
            ))}
          </select>
        </div>

        {/* Farmer UID (auto-filled or manual) */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-on-surface" htmlFor="farmer-uid">Farmer UID <span className="text-error">*</span></label>
          <input
            id="farmer-uid"
            type="text"
            required
            value={farmerUid}
            onChange={e => setFarmerUid(e.target.value)}
            placeholder="Farmer's Firebase UID"
            className="w-full h-10 px-3 rounded-lg bg-surface-container text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary border border-transparent font-mono"
          />
          <p className="text-xs text-on-surface-variant">Auto-filled when an assignment is selected above.</p>
        </div>

        {/* Amount + Currency */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-on-surface" htmlFor="amount">Amount <span className="text-error">*</span></label>
            <input
              id="amount"
              type="number"
              required
              min="0.01"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full h-10 px-3 rounded-lg bg-surface-container text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary border border-transparent"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-on-surface" htmlFor="currency">Currency <span className="text-error">*</span></label>
            <select
              id="currency"
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-surface-container text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary border border-transparent"
            >
              <option value="BDT">BDT (Bangladeshi Taka)</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
        </div>

        {/* Payment Date */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-on-surface" htmlFor="pay-date">Payment Date <span className="text-error">*</span></label>
          <input
            id="pay-date"
            type="date"
            required
            value={paymentDate}
            onChange={e => setPaymentDate(e.target.value)}
            className="w-full h-10 px-3 rounded-lg bg-surface-container text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary border border-transparent"
          />
        </div>

        {/* Purpose */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-on-surface" htmlFor="purpose">Purpose <span className="text-error">*</span></label>
          <input
            id="purpose"
            type="text"
            required
            value={purpose}
            onChange={e => setPurpose(e.target.value)}
            placeholder="e.g. Monthly salary payment"
            className="w-full h-10 px-3 rounded-lg bg-surface-container text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary border border-transparent"
          />
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-on-surface" htmlFor="notes">Notes (optional)</label>
          <textarea
            id="notes"
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Additional details…"
            className="w-full px-3 py-2 rounded-lg bg-surface-container text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary border border-transparent resize-none"
          />
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-error/10 border border-error/30">
            <p className="text-xs text-error">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Link to="/dashboard/payments" className="h-10 px-5 inline-flex items-center rounded-xl border border-outline-variant/40 hover:bg-surface-container text-on-surface text-sm font-semibold">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || !farmerUid || !amount || !purpose || !activeFarm}
            className="h-10 px-6 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-bold text-sm shadow-sm cursor-pointer disabled:opacity-60 flex items-center gap-2"
          >
            {submitting ? (
              <><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span> Recording…</>
            ) : (
              <><span className="material-symbols-outlined text-[16px]">add_card</span> Record Payment</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
