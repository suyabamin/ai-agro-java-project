import { apiClient } from './apiClient';
import type { ApiResponse } from '../types/api';
import type { Field } from '../types/field';
import type {
  FieldAssignment,
  CreateAssignmentPayload,
  ReleaseAssignmentPayload,
  ReassignFarmerPayload,
  AssignmentHistory,
  CursorPage,
} from '../types/assignment';

export const assignmentService = {
  /**
   * List assignments for a specific field. Restricted to active farm members.
   */
  async fetchFieldAssignments(
    farmId: string,
    fieldId: string,
    cursor?: string | null
  ): Promise<ApiResponse<CursorPage<FieldAssignment>>> {
    const response = await apiClient.get<ApiResponse<CursorPage<FieldAssignment>>>(
      `/farms/${encodeURIComponent(farmId)}/fields/${encodeURIComponent(fieldId)}/assignments`, { params: { cursor } }
    );
    return response.data;
  },

  /**
   * List all assignments for an entire farm. Restricted to active farm members.
   */
  async fetchFarmAssignments(farmId: string, cursor?: string | null): Promise<ApiResponse<CursorPage<FieldAssignment>>> {
    const response = await apiClient.get<ApiResponse<CursorPage<FieldAssignment>>>(
      `/farms/${encodeURIComponent(farmId)}/assignments`, { params: { cursor } }
    );
    return response.data;
  },

  /**
   * Assign a farmer to a field. Restricted to OWNER and MANAGER.
   */
  async createAssignment(
    farmId: string,
    fieldId: string,
    payload: CreateAssignmentPayload
  ): Promise<ApiResponse<FieldAssignment>> {
    const response = await apiClient.post<ApiResponse<FieldAssignment>>(
      `/farms/${encodeURIComponent(farmId)}/fields/${encodeURIComponent(fieldId)}/assignments`,
      payload
    );
    return response.data;
  },

  /**
   * Release a farmer from a field. Restricted to OWNER and MANAGER.
   */
  async releaseAssignment(
    farmId: string,
    fieldId: string,
    assignmentId: string,
    payload: ReleaseAssignmentPayload
  ): Promise<ApiResponse<FieldAssignment>> {
    const response = await apiClient.post<ApiResponse<FieldAssignment>>(
      `/farms/${encodeURIComponent(farmId)}/fields/${encodeURIComponent(fieldId)}/assignments/${encodeURIComponent(assignmentId)}/release`,
      payload
    );
    return response.data;
  },

  /**
   * Reassign a field to a new farmer. Restricted to OWNER and MANAGER.
   */
  async reassignFarmer(
    farmId: string,
    fieldId: string,
    assignmentId: string,
    payload: ReassignFarmerPayload
  ): Promise<ApiResponse<FieldAssignment>> {
    const response = await apiClient.post<ApiResponse<FieldAssignment>>(
      `/farms/${encodeURIComponent(farmId)}/fields/${encodeURIComponent(fieldId)}/assignments/${encodeURIComponent(assignmentId)}/reassign`,
      payload
    );
    return response.data;
  },

  /**
   * Fetch audit history for an assignment. Restricted to active farm members.
   */
  async fetchAssignmentHistory(
    farmId: string,
    fieldId: string,
    assignmentId: string,
    cursor?: string | null
  ): Promise<ApiResponse<CursorPage<AssignmentHistory>>> {
    const response = await apiClient.get<ApiResponse<CursorPage<AssignmentHistory>>>(
      `/farms/${encodeURIComponent(farmId)}/fields/${encodeURIComponent(fieldId)}/assignments/${encodeURIComponent(assignmentId)}/history`, { params: { cursor } }
    );
    return response.data;
  },

  /**
   * Farmer Workspace: Fetch currently active assignments for authenticated farmer.
   */
  async fetchMyActiveAssignments(cursor?: string | null): Promise<ApiResponse<CursorPage<FieldAssignment>>> {
    const response = await apiClient.get<ApiResponse<CursorPage<FieldAssignment>>>(
      `/farmers/me/assignments`, { params: { cursor } }
    );
    return response.data;
  },

  /**
   * Farmer Workspace: Fetch assignment history for authenticated farmer.
   */
  async fetchMyAssignmentHistory(cursor?: string | null): Promise<ApiResponse<CursorPage<FieldAssignment>>> {
    const response = await apiClient.get<ApiResponse<CursorPage<FieldAssignment>>>(
      `/farmers/me/assignments/history`, { params: { cursor } }
    );
    return response.data;
  },

  /**
   * Farmer Workspace: Fetch field details for an assigned field. Restricted to assigned farmer.
   */
  async fetchMyAssignedField(fieldId: string): Promise<ApiResponse<Field>> {
    const response = await apiClient.get<ApiResponse<Field>>(
      `/farmers/me/fields/${encodeURIComponent(fieldId)}`
    );
    return response.data;
  },
};
