import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';

const encodeSafeUid = (rawUid: string): string => {
  return 'uid_' + Buffer.from(rawUid, 'utf8').toString('base64url');
};

describe('Cloud Firestore Security Rules Emulator Tests', () => {
  let testEnv: RulesTestEnvironment;

  const ALICE_UID = 'user-alice-101';
  const ALICE_SAFE_UID = encodeSafeUid(ALICE_UID);

  const BOB_UID = 'user-bob-202';
  const BOB_SAFE_UID = encodeSafeUid(BOB_UID);

  const CHARLIE_FARMER_UID = 'user-charlie-303';
  const CHARLIE_SAFE_UID = encodeSafeUid(CHARLIE_FARMER_UID);

  const FARM_PUBLIC = 'farm-green-acres';
  const FARM_PRIVATE = 'farm-secret-valley';
  const FIELD_ACTIVE = 'fld-north-paddy';

  beforeAll(async () => {
    const rulesPath = resolve(__dirname, '../../../firestore.rules');
    const rulesContent = readFileSync(rulesPath, 'utf8');

    testEnv = await initializeTestEnvironment({
      // Match the isolated project passed to `firebase emulators:exec --project demo-agroai`.
      projectId: 'demo-agroai',
      firestore: {
        rules: rulesContent,
        host: '127.0.0.1',
        port: 8085,
      },
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();

      // Seed baseline data using admin/system context (bypasses rules)
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();

        // 1. Private User Profiles
        await setDoc(doc(db, 'users', ALICE_UID), {
          email: 'alice@agroai.org',
          fullName: 'Alice Owner',
          accountStatus: 'ACTIVE',
        });
        await setDoc(doc(db, 'users', BOB_UID), {
          email: 'bob@agroai.org',
          fullName: 'Bob Manager',
          accountStatus: 'ACTIVE',
        });
        await setDoc(doc(db, 'users', CHARLIE_FARMER_UID), {
          email: 'charlie@agroai.org',
          fullName: 'Charlie Farmer',
          accountStatus: 'ACTIVE',
        });

        // 2. Public Profiles
        await setDoc(doc(db, 'public_profiles', ALICE_UID), {
          fullName: 'Alice Owner',
          bio: 'Owner of Green Acres',
        });
        await setDoc(doc(db, 'public_profiles', BOB_UID), {
          fullName: 'Bob Manager',
          bio: 'Manager',
        });

        // 3. Quarantined profile
        await setDoc(doc(db, 'quarantined_public_profiles', 'qnt_corrupt_01'), {
          originalUid: 'orphan_01',
          reason: 'ORPHAN_PROJECTION',
        });

        // 4. Farms
        await setDoc(doc(db, 'farms', FARM_PUBLIC), {
          name: 'Green Acres Public Farm',
          visibility: 'PUBLIC',
          status: 'ACTIVE',
        });
        await setDoc(doc(db, 'farms', FARM_PRIVATE), {
          name: 'Secret Valley Private Farm',
          visibility: 'PRIVATE',
          status: 'ACTIVE',
        });

        // 5. Farm Memberships
        // Alice is ACTIVE member of FARM_PRIVATE
        const aliceMembershipId = `mbr_${FARM_PRIVATE}::${ALICE_SAFE_UID}`;
        await setDoc(doc(db, 'farm_members', aliceMembershipId), {
          farmId: FARM_PRIVATE,
          userId: ALICE_UID,
          status: 'ACTIVE',
          role: 'OWNER',
        });

        // Bob has REVOKED membership on FARM_PRIVATE
        const bobMembershipId = `mbr_${FARM_PRIVATE}::${BOB_SAFE_UID}`;
        await setDoc(doc(db, 'farm_members', bobMembershipId), {
          farmId: FARM_PRIVATE,
          userId: BOB_UID,
          status: 'REVOKED',
          role: 'MANAGER',
        });

        // 6. Fields
        await setDoc(doc(db, 'fields', FIELD_ACTIVE), {
          farmId: FARM_PRIVATE,
          name: 'North Paddy 01',
          status: 'ACTIVE',
        });

        // 7. Field Assignments
        // Charlie has ACTIVE assignment on FIELD_ACTIVE
        const charlieAssignmentId = `asgn_fld_${FIELD_ACTIVE}::${CHARLIE_SAFE_UID}`;
        await setDoc(doc(db, 'field_assignments', charlieAssignmentId), {
          farmId: FARM_PRIVATE,
          fieldId: FIELD_ACTIVE,
          farmerId: CHARLIE_FARMER_UID,
          status: 'ACTIVE',
        });
        await setDoc(doc(db, 'active_field_assignment_locks', charlieAssignmentId), {
          farmId: FARM_PRIVATE,
          fieldId: FIELD_ACTIVE,
          farmerId: CHARLIE_FARMER_UID,
          farmerSafeUid: CHARLIE_SAFE_UID,
          assignmentId: charlieAssignmentId,
        });

        // Bob has TERMINATED assignment on FIELD_ACTIVE
        const bobAssignmentId = `asgn_fld_${FIELD_ACTIVE}::${BOB_SAFE_UID}`;
        await setDoc(doc(db, 'field_assignments', bobAssignmentId), {
          farmId: FARM_PRIVATE,
          fieldId: FIELD_ACTIVE,
          farmerId: BOB_UID,
          status: 'TERMINATED',
        });

        // 8. Jobs
        await setDoc(doc(db, 'jobs', 'job-pub-01'), {
          farmId: FARM_PRIVATE,
          title: 'Harvester',
          status: 'PUBLISHED',
        });
        await setDoc(doc(db, 'jobs', 'job-draft-01'), {
          farmId: FARM_PRIVATE,
          title: 'Secret Harvester',
          status: 'DRAFT',
        });

        // 9. Applications
        const appCharlieId = `app_job-pub-01::${CHARLIE_SAFE_UID}`;
        await setDoc(doc(db, 'applications', appCharlieId), {
          jobId: 'job-pub-01',
          farmId: FARM_PRIVATE,
          applicantUid: CHARLIE_FARMER_UID,
          status: 'SUBMITTED',
        });

        // 10. Application History
        await setDoc(doc(db, 'application_history', 'hist_01'), {
          applicationId: appCharlieId,
          farmId: FARM_PRIVATE,
          applicantUid: CHARLIE_FARMER_UID,
          fromStatus: 'SUBMITTED',
          toStatus: 'UNDER_REVIEW',
        });

        // 11. Application Messages
        await setDoc(doc(db, 'application_messages', 'msg_01'), {
          applicationId: appCharlieId,
          farmId: FARM_PRIVATE,
          applicantUid: CHARLIE_FARMER_UID,
          senderUid: CHARLIE_FARMER_UID,
          message: 'Hello!',
        });

        // 12. Assignment History
        await setDoc(doc(db, 'assignment_history', 'asgn_hist_01'), {
          assignmentId: `asgn_fld_${FIELD_ACTIVE}::${CHARLIE_SAFE_UID}`,
          farmId: FARM_PRIVATE,
          fieldId: FIELD_ACTIVE,
          farmerUid: CHARLIE_FARMER_UID,
          eventType: 'ASSIGNED',
        });
      });
    }
  });

  // --- Rule 1: Unauthenticated access denied ---
  it('[RULE-01] Unauthenticated access to private collections is denied', async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(unauthedDb, 'users', ALICE_UID)));
    await assertFails(getDoc(doc(unauthedDb, 'public_profiles', ALICE_UID)));
    await assertFails(getDoc(doc(unauthedDb, 'farms', FARM_PRIVATE)));
  });

  // --- Rule 2: User can read own private profile ---
  it('[RULE-02] Authenticated user can read their own private profile', async () => {
    const aliceDb = testEnv.authenticatedContext(ALICE_UID, { safeUid: ALICE_SAFE_UID }).firestore();
    await assertSucceeds(getDoc(doc(aliceDb, 'users', ALICE_UID)));
  });

  // --- Rule 3: User cannot read other users private profile ---
  it('[RULE-03] Authenticated user cannot read another users private profile', async () => {
    const bobDb = testEnv.authenticatedContext(BOB_UID, { safeUid: BOB_SAFE_UID }).firestore();
    await assertFails(getDoc(doc(bobDb, 'users', ALICE_UID)));
  });

  // --- Rule 4: Client cannot write to private profiles ---
  it('[RULE-04] Direct client writes to private profiles users/{uid} are denied', async () => {
    const aliceDb = testEnv.authenticatedContext(ALICE_UID, { safeUid: ALICE_SAFE_UID }).firestore();
    await assertFails(setDoc(doc(aliceDb, 'users', ALICE_UID), { fullName: 'Hacked' }, { merge: true }));
  });

  // --- Rule 5: Authenticated users can read public profiles ---
  it('[RULE-05] Authenticated user can read any public profile', async () => {
    const bobDb = testEnv.authenticatedContext(BOB_UID, { safeUid: BOB_SAFE_UID }).firestore();
    await assertSucceeds(getDoc(doc(bobDb, 'public_profiles', ALICE_UID)));
  });

  // --- Rule 6: Client cannot write to public profiles ---
  it('[RULE-06] Direct client writes to public_profiles/{uid} are denied', async () => {
    const aliceDb = testEnv.authenticatedContext(ALICE_UID, { safeUid: ALICE_SAFE_UID }).firestore();
    await assertFails(setDoc(doc(aliceDb, 'public_profiles', ALICE_UID), { bio: 'Hacked' }, { merge: true }));
  });

  // --- Rule 7: Quarantined profiles cannot be accessed by clients ---
  it('[RULE-07] Clients cannot read or write quarantined profiles', async () => {
    const aliceDb = testEnv.authenticatedContext(ALICE_UID, { safeUid: ALICE_SAFE_UID }).firestore();
    await assertFails(getDoc(doc(aliceDb, 'quarantined_public_profiles', 'qnt_corrupt_01')));
    await assertFails(setDoc(doc(aliceDb, 'quarantined_public_profiles', 'qnt_new'), { data: 'test' }));
  });

  // --- Rule 8: Public farms can be read by any visitor ---
  it('[RULE-08] Public farms can be read by visitors', async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(unauthedDb, 'farms', FARM_PUBLIC)));
  });

  // --- Rule 9: Private farms require valid active membership ---
  it('[RULE-09] Private farms can be read by active members', async () => {
    const aliceDb = testEnv.authenticatedContext(ALICE_UID, { safeUid: ALICE_SAFE_UID }).firestore();
    await assertSucceeds(getDoc(doc(aliceDb, 'farms', FARM_PRIVATE)));
  });

  // --- Rule 10: Inactive, revoked or missing membership is denied private farm ---
  it('[RULE-10] Revoked member or non-member cannot read private farm', async () => {
    const bobDb = testEnv.authenticatedContext(BOB_UID, { safeUid: BOB_SAFE_UID }).firestore();
    await assertFails(getDoc(doc(bobDb, 'farms', FARM_PRIVATE)));

    const strangerDb = testEnv.authenticatedContext('stranger-999', { safeUid: encodeSafeUid('stranger-999') }).firestore();
    await assertFails(getDoc(doc(strangerDb, 'farms', FARM_PRIVATE)));
  });

  // --- Rule 11: Active field assignment grants field access ---
  it('[RULE-11] Actively assigned farmer can read assigned field', async () => {
    const charlieDb = testEnv.authenticatedContext(CHARLIE_FARMER_UID, { safeUid: CHARLIE_SAFE_UID }).firestore();
    await assertSucceeds(getDoc(doc(charlieDb, 'fields', FIELD_ACTIVE)));
  });

  // --- Rule 12: Released/terminated assignment denies field access ---
  it('[RULE-12] Terminated assignment denies field access to non-member', async () => {
    const bobDb = testEnv.authenticatedContext(BOB_UID, { safeUid: BOB_SAFE_UID }).firestore();
    await assertFails(getDoc(doc(bobDb, 'fields', FIELD_ACTIVE)));
  });

  // --- Rule 13: Farmer cannot read another farmers assignment document ---
  it('[RULE-13] Farmer can read own assignment document but not anothers', async () => {
    const charlieDb = testEnv.authenticatedContext(CHARLIE_FARMER_UID, { safeUid: CHARLIE_SAFE_UID }).firestore();
    const charlieAssignmentId = `asgn_fld_${FIELD_ACTIVE}::${CHARLIE_SAFE_UID}`;
    const bobAssignmentId = `asgn_fld_${FIELD_ACTIVE}::${BOB_SAFE_UID}`;

    await assertSucceeds(getDoc(doc(charlieDb, 'field_assignments', charlieAssignmentId)));
    await assertFails(getDoc(doc(charlieDb, 'field_assignments', bobAssignmentId)));
  });

  // --- Rule 14: Client writes to backend-managed collections are denied ---
  it('[RULE-14] All client writes to farms, farm_members, fields, assignments, and locks are denied', async () => {
    const aliceDb = testEnv.authenticatedContext(ALICE_UID, { safeUid: ALICE_SAFE_UID }).firestore();
    await assertFails(setDoc(doc(aliceDb, 'farms', 'farm_new'), { name: 'New Farm' }));
    await assertFails(setDoc(doc(aliceDb, 'farm_members', 'mbr_new'), { role: 'OWNER' }));
    await assertFails(setDoc(doc(aliceDb, 'fields', 'fld_new'), { name: 'New Field' }));
    await assertFails(setDoc(doc(aliceDb, 'field_assignments', 'asgn_new'), { status: 'ACTIVE' }));
    await assertFails(setDoc(doc(aliceDb, 'active_field_assignment_locks', 'asgn_new'), { assignmentId: 'asgn_new' }));
  });

  // --- Rule 15: Missing safeUid claim denies membership and field lookup ---
  it('[RULE-15] User without safeUid custom claim is denied private farm and field access', async () => {
    // Authenticated Alice without safeUid claim in token
    const aliceNoClaimDb = testEnv.authenticatedContext(ALICE_UID).firestore();
    await assertFails(getDoc(doc(aliceNoClaimDb, 'farms', FARM_PRIVATE)));
    await assertFails(getDoc(doc(aliceNoClaimDb, 'fields', FIELD_ACTIVE)));
  });

  // --- Rule 16: Public farm list query constraint ---
  it('[RULE-16] Querying farms with visibility == PUBLIC succeeds; unconstrained query fails', async () => {
    const visitorDb = testEnv.unauthenticatedContext().firestore();
    const publicQuery = query(collection(visitorDb, 'farms'), where('visibility', '==', 'PUBLIC'));
    await assertSucceeds(getDocs(publicQuery));

    // Unconstrained query fails because private farms cannot be read by visitors
    const allQuery = query(collection(visitorDb, 'farms'));
    await assertFails(getDocs(allQuery));
  });

  // --- Rule 17: Jobs access controls ---
  it('[RULE-17] Published jobs are readable by public; draft jobs require active farm membership', async () => {
    const visitorDb = testEnv.unauthenticatedContext().firestore();
    // Visitor can read published job
    await assertSucceeds(getDoc(doc(visitorDb, 'jobs', 'job-pub-01')));
    // Visitor cannot read draft job
    await assertFails(getDoc(doc(visitorDb, 'jobs', 'job-draft-01')));

    // Non-member stranger cannot read draft job
    const strangerDb = testEnv.authenticatedContext('stranger-999', { safeUid: encodeSafeUid('stranger-999') }).firestore();
    await assertFails(getDoc(doc(strangerDb, 'jobs', 'job-draft-01')));

    // Alice (active farm member) can read draft job
    const aliceDb = testEnv.authenticatedContext(ALICE_UID, { safeUid: ALICE_SAFE_UID }).firestore();
    await assertSucceeds(getDoc(doc(aliceDb, 'jobs', 'job-draft-01')));
  });

  // --- Rule 18: Job Application read controls ---
  it('[RULE-18] Applicant and active farm member can read application; strangers cannot', async () => {
    const appCharlieId = `app_job-pub-01::${CHARLIE_SAFE_UID}`;

    // Charlie (applicant) can read
    const charlieDb = testEnv.authenticatedContext(CHARLIE_FARMER_UID, { safeUid: CHARLIE_SAFE_UID }).firestore();
    await assertSucceeds(getDoc(doc(charlieDb, 'applications', appCharlieId)));

    // Alice (farm member) can read
    const aliceDb = testEnv.authenticatedContext(ALICE_UID, { safeUid: ALICE_SAFE_UID }).firestore();
    await assertSucceeds(getDoc(doc(aliceDb, 'applications', appCharlieId)));

    // Stranger cannot read
    const strangerDb = testEnv.authenticatedContext('stranger-999', { safeUid: encodeSafeUid('stranger-999') }).firestore();
    await assertFails(getDoc(doc(strangerDb, 'applications', appCharlieId)));
  });

  // --- Rule 19: Application History and Messages read controls ---
  it('[RULE-19] Applicant and active farm member can read history and messages; strangers cannot', async () => {
    // Charlie (applicant) can read history and messages
    const charlieDb = testEnv.authenticatedContext(CHARLIE_FARMER_UID, { safeUid: CHARLIE_SAFE_UID }).firestore();
    await assertSucceeds(getDoc(doc(charlieDb, 'application_history', 'hist_01')));
    await assertSucceeds(getDoc(doc(charlieDb, 'application_messages', 'msg_01')));

    // Alice (farm member) can read history and messages
    const aliceDb = testEnv.authenticatedContext(ALICE_UID, { safeUid: ALICE_SAFE_UID }).firestore();
    await assertSucceeds(getDoc(doc(aliceDb, 'application_history', 'hist_01')));
    await assertSucceeds(getDoc(doc(aliceDb, 'application_messages', 'msg_01')));

    // Stranger cannot read history or messages
    const strangerDb = testEnv.authenticatedContext('stranger-999', { safeUid: encodeSafeUid('stranger-999') }).firestore();
    await assertFails(getDoc(doc(strangerDb, 'application_history', 'hist_01')));
    await assertFails(getDoc(doc(strangerDb, 'application_messages', 'msg_01')));
  });

  // --- Rule 20: Client writes to jobs, applications, history, messages denied ---
  it('[RULE-20] All direct client writes to jobs, applications, history, and messages are denied', async () => {
    const charlieDb = testEnv.authenticatedContext(CHARLIE_FARMER_UID, { safeUid: CHARLIE_SAFE_UID }).firestore();
    const aliceDb = testEnv.authenticatedContext(ALICE_UID, { safeUid: ALICE_SAFE_UID }).firestore();

    await assertFails(setDoc(doc(aliceDb, 'jobs', 'job_new'), { title: 'Illegal' }));
    await assertFails(setDoc(doc(charlieDb, 'applications', 'app_new'), { status: 'SUBMITTED' }));
    await assertFails(setDoc(doc(charlieDb, 'application_history', 'hist_new'), { note: 'Illegal' }));
    await assertFails(setDoc(doc(charlieDb, 'application_messages', 'msg_new'), { message: 'Illegal' }));
  });

  // --- Rule 21: Assignment History read controls ---
  it('[RULE-21] Assigned farmer and active farm member can read assignment_history; strangers cannot', async () => {
    // Charlie (assigned farmer) can read history
    const charlieDb = testEnv.authenticatedContext(CHARLIE_FARMER_UID, { safeUid: CHARLIE_SAFE_UID }).firestore();
    await assertSucceeds(getDoc(doc(charlieDb, 'assignment_history', 'asgn_hist_01')));

    // Alice (farm member) can read history
    const aliceDb = testEnv.authenticatedContext(ALICE_UID, { safeUid: ALICE_SAFE_UID }).firestore();
    await assertSucceeds(getDoc(doc(aliceDb, 'assignment_history', 'asgn_hist_01')));

    // Stranger cannot read assignment history
    const strangerDb = testEnv.authenticatedContext('stranger-999', { safeUid: encodeSafeUid('stranger-999') }).firestore();
    await assertFails(getDoc(doc(strangerDb, 'assignment_history', 'asgn_hist_01')));
  });

  // --- Rule 22: Client writes to assignment_history denied ---
  it('[RULE-22] Direct client writes to assignment_history are denied', async () => {
    const charlieDb = testEnv.authenticatedContext(CHARLIE_FARMER_UID, { safeUid: CHARLIE_SAFE_UID }).firestore();
    await assertFails(setDoc(doc(charlieDb, 'assignment_history', 'asgn_hist_illegal'), { eventType: 'RELEASED' }));
  });

  it('[RULE-23] Suspended farms and inactive or archived fields revoke assigned farmer reads', async () => {
    const charlieDb = testEnv.authenticatedContext(CHARLIE_FARMER_UID, { safeUid: CHARLIE_SAFE_UID }).firestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'farms', FARM_PRIVATE), { status: 'SUSPENDED' }, { merge: true });
    });
    await assertFails(getDoc(doc(charlieDb, 'fields', FIELD_ACTIVE)));

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'farms', FARM_PRIVATE), { status: 'ACTIVE' }, { merge: true });
      await setDoc(doc(db, 'fields', FIELD_ACTIVE), { status: 'FALLOW' }, { merge: true });
    });
    await assertFails(getDoc(doc(charlieDb, 'fields', FIELD_ACTIVE)));

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'fields', FIELD_ACTIVE), { status: 'ARCHIVED' }, { merge: true });
    });
    await assertFails(getDoc(doc(charlieDb, 'fields', FIELD_ACTIVE)));
  });

  it('[RULE-24] The active-pair lock grants only its referenced current tenure', async () => {
    const charlieDb = testEnv.authenticatedContext(CHARLIE_FARMER_UID, { safeUid: CHARLIE_SAFE_UID }).firestore();
    const lockId = `asgn_fld_${FIELD_ACTIVE}::${CHARLIE_SAFE_UID}`;
    await assertSucceeds(getDoc(doc(charlieDb, 'active_field_assignment_locks', lockId)));
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'field_assignments', 'asgn_tenure_released'), {
        farmId: FARM_PRIVATE, fieldId: FIELD_ACTIVE, farmerId: CHARLIE_FARMER_UID, status: 'RELEASED',
      });
      await setDoc(doc(db, 'active_field_assignment_locks', lockId), {
        farmId: FARM_PRIVATE, fieldId: FIELD_ACTIVE, farmerId: CHARLIE_FARMER_UID,
        farmerSafeUid: CHARLIE_SAFE_UID, assignmentId: 'asgn_tenure_released',
      });
    });
    await assertFails(getDoc(doc(charlieDb, 'fields', FIELD_ACTIVE)));
  });

  it('[RULE-25] A disabled farmer profile immediately revokes active field access', async () => {
    const charlieDb = testEnv.authenticatedContext(CHARLIE_FARMER_UID, { safeUid: CHARLIE_SAFE_UID }).firestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', CHARLIE_FARMER_UID), { accountStatus: 'SUSPENDED' }, { merge: true });
    });
    await assertFails(getDoc(doc(charlieDb, 'fields', FIELD_ACTIVE)));
  });

  it('[RULE-26] Monitoring collections deny direct client reads and writes', async () => {
    const aliceDb = testEnv.authenticatedContext(ALICE_UID, { safeUid: ALICE_SAFE_UID }).firestore();
    const collections = ['field_images', 'soil_telemetry', 'ai_analysis_results', 'irrigation_plans', 'field_activity'];
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      for (const collectionName of collections) {
        await setDoc(doc(adminDb, collectionName, 'monitoring-fixture'), {
          farmId: FARM_PRIVATE, fieldId: FIELD_ACTIVE,
        });
      }
    });
    for (const collectionName of collections) {
      const record = doc(aliceDb, collectionName, 'monitoring-fixture');
      await assertFails(getDoc(record));
      await assertFails(setDoc(doc(aliceDb, collectionName, 'client-write'), { farmId: FARM_PRIVATE, fieldId: FIELD_ACTIVE }));
    }
  });
});
