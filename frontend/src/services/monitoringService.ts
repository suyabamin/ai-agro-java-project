import { apiClient } from './apiClient';
import type { ApiResponse } from '../types/api';

export interface MonitoringPage<T> { items: T[]; nextCursor: string | null; hasNext: boolean; pageSize: number }
export interface MonitoringRecord { [key: string]: unknown; id?: string; status?: string; createdAt?: string }

export function validateCropImageFile(file: File): string | null {
  if (file.size < 1 || file.size > 8 * 1024 * 1024) return 'Choose an image no larger than 8 MiB.';
  const extension = file.name.toLowerCase().split('.').pop();
  const matching = (file.type === 'image/png' && extension === 'png') ||
    (file.type === 'image/jpeg' && (extension === 'jpg' || extension === 'jpeg'));
  return matching ? null : 'Choose a PNG or JPEG file whose extension matches its declared image type.';
}

const root = (farmId: string, fieldId: string) => `/farms/${encodeURIComponent(farmId)}/fields/${encodeURIComponent(fieldId)}/monitoring`;
const farmRoot = (farmId: string) => `/farms/${encodeURIComponent(farmId)}/monitoring`;

export const monitoringService = {
  async latestFarmAgriculturalAnalyses(farmId: string) {
    return (await apiClient.get<ApiResponse<Record<string, MonitoringRecord>>>(`${farmRoot(farmId)}/agricultural-analyses/latest`)).data;
  },
  async latestFarmDiseaseAnalyses(farmId: string) {
    return (await apiClient.get<ApiResponse<Record<string, MonitoringRecord>>>(`${farmRoot(farmId)}/disease-analyses/latest`)).data;
  },
  async latestFarmTelemetry(farmId: string) {
    return (await apiClient.get<ApiResponse<Record<string, MonitoringRecord[]>>>(`${farmRoot(farmId)}/telemetry/latest`)).data;
  },
  async listImages(farmId: string, fieldId: string, cursor?: string | null, size = 25) {
    return (await apiClient.get<ApiResponse<MonitoringPage<MonitoringRecord>>>(`${root(farmId, fieldId)}/images`, {
      params: { cursor: cursor || undefined, size },
    })).data;
  },
  async getImageContent(farmId: string, fieldId: string, imageId: string) {
    return (await apiClient.get<Blob>(`${root(farmId, fieldId)}/images/${encodeURIComponent(imageId)}/content`, { responseType: 'blob' })).data;
  },
  async imageMetadata(farmId: string, fieldId: string, imageId: string) {
    return (await apiClient.get<ApiResponse<MonitoringRecord>>(`${root(farmId, fieldId)}/images/${encodeURIComponent(imageId)}`)).data;
  },
  async uploadImage(farmId: string, fieldId: string, file: File) {
    const form = new FormData(); form.append('file', file);
    return (await apiClient.post<ApiResponse<MonitoringRecord>>(`${root(farmId, fieldId)}/images`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    })).data;
  },
  async deleteImage(farmId: string, fieldId: string, imageId: string) {
    return (await apiClient.delete<ApiResponse<void>>(`${root(farmId, fieldId)}/images/${encodeURIComponent(imageId)}`)).data;
  },
  async analyzeDisease(farmId: string, fieldId: string, imageId: string) {
    return (await apiClient.post<ApiResponse<MonitoringRecord>>(`${root(farmId, fieldId)}/disease-analyses`, null, {
      params: { imageId },
      timeout: 35000,
    })).data;
  },
  async diseaseAvailability(farmId: string, fieldId: string) {
    return (await apiClient.get<ApiResponse<MonitoringRecord>>(`${root(farmId, fieldId)}/disease-availability`)).data;
  },
  async telemetry(farmId: string, fieldId: string) {
    return (await apiClient.get<ApiResponse<MonitoringRecord[]>>(`${root(farmId, fieldId)}/telemetry/latest`)).data;
  },
  async telemetryHistory(farmId: string, fieldId: string, measurementType?: string, cursor?: string, fromEpochMs?: number, toEpochMs?: number) {
    return (await apiClient.get<ApiResponse<MonitoringPage<MonitoringRecord>>>(`${root(farmId, fieldId)}/telemetry`, {
      params: { size: 50, measurementType, cursor, fromEpochMs, toEpochMs },
    })).data;
  },
  async submitTelemetry(farmId: string, fieldId: string, input: object) {
    return (await apiClient.post<ApiResponse<MonitoringRecord>>(`${root(farmId, fieldId)}/telemetry`, input)).data;
  },
  async submitTelemetryBatch(farmId: string, fieldId: string, readings: object[]) {
    return (await apiClient.post<ApiResponse<MonitoringRecord[]>>(`${root(farmId, fieldId)}/telemetry/batch`, { readings })).data;
  },
  async createAnalysis(farmId: string, fieldId: string, asyncMode = false) {
    return (await apiClient.post<ApiResponse<MonitoringRecord>>(`${root(farmId, fieldId)}/agricultural-analyses`, null, {
      params: asyncMode ? { async: true } : undefined,
    })).data;
  },
  async agriculturalAnalysis(farmId: string, fieldId: string, analysisId: string) {
    return (await apiClient.get<ApiResponse<MonitoringRecord>>(`${root(farmId, fieldId)}/agricultural-analyses/${encodeURIComponent(analysisId)}`)).data;
  },
  async listAgriculturalAnalyses(farmId: string, fieldId: string, cursor?: string | null, size = 25) {
    return (await apiClient.get<ApiResponse<MonitoringPage<MonitoringRecord>>>(`${root(farmId, fieldId)}/agricultural-analyses`, {
      params: { cursor: cursor || undefined, size },
    })).data;
  },
  async analyses(farmId: string, fieldId: string, cursor?: string | null, size = 25) {
    return (await apiClient.get<ApiResponse<MonitoringPage<MonitoringRecord>>>(`${root(farmId, fieldId)}/disease-analyses`, {
      params: { cursor: cursor || undefined, size },
    })).data;
  },
  async analysis(farmId: string, fieldId: string, analysisId: string) {
    return (await apiClient.get<ApiResponse<MonitoringRecord>>(`${root(farmId, fieldId)}/disease-analyses/${encodeURIComponent(analysisId)}`)).data;
  },
  async triggerDiseaseResearch(farmId: string, fieldId: string, analysisId: string) {
    return (await apiClient.post<ApiResponse<MonitoringRecord>>(`${root(farmId, fieldId)}/disease-analyses/${encodeURIComponent(analysisId)}/research`)).data;
  },
  async getDiseaseResearch(farmId: string, fieldId: string, analysisId: string) {
    return (await apiClient.get<ApiResponse<MonitoringRecord[]>>(`${root(farmId, fieldId)}/disease-analyses/${encodeURIComponent(analysisId)}/research`)).data;
  },
  async fieldIntelligence(farmId: string, fieldId: string) {
    return (await apiClient.get<ApiResponse<MonitoringRecord>>(`${root(farmId, fieldId)}/intelligence`)).data;
  },
  async createIrrigationPlan(farmId: string, fieldId: string) {
    return (await apiClient.post<ApiResponse<MonitoringRecord>>(`${root(farmId, fieldId)}/irrigation-plans`)).data;
  },
  async irrigationPlans(farmId: string, fieldId: string, cursor?: string | null, size = 25) {
    return (await apiClient.get<ApiResponse<MonitoringPage<MonitoringRecord>>>(`${root(farmId, fieldId)}/irrigation-plans`, {
      params: { cursor: cursor || undefined, size },
    })).data;
  },
  async irrigationPlan(farmId: string, fieldId: string, planId: string) {
    return (await apiClient.get<ApiResponse<MonitoringRecord>>(`${root(farmId, fieldId)}/irrigation-plans/${encodeURIComponent(planId)}`)).data;
  },
  async updatePlanStatus(farmId: string, fieldId: string, planId: string, status: string) {
    return (await apiClient.patch<ApiResponse<MonitoringRecord>>(`${root(farmId, fieldId)}/irrigation-plans/${encodeURIComponent(planId)}/status`, { status })).data;
  },
  async history(farmId: string, fieldId: string, cursor?: string, eventType?: string, fromEpochMs?: number, toEpochMs?: number) {
    return (await apiClient.get<ApiResponse<MonitoringPage<MonitoringRecord>>>(`${root(farmId, fieldId)}/history`, {
      params: { cursor, size: 25, eventType, fromEpochMs, toEpochMs },
    })).data;
  },
  async historyItem(farmId: string, fieldId: string, activityId: string) {
    return (await apiClient.get<ApiResponse<MonitoringRecord>>(`${root(farmId, fieldId)}/history/${encodeURIComponent(activityId)}`)).data;
  },
};
