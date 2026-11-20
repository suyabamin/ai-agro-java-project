import { describe, it, expect, vi, beforeEach } from 'vitest';
import { paymentService } from './paymentService';
import { apiClient } from './apiClient';

vi.mock('./apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('PaymentService Frontend Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('recordPayment calls POST /farms/{farmId}/payments', async () => {
    const mockPayment = {
      paymentId: 'pay-1',
      farmId: 'farm-1',
      scope: 'FARM' as const,
      payerUid: 'owner-1',
      farmerUid: 'farmer-1',
      amount: 5000,
      currency: 'BDT',
      paymentDate: '2026-11-19T00:00:00Z',
      purpose: 'Field clearing',
      status: 'RECORDED' as const,
      createdAt: '2026-11-19T00:00:00Z',
      createdBy: 'owner-1',
      version: 1,
    };
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { success: true, data: mockPayment, message: 'Recorded' },
    });

    const result = await paymentService.recordPayment('farm-1', {
      farmerUid: 'farmer-1',
      amount: 5000,
      currency: 'BDT',
      paymentDate: '2026-11-19T00:00:00Z',
      purpose: 'Field clearing',
    });

    expect(apiClient.post).toHaveBeenCalledWith('/farms/farm-1/payments', {
      farmerUid: 'farmer-1',
      amount: 5000,
      currency: 'BDT',
      paymentDate: '2026-11-19T00:00:00Z',
      purpose: 'Field clearing',
    });
    expect(result.data?.amount).toBe(5000);
    expect(result.data?.currency).toBe('BDT');
  });

  it('listFarmPayments calls GET /farms/{farmId}/payments', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, data: [], message: 'Retrieved' },
    });

    const result = await paymentService.listFarmPayments('farm-1', 'farmer-1', 25);
    expect(apiClient.get).toHaveBeenCalledWith('/farms/farm-1/payments?farmerUid=farmer-1&limit=25');
    expect(result.success).toBe(true);
  });

  it('reversePayment calls POST /payments/{paymentId}/reverse', async () => {
    const reversedPayment = {
      paymentId: 'pay-1',
      farmId: 'farm-1',
      scope: 'FARM' as const,
      payerUid: 'owner-1',
      farmerUid: 'farmer-1',
      amount: 5000,
      currency: 'BDT',
      paymentDate: '2026-11-19T00:00:00Z',
      purpose: 'Field clearing',
      status: 'REVERSED' as const,
      createdAt: '2026-11-19T00:00:00Z',
      createdBy: 'owner-1',
      reversedAt: '2026-11-19T01:00:00Z',
      reversedBy: 'owner-1',
      reversalReason: 'Duplicate entry',
      version: 2,
    };
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { success: true, data: reversedPayment, message: 'Reversed' },
    });

    const result = await paymentService.reversePayment('pay-1', { reversalReason: 'Duplicate entry' });
    expect(apiClient.post).toHaveBeenCalledWith('/payments/pay-1/reverse', {
      reversalReason: 'Duplicate entry',
    });
    expect(result.data?.status).toBe('REVERSED');
    expect(result.data?.reversalReason).toBe('Duplicate entry');
  });
});
