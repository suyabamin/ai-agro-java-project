# Milestone 6 Live Firebase Report

**Status: NOT TESTED.** No live Firebase Auth or Firestore request was made during this continuation.

## Safe project/credential inventory

- `.firebaserc` defaults to `agroai-dev`; that value alone does not establish isolation, non-production status or authorization.
- An ignored service-account JSON exists at `frontend/src/types/.secrets/agroai-firebase-adminsdk.json.json`. This continuation inspected only file metadata, ignore matching and Git index status. Its contents were not opened, displayed or used. It is not in the index and `.gitignore` matches it. Earlier report history records project `agroai-dev`; no new cloud operation was used to confirm it.
- The prior Firebase CLI identity-list output exposed credential-bearing OAuth session material. The owner must revoke the grant/session and run `firebase logout`; the agent did not reuse, revoke or clear CLI credentials.
- `firebase.json` configures a local Firestore emulator on loopback port 8085. Current Rules test source uses `projectId: 'demo-agroai'`, matching the explicit emulator command. The emulator reported non-emulated services fail closed for this demo project.

## Local test status

- `npm run test:live`: 1 test skipped, 0 executed. It is intentionally disabled by default.
- Current emulator suite: 26/26 passed against `demo-agroai`; emulator evidence is not live Firebase evidence.
- No Rules deployment, user creation, verification email, Firestore live read/write, production access or data mutation occurred.

## Live test source hardening

`frontend/src/live-test/liveAuthClient.test.ts` now uses a pre-provisioned disposable identity; it does not create users, send verification email, write Firestore documents, log identity/token, or persist ID tokens. It signs out in `finally` and in suite teardown. It can only opt in when all required guards are set and match:

- `AGROAI_LIVE_FIREBASE_TESTS=1`
- `AGROAI_LIVE_FIREBASE_APPROVED=YES`
- `AGROAI_LIVE_FIREBASE_NON_PRODUCTION_PROJECT_ID=<owner-confirmed isolated project ID>` matching `VITE_FIREBASE_PROJECT_ID`
- `AGROAI_LIVE_FIREBASE_TEST_EMAIL` and `AGROAI_LIVE_FIREBASE_TEST_PASSWORD` for a pre-created disposable account
- Valid local `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID`

Setting these variables is not itself authorization to run. Owner must review and explicitly authorize an isolated test. No live test was opted in here. Client-write denial remains tested by the local Rules emulator suite, not by mutating a live account.

## Owner prerequisites

1. Revoke the previously exposed OAuth grant/session through owner-controlled account security and clear local CLI auth with `firebase logout`. Do not reuse any exposed session material.
2. Move the ignored Admin key outside the repository securely. Rotate it only if the owner confirms exposure or prior commitment.
3. Confirm an isolated non-production Firebase project and authorize exact read/sign-in operations; provide a pre-provisioned disposable identity and cleanup policy.
4. Supply matching Web client config locally and, only if backend Admin checks are later approved, a least-privilege Admin credential in a protected location outside the repository.
5. Review all side effects and test cleanup before separately authorizing a live integration run. Never target production or deploy Rules for these checks.

Real Firebase Auth, backend token verification, Firebase Admin persistence, full authenticated cross-service behavior and production storage remain **NOT TESTED**. M6 remains NOT READY; owner acceptance is pending.
