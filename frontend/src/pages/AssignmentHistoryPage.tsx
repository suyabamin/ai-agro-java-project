import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { assignmentService } from '../services/assignmentService';
import type { FieldAssignment } from '../types/assignment';
import { StatusBadge } from '../components/ui/StatusBadge';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';

export const AssignmentHistoryPage: React.FC = () => {
  const { activeFarm } = useFarm();
  const navigate = useNavigate();

  const [assignments, setAssignments] = useState<FieldAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(false);

  const loadAssignments = useCallback(async () => {
    if (!activeFarm) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await assignmentService.fetchFarmAssignments(activeFarm.farmId);
      setAssignments(resp.data?.items || []);
      setCursor(resp.data?.nextCursor || null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load assignment history');
    } finally {
      setLoading(false);
    }
  }, [activeFarm]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const loadMore = async () => {
    if (!activeFarm || !cursor) return;
    setPageLoading(true);
    try {
      const resp = await assignmentService.fetchFarmAssignments(activeFarm.farmId, cursor);
      const items = resp.data?.items || [];
      setAssignments((prev) => [...prev, ...items]);
      setCursor(resp.data?.nextCursor || null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to load next page');
    } finally {
      setPageLoading(false);
    }
  };

  if (!activeFarm) {
    return (
      <EmptyState
        icon="warehouse"
        title="No Farm Selected"
        description="Select an active farm to inspect historical assignments."
        actionText="My Farms"
        onAction={() => navigate('/dashboard/farms')}
      />
    );
  }

  const historyItems = assignments.filter((a) => a.status !== 'ACTIVE');

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Tenure Records
            </span>
            <span className="text-xs text-on-surface-variant">• {activeFarm.name}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
            Field Assignment History & Archives
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Audit logs of concluded, released, and transferred farmer tenures across all acreage sectors.
          </p>
        </div>

        <Link
          to="/dashboard/assignments"
          className="h-11 px-5 rounded-xl border border-outline-variant/40 hover:bg-surface-container text-on-surface font-semibold text-xs flex items-center justify-center gap-2 no-underline transition-colors shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
          <span>Active Assignments</span>
        </Link>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-error-container text-error text-xs font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <LoadingSkeleton count={4} />
      ) : historyItems.length === 0 ? (
        <EmptyState
          icon="history"
          title="No Historical Assignments"
          description={`There are no released or completed assignment records under "${activeFarm.name}". All currently active tenures remain ongoing.`}
          actionText="View Active Assignments"
          onAction={() => navigate('/dashboard/assignments')}
        />
      ) : (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container-low border-b border-outline-variant/30 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Tenure ID</th>
                  <th className="py-3 px-4">Specialist / Farmer</th>
                  <th className="py-3 px-4">Field Sector</th>
                  <th className="py-3 px-4">Assigned Date</th>
                  <th className="py-3 px-4">Released Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Release Justification</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {historyItems.map((a) => (
                  <tr key={a.assignmentId} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-semibold text-on-surface">
                      {a.assignmentId.substring(0, 10)}...
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-on-surface">{a.farmerName || 'Specialist'}</div>
                      <div className="text-[10px] text-on-surface-variant font-mono">UID: {a.farmerUid}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-primary">
                      {a.fieldId.substring(0, 14)}...
                    </td>
                    <td className="py-3.5 px-4 text-on-surface-variant">
                      {new Date(a.assignedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-on-surface-variant">
                      {a.releasedAt ? new Date(a.releasedAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="py-3.5 px-4 text-on-surface-variant italic">
                      {a.releaseReason || 'Completed season'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        to={`/dashboard/assignments/${a.assignmentId}`}
                        className="h-8 px-3 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-[11px] inline-flex items-center gap-1 no-underline"
                      >
                        <span>Inspect</span>
                        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                      </Link>
                    </td>
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
                {pageLoading ? 'Loading...' : 'Load More Records'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
