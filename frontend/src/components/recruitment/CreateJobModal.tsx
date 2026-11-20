import React, { useState } from 'react';
import { jobService } from '../../services/jobService';
import type { Job, CreateJobPayload, JobCategory, EmploymentType, SalaryType } from '../../types/job';

interface CreateJobModalProps {
  isOpen: boolean;
  farmId: string;
  onClose: () => void;
  onJobCreated: (job: Job) => void;
}

const CATEGORIES: JobCategory[] = [
  'CROP_FARMING',
  'LIVESTOCK',
  'IRRIGATION',
  'HARVESTING',
  'EQUIPMENT_OPERATION',
  'GENERAL_LABOR',
  'AGRONOMY_TECH',
];

const EMPLOYMENT_TYPES: EmploymentType[] = [
  'FULL_TIME',
  'PART_TIME',
  'SEASONAL',
  'DAILY_WAGE',
  'CONTRACT',
];

const SALARY_TYPES: SalaryType[] = [
  'FIXED',
  'HOURLY',
  'DAILY',
  'MONTHLY',
  'PER_HECTARE',
  'NEGOTIABLE',
];

export const CreateJobModal: React.FC<CreateJobModalProps> = ({
  isOpen,
  farmId,
  onClose,
  onJobCreated,
}) => {
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
  const [publishImmediately, setPublishImmediately] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

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
      const res = await jobService.createJob(farmId, payload);
      if (res.data) {
        onJobCreated(res.data);
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create job posting';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '8px',
          padding: '24px',
          width: '100%',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#1B4332' }}>Post New Job Opportunity</h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#6B7280' }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#FEE2E2',
              color: '#991B1B',
              borderRadius: '6px',
              fontSize: '13px',
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
              Job Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Seasonal Rice Harvester"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as JobCategory)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px' }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                Employment Type *
              </label>
              <select
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px' }}
              >
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
              Detailed Description *
            </label>
            <textarea
              required
              rows={4}
              placeholder="Describe roles, daily responsibilities, tools, working conditions..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                Required Skills (comma separated)
              </label>
              <input
                type="text"
                placeholder="Transplanting, Tractor, Irrigation"
                value={skillsStr}
                onChange={(e) => setSkillsStr(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                Open Positions
              </label>
              <input
                type="number"
                min="1"
                max="500"
                value={positions}
                onChange={(e) => setPositions(parseInt(e.target.value) || 1)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
              Experience Requirements
            </label>
            <input
              type="text"
              placeholder="e.g. 2 years experience with harvesting equipment"
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                Salary Type
              </label>
              <select
                value={salaryType}
                onChange={(e) => setSalaryType(e.target.value as SalaryType)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px' }}
              >
                {SALARY_TYPES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                Min Salary (BDT)
              </label>
              <input
                type="number"
                min="0"
                placeholder="500"
                value={minSalary}
                onChange={(e) => setMinSalary(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                Max Salary (BDT)
              </label>
              <input
                type="number"
                min="0"
                placeholder="800"
                value={maxSalary}
                onChange={(e) => setMaxSalary(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                Location Summary
              </label>
              <input
                type="text"
                placeholder="e.g. Gazipur Sadar, Near Highway"
                value={locationSummary}
                onChange={(e) => setLocationSummary(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                Application Deadline
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <input
              type="checkbox"
              id="publishImmediately"
              checked={publishImmediately}
              onChange={(e) => setPublishImmediately(e.target.checked)}
            />
            <label htmlFor="publishImmediately" style={{ fontSize: '13px', color: '#374151', cursor: 'pointer' }}>
              Publish immediately to Public Farmer Marketplace
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '8px 16px',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                backgroundColor: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '8px 18px',
                backgroundColor: '#2D6A4F',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {loading ? 'Creating...' : publishImmediately ? 'Create & Publish' : 'Save as Draft'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
