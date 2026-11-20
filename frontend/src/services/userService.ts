import { apiClient } from './apiClient';
import type { ApiResponse, UserProfile, PublicProfile, InitializeProfilePayload, UpdateProfilePayload } from '../types/api';

export const userService = {
  /**
   * Strictly read-only fetch of current authenticated user profile.
   * Never silently performs writes.
   */
  async getMe(): Promise<ApiResponse<UserProfile>> {
    const response = await apiClient.get<ApiResponse<UserProfile>>('/users/me');
    return response.data;
  },

  /**
   * Idempotent initialization of user profile.
   * UID and email are derived on server from verified Firebase ID token claims.
   */
  async initializeProfile(payload: InitializeProfilePayload): Promise<ApiResponse<UserProfile>> {
    const response = await apiClient.post<ApiResponse<UserProfile>>('/users/me/initialize', payload);
    return response.data;
  },

  /**
   * Concurrency-safe profile update.
   * Requires expectedVersion; returns 409 Conflict if stale.
   */
  async updateProfile(payload: UpdateProfilePayload): Promise<ApiResponse<UserProfile>> {
    const response = await apiClient.put<ApiResponse<UserProfile>>('/users/me', payload);
    return response.data;
  },

  /**
   * Dedicated transactional reconciliation endpoint.
   */
  async reconcileProfile(): Promise<ApiResponse<UserProfile>> {
    const response = await apiClient.post<ApiResponse<UserProfile>>('/users/me/reconcile');
    return response.data;
  },

  /**
   * Public directory profile fetch.
   */
  async getPublicProfile(uid: string): Promise<ApiResponse<PublicProfile>> {
    const response = await apiClient.get<ApiResponse<PublicProfile>>(`/users/${encodeURIComponent(uid)}/public`);
    return response.data;
  },
};
