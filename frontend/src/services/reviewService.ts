import { apiClient } from './apiClient';
import type { ApiResponse } from '../types/api';
import type {
  AssignmentReview,
  CreateAssignmentReviewRequest,
  UpdateAssignmentReviewRequest,
} from '../types/review';

export const reviewService = {
  async fetchReview(assignmentId: string): Promise<ApiResponse<AssignmentReview>> {
    const res = await apiClient.get<ApiResponse<AssignmentReview>>(
      `/assignments/${assignmentId}/review`
    );
    return res.data;
  },

  async createReview(
    assignmentId: string,
    request: CreateAssignmentReviewRequest
  ): Promise<ApiResponse<AssignmentReview>> {
    const res = await apiClient.post<ApiResponse<AssignmentReview>>(
      `/assignments/${assignmentId}/review`,
      request
    );
    return res.data;
  },

  async updateReview(
    assignmentId: string,
    request: UpdateAssignmentReviewRequest
  ): Promise<ApiResponse<AssignmentReview>> {
    const res = await apiClient.put<ApiResponse<AssignmentReview>>(
      `/assignments/${assignmentId}/review`,
      request
    );
    return res.data;
  },
};
