export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  message: string;
  requestId: string;
  timestamp: string;
}

export interface BackendHealthData {
  status: string;
  service: string;
  version: string;
}

export interface FirebaseHealthData {
  status: string;
  configured: boolean;
  sdkInitialized: boolean;
  projectId: string;
  message: string;
  firestoreStatus: string;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  fullName: string | null;
  phoneNumber?: string | null;
  bio?: string | null;
  profileImageUrl?: string | null;
  preferredLanguage?: 'en' | 'bn';
  accountStatus?: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  profileVersion?: number;
  emailVerified?: boolean;
  activeRoles?: string[];
  contextualPermissions?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  // Legacy compatibility for mock switcher
  name?: string | null;
  role?: string;
}

export interface PublicProfile {
  uid: string;
  fullName: string;
  profileImageUrl?: string | null;
  bio?: string | null;
  preferredLanguage?: 'en' | 'bn';
  publicRoleBadges?: string[];
  profileVersion?: number;
  createdAt?: string;
}

export interface InitializeProfilePayload {
  fullName: string;
  phoneNumber?: string;
  bio?: string;
  preferredLanguage?: 'en' | 'bn';
}

export interface UpdateProfilePayload {
  fullName: string;
  phoneNumber?: string;
  bio?: string;
  profileImageUrl?: string;
  preferredLanguage?: 'en' | 'bn';
  expectedVersion: number;
}
