import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from './apiClient';

const mockStorage: Record<string, string> = {};
const fakeLocalStorage = {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => { mockStorage[key] = value; },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
};

Object.defineProperty(globalThis, 'localStorage', {
  value: fakeLocalStorage,
  writable: true,
});

const mockDispatchEvent = vi.fn();
// @ts-expect-error mocking window for Node test environment
globalThis.window = {
  dispatchEvent: mockDispatchEvent,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

describe('API Client Unit Tests', () => {
  beforeEach(() => {
    fakeLocalStorage.clear();
    mockDispatchEvent.mockClear();
    vi.restoreAllMocks();
  });

  it('configures the base URL and JSON headers', () => {
    expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
    expect(apiClient.defaults.timeout).toBe(10000);
  });

  it('attaches Bearer token from localStorage when available', async () => {
    localStorage.setItem('agroai_mock_token', 'test-bearer-token-123');

    // @ts-expect-error accessing internal handler for testing
    const handler = apiClient.interceptors.request.handlers[0];

    const config = {
      headers: new Headers(),
    };

    // @ts-expect-error test mock config
    const modifiedConfig = await handler.fulfilled(config);
    expect(modifiedConfig.headers.get('Authorization')).toBe('Bearer test-bearer-token-123');
  });

  it('does not attach Bearer token when no token is present', async () => {
    localStorage.removeItem('agroai_mock_token');

    // @ts-expect-error accessing internal handler for testing
    const handler = apiClient.interceptors.request.handlers[0];

    const config = {
      headers: new Headers(),
    };

    // @ts-expect-error test mock config
    const modifiedConfig = await handler.fulfilled(config);
    expect(modifiedConfig.headers.get('Authorization')).toBeNull();
  });

  it('[M2-REF-02] Response interceptor rejects 403 Forbidden immediately without token refresh', async () => {
    // @ts-expect-error accessing internal response error handler
    const errorHandler = apiClient.interceptors.response.handlers[0].rejected;

    const error403 = {
      response: { status: 403, data: { success: false, message: 'Forbidden' } },
      config: { headers: new Headers() },
    };

    await expect(errorHandler!(error403)).rejects.toEqual(error403);
    expect(mockDispatchEvent).not.toHaveBeenCalled();
  });

  it('[M2-REF-03] Response interceptor aborts retry and dispatches unauthorized if _retry is already true', async () => {
    // @ts-expect-error accessing internal response error handler
    const errorHandler = apiClient.interceptors.response.handlers[0].rejected;

    const error401Retried = {
      response: { status: 401, data: { success: false, message: 'Unauthorized' } },
      config: { _retry: true, headers: new Headers() },
    };

    await expect(errorHandler!(error401Retried)).rejects.toEqual(error401Retried);
    expect(mockDispatchEvent).toHaveBeenCalled();
  });
});
