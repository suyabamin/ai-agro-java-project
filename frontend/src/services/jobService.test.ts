import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jobService } from './jobService';
import { apiClient } from './apiClient';
import type { CreateJobPayload, UpdateJobPayload } from '../types/job';

vi.mock('./apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('JobService Frontend Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetchFarmJobs calls GET /farms/{farmId}/jobs with params', async () => {
    const mockJobs = [
      {
        jobId: 'job-123',
        farmId: 'farm-123',
        title: 'Harvester',
        status: 'PUBLISHED',
      },
    ];
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, data: mockJobs, message: 'Jobs retrieved' },
    });

    const result = await jobService.fetchFarmJobs('farm-123');
    expect(apiClient.get).toHaveBeenCalledWith('/farms/farm-123/jobs', {
      params: { includeUnpublished: true },
    });
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0].jobId).toBe('job-123');
  });

  it('fetchJobById calls GET /farms/{farmId}/jobs/{jobId}', async () => {
    const mockJob = { jobId: 'job-123', farmId: 'farm-123', title: 'Harvester' };
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, data: mockJob, message: 'Job retrieved' },
    });

    const result = await jobService.fetchJobById('farm-123', 'job-123');
    expect(apiClient.get).toHaveBeenCalledWith('/farms/farm-123/jobs/job-123');
    expect(result.data?.title).toBe('Harvester');
  });

  it('createJob calls POST /farms/{farmId}/jobs', async () => {
    const payload: CreateJobPayload = {
      title: 'Harvester',
      description: 'Harvester needed for harvesting season',
      jobCategory: 'CROP_FARMING',
      employmentType: 'SEASONAL',
    };
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { success: true, data: { jobId: 'job-new', ...payload }, message: 'Created' },
    });

    const result = await jobService.createJob('farm-123', payload);
    expect(apiClient.post).toHaveBeenCalledWith('/farms/farm-123/jobs', payload);
    expect(result.data?.jobId).toBe('job-new');
  });

  it('updateJob calls PUT /farms/{farmId}/jobs/{jobId}', async () => {
    const payload: UpdateJobPayload = {
      title: 'Updated Harvester',
      description: 'Updated harvesting description text',
      jobCategory: 'CROP_FARMING',
      employmentType: 'FULL_TIME',
      version: 1,
    };
    vi.mocked(apiClient.put).mockResolvedValueOnce({
      data: { success: true, data: { jobId: 'job-123', ...payload, version: 2 }, message: 'Updated' },
    });

    const result = await jobService.updateJob('farm-123', 'job-123', payload);
    expect(apiClient.put).toHaveBeenCalledWith('/farms/farm-123/jobs/job-123', payload);
    expect(result.data?.version).toBe(2);
  });

  it('publishJob calls POST /farms/{farmId}/jobs/{jobId}/publish', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { success: true, data: { jobId: 'job-123', status: 'PUBLISHED' }, message: 'Published' },
    });

    const result = await jobService.publishJob('farm-123', 'job-123');
    expect(apiClient.post).toHaveBeenCalledWith('/farms/farm-123/jobs/job-123/publish');
    expect(result.data?.status).toBe('PUBLISHED');
  });

  it('pauseJob calls POST /farms/{farmId}/jobs/{jobId}/pause', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { success: true, data: { jobId: 'job-123', status: 'PAUSED' }, message: 'Paused' },
    });

    const result = await jobService.pauseJob('farm-123', 'job-123');
    expect(apiClient.post).toHaveBeenCalledWith('/farms/farm-123/jobs/job-123/pause');
    expect(result.data?.status).toBe('PAUSED');
  });

  it('closeJob calls POST /farms/{farmId}/jobs/{jobId}/close', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { success: true, data: { jobId: 'job-123', status: 'CLOSED' }, message: 'Closed' },
    });

    const result = await jobService.closeJob('farm-123', 'job-123');
    expect(apiClient.post).toHaveBeenCalledWith('/farms/farm-123/jobs/job-123/close');
    expect(result.data?.status).toBe('CLOSED');
  });

  it('archiveJob calls POST /farms/{farmId}/jobs/{jobId}/archive', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { success: true, data: null, message: 'Archived' },
    });

    await jobService.archiveJob('farm-123', 'job-123');
    expect(apiClient.post).toHaveBeenCalledWith('/farms/farm-123/jobs/job-123/archive');
  });

  it('fetchPublicJobs calls GET /public/jobs with query parameters', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, data: [], message: 'Public jobs' },
    });

    await jobService.fetchPublicJobs({ category: 'CROP_FARMING', page: 0, size: 10 });
    expect(apiClient.get).toHaveBeenCalledWith('/public/jobs', {
      params: { category: 'CROP_FARMING', page: 0, size: 10 },
    });
  });

  it('fetchPublicJobById calls GET /public/jobs/{jobId}', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, data: { jobId: 'job-pub-1', title: 'Rice Hand' }, message: 'Job' },
    });

    const result = await jobService.fetchPublicJobById('job-pub-1');
    expect(apiClient.get).toHaveBeenCalledWith('/public/jobs/job-pub-1');
    expect(result.data?.title).toBe('Rice Hand');
  });
});
