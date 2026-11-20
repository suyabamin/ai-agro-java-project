import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { jobService } from '../services/jobService';
import type { Job } from '../types/job';
import { StatusBadge } from '../components/ui/StatusBadge';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';

export const JobListPage: React.FC = () => {
  const { activeFarm } = useFarm();
  const navigate = useNavigate();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeFarm) {
      setJobs([]);
      setLoading(false);
      return;
    }

    let mounted = true;
    async function loadJobs() {
      setLoading(true);
      setError(null);
      try {
        const resp = await jobService.fetchFarmJobs(activeFarm!.farmId, true);
        if (mounted) {
          setJobs(resp.data || []);
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch farm job vacancies');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadJobs();

    return () => {
      mounted = false;
    };
  }, [activeFarm]);

  const handleAction = async (jobId: string, action: 'publish' | 'pause' | 'close') => {
    if (!activeFarm) return;
    try {
      if (action === 'publish') await jobService.publishJob(activeFarm.farmId, jobId);
      else if (action === 'pause') await jobService.pauseJob(activeFarm.farmId, jobId);
      else if (action === 'close') await jobService.closeJob(activeFarm.farmId, jobId);

      const resp = await jobService.fetchFarmJobs(activeFarm.farmId, true);
      setJobs(resp.data || []);
      setActionMessage(`Job status updated to ${action.toUpperCase()}ED.`);
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Failed to ${action} job`);
    }
  };

  const filtered = jobs.filter((j) => {
    const matchesSearch =
      j.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      j.jobCategory.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || j.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (!activeFarm) {
    return (
      <EmptyState
        icon="warehouse"
        title="No Farm Selected"
        description="Select an active farm to manage job postings and recruitment vacancies."
        actionText="My Farms"
        onAction={() => navigate('/dashboard/farms')}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Workforce Recruitment
            </span>
            <span className="text-xs text-on-surface-variant">• {activeFarm.name}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
            Job Vacancy Postings
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Publish recruitment listings, hire qualified field specialists, and review candidate proposals.
          </p>
        </div>

        <Link
          to="/dashboard/jobs/new"
          className="h-11 px-5 rounded-xl bg-primary hover:bg-secondary text-on-primary font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 no-underline shrink-0 active:scale-95"
        >
          <span className="material-symbols-outlined text-[18px]">post_add</span>
          <span>Create Vacancy</span>
        </Link>
      </div>

      {actionMessage && (
        <div className="p-3.5 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{actionMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-error-container text-error text-xs font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{error}</span>
        </div>
      )}

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
            placeholder="Search job title or category..."
            className="w-full h-10 pl-9 pr-3 rounded-lg bg-surface-container-low text-on-surface text-xs placeholder:text-outline outline-none focus:ring-2 focus:ring-primary border border-transparent shadow-inner"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-on-surface-variant font-semibold">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 rounded-lg bg-surface-container-low text-on-surface text-xs outline-none focus:ring-2 focus:ring-primary border border-transparent cursor-pointer font-medium"
          >
            <option value="ALL">All Statuses</option>
            <option value="PUBLISHED">PUBLISHED</option>
            <option value="DRAFT">DRAFT</option>
            <option value="PAUSED">PAUSED</option>
            <option value="CLOSED">CLOSED</option>
          </select>
        </div>
      </div>

      {/* Jobs Grid */}
      {loading ? (
        <LoadingSkeleton count={3} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="work"
          title={jobs.length === 0 ? 'No Vacancies Created' : 'No Matching Vacancies'}
          description={
            jobs.length === 0
              ? `There are no open job postings under "${activeFarm.name}". Post a vacancy to recruit specialized agricultural labor.`
              : 'No job postings matched your search criteria.'
          }
          actionText={jobs.length === 0 ? 'Create Vacancy' : undefined}
          onAction={jobs.length === 0 ? () => navigate('/dashboard/jobs/new') : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((j) => (
            <div
              key={j.jobId}
              className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/30 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-[10px] font-bold uppercase tracking-wider">
                    {j.jobCategory}
                  </span>
                  <StatusBadge status={j.status} />
                </div>

                <h3 className="font-bold text-base text-on-surface tracking-tight mb-1">
                  {j.title}
                </h3>
                <p className="text-xs text-on-surface-variant line-clamp-2 mb-4 leading-relaxed">
                  {j.description}
                </p>

                <div className="p-3.5 rounded-xl bg-surface-container-low text-xs space-y-1.5 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-on-surface-variant">Compensation</span>
                    <span className="font-extrabold text-primary">
                      {j.minimumSalary
                        ? `${j.minimumSalary}${j.maximumSalary ? ` - ${j.maximumSalary}` : ''} ${j.currency || 'BDT'} (${j.salaryType})`
                        : 'Negotiable'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-on-surface-variant">
                    <span>Type: {j.employmentType}</span>
                    <span>Vacancies: {j.numberOfPositions || 1}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-outline-variant/20">
                <div className="flex items-center gap-2">
                  <Link
                    to={`/dashboard/jobs/${j.jobId}`}
                    className="flex-1 h-9 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs flex items-center justify-center gap-1 no-underline"
                  >
                    <span>View Dossier</span>
                  </Link>
                  <Link
                    to={`/dashboard/applications?jobId=${j.jobId}`}
                    className="h-9 px-3 rounded-lg bg-primary hover:bg-secondary text-on-primary font-bold text-xs flex items-center gap-1 no-underline"
                  >
                    <span>Candidates</span>
                  </Link>
                </div>

                {/* Status Toggle Action */}
                <div className="flex items-center justify-between text-[11px] pt-1">
                  {j.status === 'DRAFT' && (
                    <button
                      type="button"
                      onClick={() => handleAction(j.jobId, 'publish')}
                      className="text-primary font-bold hover:underline cursor-pointer"
                    >
                      Publish Vacancy
                    </button>
                  )}
                  {j.status === 'PUBLISHED' && (
                    <button
                      type="button"
                      onClick={() => handleAction(j.jobId, 'pause')}
                      className="text-amber-700 font-bold hover:underline cursor-pointer"
                    >
                      Pause Applications
                    </button>
                  )}
                  {j.status === 'PAUSED' && (
                    <button
                      type="button"
                      onClick={() => handleAction(j.jobId, 'publish')}
                      className="text-primary font-bold hover:underline cursor-pointer"
                    >
                      Resume Listing
                    </button>
                  )}
                  {j.status !== 'CLOSED' && (
                    <button
                      type="button"
                      onClick={() => handleAction(j.jobId, 'close')}
                      className="text-error font-semibold hover:underline cursor-pointer ml-auto"
                    >
                      Close Job
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
