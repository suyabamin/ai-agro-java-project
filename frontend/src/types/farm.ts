export type FarmRole = 'OWNER' | 'MANAGER' | 'OBSERVER';
export type FarmStatus = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
export type FarmVisibility = 'PUBLIC' | 'PRIVATE';
export type MembershipStatus = 'ACTIVE' | 'REVOKED';

export interface Farm {
  farmId: string;
  name: string;
  description?: string | null;
  ownerUid: string;
  district: string;
  division: string;
  detailedAddress?: string | null;
  totalAreaHectares: number;
  activeFieldCount: number;
  visibility: FarmVisibility;
  status: FarmStatus;
  version: number;
  myRole: FarmRole;
  createdAt: string;
  updatedAt: string;
}

export interface PublicFarm {
  farmId: string;
  name: string;
  district: string;
  division: string;
  totalAreaHectares: number;
  activeFieldCount: number;
  primaryCropTypes?: string[];
  projectionVersion: number;
  updatedAt: string;
}

export interface FarmMember {
  membershipId: string;
  farmId: string;
  userId: string;
  role: FarmRole;
  status: MembershipStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFarmPayload {
  farmId?: string;
  name: string;
  description?: string;
  district: string;
  division: string;
  detailedAddress?: string;
  totalAreaHectares: number;
  visibility: FarmVisibility;
}

export interface UpdateFarmPayload {
  name: string;
  description?: string;
  district: string;
  division: string;
  detailedAddress?: string;
  totalAreaHectares: number;
  expectedVersion: number;
}

export interface UpdateFarmVisibilityPayload {
  visibility: FarmVisibility;
  expectedVersion: number;
}

export interface AddFarmMemberPayload {
  userId: string;
  role: 'MANAGER' | 'OBSERVER';
}

export interface UpdateFarmMemberRolePayload {
  role: 'MANAGER' | 'OBSERVER';
}
