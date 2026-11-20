import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './apiClient';
import { monitoringService, validateCropImageFile } from './monitoringService';

vi.mock('./apiClient', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));

describe('monitoringService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses encoded farm and field path segments for telemetry reads', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { success: true, data: [] } });
    await monitoringService.telemetry('farm / one', 'field #2');
    expect(apiClient.get).toHaveBeenCalledWith('/farms/farm%20%2F%20one/fields/field%20%232/monitoring/telemetry/latest');
  });

  it('uploads a selected image as multipart form data', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { success: true, data: { imageId: 'image-1' } } });
    const file = new File(['image bytes'], 'leaf.png', { type: 'image/png' });
    await monitoringService.uploadImage('farm-1', 'field-1', file);
    const [url, body, config] = vi.mocked(apiClient.post).mock.calls[0];
    expect(url).toBe('/farms/farm-1/fields/field-1/monitoring/images');
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('file')).toBe(file);
    expect(config?.headers).toEqual({ 'Content-Type': 'multipart/form-data' });
  });

  it('requests disease analysis by image ID without inventing a result client side', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { success: true, data: { status: 'MODEL_UNAVAILABLE' } } });
    const response = await monitoringService.analyzeDisease('farm-1', 'field-1', 'image-1');
    expect(apiClient.post).toHaveBeenCalledWith('/farms/farm-1/fields/field-1/monitoring/disease-analyses', null, { params: { imageId: 'image-1' } });
    expect(response.data?.status).toBe('MODEL_UNAVAILABLE');
  });

  it('queries model availability only through the authenticated backend API', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { success: true, data: { status: 'MODEL_UNAVAILABLE', available: false } } });
    const response = await monitoringService.diseaseAvailability('farm-1', 'field-1');
    expect(apiClient.get).toHaveBeenCalledWith('/farms/farm-1/fields/field-1/monitoring/disease-availability');
    expect(response.data?.status).toBe('MODEL_UNAVAILABLE');
  });

  it.each([
    ['images', monitoringService.listImages, '/images'],
    ['analyses', monitoringService.analyses, '/disease-analyses'],
    ['irrigation plans', monitoringService.irrigationPlans, '/irrigation-plans'],
  ] as const)('requests a bounded cursor page for %s', async (_name, method, suffix) => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { success: true, data: { items: [], nextCursor: 'next-1', hasNext: true, pageSize: 10 } } });
    const response = await method('farm-1', 'field-1', 'cursor-1', 10);
    expect(apiClient.get).toHaveBeenCalledWith(`/farms/farm-1/fields/field-1/monitoring${suffix}`, {
      params: { cursor: 'cursor-1', size: 10 },
    });
    expect(response.data?.nextCursor).toBe('next-1');
    expect(response.data?.hasNext).toBe(true);
  });

  it('submits telemetry through the field monitoring API', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { success: true, data: { telemetryId: 't-1' } } });
    const record = { measurementType: 'SOIL_MOISTURE', value: 42, unit: '%', observedAt: '2026-11-18T00:00:00Z', source: 'MANUAL' };
    await monitoringService.submitTelemetry('farm-1', 'field-1', record);
    expect(apiClient.post).toHaveBeenCalledWith('/farms/farm-1/fields/field-1/monitoring/telemetry', record);
  });

  it('rejects mismatched or unsupported image declarations before upload', () => {
    expect(validateCropImageFile(new File(['bytes'], 'leaf.gif', { type: 'image/gif' }))).toContain('PNG or JPEG');
    expect(validateCropImageFile(new File(['bytes'], 'leaf.png', { type: 'image/jpeg' }))).toContain('extension matches');
    expect(validateCropImageFile(new File(['bytes'], 'leaf.jpg', { type: 'image/jpeg' }))).toBeNull();
  });

  it('rejects files over the upload size limit', () => {
    const oversized = new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' });
    expect(validateCropImageFile(oversized)).toContain('8 MiB');
  });
});
