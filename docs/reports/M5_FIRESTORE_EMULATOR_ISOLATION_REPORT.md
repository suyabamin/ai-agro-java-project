# M5 Firestore Emulator Isolation Verification

**Finding:** M5-EMU-01 — ensure assignment integration tests fail closed and cannot silently address production Firestore.
**Severity:** CRITICAL. **Status:** PASS for the local test harness; production access was NOT TESTED.

## Direct configuration evidence

- Root `firebase.json` binds Firestore emulator to `127.0.0.1:8085`.
- `FirebaseAssignmentEmulatorLiveTest.initializeEmulatorApp()` refuses to initialize unless `FIRESTORE_EMULATOR_HOST` is exactly `127.0.0.1:8085`; absent or non-loopback/other-port values throw before any Firestore client is initialized.
- The test uses hard-coded Firebase project ID `demo-agroai-assignment`, not `.firebaserc` default `agroai-dev`.
- The test constructs Firebase options with a synthetic in-memory dummy credential, not ADC or a service-account key; the dummy value is not copied into this report.
- Firebase CLI invocation explicitly supplies `--project demo-agroai-assignment`. CLI output confirms the `demo-` project and states that non-emulated service access for this project fails.
- Maven Surefire excludes `**/Firebase*Live*Test.java` by default. The profile named `live-firebase` changes that exclusion, but the exact invocation also sets `-Dtest=FirebaseAssignmentEmulatorLiveTest`; it ran only the local emulator class. Despite the profile/class names, this invocation was local emulator testing, not live Firebase testing.
- `emulators:exec` starts and shuts down the emulator around the exact command; no emulator data import/export directory is configured. Test writes are synthetic and emulator-local; the emulator process is discarded at shutdown.

Exact command: `firebase emulators:exec --only firestore --project demo-agroai-assignment 'cd backend && mvnw.cmd -o -Plive-firebase -Dtest=FirebaseAssignmentEmulatorLiveTest test'`.

Current result: 2 tests passed, 0 failed/errors/skipped; includes synthetic lifecycle rollback/concurrency and pagination tests. Surefire output: `backend/target/surefire-reports/TEST-com.agroai.config.FirebaseAssignmentEmulatorLiveTest.xml`.

No live Firebase command, credentials, or production endpoint was used. Test safety does not establish production IAM or live-project security.

## M5 Prompt 4 continuation addendum — 2026-11-19

- Test source now additionally exercises a release/reassignment race, assignment creation concurrent with an archived field document gate, and two independent lifecycle workers against synthetic records. It still enforces `FIRESTORE_EMULATOR_HOST=127.0.0.1:8085`, fixed `demo-agroai-assignment`, and in-memory synthetic credentials.
- Exact current command is recorded in `M5_FAILURE_RECOVERY_AND_CONCURRENCY_REPORT.md`; the final post-edit rerun passed 2/2 tests with 0 failures/errors/skips.
- One intermediate run returned an emulator `ABORTED: Transaction lock timeout` on concurrent release and surfaced it as `DatabaseUnavailableException`. No production Firebase endpoint was contacted. The test now includes one idempotent retry path, but the successful run observed zero retries; do not claim transient retry recovery was demonstrated by that run.
- Emulator tests are local transaction/lifecycle evidence only. They do not test production IAM, actual Firebase Auth, live persistence, or production latency.
