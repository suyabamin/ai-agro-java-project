import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { applicationService } from '../services/applicationService';
import { jobService } from '../services/jobService';
import type { JobApplication, Job } from '../types/job';
import { StatusBadge } from '../components/ui/StatusBadge';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ApplicationDetailModal } from '../components/recruitment/ApplicationDetailModal';

export const ApplicationManagementPage: React.FC = () => {
  const { activeFarm } = useFarm();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedJobId = searchParams.get('jobId') || 'ALL';

  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Detail Modal
  const [selectedApp, setSelectedApp] = useState<JobApplication | null>(null);

  const loadData = useCallback(async () => {
    if (!activeFarm) return;
    setLoading(true);
    setError(null);
    try {
      const jobsRes = await jobService.fetchFarmJobs(activeFarm.farmId, true);
      const farmJobs = jobsRes.data || [];
      setJobs(farmJobs);

      if (selectedJobId && selectedJobId !== 'ALL') {
        const appsRes = await applicationService.getFarmApplications(activeFarm.farmId, { jobId: selectedJobId });
        setApplications(appsRes.data || []);
      } else {
        // Collect applications from all jobs
        const appsLists = await Promise.all(
          farmJobs.map((j) =>
            applicationService.getFarmApplications(activeFarm.farmId, { jobId: j.jobId }).catch(() => ({ data: [] }))
          )
        );
        const combined = appsLists.flatMap((res) => res.data || []);
        setApplications(combined);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch candidate applications');
    } finally {
      setLoading(false);
    }
  }, [activeFarm, selectedJobId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!activeFarm) {
    return (
      <EmptyState
        icon="warehouse"
        title="No Farm Selected"
        description="Select an active farm to review applicant dossiers and recruitment submissions."
        actionText="My Farms"
        onAction={() => navigate('/dashboard/farms')}
      />
    );
  }

  const filtered = applications.filter((app) => {
    const matchesSearch =
      app.applicantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.applicantEmail.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Workforce Pipeline
            </span>
            <span className="text-xs text-on-surface-variant">• {activeFarm.name}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
            Candidate Application Management
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Screen applicant qualifications, conduct peer evaluations, and approve agronomists for field assignment.
          </p>
        </div>

        <Link
          to="/dashboard/jobs"
          className="h-11 px-5 rounded-xl border border-outline-variant/40 hover:bg-surface-container text-on-surface font-semibold text-xs flex items-center justify-center gap-2 no-underline shrink-0 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">work</span>
          <span>View All Vacancies</span>
        </Link>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-error-container text-error text-xs font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4 bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/30">
        <div className="relative w-full lg:w-80 flex items-center">
          <span className="absolute left-3 text-on-surface-variant pointer-events-none">
            <span className="material-symbols-outlined text-[18px]">search</span>
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search candidate name or email..."
            className="w-full h-10 pl-9 pr-3 rounded-lg bg-surface-container-low text-on-surface text-xs placeholder:text-outline outline-none focus:ring-2 focus:ring-primary border border-transparent shadow-inner"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs text-on-surface-variant font-semibold">Vacancy:</span>
            <select
              value={selectedJobId}
              onChange={(e) => setSearchParams(e.target.value === 'ALL' ? {} : { jobId: e.target.value })}
              className="h-10 px-3 rounded-lg bg-surface-container-low text-on-surface text-xs outline-none focus:ring-2 focus:ring-primary border border-transparent cursor-pointer font-medium max-w-[200px] truncate"
            >
              <option value="ALL">All Vacancies</option>
              {jobs.map((j) => (
                <option key={j.jobId} value={j.jobId}>
                  {j.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-on-surface-variant font-semibold">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 px-3 rounded-lg bg-surface-container-low text-on-surface text-xs outline-none focus:ring-2 focus:ring-primary border border-transparent cursor-pointer font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUBMITTED">SUBMITTED</option>
              <option value="UNDER_REVIEW">UNDER_REVIEW</option>
              <option value="SHORTLISTED">SHORTLISTED</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
              <option value="WITHDRAWN">WITHDRAWN</option>
            </select>
          </div>
        </div>
      </div>

      {/* Applications List */}
      {loading ? (
        <LoadingSkeleton count={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="assignment_ind"
          title={applications.length === 0 ? 'No Applications Received' : 'No Matching Applications'}
          description={
            applications.length === 0
              ? `There are no candidate proposals submitted for vacancies under "${activeFarm.name}".`
              : 'No applications match your selected filters.'
          }
        />
      ) : (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container-low border-b border-outline-variant/30 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Applicant</th>
                  <th className="py-3 px-4">Experience</th>
                  <th className="py-3 px-4">Expected Rate</th>
                  <th className="py-3 px-4">Submitted Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {filtered.map((app) => (
                  <tr key={app.applicationId} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-on-surface">{app.applicantName}</div>
                      <div className="text-[11px] text-on-surface-variant">{app.applicantEmail}</div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-on-surface">
                      {app.experienceYears != null ? `${app.experienceYears} Years` : 'Not specified'}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-primary">
                      {app.expectedSalary != null ? `${app.expectedSalary} BDT` : 'Open'}
                    </td>
                    <td className="py-3.5 px-4 text-on-surface-variant">
                      {new Date(app.submittedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedApp(app)}
                        className="h-8 px-3 rounded-lg bg-primary hover:bg-secondary text-on-primary font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
                      >
                        <span>Review</span>
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {selectedApp && (
        <ApplicationDetailModal
          isOpen={!!selectedApp}
          farmId={activeFarm.farmId}
          application={selectedApp}
          onClose={() => setSelectedApp(null)}
          onApplicationUpdated={() => {
            setSelectedApp(null);
            loadData();
          }}
        />
      )}
    </div>
  );
};
