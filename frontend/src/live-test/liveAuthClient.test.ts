import { afterAll, describe, expect, it } from 'vitest';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, firebaseConfig, isFirebaseClientConfigured } from '../services/firebase';
import { liveAuthGuardError } from './liveAuthGuard';

// This suite is intentionally opt-in and expects a pre-provisioned disposable
// account in an owner-confirmed isolated project. It never creates users,
// sends email, writes Firestore documents, or persists ID tokens.
const enabled = process.env.AGROAI_LIVE_FIREBASE_TESTS === '1';
const configuredProject = firebaseConfig.projectId;
const approvedProject = process.env.AGROAI_LIVE_FIREBASE_NON_PRODUCTION_PROJECT_ID;
const explicitlyApproved = process.env.AGROAI_LIVE_FIREBASE_APPROVED;
const email = process.env.AGROAI_LIVE_FIREBASE_TEST_EMAIL;
const password = process.env.AGROAI_LIVE_FIREBASE_TEST_PASSWORD;

const guardError = liveAuthGuardError({ enabled: enabled ? '1' : '0', approved: explicitlyApproved,
  approvedProject, configuredProject, email, password,
  clientConfigured: isFirebaseClientConfigured, authAvailable: Boolean(auth) });
if (guardError) throw new Error(guardError);

describe.skipIf(!enabled)('Opt-in isolated Firebase Auth integration (never run by default)', () => {
  afterAll(async () => {
    if (auth?.currentUser) await signOut(auth);
  });

  it('signs in a pre-provisioned disposable identity and obtains an in-memory token', async () => {
    if (!auth || !email || !password) throw new Error('Guarded Firebase test configuration is incomplete');
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      expect(credential.user.uid).toBeTruthy();
      const token = await credential.user.getIdToken(true);
      expect(token.split('.')).toHaveLength(3);
      // Do not log, return from this test, or persist the token.
    } finally {
      if (auth.currentUser) await signOut(auth);
    }
  });
});
