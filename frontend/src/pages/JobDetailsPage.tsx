import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { jobService } from '../services/jobService';
import { applicationService } from '../services/applicationService';
import type { Job, JobApplication } from '../types/job';
import { StatusBadge } from '../components/ui/StatusBadge';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { ApplicationDetailModal } from '../components/recruitment/ApplicationDetailModal';

export const JobDetailsPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const { activeFarm } = useFarm();

  const [job, setJob] = useState<Job | null>(null);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Application modal
  const [selectedApp, setSelectedApp] = useState<JobApplication | null>(null);

  const loadData = useCallback(async () => {
    if (!activeFarm || !jobId) return;
    setLoading(true);
    setError(null);
    try {
      const [jobRes, appsRes] = await Promise.all([
        jobService.fetchJobById(activeFarm.farmId, jobId),
        applicationService.getFarmApplications(activeFarm.farmId, { jobId }).catch(() => ({ data: [] })),
      ]);
      setJob(jobRes.data || null);
      setApplications(appsRes.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load job details');
    } finally {
      setLoading(false);
    }
  }, [activeFarm, jobId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStatusChange = async (action: 'publish' | 'pause' | 'close') => {
    if (!activeFarm || !jobId) return;
    setActionLoading(true);
    setError(null);
    try {
      if (action === 'publish') await jobService.publishJob(activeFarm.farmId, jobId);
      else if (action === 'pause') await jobService.pauseJob(activeFarm.farmId, jobId);
      else if (action === 'close') await jobService.closeJob(activeFarm.farmId, jobId);

      setSuccessMsg(`Job status updated to ${action.toUpperCase()}ED`);
      setTimeout(() => setSuccessMsg(null), 3000);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Failed to ${action} job`);
    } finally {
      setActionLoading(false);
    }
  };

  if (!activeFarm) {
    return (
      <div className="p-8 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/30">
        <h2 className="text-base font-bold text-on-surface">No Farm Selected</h2>
        <Link to="/dashboard/farms" className="mt-3 inline-block px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold">
          Go to My Farms
        </Link>
      </div>
    );
  }

  if (loading) {
    return <LoadingSkeleton type="dashboard" />;
  }

  if (error || !job) {
    return (
      <div className="p-8 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/30 space-y-3">
        <h2 className="text-base font-bold text-on-surface">Job Vacancy Not Found</h2>
        <p className="text-xs text-on-surface-variant">{error || 'Could not locate job record.'}</p>
        <Link to="/dashboard/jobs" className="inline-block px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold">
          Back to Vacancies
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard/jobs"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Back to Vacancies</span>
        </Link>
        <span className="px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface-variant text-xs font-bold uppercase tracking-wider">
          {activeFarm.name}
        </span>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Dossier Card */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30 relative overflow-hidden space-y-6">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-tertiary-fixed-dim" />

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-[11px] font-bold uppercase tracking-wider">
                {job.jobCategory.replace(/_/g, ' ')}
              </span>
              <StatusBadge status={job.status} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
              {job.title}
            </h1>
            <p className="text-xs text-on-surface-variant mt-1">
              Requisition ID: <span className="font-mono">{job.jobId}</span> • Published: {new Date(job.createdAt).toLocaleDateString()}
            </p>
          </div>

          {/* Quick Status Control Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {job.status !== 'PUBLISHED' && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleStatusChange('publish')}
                className="h-10 px-4 rounded-xl bg-primary hover:bg-secondary text-on-primary font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[16px]">publish</span>
                <span>Publish</span>
              </button>
            )}

            {job.status === 'PUBLISHED' && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleStatusChange('pause')}
                className="h-10 px-4 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[16px]">pause</span>
                <span>Pause</span>
              </button>
            )}

            {job.status !== 'CLOSED' && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleStatusChange('close')}
                className="h-10 px-4 rounded-xl border border-error/40 text-error hover:bg-error-container/30 font-semibold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[16px]">lock</span>
                <span>Close</span>
              </button>
            )}
          </div>
        </div>

        {/* Spec Matrix */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs">
          <div>
            <span className="text-[10px] text-on-surface-variant uppercase font-semibold">Compensation</span>
            <div className="font-bold text-primary text-sm mt-0.5">
              {job.minimumSalary != null
                ? `${job.minimumSalary}${job.maximumSalary ? ` - ${job.maximumSalary}` : ''} ${job.currency || 'BDT'} (${job.salaryType})`
                : job.salaryType}
            </div>
          </div>
          <div>
            <span className="text-[10px] text-on-surface-variant uppercase font-semibold">Employment Term</span>
            <div className="font-bold text-on-surface text-sm mt-0.5">{job.employmentType.replace(/_/g, ' ')}</div>
          </div>
          <div>
            <span className="text-[10px] text-on-surface-variant uppercase font-semibold">Positions</span>
            <div className="font-bold text-on-surface text-sm mt-0.5">{job.numberOfPositions} Specialists</div>
          </div>
          <div>
            <span className="text-[10px] text-on-surface-variant uppercase font-semibold">Total Applications</span>
            <div className="font-bold text-secondary text-sm mt-0.5">{applications.length} Candidates</div>
          </div>
        </div>

        {/* Description & Competencies */}
        <div className="space-y-4 text-xs">
          <div>
            <h3 className="font-bold text-sm text-on-surface mb-2">Scope of Work</h3>
            <p className="text-on-surface-variant leading-relaxed whitespace-pre-wrap">
              {job.description}
            </p>
          </div>

          {job.experienceRequirements && (
            <div>
              <h3 className="font-bold text-sm text-on-surface mb-1">Experience Requirements</h3>
              <p className="text-on-surface-variant">{job.experienceRequirements}</p>
            </div>
          )}

          {job.requiredSkills && job.requiredSkills.length > 0 && (
            <div>
              <h3 className="font-bold text-sm text-on-surface mb-2">Required Skills</h3>
              <div className="flex flex-wrap gap-1.5">
                {job.requiredSkills.map((sk) => (
                  <span
                    key={sk}
                    className="px-2.5 py-1 rounded-md bg-surface-container text-on-surface text-xs font-semibold"
                  >
                    {sk}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Applications Section */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-sm border border-outline-variant/30 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-on-surface">Candidate Applications</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Review and screen agronomic candidates who applied for this vacancy.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-surface-container text-on-surface-variant text-xs font-bold">
            {applications.length} Received
          </span>
        </div>

        {applications.length === 0 ? (
          <div className="p-8 text-center bg-surface-container-low rounded-xl border border-outline-variant/20">
            <span className="material-symbols-outlined text-[36px] text-outline mb-2">inbox</span>
            <p className="text-xs font-bold text-on-surface">No Applications Yet</p>
            <p className="text-[11px] text-on-surface-variant mt-1">
              When farmers apply to this listing on the Public Marketplace, their dossiers will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/20">
            {applications.map((app) => (
              <div
                key={app.applicationId}
                className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-on-surface">{app.applicantName}</span>
                    <StatusBadge status={app.status} />
                  </div>
                  <div className="text-[11px] text-on-surface-variant flex items-center gap-3">
                    <span>Email: {app.applicantEmail}</span>
                    <span>•</span>
                    <span>Applied: {new Date(app.submittedAt).toLocaleDateString()}</span>
                    {app.expectedSalary && (
                      <>
                        <span>•</span>
                        <span className="font-semibold text-primary">Expected: {app.expectedSalary} BDT</span>
                      </>
                    )}
                  </div>
                  {app.coverLetter && (
                    <p className="text-[11px] text-on-surface-variant line-clamp-1 italic max-w-xl">
                      "{app.coverLetter}"
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedApp(app)}
                    className="h-9 px-4 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <span>Inspect Dossier</span>
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Application Detail Modal */}
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
