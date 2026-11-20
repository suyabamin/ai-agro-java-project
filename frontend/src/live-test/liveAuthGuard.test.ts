import { describe, expect, it } from 'vitest';
import { liveAuthGuardError, type LiveAuthEnvironment } from './liveAuthGuard';

const valid: LiveAuthEnvironment = {
  enabled: '1', approved: 'YES', approvedProject: 'agroai-disposable',
  configuredProject: 'agroai-disposable', email: 'test@example.test', password: 'disposable',
  clientConfigured: true, authAvailable: true,
};

describe('live Firebase Auth safety gate (pure local tests)', () => {
  it('keeps live tests disabled by default', () => {
    expect(liveAuthGuardError({})).toBeNull();
  });
  it('rejects missing explicit owner approval', () => {
    expect(liveAuthGuardError({ ...valid, approved: undefined })).not.toBeNull();
  });
  it('rejects production or mismatched project IDs', () => {
    expect(liveAuthGuardError({ ...valid, configuredProject: 'production-project' })).not.toBeNull();
  });
  it('rejects missing pre-provisioned identity or client configuration', () => {
    expect(liveAuthGuardError({ ...valid, email: undefined })).not.toBeNull();
    expect(liveAuthGuardError({ ...valid, clientConfigured: false })).not.toBeNull();
  });
  it('accepts only the fully specified isolated disposable test configuration', () => {
    expect(liveAuthGuardError(valid)).toBeNull();
  });
});
