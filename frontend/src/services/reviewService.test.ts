import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reviewService } from './reviewService';
import { apiClient } from './apiClient';

vi.mock('./apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('ReviewService Frontend Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetchReview calls GET /assignments/{assignmentId}/review', async () => {
    const mockReview = {
      assignmentId: 'asgn-1',
      farmId: 'farm-1',
      fieldId: 'field-1',
      authorUid: 'owner-1',
      farmerUid: 'farmer-1',
      rating: 5,
      comment: 'Excellent harvest work',
      createdAt: '2026-11-19T00:00:00Z',
      updatedAt: '2026-11-19T00:00:00Z',
      revisions: [],
    };
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, data: mockReview, message: 'Retrieved' },
    });

    const result = await reviewService.fetchReview('asgn-1');
    expect(apiClient.get).toHaveBeenCalledWith('/assignments/asgn-1/review');
    expect(result.data?.rating).toBe(5);
    expect(result.data?.comment).toBe('Excellent harvest work');
  });

  it('createReview calls POST /assignments/{assignmentId}/review', async () => {
    const mockReview = {
      assignmentId: 'asgn-1',
      farmId: 'farm-1',
      fieldId: 'field-1',
      authorUid: 'owner-1',
      farmerUid: 'farmer-1',
      rating: 4,
      comment: 'Good upkeep',
      createdAt: '2026-11-19T00:00:00Z',
      updatedAt: '2026-11-19T00:00:00Z',
      revisions: [],
    };
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { success: true, data: mockReview, message: 'Created' },
    });

    const result = await reviewService.createReview('asgn-1', { rating: 4, comment: 'Good upkeep' });
    expect(apiClient.post).toHaveBeenCalledWith('/assignments/asgn-1/review', {
      rating: 4,
      comment: 'Good upkeep',
    });
    expect(result.data?.rating).toBe(4);
  });

  it('updateReview calls PUT /assignments/{assignmentId}/review', async () => {
    const updatedReview = {
      assignmentId: 'asgn-1',
      farmId: 'farm-1',
      fieldId: 'field-1',
      authorUid: 'owner-1',
      farmerUid: 'farmer-1',
      rating: 5,
      comment: 'Revised to 5 stars',
      createdAt: '2026-11-19T00:00:00Z',
      updatedAt: '2026-11-19T01:00:00Z',
      revisions: [
        {
          revisionNumber: 1,
          rating: 4,
          comment: 'Good upkeep',
          editedAt: '2026-11-19T01:00:00Z',
          editedBy: 'owner-1',
        },
      ],
    };
    vi.mocked(apiClient.put).mockResolvedValueOnce({
      data: { success: true, data: updatedReview, message: 'Updated' },
    });

    const result = await reviewService.updateReview('asgn-1', { rating: 5, comment: 'Revised to 5 stars' });
    expect(apiClient.put).toHaveBeenCalledWith('/assignments/asgn-1/review', {
      rating: 5,
      comment: 'Revised to 5 stars',
    });
    expect(result.data?.revisions).toHaveLength(1);
    expect(result.data?.rating).toBe(5);
  });
});
