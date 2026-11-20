export type AssignmentStatus = 'ACTIVE' | 'RELEASED' | 'COMPLETED' | 'TERMINATED';

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasNext: boolean;
  pageSize: number;
}

export interface FieldAssignment {
  assignmentId: string;
  farmId: string;
  fieldId: string;
  farmerUid: string;
  farmerSafeUid?: string;
  farmerName?: string | null;
  status: AssignmentStatus;
  permissions: string[];
  assignedByUid: string;
  sourceApplicationId?: string | null;
  sourceJobId?: string | null;
  assignedAt: string;
  updatedAt: string;
  releasedAt?: string | null;
  releasedByUid?: string | null;
  releaseReason?: string | null;
  version: number;
}

export interface CreateAssignmentPayload {
  farmerUid: string;
  permissions?: string[];
  sourceApplicationId?: string | null;
  sourceJobId?: string | null;
}

export interface ReleaseAssignmentPayload {
  releaseReason?: string | null;
  expectedVersion?: number;
}

export interface ReassignFarmerPayload {
  newFarmerUid: string;
  releaseReason: string;
  permissions?: string[];
  expectedVersion?: number;
  sourceApplicationId?: string | null;
}

export interface AssignmentHistory {
  historyId: string;
  assignmentId: string;
  farmId: string;
  fieldId: string;
  farmerUid: string;
  farmerName?: string | null;
  eventType: 'ASSIGNED' | 'RELEASED' | 'REASSIGNED' | string;
  performedByUid: string;
  performedByRole: string;
  reason?: string | null;
  sourceApplicationId?: string | null;
  timestamp: string;
}
