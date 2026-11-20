import { apiClient } from './apiClient';
import type { ApiResponse } from '../types/api';
import type {
  Field,
  CreateFieldPayload,
  UpdateFieldPayload,
} from '../types/field';

export const fieldService = {
  /**
   * List fields for a farm. Restricted to active farm members.
   */
  async fetchFields(farmId: string, includeArchived = false): Promise<ApiResponse<Field[]>> {
    const response = await apiClient.get<ApiResponse<Field[]>>(
      `/farms/${encodeURIComponent(farmId)}/fields`,
      {
        params: { includeArchived },
      }
    );
    return response.data;
  },

  /**
   * Get single field by ID. Restricted to active farm members.
   */
  async fetchFieldById(farmId: string, fieldId: string): Promise<ApiResponse<Field>> {
    const response = await apiClient.get<ApiResponse<Field>>(
      `/farms/${encodeURIComponent(farmId)}/fields/${encodeURIComponent(fieldId)}`
    );
    return response.data;
  },

  /**
   * Create a new field under a farm. Restricted to OWNER and MANAGER.
   */
  async createField(farmId: string, payload: CreateFieldPayload): Promise<ApiResponse<Field>> {
    const response = await apiClient.post<ApiResponse<Field>>(
      `/farms/${encodeURIComponent(farmId)}/fields`,
      payload
    );
    return response.data;
  },

  /**
   * Update field metadata with optimistic concurrency validation. Restricted to OWNER and MANAGER.
   */
  async updateField(
    farmId: string,
    fieldId: string,
    payload: UpdateFieldPayload
  ): Promise<ApiResponse<Field>> {
    const response = await apiClient.put<ApiResponse<Field>>(
      `/farms/${encodeURIComponent(farmId)}/fields/${encodeURIComponent(fieldId)}`,
      payload
    );
    return response.data;
  },

  /**
   * Soft-archive a field. Decrements farm.activeFieldCount. Restricted to OWNER only.
   */
  async archiveField(
    farmId: string,
    fieldId: string,
    expectedVersion?: number
  ): Promise<ApiResponse<void>> {
    const params = expectedVersion !== undefined ? { expectedVersion } : undefined;
    const response = await apiClient.post<ApiResponse<void>>(
      `/farms/${encodeURIComponent(farmId)}/fields/${encodeURIComponent(fieldId)}/archive`,
      null,
      { params }
    );
    return response.data;
  },
};
