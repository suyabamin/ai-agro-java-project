export type PaymentStatus = 'RECORDED' | 'REVERSED';
export type PaymentScope = 'FARM' | 'ASSIGNMENT';

export interface PaymentRecord {
  paymentId: string;
  farmId: string;
  assignmentId?: string | null;
  scope: PaymentScope;
  payerUid: string;
  payerName?: string | null;
  farmerUid: string;
  farmerName?: string | null;
  amount: number | string;
  currency: string;
  paymentDate: string;
  purpose: string;
  notes?: string | null;
  status: PaymentStatus;
  createdAt: string;
  createdBy: string;
  reversedAt?: string | null;
  reversedBy?: string | null;
  reversalReason?: string | null;
  version: number;
}

export interface RecordPaymentRequest {
  assignmentId?: string | null;
  farmerUid: string;
  amount: number;
  currency: string;
  paymentDate: string;
  purpose: string;
  notes?: string | null;
}

export interface ReversePaymentRequest {
  reversalReason: string;
}
