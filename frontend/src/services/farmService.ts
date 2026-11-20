import { apiClient } from './apiClient';
import type { ApiResponse } from '../types/api';
import type {
  Farm,
  PublicFarm,
  FarmMember,
  CreateFarmPayload,
  UpdateFarmPayload,
  UpdateFarmVisibilityPayload,
  AddFarmMemberPayload,
  UpdateFarmMemberRolePayload,
} from '../types/farm';

export const farmService = {
  /**
   * Register a new farm with the authenticated user as OWNER.
   */
  async createFarm(payload: CreateFarmPayload): Promise<ApiResponse<Farm>> {
    const response = await apiClient.post<ApiResponse<Farm>>('/farms', payload);
    return response.data;
  },

  /**
   * List all farms where the authenticated user is an active member.
   */
  async fetchMyFarms(): Promise<ApiResponse<Farm[]>> {
    const response = await apiClient.get<ApiResponse<Farm[]>>('/farms');
    return response.data;
  },

  /**
   * Get farm details by ID. Restricted to active members.
   */
  async fetchFarmById(farmId: string): Promise<ApiResponse<Farm>> {
    const response = await apiClient.get<ApiResponse<Farm>>(`/farms/${encodeURIComponent(farmId)}`);
    return response.data;
  },

  /**
   * Update farm metadata with optimistic concurrency validation.
   */
  async updateFarm(farmId: string, payload: UpdateFarmPayload): Promise<ApiResponse<Farm>> {
    const response = await apiClient.put<ApiResponse<Farm>>(
      `/farms/${encodeURIComponent(farmId)}`,
      payload
    );
    return response.data;
  },

  /**
   * Update farm visibility (PUBLIC/PRIVATE) and synchronize public projection.
   */
  async updateFarmVisibility(
    farmId: string,
    payload: UpdateFarmVisibilityPayload
  ): Promise<ApiResponse<Farm>> {
    const response = await apiClient.patch<ApiResponse<Farm>>(
      `/farms/${encodeURIComponent(farmId)}/visibility`,
      payload
    );
    return response.data;
  },

  /**
   * Soft-archive a farm and delete public projection.
   */
  async archiveFarm(farmId: string, expectedVersion?: number): Promise<ApiResponse<void>> {
    const params = expectedVersion !== undefined ? { expectedVersion } : undefined;
    const response = await apiClient.post<ApiResponse<void>>(
      `/farms/${encodeURIComponent(farmId)}/archive`,
      null,
      { params }
    );
    return response.data;
  },

  /**
   * List members of a farm. Restricted to active members.
   */
  async fetchFarmMembers(farmId: string): Promise<ApiResponse<FarmMember[]>> {
    const response = await apiClient.get<ApiResponse<FarmMember[]>>(
      `/farms/${encodeURIComponent(farmId)}/members`
    );
    return response.data;
  },

  /**
   * Grant MANAGER or OBSERVER role to an existing user. Restricted to OWNER.
   */
  async addFarmMember(farmId: string, payload: AddFarmMemberPayload): Promise<ApiResponse<FarmMember>> {
    const response = await apiClient.post<ApiResponse<FarmMember>>(
      `/farms/${encodeURIComponent(farmId)}/members`,
      payload
    );
    return response.data;
  },

  /**
   * Update an existing member's role. Restricted to OWNER.
   */
  async updateFarmMemberRole(
    farmId: string,
    userId: string,
    payload: UpdateFarmMemberRolePayload
  ): Promise<ApiResponse<FarmMember>> {
    const response = await apiClient.patch<ApiResponse<FarmMember>>(
      `/farms/${encodeURIComponent(farmId)}/members/${encodeURIComponent(userId)}`,
      payload
    );
    return response.data;
  },

  /**
   * Soft-revoke a farm membership. Restricted to OWNER.
   */
  async removeFarmMember(farmId: string, userId: string): Promise<ApiResponse<void>> {
    const response = await apiClient.delete<ApiResponse<void>>(
      `/farms/${encodeURIComponent(farmId)}/members/${encodeURIComponent(userId)}`
    );
    return response.data;
  },

  /**
   * Public discovery: list public active farm projections.
   */
  async fetchPublicFarms(params?: {
    district?: string;
    division?: string;
    cropType?: string;
    page?: number;
    size?: number;
  }): Promise<ApiResponse<PublicFarm[]>> {
    const response = await apiClient.get<ApiResponse<PublicFarm[]>>('/public/farms', { params });
    return response.data;
  },

  /**
   * Public discovery: get single public farm projection.
   */
  async fetchPublicFarmById(farmId: string): Promise<ApiResponse<PublicFarm>> {
    const response = await apiClient.get<ApiResponse<PublicFarm>>(
      `/public/farms/${encodeURIComponent(farmId)}`
    );
    return response.data;
  },
};
