# Milestone 6 Blocker Resolution Plan

**Technical readiness:** NOT READY. **Owner acceptance:** PENDING. **Current local suite:** 333/333 executed tests passed; live test is default-skipped. See `MILESTONE_6_TEST_REPORT.md`.

## Resolved local blockers

- [x] Restrict development mock login/registration UI, persisted mock session restore/creation and mock token fallback to Vite DEV. Verified by frontend tests/build and production-preview E2E with seeded stale mock storage (1/1); development mock workflow still passes E2E 3/3.
- [x] Remove unsafe side effects from live Auth test: no Auth account creation, verification email, Firestore write, token logging/persistence, or UID artifact. Requires explicit enable/approval, matching project ID and pre-provisioned disposable identity; signs out in `finally`.
- [x] Confirm default live test invocation does not contact Firebase: `npm run test:live` => 1 skipped, 0 executed.
- [x] Run Firestore Rules locally using `firebase emulators:exec --only firestore --project demo-agroai ...`; emulator and test source IDs match. 26/26 passed; no live project or Rules deployment.
- [x] Verify dev/test-only local storage profile and explicit missing-provider service error; added test and full Maven suite now 216/216.
- [x] Rerun mobile monitoring UI at 390×844 and 430×932; both pass overflow assertions and Save reading interaction.

## Owner/security prerequisites still open

- [ ] Revoke the previously exposed Firebase CLI OAuth grant/session through owner account security; then run `firebase logout` to clear local CLI state. No revocation was performed here.
- [ ] Move the ignored Admin service-account JSON from `frontend/src/types/.secrets/` to owner-controlled storage outside the repository. Its contents were not opened or used. Rotate only if it was committed/exposed.
- [ ] Confirm an isolated, non-production Firebase project and explicitly authorize the exact test operations. The name `agroai-dev` and `.firebaserc` default do not establish isolation.
- [ ] Provision a disposable pre-created identity and decide allowed Auth sign-in/read checks and cleanup. Provide Web configuration through a secure local channel; never put credentials in reports.

## Not tested; gated on owner prerequisites

- [ ] Firebase Auth sign-in against isolated project and real ID-token verification in Spring Boot.
- [ ] Spring authorization with real identity claims and Firebase Admin persistence; deterministic test data cleanup.
- [ ] Full authenticated frontend → Spring Boot → FastAPI → Firestore → frontend lifecycle; expected no-model response remains MODEL_UNAVAILABLE.
- [ ] Production image storage integration. Owner must decide scope and approve a provider plus isolated credentials; current code has explicit unavailable state when no provider exists.
- [ ] Actual inference/evaluation; owner supplies a model/dataset/licensing and evaluation protocol if required. Do not add an arbitrary model.

M1–M5 historical owner acceptance remains unchanged. M5 technical follow-ups remain open. M6 cannot be accepted by this report; M7 remains blocked/not started/not accepted and M8 remains blocked. No live Firebase calls, Rules deployment, production mutation or real image upload occurred.
