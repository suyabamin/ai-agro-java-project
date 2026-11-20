# M5 Assignment Lifecycle Audit

Date: 2026-11-18. Historical owner acceptance: ACCEPTED. Technical status: PARTIAL; overall M5 remains NOT READY.

The existing design creates a new UUID-based `asgn_tenure_...` document per assignment period. Release retains the old document and records release metadata/history; reassign releases and creates separate records. Live Firestore create/release/reassign paths use transactions with membership, farm/field, profile/application, and active-pair lock validation. The emulator confirms repeat tenure and one concurrent duplicate-create race (exactly one successful create).

`AssignmentLifecycleService` uses bounded pages of 100, stores `lastAssignmentId`, and resumes incomplete operations. A new emulator scenario seeded 105 synthetic assignments plus the existing active record (106 total), threw after the third release committed but before cursor persistence, observed 103 active and PROCESSING, then retried and observed zero active. This is local emulator evidence only; it does not establish live production race behavior.

Command: `firebase emulators:exec --only firestore --project demo-agroai-assignment 'cd backend && mvnw.cmd -o -Plive-firebase -Dtest=FirebaseAssignmentEmulatorLiveTest test'` (with Java 21 in environment). Result: 1 test passed. CLI confirmed demo project; tests construct Admin SDK with exact same ID and fake emulator token.

Still not tested: simultaneous lifecycle operation workers, farm status mutation racing create, production Firestore, and cross-region/network failure. M5 technical closure remains open.
