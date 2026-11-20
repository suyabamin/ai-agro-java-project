import React, { useEffect, useState, useCallback } from 'react';
import { assignmentService } from '../services/assignmentService';
import type { FieldAssignment } from '../types/assignment';
import { StatusBadge } from '../components/ui/StatusBadge';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';

export const FarmerAssignmentsPage: React.FC = () => {
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const [assignments, setAssignments] = useState<FieldAssignment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'active') {
        const resp = await assignmentService.fetchMyActiveAssignments();
        setAssignments(resp.data?.items || []);
        setCursor(resp.data?.nextCursor || null);
      } else {
        const resp = await assignmentService.fetchMyAssignmentHistory();
        setAssignments(resp.data?.items || []);
        setCursor(resp.data?.nextCursor || null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const loadMore = async () => {
    if (!cursor) return;
    setPageLoading(true);
    try {
      const resp = tab === 'active'
        ? await assignmentService.fetchMyActiveAssignments(cursor)
        : await assignmentService.fetchMyAssignmentHistory(cursor);
      const items = resp.data?.items || [];
      setAssignments((prev) => [...prev, ...items]);
      setCursor(resp.data?.nextCursor || null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to load more records');
    } finally {
      setPageLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-tertiary-fixed-dim" />

        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Tenure Ledger</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
          Field Assignment History & Tenures
        </h1>
        <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
          Audited log of your operational tenures, role authorizations, and release statements.
        </p>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-outline-variant/20">
          <button
            type="button"
            onClick={() => setTab('active')}
            className={`h-9 px-4 rounded-xl font-bold text-xs cursor-pointer transition-all ${
              tab === 'active'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
            }`}
          >
            Active Assignments
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`h-9 px-4 rounded-xl font-bold text-xs cursor-pointer transition-all ${
              tab === 'history'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
            }`}
          >
            Concluded History
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-error-container text-error text-xs font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <LoadingSkeleton count={3} />
      ) : assignments.length === 0 ? (
        <EmptyState
          icon="assignment"
          title={tab === 'active' ? 'No Active Tenures' : 'No Concluded Assignments'}
          description={
            tab === 'active'
              ? 'You do not hold any active field assignments currently.'
              : 'You have not yet concluded any historical assignments on AgroAI.'
          }
        />
      ) : (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container-low border-b border-outline-variant/30 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Tenure ID</th>
                  <th className="py-3 px-4">Field Sector</th>
                  <th className="py-3 px-4">Farm Holding</th>
                  <th className="py-3 px-4">Assigned At</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Scope Permissions</th>
                  {tab === 'history' && <th className="py-3 px-4">Release Note</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {assignments.map((a) => (
                  <tr key={a.assignmentId} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-semibold text-on-surface">
                      {a.assignmentId.substring(0, 12)}...
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-primary">
                      {a.fieldId.substring(0, 14)}...
                    </td>
                    <td className="py-3.5 px-4 font-mono text-on-surface-variant">
                      {a.farmId.substring(0, 12)}...
                    </td>
                    <td className="py-3.5 px-4 text-on-surface-variant">
                      {new Date(a.assignedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        {a.permissions?.map((p) => (
                          <span
                            key={p}
                            className="px-2 py-0.5 rounded bg-surface-container text-on-surface text-[10px] font-semibold"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    </td>
                    {tab === 'history' && (
                      <td className="py-3.5 px-4 text-on-surface-variant italic">
                        {a.releaseReason || 'Concluded'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {cursor && (
            <div className="p-4 border-t border-outline-variant/20 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={pageLoading}
                className="h-9 px-5 rounded-xl border border-outline-variant/40 hover:bg-surface-container text-on-surface text-xs font-semibold cursor-pointer disabled:opacity-60"
              >
                {pageLoading ? 'Loading...' : 'Load Next Page'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
