import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applicationService } from './applicationService';
import { apiClient } from './apiClient';
import type { CreateApplicationPayload, ApplicationDecisionPayload } from '../types/job';

vi.mock('./apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('ApplicationService Frontend Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applyForJob calls POST /jobs/{jobId}/applications', async () => {
    const payload: CreateApplicationPayload = {
      coverLetter: 'Interested in working as paddy harvester',
      experienceYears: 3,
      relevantSkills: ['Paddy Harvesting', 'Machine Operation'],
    };
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { success: true, data: { applicationId: 'app-1', ...payload, status: 'SUBMITTED' }, message: 'Applied' },
    });

    const result = await applicationService.applyForJob('job-123', payload);
    expect(apiClient.post).toHaveBeenCalledWith('/jobs/job-123/applications', payload);
    expect(result.data?.applicationId).toBe('app-1');
    expect(result.data?.status).toBe('SUBMITTED');
  });

  it('getMyApplications calls GET /users/me/applications with pagination', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, data: [], message: 'Applications' },
    });

    await applicationService.getMyApplications(1, 10);
    expect(apiClient.get).toHaveBeenCalledWith('/users/me/applications', {
      params: { page: 1, size: 10 },
    });
  });

  it('getApplicationById calls GET /applications/{applicationId}', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, data: { applicationId: 'app-1', status: 'SUBMITTED' }, message: 'Application' },
    });

    const result = await applicationService.getApplicationById('app-1');
    expect(apiClient.get).toHaveBeenCalledWith('/applications/app-1');
    expect(result.data?.applicationId).toBe('app-1');
  });

  it('withdrawApplication calls POST /applications/{applicationId}/withdraw', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { success: true, data: { applicationId: 'app-1', status: 'WITHDRAWN' }, message: 'Withdrawn' },
    });

    const result = await applicationService.withdrawApplication('app-1');
    expect(apiClient.post).toHaveBeenCalledWith('/applications/app-1/withdraw');
    expect(result.data?.status).toBe('WITHDRAWN');
  });

  it('getFarmApplications calls GET /farms/{farmId}/applications with filters', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, data: [], message: 'Farm applications' },
    });

    await applicationService.getFarmApplications('farm-1', { status: 'SUBMITTED', page: 0, size: 20 });
    expect(apiClient.get).toHaveBeenCalledWith('/farms/farm-1/applications', {
      params: { status: 'SUBMITTED', page: 0, size: 20 },
    });
  });

  it('reviewApplication calls POST /farms/{farmId}/applications/{applicationId}/review', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { success: true, data: { applicationId: 'app-1', status: 'UNDER_REVIEW' }, message: 'Under review' },
    });

    const result = await applicationService.reviewApplication('farm-1', 'app-1');
    expect(apiClient.post).toHaveBeenCalledWith('/farms/farm-1/applications/app-1/review');
    expect(result.data?.status).toBe('UNDER_REVIEW');
  });

  it('shortlistApplication calls POST /farms/{farmId}/applications/{applicationId}/shortlist', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { success: true, data: { applicationId: 'app-1', status: 'SHORTLISTED' }, message: 'Shortlisted' },
    });

    const result = await applicationService.shortlistApplication('farm-1', 'app-1');
    expect(apiClient.post).toHaveBeenCalledWith('/farms/farm-1/applications/app-1/shortlist');
    expect(result.data?.status).toBe('SHORTLISTED');
  });

  it('approveApplication calls POST /farms/{farmId}/applications/{applicationId}/approve', async () => {
    const decision: ApplicationDecisionPayload = { note: 'Approved candidate', version: 2 };
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { success: true, data: { applicationId: 'app-1', status: 'APPROVED' }, message: 'Approved' },
    });

    const result = await applicationService.approveApplication('farm-1', 'app-1', decision);
    expect(apiClient.post).toHaveBeenCalledWith('/farms/farm-1/applications/app-1/approve', decision);
    expect(result.data?.status).toBe('APPROVED');
  });

  it('rejectApplication calls POST /farms/{farmId}/applications/{applicationId}/reject', async () => {
    const decision: ApplicationDecisionPayload = { note: 'Position filled', version: 2 };
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { success: true, data: { applicationId: 'app-1', status: 'REJECTED' }, message: 'Rejected' },
    });

    const result = await applicationService.rejectApplication('farm-1', 'app-1', decision);
    expect(apiClient.post).toHaveBeenCalledWith('/farms/farm-1/applications/app-1/reject', decision);
    expect(result.data?.status).toBe('REJECTED');
  });

  it('getApplicationHistory calls GET /applications/{applicationId}/history', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, data: [], message: 'History' },
    });

    await applicationService.getApplicationHistory('app-1');
    expect(apiClient.get).toHaveBeenCalledWith('/applications/app-1/history');
  });

  it('getApplicationMessages calls GET /applications/{applicationId}/messages', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, data: [], message: 'Messages' },
    });

    await applicationService.getApplicationMessages('app-1');
    expect(apiClient.get).toHaveBeenCalledWith('/applications/app-1/messages');
  });

  it('sendMessage calls POST /applications/{applicationId}/messages', async () => {
    const payload = { message: 'When can I start?' };
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { success: true, data: { messageId: 'm-1', ...payload }, message: 'Sent' },
    });

    const result = await applicationService.sendMessage('app-1', payload);
    expect(apiClient.post).toHaveBeenCalledWith('/applications/app-1/messages', payload);
    expect(result.data?.messageId).toBe('m-1');
  });
});
