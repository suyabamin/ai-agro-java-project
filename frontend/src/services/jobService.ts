import { apiClient } from './apiClient';
import type { ApiResponse } from '../types/api';
import type {
  Job,
  PublicJob,
  CreateJobPayload,
  UpdateJobPayload,
  JobCategory,
  EmploymentType,
} from '../types/job';

export interface PublicJobFilterParams {
  category?: JobCategory;
  employmentType?: EmploymentType;
  district?: string;
  division?: string;
  minSalary?: number;
  maxSalary?: number;
  keyword?: string;
  page?: number;
  size?: number;
}

export const jobService = {
  /**
   * List jobs for a farm. Restricted to active farm members.
   */
  async fetchFarmJobs(farmId: string, includeUnpublished = true): Promise<ApiResponse<Job[]>> {
    const response = await apiClient.get<ApiResponse<Job[]>>(
      `/farms/${encodeURIComponent(farmId)}/jobs`,
      {
        params: { includeUnpublished },
      }
    );
    return response.data;
  },

  /**
   * Get single job by ID under a farm.
   */
  async fetchJobById(farmId: string, jobId: string): Promise<ApiResponse<Job>> {
    const response = await apiClient.get<ApiResponse<Job>>(
      `/farms/${encodeURIComponent(farmId)}/jobs/${encodeURIComponent(jobId)}`
    );
    return response.data;
  },

  /**
   * Create a new job posting. Restricted to OWNER and MANAGER.
   */
  async createJob(farmId: string, payload: CreateJobPayload): Promise<ApiResponse<Job>> {
    const response = await apiClient.post<ApiResponse<Job>>(
      `/farms/${encodeURIComponent(farmId)}/jobs`,
      payload
    );
    return response.data;
  },

  /**
   * Update job details with OCC version check. Restricted to OWNER and MANAGER.
   */
  async updateJob(
    farmId: string,
    jobId: string,
    payload: UpdateJobPayload
  ): Promise<ApiResponse<Job>> {
    const response = await apiClient.put<ApiResponse<Job>>(
      `/farms/${encodeURIComponent(farmId)}/jobs/${encodeURIComponent(jobId)}`,
      payload
    );
    return response.data;
  },

  /**
   * Publish a job posting. Restricted to OWNER and MANAGER.
   */
  async publishJob(farmId: string, jobId: string): Promise<ApiResponse<Job>> {
    const response = await apiClient.post<ApiResponse<Job>>(
      `/farms/${encodeURIComponent(farmId)}/jobs/${encodeURIComponent(jobId)}/publish`
    );
    return response.data;
  },

  /**
   * Pause an active job posting. Restricted to OWNER and MANAGER.
   */
  async pauseJob(farmId: string, jobId: string): Promise<ApiResponse<Job>> {
    const response = await apiClient.post<ApiResponse<Job>>(
      `/farms/${encodeURIComponent(farmId)}/jobs/${encodeURIComponent(jobId)}/pause`
    );
    return response.data;
  },

  /**
   * Close a job posting. Restricted to OWNER and MANAGER.
   */
  async closeJob(farmId: string, jobId: string): Promise<ApiResponse<Job>> {
    const response = await apiClient.post<ApiResponse<Job>>(
      `/farms/${encodeURIComponent(farmId)}/jobs/${encodeURIComponent(jobId)}/close`
    );
    return response.data;
  },

  /**
   * Archive a job posting. Restricted to OWNER ONLY.
   */
  async archiveJob(farmId: string, jobId: string): Promise<ApiResponse<void>> {
    const response = await apiClient.post<ApiResponse<void>>(
      `/farms/${encodeURIComponent(farmId)}/jobs/${encodeURIComponent(jobId)}/archive`
    );
    return response.data;
  },

  /**
   * Browse public job marketplace (Unauthenticated / Public).
   */
  async fetchPublicJobs(params: PublicJobFilterParams = {}): Promise<ApiResponse<PublicJob[]>> {
    const response = await apiClient.get<ApiResponse<PublicJob[]>>('/public/jobs', {
      params,
    });
    return response.data;
  },

  /**
   * View public job posting details.
   */
  async fetchPublicJobById(jobId: string): Promise<ApiResponse<PublicJob>> {
    const response = await apiClient.get<ApiResponse<PublicJob>>(
      `/public/jobs/${encodeURIComponent(jobId)}`
    );
    return response.data;
  },
};
