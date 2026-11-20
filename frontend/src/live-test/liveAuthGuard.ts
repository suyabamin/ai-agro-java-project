export interface LiveAuthEnvironment {
  enabled?: string;
  approved?: string;
  approvedProject?: string;
  configuredProject?: string;
  email?: string;
  password?: string;
  clientConfigured?: boolean;
  authAvailable?: boolean;
}

/** Pure safety gate; deliberately performs no Firebase or network operations. */
export function liveAuthGuardError(environment: LiveAuthEnvironment): string | null {
  if (environment.enabled !== '1') return null;
  if (environment.approved !== 'YES' || !environment.approvedProject ||
      environment.approvedProject !== environment.configuredProject ||
      !environment.email || !environment.password ||
      !environment.clientConfigured || !environment.authAvailable) {
    return 'Live Firebase tests require explicit isolated-project approval, matching project ID, and a pre-provisioned disposable identity.';
  }
  return null;
}
