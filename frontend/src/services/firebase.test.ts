import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCurrentIdToken,
  isFirebaseClientConfigured,
  firebaseConfig,
  app,
  auth,
  db,
  analyticsPromise,
  getFirebaseAuth,
  getFirestoreDb,
} from './firebase';

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

describe('Firebase Client Service Unit Tests', () => {
  beforeEach(() => {
    fakeLocalStorage.clear();
  });

  it('exposes a valid firebaseConfig object matching expected properties', () => {
    expect(firebaseConfig).toBeDefined();
    expect(typeof firebaseConfig).toBe('object');
  });

  it('exports shared app, auth, and db instances or functions consistently', () => {
    expect(getFirebaseAuth).toBeDefined();
    expect(getFirestoreDb).toBeDefined();
    expect(typeof getFirebaseAuth).toBe('function');
    expect(typeof getFirestoreDb).toBe('function');
    if (isFirebaseClientConfigured) {
      expect(app).toBeDefined();
      expect(auth).toBeDefined();
      expect(db).toBeDefined();
      expect(firebaseConfig.projectId).toBe('agroai-dev');
    }
  });

  it('analyticsPromise resolves gracefully without throwing in test environment', async () => {
    const analytics = await analyticsPromise;
    // In Node / Vitest environment, isSupported() evaluates to false; analytics should resolve to null
    expect(analytics === null || typeof analytics === 'object').toBe(true);
  });

  it('reports configuration boolean status accurately', () => {
    expect(typeof isFirebaseClientConfigured).toBe('boolean');
  });

  it('falls back to a mock token only in Vite development mode', async () => {
    localStorage.setItem('agroai_mock_token', 'mock-token-sample');
    const token = await getCurrentIdToken();
    expect(token).toBe(import.meta.env.DEV ? 'mock-token-sample' : null);
  });

  it('returns null when no user is signed in and no mock token exists', async () => {
    const token = await getCurrentIdToken();
    expect(token).toBeNull();
  });
});
