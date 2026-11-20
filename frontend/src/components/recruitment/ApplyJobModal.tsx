import React, { useState } from 'react';
import { applicationService } from '../../services/applicationService';
import type { PublicJob, JobApplication, CreateApplicationPayload } from '../../types/job';

interface ApplyJobModalProps {
  isOpen: boolean;
  job: PublicJob | null;
  onClose: () => void;
  onSuccess: (app: JobApplication) => void;
}

export const ApplyJobModal: React.FC<ApplyJobModalProps> = ({
  isOpen,
  job,
  onClose,
  onSuccess,
}) => {
  const [coverLetter, setCoverLetter] = useState('');
  const [experienceYears, setExperienceYears] = useState<string>('');
  const [relevantSkills, setRelevantSkills] = useState('');
  const [expectedSalary, setExpectedSalary] = useState<string>('');
  const [earliestStartDate, setEarliestStartDate] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !job) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const skills = relevantSkills
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const payload: CreateApplicationPayload = {
      coverLetter: coverLetter.trim() || undefined,
      experienceYears: experienceYears ? parseInt(experienceYears, 10) : undefined,
      relevantSkills: skills.length > 0 ? skills : undefined,
      expectedSalary: expectedSalary ? parseFloat(expectedSalary) : undefined,
      earliestStartDate: earliestStartDate ? new Date(earliestStartDate).toISOString() : undefined,
    };

    setLoading(true);
    try {
      const res = await applicationService.applyForJob(job.jobId, payload);
      if (res.data) {
        onSuccess(res.data);
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit application';
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
          maxWidth: '540px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#1B4332' }}>Apply for Position</h3>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6B7280' }}>
              <strong>{job.title}</strong> at {job.farmName}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#6B7280' }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div style={{ padding: '8px 12px', backgroundColor: '#FEE2E2', color: '#991B1B', borderRadius: '6px', fontSize: '13px', marginBottom: '14px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
              Cover Letter / Introduction
            </label>
            <textarea
              rows={4}
              placeholder="Introduce yourself, your farming experience, and availability..."
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                Years of Experience
              </label>
              <input
                type="number"
                min="0"
                max="50"
                placeholder="e.g. 3"
                value={experienceYears}
                onChange={(e) => setExperienceYears(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '13px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                Expected Salary ({job.currency})
              </label>
              <input
                type="number"
                min="0"
                placeholder={job.minimumSalary ? String(job.minimumSalary) : 'Negotiable'}
                value={expectedSalary}
                onChange={(e) => setExpectedSalary(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '13px' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
              Your Relevant Skills (comma separated)
            </label>
            <input
              type="text"
              placeholder="Paddy Harvesting, Tractor Operation, Irrigation"
              value={relevantSkills}
              onChange={(e) => setRelevantSkills(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '13px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
              Earliest Available Start Date
            </label>
            <input
              type="date"
              value={earliestStartDate}
              onChange={(e) => setEarliestStartDate(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
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
              {loading ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
