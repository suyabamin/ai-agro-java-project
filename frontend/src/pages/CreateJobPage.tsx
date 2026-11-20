import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useFarm } from '../context/FarmContext';
import { jobService } from '../services/jobService';
import type { CreateJobPayload, JobCategory, EmploymentType, SalaryType } from '../types/job';
import { EmptyState } from '../components/ui/EmptyState';

const CATEGORIES: { value: JobCategory; label: string }[] = [
  { value: 'CROP_FARMING', label: 'Crop Farming' },
  { value: 'LIVESTOCK', label: 'Livestock Care' },
  { value: 'IRRIGATION', label: 'Irrigation & Drainage' },
  { value: 'HARVESTING', label: 'Harvesting Operations' },
  { value: 'EQUIPMENT_OPERATION', label: 'Equipment & Machinery' },
  { value: 'GENERAL_LABOR', label: 'General Field Labor' },
  { value: 'AGRONOMY_TECH', label: 'Agronomy Tech & Calibration' },
];

const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: 'FULL_TIME', label: 'Full Time' },
  { value: 'PART_TIME', label: 'Part Time' },
  { value: 'SEASONAL', label: 'Seasonal' },
  { value: 'DAILY_WAGE', label: 'Daily Wage' },
  { value: 'CONTRACT', label: 'Contract' },
];

const SALARY_TYPES: { value: SalaryType; label: string }[] = [
  { value: 'DAILY', label: 'Daily Rate' },
  { value: 'MONTHLY', label: 'Monthly Salary' },
  { value: 'PER_HECTARE', label: 'Per Hectare' },
  { value: 'FIXED', label: 'Fixed Contract' },
  { value: 'HOURLY', label: 'Hourly' },
  { value: 'NEGOTIABLE', label: 'Negotiable' },
];

export const CreateJobPage: React.FC = () => {
  const { activeFarm } = useFarm();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<JobCategory>('CROP_FARMING');
  const [employmentType, setEmploymentType] = useState<EmploymentType>('SEASONAL');
  const [skillsStr, setSkillsStr] = useState('');
  const [experience, setExperience] = useState('');
  const [positions, setPositions] = useState(1);
  const [salaryType, setSalaryType] = useState<SalaryType>('DAILY');
  const [minSalary, setMinSalary] = useState<string>('');
  const [maxSalary, setMaxSalary] = useState<string>('');
  const [locationSummary, setLocationSummary] = useState('');
  const [deadline, setDeadline] = useState('');
  const [publishImmediately, setPublishImmediately] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!activeFarm) {
    return (
      <EmptyState
        icon="warehouse"
        title="No Active Farm Selected"
        description="Select an active farm before publishing workforce vacancies."
        actionText="My Farms"
        onAction={() => navigate('/dashboard/farms')}
      />
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (title.trim().length < 3) {
      setError('Job title must be at least 3 characters.');
      return;
    }
    if (description.trim().length < 10) {
      setError('Job description must be at least 10 characters.');
      return;
    }

    const skills = skillsStr
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const payload: CreateJobPayload = {
      title: title.trim(),
      description: description.trim(),
      jobCategory: category,
      employmentType,
      requiredSkills: skills.length > 0 ? skills : undefined,
      experienceRequirements: experience.trim() || undefined,
      numberOfPositions: Number(positions) || 1,
      salaryType,
      minimumSalary: minSalary ? parseFloat(minSalary) : undefined,
      maximumSalary: maxSalary ? parseFloat(maxSalary) : undefined,
      currency: 'BDT',
      locationSummary: locationSummary.trim() || undefined,
      applicationDeadline: deadline ? new Date(deadline).toISOString() : undefined,
      publishImmediately,
    };

    setLoading(true);
    try {
      await jobService.createJob(activeFarm.farmId, payload);
      navigate('/dashboard/jobs');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to publish job vacancy';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[900px] mx-auto space-y-6">
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

      {/* Main Form Card */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-10 shadow-sm border border-outline-variant/30 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-tertiary-fixed-dim" />

        <div className="flex items-center gap-2 mb-2">
          <span className="px-2.5 py-0.5 rounded-full bg-surface-container-low text-primary text-xs font-bold uppercase tracking-wider flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">post_add</span>
            Recruitment Requisition
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
          Publish Job Vacancy
        </h1>
        <p className="text-xs sm:text-sm text-on-surface-variant mt-1 mb-8 leading-relaxed">
          Post an open agronomic role under <strong className="text-on-surface">{activeFarm.name}</strong> to recruit certified farmers, probe technicians, or harvesters.
        </p>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-error-container text-error text-xs font-medium border border-error/20 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-on-surface" htmlFor="job-title">
              Job Title *
            </label>
            <input
              id="job-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Lead Rice Agronomist & Sensor Calibration Specialist"
              className="w-full h-11 px-4 rounded-lg bg-surface-container-low text-on-surface text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all border border-transparent shadow-inner"
            />
          </div>

          {/* Category & Employment Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface" htmlFor="job-cat">
                Specialization Category *
              </label>
              <select
                id="job-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value as JobCategory)}
                className="w-full h-11 px-3 rounded-lg bg-surface-container-low text-on-surface text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all border border-transparent shadow-inner cursor-pointer"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface" htmlFor="job-emp">
                Employment Term *
              </label>
              <select
                id="job-emp"
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
                className="w-full h-11 px-3 rounded-lg bg-surface-container-low text-on-surface text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all border border-transparent shadow-inner cursor-pointer"
              >
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-on-surface" htmlFor="job-desc">
              Detailed Scope of Work & Responsibilities *
            </label>
            <textarea
              id="job-desc"
              rows={4}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Outline daily duties, field inspection expectations, crop stages, and probe telemetry verification..."
              className="w-full p-3 rounded-lg bg-surface-container-low text-on-surface text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all border border-transparent shadow-inner"
            />
          </div>

          {/* Skills & Experience */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface" htmlFor="job-skills">
                Required Competencies (comma separated)
              </label>
              <input
                id="job-skills"
                type="text"
                value={skillsStr}
                onChange={(e) => setSkillsStr(e.target.value)}
                placeholder="Paddy Cultivation, Soil Probes, IPM"
                className="w-full h-11 px-4 rounded-lg bg-surface-container-low text-on-surface text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all border border-transparent shadow-inner"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-on-surface" htmlFor="job-exp">
                Experience Requirements
              </label>
              <input
                id="job-exp"
                type="text"
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                placeholder="e.g. Minimum 3 seasons in floodplains"
                className="w-full h-11 px-4 rounded-lg bg-surface-container-low text-on-surface text-sm focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all border border-transparent shadow-inner"
              />
            </div>
          </div>

          {/* Compensation Matrix */}
          <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 space-y-4">
            <span className="text-xs font-bold text-on-surface uppercase tracking-wider block">
              Compensation & Capacity
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface-variant">Rate Structure</label>
                <select
                  value={salaryType}
                  onChange={(e) => setSalaryType(e.target.value as SalaryType)}
                  className="w-full h-10 px-3 rounded-lg bg-surface-container-lowest text-on-surface text-xs outline-none focus:ring-2 focus:ring-primary border border-transparent cursor-pointer font-medium"
                >
                  {SALARY_TYPES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface-variant">Min Amount (BDT)</label>
                <input
                  type="number"
                  min="0"
                  value={minSalary}
                  onChange={(e) => setMinSalary(e.target.value)}
                  placeholder="e.g. 800"
                  className="w-full h-10 px-3 rounded-lg bg-surface-container-lowest text-on-surface text-xs outline-none focus:ring-2 focus:ring-primary border border-transparent"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface-variant">Max Amount (BDT)</label>
                <input
                  type="number"
                  min="0"
                  value={maxSalary}
                  onChange={(e) => setMaxSalary(e.target.value)}
                  placeholder="e.g. 1200"
                  className="w-full h-10 px-3 rounded-lg bg-surface-container-lowest text-on-surface text-xs outline-none focus:ring-2 focus:ring-primary border border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-outline-variant/20">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface-variant">Open Positions</label>
                <input
                  type="number"
                  min="1"
                  value={positions}
                  onChange={(e) => setPositions(parseInt(e.target.value) || 1)}
                  className="w-full h-10 px-3 rounded-lg bg-surface-container-lowest text-on-surface text-xs outline-none focus:ring-2 focus:ring-primary border border-transparent"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface-variant">Location Summary</label>
                <input
                  type="text"
                  value={locationSummary}
                  onChange={(e) => setLocationSummary(e.target.value)}
                  placeholder="e.g. Zone B (Paddy East)"
                  className="w-full h-10 px-3 rounded-lg bg-surface-container-lowest text-on-surface text-xs outline-none focus:ring-2 focus:ring-primary border border-transparent"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface-variant">Application Deadline</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-surface-container-lowest text-on-surface text-xs outline-none focus:ring-2 focus:ring-primary border border-transparent cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Visibility / Direct Publish */}
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-container-low border border-outline-variant/30">
            <input
              type="checkbox"
              id="pub-now"
              checked={publishImmediately}
              onChange={(e) => setPublishImmediately(e.target.checked)}
              className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer accent-primary"
            />
            <label htmlFor="pub-now" className="text-xs font-bold text-on-surface cursor-pointer">
              Publish Immediately (Broadcast vacancy to Public Marketplace upon creation)
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant/30">
            <Link
              to="/dashboard/jobs"
              className="h-11 px-5 rounded-xl border border-outline-variant/40 hover:bg-surface-container-low text-on-surface font-semibold text-xs transition-colors flex items-center justify-center no-underline"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="h-11 px-6 rounded-xl bg-primary hover:bg-secondary text-on-primary font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60 active:scale-95"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span>
                  <span>Publishing Vacancy...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">publish</span>
                  <span>Publish Requisition</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
