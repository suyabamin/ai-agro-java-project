import React, { useEffect, useState, useCallback } from 'react';
import { jobService } from '../services/jobService';
import { ApplyJobModal } from '../components/recruitment/ApplyJobModal';
import { useAuth } from '../context/AuthContext';
import type { PublicJob, JobCategory, EmploymentType } from '../types/job';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';

const CATEGORIES: { label: string; value: JobCategory }[] = [
  { label: 'Crop Farming', value: 'CROP_FARMING' },
  { label: 'Livestock', value: 'LIVESTOCK' },
  { label: 'Irrigation', value: 'IRRIGATION' },
  { label: 'Harvesting', value: 'HARVESTING' },
  { label: 'Equipment Operation', value: 'EQUIPMENT_OPERATION' },
  { label: 'General Labor', value: 'GENERAL_LABOR' },
  { label: 'Agronomy Tech', value: 'AGRONOMY_TECH' },
];

const EMPLOYMENT_TYPES: { label: string; value: EmploymentType }[] = [
  { label: 'Full Time', value: 'FULL_TIME' },
  { label: 'Part Time', value: 'PART_TIME' },
  { label: 'Seasonal', value: 'SEASONAL' },
  { label: 'Daily Wage', value: 'DAILY_WAGE' },
  { label: 'Contract', value: 'CONTRACT' },
];

export const JobsPage: React.FC = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<JobCategory | ''>('');
  const [employmentType, setEmploymentType] = useState<EmploymentType | ''>('');
  const [district, setDistrict] = useState('');

  // Apply modal
  const [applyingJob, setApplyingJob] = useState<PublicJob | null>(null);
  const [detailJob, setDetailJob] = useState<PublicJob | null>(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await jobService.fetchPublicJobs({
        keyword: keyword.trim() || undefined,
        category: category || undefined,
        employmentType: employmentType || undefined,
        district: district.trim() || undefined,
      });
      setJobs(res.data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load jobs';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [keyword, category, employmentType, district]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const handleApplyClick = (job: PublicJob) => {
    if (!user) {
      setError('You must sign in or register to submit an application.');
      return;
    }
    setApplyingJob(job);
  };

  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-10 shadow-sm border border-outline-variant/30 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-tertiary-fixed-dim" />

        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-low text-primary text-xs font-bold uppercase tracking-wider mb-3">
            <span className="material-symbols-outlined text-[16px]">work</span>
            <span>Agronomic Labor Marketplace</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight">
            Agricultural Job Vacancies
          </h1>
          <p className="text-sm sm:text-base text-on-surface-variant mt-2 leading-relaxed">
            Apply for specialized fieldwork, irrigation technician roles, and farm management contracts across high-yield precision farms.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-error-container text-error text-xs font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/30 flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="relative w-full lg:w-72 flex items-center">
          <span className="absolute left-3 text-on-surface-variant pointer-events-none">
            <span className="material-symbols-outlined text-[18px]">search</span>
          </span>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Search role, skills..."
            className="w-full h-10 pl-9 pr-3 rounded-lg bg-surface-container-low text-on-surface text-xs placeholder:text-outline outline-none focus:ring-2 focus:ring-primary border border-transparent shadow-inner"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as JobCategory | '')}
            className="h-10 px-3 rounded-lg bg-surface-container-low text-on-surface text-xs outline-none focus:ring-2 focus:ring-primary border border-transparent cursor-pointer font-medium"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          <select
            value={employmentType}
            onChange={(e) => setEmploymentType(e.target.value as EmploymentType | '')}
            className="h-10 px-3 rounded-lg bg-surface-container-low text-on-surface text-xs outline-none focus:ring-2 focus:ring-primary border border-transparent cursor-pointer font-medium"
          >
            <option value="">All Employment Types</option>
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            placeholder="District (e.g. Gazipur)"
            className="h-10 px-3 rounded-lg bg-surface-container-low text-on-surface text-xs outline-none focus:ring-2 focus:ring-primary border border-transparent shadow-inner w-36"
          />

          {(keyword || category || employmentType || district) && (
            <button
              type="button"
              onClick={() => {
                setKeyword('');
                setCategory('');
                setEmploymentType('');
                setDistrict('');
              }}
              className="h-10 px-3 rounded-lg border border-outline-variant/40 hover:bg-surface-container-low text-on-surface-variant text-xs font-semibold cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Jobs Grid */}
      {loading ? (
        <LoadingSkeleton count={6} />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon="work_outline"
          title="No Open Vacancies Found"
          description="There are currently no job postings matching your selected filters. Try broadening your criteria."
          actionText="Clear Filters"
          onAction={() => {
            setKeyword('');
            setCategory('');
            setEmploymentType('');
            setDistrict('');
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {jobs.map((job) => (
            <div
              key={job.jobId}
              className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/30 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold uppercase tracking-wider">
                    {job.jobCategory.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs font-semibold text-on-surface-variant">
                    {job.employmentType.replace(/_/g, ' ')}
                  </span>
                </div>

                <h3 className="font-bold text-base text-on-surface tracking-tight mb-1">
                  {job.title}
                </h3>

                <p className="text-xs font-semibold text-primary flex items-center gap-1 mb-2">
                  <span className="material-symbols-outlined text-[15px]">warehouse</span>
                  <span>{job.farmName} • {job.farmDistrict}, {job.farmDivision}</span>
                </p>

                <p className="text-xs text-on-surface-variant line-clamp-3 mb-4 leading-relaxed">
                  {job.description}
                </p>

                {job.requiredSkills && job.requiredSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {job.requiredSkills.map((sk) => (
                      <span
                        key={sk}
                        className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface-variant text-[10px] font-medium"
                      >
                        {sk}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-outline-variant/20 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-primary text-sm">
                    {job.minimumSalary != null
                      ? `${job.minimumSalary}${job.maximumSalary ? ` - ${job.maximumSalary}` : ''} ${job.currency || 'BDT'} / ${job.salaryType.toLowerCase()}`
                      : job.salaryType}
                  </span>
                  <span className="text-[11px] text-on-surface-variant">
                    {job.numberOfPositions} open position{job.numberOfPositions > 1 ? 's' : ''}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailJob(job)}
                    className="flex-1 h-9 rounded-lg border border-outline-variant/40 hover:bg-surface-container text-on-surface font-semibold text-xs flex items-center justify-center cursor-pointer transition-colors"
                  >
                    Details
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyClick(job)}
                    className="flex-1 h-9 rounded-lg bg-primary hover:bg-secondary text-on-primary font-bold text-xs flex items-center justify-center cursor-pointer shadow-sm transition-all active:scale-95"
                  >
                    Apply Now
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {detailJob && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-outline-variant/30 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-on-surface">{detailJob.title}</h3>
                <p className="text-xs font-semibold text-primary mt-0.5">
                  {detailJob.farmName} — {detailJob.farmDistrict}, {detailJob.farmDivision}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailJob(null)}
                className="w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center text-on-surface-variant cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="text-xs text-on-surface leading-relaxed whitespace-pre-wrap">
              {detailJob.description}
            </div>

            {detailJob.experienceRequirements && (
              <div className="p-3 rounded-xl bg-surface-container-low text-xs">
                <span className="font-bold text-on-surface block mb-1">Experience Requirements:</span>
                <span className="text-on-surface-variant">{detailJob.experienceRequirements}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant/20">
              <button
                type="button"
                onClick={() => setDetailJob(null)}
                className="h-10 px-4 rounded-xl border border-outline-variant/40 hover:bg-surface-container text-on-surface text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const j = detailJob;
                  setDetailJob(null);
                  handleApplyClick(j);
                }}
                className="h-10 px-5 rounded-xl bg-primary hover:bg-secondary text-on-primary text-xs font-bold shadow-md cursor-pointer active:scale-95 transition-all"
              >
                Apply for this Job
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apply Modal */}
      <ApplyJobModal
        isOpen={!!applyingJob}
        job={applyingJob}
        onClose={() => setApplyingJob(null)}
        onSuccess={(app) => {
          setSuccessMsg(`Application submitted successfully! Application ID: ${app.applicationId}`);
        }}
      />
    </div>
  );
};
