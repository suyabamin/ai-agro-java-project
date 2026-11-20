import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { getCurrentIdToken } from './firebase';
import type { ApiResponse, BackendHealthData, FirebaseHealthData, UserProfile } from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    _retry?: boolean;
  }
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Attach Bearer token on all outgoing requests
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = await getCurrentIdToken();
      if (token) {
        config.headers.set('Authorization', `Bearer ${token}`);
      }
    } catch (err) {
      console.warn('Failed to attach bearer token to request:', err);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Single-Retry Token Refresh & 403 Immunity
let refreshPromise: Promise<string | null> | null = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const originalRequest = error.config;

    // Rule 1: No retry on 403 Forbidden (authorization denial, not token expiry)
    if (error.response?.status === 403) {
      return Promise.reject(error);
    }

    // Rule 2: Single-retry on 401 Unauthorized
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        if (!refreshPromise) {
          // Force refresh Firebase ID token
          refreshPromise = getCurrentIdToken(true).finally(() => {
            refreshPromise = null;
          });
        }

        const freshToken = await refreshPromise;
        if (freshToken) {
          originalRequest.headers.set('Authorization', `Bearer ${freshToken}`);
          return apiClient(originalRequest);
        }
      } catch (refreshErr) {
        console.warn('Token refresh failed:', refreshErr);
      }

      // If refresh failed or yielded no token, purge session and broadcast unauthorized
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('agroai:unauthorized'));
      }
      return Promise.reject(error);
    }

    // Rule 3: Abort if already retried once (infinite loop prevention)
    if (error.response?.status === 401 && originalRequest?._retry) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('agroai:unauthorized'));
      }
    }

    return Promise.reject(error);
  }
);

export const checkBackendHealth = async (): Promise<ApiResponse<BackendHealthData>> => {
  const response = await apiClient.get<ApiResponse<BackendHealthData>>('/health');
  return response.data;
};

export const checkFirebaseHealth = async (): Promise<ApiResponse<FirebaseHealthData>> => {
  const response = await apiClient.get<ApiResponse<FirebaseHealthData>>('/health/firebase');
  return response.data;
};

export const fetchCurrentUser = async (): Promise<ApiResponse<UserProfile>> => {
  const response = await apiClient.get<ApiResponse<UserProfile>>('/users/me');
  return response.data;
};
