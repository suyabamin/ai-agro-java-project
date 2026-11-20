import React, { useState, useEffect } from 'react';
import { jobService } from '../../services/jobService';
import { applicationService } from '../../services/applicationService';
import { CreateJobModal } from './CreateJobModal';
import { ApplicationDetailModal } from './ApplicationDetailModal';
import type { Job, JobApplication, JobStatus } from '../../types/job';

interface JobManagementSectionProps {
  farmId: string;
  userRole?: string;
}

export const JobManagementSection: React.FC<JobManagementSectionProps> = ({ farmId, userRole }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<JobApplication | null>(null);

  const canManage = userRole === 'OWNER' || userRole === 'MANAGER';
  const isOwner = userRole === 'OWNER';

  useEffect(() => {
    if (farmId) {
      loadJobs();
      loadApplications();
    }
  }, [farmId]);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const res = await jobService.fetchFarmJobs(farmId, true);
      if (res.data) setJobs(res.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load jobs';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const loadApplications = async () => {
    try {
      const res = await applicationService.getFarmApplications(farmId);
      if (res.data) setApplications(res.data);
    } catch (err: unknown) {
      console.warn('Failed to load farm applications:', err);
    }
  };

  const handlePublish = async (jobId: string) => {
    try {
      const res = await jobService.publishJob(farmId, jobId);
      if (res.data) {
        setSuccess('Job published successfully');
        loadJobs();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to publish job');
    }
  };

  const handlePause = async (jobId: string) => {
    try {
      const res = await jobService.pauseJob(farmId, jobId);
      if (res.data) {
        setSuccess('Job paused');
        loadJobs();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to pause job');
    }
  };

  const handleClose = async (jobId: string) => {
    try {
      const res = await jobService.closeJob(farmId, jobId);
      if (res.data) {
        setSuccess('Job closed');
        loadJobs();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to close job');
    }
  };

  const handleArchive = async (jobId: string) => {
    if (!window.confirm('Are you sure you want to archive this job?')) return;
    try {
      await jobService.archiveJob(farmId, jobId);
      setSuccess('Job archived');
      loadJobs();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to archive job');
    }
  };

  const getStatusBadge = (status: JobStatus) => {
    const map: Record<JobStatus, { bg: string; text: string }> = {
      DRAFT: { bg: '#E5E7EB', text: '#374151' },
      PUBLISHED: { bg: '#D1FAE5', text: '#065F46' },
      PAUSED: { bg: '#FEF3C7', text: '#92400E' },
      CLOSED: { bg: '#FEE2E2', text: '#991B1B' },
      ARCHIVED: { bg: '#E5E7EB', text: '#6B7280' },
    };
    const c = map[status] || { bg: '#F3F4F6', text: '#4B5563' };
    return (
      <span
        style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: '10px',
          backgroundColor: c.bg,
          color: c.text,
          fontSize: '11px',
          fontWeight: 700,
        }}
      >
        {status}
      </span>
    );
  };

  const filteredApplications = selectedJobId
    ? applications.filter((a) => a.jobId === selectedJobId)
    : applications;

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '8px',
        border: '1px solid #E5E7EB',
        padding: '24px',
        marginTop: '24px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#1B4332' }}>👥 Labor & Farmer Recruitment</h3>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6B7280' }}>
            Post vacancies, manage recruitment lifecycles, and evaluate candidate applications.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setCreateModalOpen(true)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#2D6A4F',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Post Vacancy
          </button>
        )}
      </div>

      {error && (
        <div style={{ padding: '8px 12px', backgroundColor: '#FEE2E2', color: '#991B1B', borderRadius: '6px', fontSize: '13px', marginBottom: '12px' }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: '8px 12px', backgroundColor: '#D1FAE5', color: '#065F46', borderRadius: '6px', fontSize: '13px', marginBottom: '12px' }}>
          {success}
        </div>
      )}

      {/* Jobs Table */}
      <h4 style={{ margin: '16px 0 8px', fontSize: '14px', color: '#374151' }}>Job Postings ({jobs.length})</h4>
      {loading ? (
        <p style={{ fontSize: '13px', color: '#6B7280' }}>Loading job postings...</p>
      ) : jobs.length === 0 ? (
        <p style={{ fontSize: '13px', color: '#6B7280' }}>No job postings created for this farm yet.</p>
      ) : (
        <div style={{ overflowX: 'auto', marginBottom: '24px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px' }}>Title & Category</th>
                <th style={{ padding: '10px 12px' }}>Type & Positions</th>
                <th style={{ padding: '10px 12px' }}>Salary</th>
                <th style={{ padding: '10px 12px' }}>Status</th>
                <th style={{ padding: '10px 12px' }}>Applications</th>
                {canManage && <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.jobId} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 600, color: '#111827' }}>{job.title}</div>
                    <div style={{ fontSize: '11px', color: '#6B7280' }}>{job.jobCategory}</div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div>{job.employmentType}</div>
                    <div style={{ fontSize: '11px', color: '#6B7280' }}>{job.numberOfPositions} open</div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {job.minimumSalary != null
                      ? `${job.minimumSalary} - ${job.maximumSalary || ''} ${job.currency} (${job.salaryType})`
                      : job.salaryType}
                  </td>
                  <td style={{ padding: '10px 12px' }}>{getStatusBadge(job.status)}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <button
                      onClick={() => setSelectedJobId(selectedJobId === job.jobId ? null : job.jobId)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#2D6A4F',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      {job.totalApplicationsCount || 0} applications
                    </button>
                  </td>
                  {canManage && (
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        {job.status === 'DRAFT' && (
                          <button
                            onClick={() => handlePublish(job.jobId)}
                            style={{ padding: '4px 8px', backgroundColor: '#D1FAE5', color: '#065F46', border: '1px solid #6EE7B7', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Publish
                          </button>
                        )}
                        {job.status === 'PUBLISHED' && (
                          <button
                            onClick={() => handlePause(job.jobId)}
                            style={{ padding: '4px 8px', backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Pause
                          </button>
                        )}
                        {(job.status === 'PUBLISHED' || job.status === 'PAUSED') && (
                          <button
                            onClick={() => handleClose(job.jobId)}
                            style={{ padding: '4px 8px', backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Close
                          </button>
                        )}
                        {isOwner && job.status !== 'ARCHIVED' && (
                          <button
                            onClick={() => handleArchive(job.jobId)}
                            style={{ padding: '4px 8px', backgroundColor: '#E5E7EB', color: '#374151', border: '1px solid #D1D5DB', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Archive
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Received Applications Section */}
      <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h4 style={{ margin: 0, fontSize: '14px', color: '#374151' }}>
            Received Candidate Applications ({filteredApplications.length})
            {selectedJobId && <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#6B7280' }}> (Filtered by job)</span>}
          </h4>
          {selectedJobId && (
            <button
              onClick={() => setSelectedJobId(null)}
              style={{ background: 'none', border: 'none', color: '#2D6A4F', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Show all applications
            </button>
          )}
        </div>

        {filteredApplications.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#6B7280' }}>No applications received yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>Applicant</th>
                  <th style={{ padding: '10px 12px' }}>Experience</th>
                  <th style={{ padding: '10px 12px' }}>Submitted</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredApplications.map((app) => (
                  <tr key={app.applicationId} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600, color: '#111827' }}>{app.applicantName}</div>
                      <div style={{ fontSize: '11px', color: '#6B7280' }}>{app.applicantEmail}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {app.experienceYears != null ? `${app.experienceYears} Years` : '—'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>{new Date(app.submittedAt).toLocaleDateString()}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600 }}>{app.status}</span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <button
                        onClick={() => setSelectedApp(app)}
                        style={{
                          padding: '4px 10px',
                          backgroundColor: '#2D6A4F',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Review Application
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateJobModal
        isOpen={createModalOpen}
        farmId={farmId}
        onClose={() => setCreateModalOpen(false)}
        onJobCreated={(newJob) => {
          setJobs((prev) => [newJob, ...prev]);
          setSuccess('Job posting created successfully!');
        }}
      />

      <ApplicationDetailModal
        isOpen={!!selectedApp}
        farmId={farmId}
        application={selectedApp}
        onClose={() => setSelectedApp(null)}
        onApplicationUpdated={(updated) => {
          setSelectedApp(updated);
          setApplications((prev) => prev.map((a) => (a.applicationId === updated.applicationId ? updated : a)));
        }}
      />
    </div>
  );
};
