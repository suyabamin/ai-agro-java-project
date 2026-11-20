import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assignmentService } from './assignmentService';
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

describe('AssignmentService Frontend Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('[ASGN-FE-01] fetchFieldAssignments calls GET /farms/{farmId}/fields/{fieldId}/assignments', async () => {
    const mockAssignments = [
      {
        assignmentId: 'asgn_fld_farm-1--fld-1::uid_abc',
        farmId: 'farm-1',
        fieldId: 'farm-1--fld-1',
        farmerUid: 'farmer-101',
        status: 'ACTIVE',
        permissions: ['READ', 'WRITE_LOGS'],
        version: 1,
      },
    ];
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, data: { items: mockAssignments, nextCursor: 'cursor-1', hasNext: false, pageSize: 25 }, message: 'Retrieved' },
    });

    const result = await assignmentService.fetchFieldAssignments('farm-1', 'farm-1--fld-1');
    expect(apiClient.get).toHaveBeenCalledWith('/farms/farm-1/fields/farm-1--fld-1/assignments', { params: { cursor: undefined } });
    expect(result.data?.items).toHaveLength(1);
    expect(result.data?.items[0].farmerUid).toBe('farmer-101');
  });

  it('[ASGN-FE-02] fetchFarmAssignments calls GET /farms/{farmId}/assignments', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, data: { items: [], nextCursor: null, hasNext: false, pageSize: 25 }, message: 'Retrieved' },
    });

    const result = await assignmentService.fetchFarmAssignments('farm-1');
    expect(apiClient.get).toHaveBeenCalledWith('/farms/farm-1/assignments', { params: { cursor: undefined } });
    expect(result.success).toBe(true);
  });

  it('[ASGN-FE-03] createAssignment calls POST with valid payload', async () => {
    const payload = {
      farmerUid: 'farmer-202',
      permissions: ['READ'],
    };
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        success: true,
        data: { assignmentId: 'asgn_1', status: 'ACTIVE', farmerUid: 'farmer-202' },
        message: 'Created',
      },
    });

    const result = await assignmentService.createAssignment('farm-1', 'farm-1--plot-1', payload);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/farms/farm-1/fields/farm-1--plot-1/assignments',
      payload
    );
    expect(result.data?.status).toBe('ACTIVE');
  });

  it('[ASGN-FE-04] releaseAssignment calls POST .../release with releaseReason', async () => {
    const payload = {
      releaseReason: 'Shift completed',
      expectedVersion: 1,
    };
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        success: true,
        data: { assignmentId: 'asgn_1', status: 'RELEASED', releaseReason: 'Shift completed' },
        message: 'Released',
      },
    });

    const result = await assignmentService.releaseAssignment('farm-1', 'farm-1--plot-1', 'asgn_1', payload);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/farms/farm-1/fields/farm-1--plot-1/assignments/asgn_1/release',
      payload
    );
    expect(result.data?.status).toBe('RELEASED');
  });

  it('[ASGN-FE-05] reassignFarmer calls POST .../reassign with new farmer payload', async () => {
    const payload = {
      newFarmerUid: 'farmer-303',
      releaseReason: 'Skill transfer',
      expectedVersion: 1,
    };
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        success: true,
        data: { assignmentId: 'asgn_2', status: 'ACTIVE', farmerUid: 'farmer-303' },
        message: 'Reassigned',
      },
    });

    const result = await assignmentService.reassignFarmer('farm-1', 'farm-1--plot-1', 'asgn_1', payload);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/farms/farm-1/fields/farm-1--plot-1/assignments/asgn_1/reassign',
      payload
    );
    expect(result.data?.farmerUid).toBe('farmer-303');
  });

  it('[ASGN-FE-06] fetchAssignmentHistory calls GET .../history', async () => {
    const mockHistory = [
      {
        historyId: 'hist-1',
        eventType: 'ASSIGNED',
        farmerUid: 'farmer-101',
      },
    ];
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, data: { items: mockHistory, nextCursor: null, hasNext: false, pageSize: 25 }, message: 'History retrieved' },
    });

    const result = await assignmentService.fetchAssignmentHistory('farm-1', 'farm-1--plot-1', 'asgn_1');
    expect(apiClient.get).toHaveBeenCalledWith(
      '/farms/farm-1/fields/farm-1--plot-1/assignments/asgn_1/history', { params: { cursor: undefined } }
    );
    expect(result.data?.items).toHaveLength(1);
    expect(result.data?.items[0].eventType).toBe('ASSIGNED');
  });

  it('[ASGN-FE-07] fetchMyActiveAssignments calls GET /farmers/me/assignments', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, data: { items: [], nextCursor: null, hasNext: false, pageSize: 25 }, message: 'Retrieved' },
    });

    const result = await assignmentService.fetchMyActiveAssignments();
    expect(apiClient.get).toHaveBeenCalledWith('/farmers/me/assignments', { params: { cursor: undefined } });
    expect(result.success).toBe(true);
  });

  it('[ASGN-FE-08] fetchMyAssignedField calls GET /farmers/me/fields/{fieldId}', async () => {
    const mockField = {
      fieldId: 'farm-1--plot-1',
      name: 'North Plot',
      status: 'ACTIVE',
    };
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, data: mockField, message: 'Retrieved' },
    });

    const result = await assignmentService.fetchMyAssignedField('farm-1--plot-1');
    expect(apiClient.get).toHaveBeenCalledWith('/farmers/me/fields/farm-1--plot-1');
    expect(result.data?.fieldId).toBe('farm-1--plot-1');
  });
});
