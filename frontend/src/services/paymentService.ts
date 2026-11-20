import { apiClient } from './apiClient';
import type { ApiResponse } from '../types/api';
import type {
  PaymentRecord,
  RecordPaymentRequest,
  ReversePaymentRequest,
} from '../types/payment';

export const paymentService = {
  async recordPayment(
    farmId: string,
    request: RecordPaymentRequest
  ): Promise<ApiResponse<PaymentRecord>> {
    const res = await apiClient.post<ApiResponse<PaymentRecord>>(
      `/farms/${farmId}/payments`,
      request
    );
    return res.data;
  },

  async listFarmPayments(
    farmId: string,
    farmerUid?: string,
    limit = 50
  ): Promise<ApiResponse<PaymentRecord[]>> {
    const params = new URLSearchParams();
    if (farmerUid) params.append('farmerUid', farmerUid);
    params.append('limit', limit.toString());
    const res = await apiClient.get<ApiResponse<PaymentRecord[]>>(
      `/farms/${farmId}/payments?${params.toString()}`
    );
    return res.data;
  },

  async listAssignmentPayments(
    assignmentId: string,
    limit = 50
  ): Promise<ApiResponse<PaymentRecord[]>> {
    const res = await apiClient.get<ApiResponse<PaymentRecord[]>>(
      `/assignments/${assignmentId}/payments?limit=${limit}`
    );
    return res.data;
  },

  async listMyPayments(limit = 50): Promise<ApiResponse<PaymentRecord[]>> {
    const res = await apiClient.get<ApiResponse<PaymentRecord[]>>(
      `/payments/my?limit=${limit}`
    );
    return res.data;
  },

  async getPayment(paymentId: string): Promise<ApiResponse<PaymentRecord>> {
    const res = await apiClient.get<ApiResponse<PaymentRecord>>(
      `/payments/${paymentId}`
    );
    return res.data;
  },

  async reversePayment(
    paymentId: string,
    request: ReversePaymentRequest
  ): Promise<ApiResponse<PaymentRecord>> {
    const res = await apiClient.post<ApiResponse<PaymentRecord>>(
      `/payments/${paymentId}/reverse`,
      request
    );
    return res.data;
  },
};
