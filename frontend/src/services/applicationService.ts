import { apiClient } from './apiClient';
import type { ApiResponse } from '../types/api';
import type {
  JobApplication,
  ApplicationHistory,
  ApplicationMessage,
  CreateApplicationPayload,
  ApplicationDecisionPayload,
  SendMessagePayload,
  ApplicationStatus,
} from '../types/job';

export interface FarmApplicationFilterParams {
  jobId?: string;
  status?: ApplicationStatus;
  page?: number;
  size?: number;
}

export const applicationService = {
  /**
   * Submit application for a published job.
   */
  async applyForJob(
    jobId: string,
    payload: CreateApplicationPayload
  ): Promise<ApiResponse<JobApplication>> {
    const response = await apiClient.post<ApiResponse<JobApplication>>(
      `/jobs/${encodeURIComponent(jobId)}/applications`,
      payload
    );
    return response.data;
  },

  /**
   * List current user's submitted applications.
   */
  async getMyApplications(page = 0, size = 20): Promise<ApiResponse<JobApplication[]>> {
    const response = await apiClient.get<ApiResponse<JobApplication[]>>('/users/me/applications', {
      params: { page, size },
    });
    return response.data;
  },

  /**
   * Get single application details.
   */
  async getApplicationById(applicationId: string): Promise<ApiResponse<JobApplication>> {
    const response = await apiClient.get<ApiResponse<JobApplication>>(
      `/applications/${encodeURIComponent(applicationId)}`
    );
    return response.data;
  },

  /**
   * Candidate withdraws application.
   */
  async withdrawApplication(applicationId: string): Promise<ApiResponse<JobApplication>> {
    const response = await apiClient.post<ApiResponse<JobApplication>>(
      `/applications/${encodeURIComponent(applicationId)}/withdraw`
    );
    return response.data;
  },

  /**
   * Farm management lists applications received for the farm.
   */
  async getFarmApplications(
    farmId: string,
    params: FarmApplicationFilterParams = {}
  ): Promise<ApiResponse<JobApplication[]>> {
    const response = await apiClient.get<ApiResponse<JobApplication[]>>(
      `/farms/${encodeURIComponent(farmId)}/applications`,
      { params }
    );
    return response.data;
  },

  /**
   * Farm manager moves application to UNDER_REVIEW.
   */
  async reviewApplication(
    farmId: string,
    applicationId: string
  ): Promise<ApiResponse<JobApplication>> {
    const response = await apiClient.post<ApiResponse<JobApplication>>(
      `/farms/${encodeURIComponent(farmId)}/applications/${encodeURIComponent(applicationId)}/review`
    );
    return response.data;
  },

  /**
   * Farm manager shortlists application.
   */
  async shortlistApplication(
    farmId: string,
    applicationId: string
  ): Promise<ApiResponse<JobApplication>> {
    const response = await apiClient.post<ApiResponse<JobApplication>>(
      `/farms/${encodeURIComponent(farmId)}/applications/${encodeURIComponent(applicationId)}/shortlist`
    );
    return response.data;
  },

  /**
   * Farm manager approves application.
   * NOTE: Application approval DOES NOT create field assignments.
   */
  async approveApplication(
    farmId: string,
    applicationId: string,
    payload: ApplicationDecisionPayload
  ): Promise<ApiResponse<JobApplication>> {
    const response = await apiClient.post<ApiResponse<JobApplication>>(
      `/farms/${encodeURIComponent(farmId)}/applications/${encodeURIComponent(applicationId)}/approve`,
      payload
    );
    return response.data;
  },

  /**
   * Farm manager rejects application.
   */
  async rejectApplication(
    farmId: string,
    applicationId: string,
    payload: ApplicationDecisionPayload
  ): Promise<ApiResponse<JobApplication>> {
    const response = await apiClient.post<ApiResponse<JobApplication>>(
      `/farms/${encodeURIComponent(farmId)}/applications/${encodeURIComponent(applicationId)}/reject`,
      payload
    );
    return response.data;
  },

  /**
   * Get immutable audit history for an application.
   */
  async getApplicationHistory(
    applicationId: string
  ): Promise<ApiResponse<ApplicationHistory[]>> {
    const response = await apiClient.get<ApiResponse<ApplicationHistory[]>>(
      `/applications/${encodeURIComponent(applicationId)}/history`
    );
    return response.data;
  },

  /**
   * Get private discussion thread messages for an application.
   */
  async getApplicationMessages(
    applicationId: string
  ): Promise<ApiResponse<ApplicationMessage[]>> {
    const response = await apiClient.get<ApiResponse<ApplicationMessage[]>>(
      `/applications/${encodeURIComponent(applicationId)}/messages`
    );
    return response.data;
  },

  /**
   * Send a private message in the application communication thread.
   */
  async sendMessage(
    applicationId: string,
    payload: SendMessagePayload
  ): Promise<ApiResponse<ApplicationMessage>> {
    const response = await apiClient.post<ApiResponse<ApplicationMessage>>(
      `/applications/${encodeURIComponent(applicationId)}/messages`,
      payload
    );
    return response.data;
  },
};
