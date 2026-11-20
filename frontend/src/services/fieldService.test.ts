import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fieldService } from './fieldService';
import { apiClient } from './apiClient';
import type { CreateFieldPayload, UpdateFieldPayload } from '../types/field';

vi.mock('./apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('FieldService Frontend Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetchFields calls GET /farms/{farmId}/fields with includeArchived=false default', async () => {
    const mockFields = [
      {
        fieldId: 'farm-123--plot-01',
        localFieldId: 'plot-01',
        farmId: 'farm-123',
        name: 'North Paddy',
        cropType: 'RICE',
        areaHectares: 2.5,
        status: 'ACTIVE',
        version: 1,
      },
    ];
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, data: mockFields, message: 'Fields retrieved' },
    });

    const result = await fieldService.fetchFields('farm-123');
    expect(apiClient.get).toHaveBeenCalledWith('/farms/farm-123/fields', {
      params: { includeArchived: false },
    });
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0].fieldId).toBe('farm-123--plot-01');
  });

  it('fetchFields calls GET with includeArchived=true when specified', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, data: [], message: 'Fields retrieved' },
    });

    await fieldService.fetchFields('farm-123', true);
    expect(apiClient.get).toHaveBeenCalledWith('/farms/farm-123/fields', {
      params: { includeArchived: true },
    });
  });

  it('fetchFieldById calls GET /farms/{farmId}/fields/{fieldId}', async () => {
    const mockField = {
      fieldId: 'farm-123--plot-01',
      localFieldId: 'plot-01',
      farmId: 'farm-123',
      name: 'North Paddy',
      cropType: 'RICE',
      areaHectares: 2.5,
      status: 'ACTIVE',
      version: 1,
    };
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, data: mockField, message: 'Field found' },
    });

    const result = await fieldService.fetchFieldById('farm-123', 'farm-123--plot-01');
    expect(apiClient.get).toHaveBeenCalledWith(
      '/farms/farm-123/fields/farm-123--plot-01'
    );
    expect(result.data?.name).toBe('North Paddy');
  });

  it('createField calls POST /farms/{farmId}/fields with payload', async () => {
    const payload: CreateFieldPayload = {
      localFieldId: 'plot-02',
      name: 'South Maize Plot',
      cropType: 'MAIZE',
      soilType: 'LOAMY',
      irrigationType: 'DRIP',
      areaHectares: 3.0,
      status: 'ACTIVE',
      notes: 'Initial planting',
    };
    const mockCreated = {
      fieldId: 'farm-123--plot-02',
      farmId: 'farm-123',
      ...payload,
      version: 1,
      createdAt: '2026-11-17T12:00:00Z',
      updatedAt: '2026-11-17T12:00:00Z',
    };
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { success: true, data: mockCreated, message: 'Field created' },
    });

    const result = await fieldService.createField('farm-123', payload);
    expect(apiClient.post).toHaveBeenCalledWith('/farms/farm-123/fields', payload);
    expect(result.data?.fieldId).toBe('farm-123--plot-02');
    expect(result.data?.version).toBe(1);
  });

  it('updateField calls PUT /farms/{farmId}/fields/{fieldId} with payload', async () => {
    const updatePayload: UpdateFieldPayload = {
      name: 'Updated North Paddy',
      cropType: 'WHEAT',
      soilType: 'CLAY',
      irrigationType: 'CANAL',
      areaHectares: 2.8,
      status: 'ACTIVE',
      expectedVersion: 1,
    };
    const mockUpdated = {
      fieldId: 'farm-123--plot-01',
      farmId: 'farm-123',
      localFieldId: 'plot-01',
      ...updatePayload,
      version: 2,
    };
    vi.mocked(apiClient.put).mockResolvedValueOnce({
      data: { success: true, data: mockUpdated, message: 'Field updated' },
    });

    const result = await fieldService.updateField(
      'farm-123',
      'farm-123--plot-01',
      updatePayload
    );
    expect(apiClient.put).toHaveBeenCalledWith(
      '/farms/farm-123/fields/farm-123--plot-01',
      updatePayload
    );
    expect(result.data?.version).toBe(2);
  });

  it('archiveField calls POST /farms/{farmId}/fields/{fieldId}/archive with version parameter', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { success: true, message: 'Field archived' },
    });

    const result = await fieldService.archiveField(
      'farm-123',
      'farm-123--plot-01',
      2
    );
    expect(apiClient.post).toHaveBeenCalledWith(
      '/farms/farm-123/fields/farm-123--plot-01/archive',
      null,
      { params: { expectedVersion: 2 } }
    );
    expect(result.success).toBe(true);
  });

  it('archiveField calls archive endpoint without version when omitted', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { success: true, message: 'Field archived' },
    });

    await fieldService.archiveField('farm-123', 'farm-123--plot-01');
    expect(apiClient.post).toHaveBeenCalledWith(
      '/farms/farm-123/fields/farm-123--plot-01/archive',
      null,
      { params: undefined }
    );
  });
});
