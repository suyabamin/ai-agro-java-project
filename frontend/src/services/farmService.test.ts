import { describe, it, expect, vi, beforeEach } from 'vitest';
import { farmService } from './farmService';
import { apiClient } from './apiClient';

vi.mock('./apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('FarmService Frontend Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createFarm calls POST /farms with correct payload', async () => {
    const payload = {
      name: 'Padma Green Valley',
      division: 'Dhaka',
      district: 'Gazipur',
      totalAreaHectares: 12.5,
      visibility: 'PUBLIC' as const,
    };
    const mockResponse = {
      data: {
        success: true,
        data: { farmId: 'farm-12345', ...payload, myRole: 'OWNER', version: 1 },
        message: 'Farm created successfully',
      },
    };
    vi.mocked(apiClient.post).mockResolvedValueOnce(mockResponse);

    const result = await farmService.createFarm(payload);
    expect(apiClient.post).toHaveBeenCalledWith('/farms', payload);
    expect(result.data?.farmId).toBe('farm-12345');
    expect(result.data?.myRole).toBe('OWNER');
  });

  it('fetchMyFarms calls GET /farms', async () => {
    const mockFarms = [
      { farmId: 'farm-1', name: 'Farm A', myRole: 'OWNER' },
      { farmId: 'farm-2', name: 'Farm B', myRole: 'MANAGER' },
    ];
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, data: mockFarms, message: 'Farms retrieved' },
    });

    const result = await farmService.fetchMyFarms();
    expect(apiClient.get).toHaveBeenCalledWith('/farms');
    expect(result.data).toHaveLength(2);
  });

  it('fetchFarmById calls GET /farms/{farmId}', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, data: { farmId: 'farm-xyz', name: 'XYZ Farm' } },
    });

    const result = await farmService.fetchFarmById('farm-xyz');
    expect(apiClient.get).toHaveBeenCalledWith('/farms/farm-xyz');
    expect(result.data?.farmId).toBe('farm-xyz');
  });

  it('updateFarm calls PUT /farms/{farmId} with payload', async () => {
    const updatePayload = {
      name: 'Updated Name',
      division: 'Rajshahi',
      district: 'Bogura',
      totalAreaHectares: 20.0,
      expectedVersion: 1,
    };
    vi.mocked(apiClient.put).mockResolvedValueOnce({
      data: { success: true, data: { farmId: 'farm-1', ...updatePayload, version: 2 } },
    });

    const result = await farmService.updateFarm('farm-1', updatePayload);
    expect(apiClient.put).toHaveBeenCalledWith('/farms/farm-1', updatePayload);
    expect(result.data?.version).toBe(2);
  });

  it('updateFarmVisibility calls PATCH /farms/{farmId}/visibility', async () => {
    vi.mocked(apiClient.patch).mockResolvedValueOnce({
      data: { success: true, data: { farmId: 'farm-1', visibility: 'PUBLIC', version: 2 } },
    });

    const result = await farmService.updateFarmVisibility('farm-1', {
      visibility: 'PUBLIC',
      expectedVersion: 1,
    });
    expect(apiClient.patch).toHaveBeenCalledWith('/farms/farm-1/visibility', {
      visibility: 'PUBLIC',
      expectedVersion: 1,
    });
    expect(result.data?.visibility).toBe('PUBLIC');
  });

  it('archiveFarm calls POST /farms/{farmId}/archive with query params', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { success: true, data: null, message: 'Farm archived' },
    });

    await farmService.archiveFarm('farm-1', 2);
    expect(apiClient.post).toHaveBeenCalledWith('/farms/farm-1/archive', null, {
      params: { expectedVersion: 2 },
    });
  });

  it('fetchFarmMembers calls GET /farms/{farmId}/members', async () => {
    const members = [
      { membershipId: 'farm-1_user-a', userId: 'user-a', role: 'OWNER', status: 'ACTIVE' },
    ];
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, data: members },
    });

    const result = await farmService.fetchFarmMembers('farm-1');
    expect(apiClient.get).toHaveBeenCalledWith('/farms/farm-1/members');
    expect(result.data).toHaveLength(1);
  });

  it('addFarmMember calls POST /farms/{farmId}/members', async () => {
    const memberPayload = { userId: 'user-new', role: 'MANAGER' as const };
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { success: true, data: { membershipId: 'farm-1_user-new', ...memberPayload } },
    });

    const result = await farmService.addFarmMember('farm-1', memberPayload);
    expect(apiClient.post).toHaveBeenCalledWith('/farms/farm-1/members', memberPayload);
    expect(result.data?.userId).toBe('user-new');
  });

  it('updateFarmMemberRole calls PATCH /farms/{farmId}/members/{userId}', async () => {
    vi.mocked(apiClient.patch).mockResolvedValueOnce({
      data: { success: true, data: { userId: 'user-b', role: 'OBSERVER' } },
    });

    const result = await farmService.updateFarmMemberRole('farm-1', 'user-b', { role: 'OBSERVER' });
    expect(apiClient.patch).toHaveBeenCalledWith('/farms/farm-1/members/user-b', { role: 'OBSERVER' });
    expect(result.data?.role).toBe('OBSERVER');
  });

  it('removeFarmMember calls DELETE /farms/{farmId}/members/{userId}', async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce({
      data: { success: true, data: null },
    });

    await farmService.removeFarmMember('farm-1', 'user-b');
    expect(apiClient.delete).toHaveBeenCalledWith('/farms/farm-1/members/user-b');
  });

  it('fetchPublicFarms calls GET /public/farms with filters', async () => {
    const projections = [
      { farmId: 'farm-1', name: 'Green Valley', district: 'Gazipur', division: 'Dhaka' },
    ];
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, data: projections },
    });

    const result = await farmService.fetchPublicFarms({ division: 'Dhaka' });
    expect(apiClient.get).toHaveBeenCalledWith('/public/farms', { params: { division: 'Dhaka' } });
    expect(result.data).toHaveLength(1);
  });

  it('fetchPublicFarmById calls GET /public/farms/{farmId}', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, data: { farmId: 'farm-pub', name: 'Public Farm' } },
    });

    const result = await farmService.fetchPublicFarmById('farm-pub');
    expect(apiClient.get).toHaveBeenCalledWith('/public/farms/farm-pub');
    expect(result.data?.farmId).toBe('farm-pub');
  });
});
