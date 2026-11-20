# AgroAI Project Memory

> This file records project state. Update it after meaningful, verified work. Do not use it as a substitute for source code or detailed specifications.

## Project identity
- Name: AgroAI
- Full title: Dynamic Agricultural Management, Farmer Marketplace & AI Decision Support Platform
- Context: University OOP Lab project
- Team size: 3
- Development environment: Windows 11 and VS Code
- Repository status: Existing full-stack project; the Milestone 6 master prompt records Milestones 1–5 as accepted. Milestone 6 infrastructure is implemented; full product acceptance remains open for end-to-end gaps.

## Approved technology direction
- Frontend: React + TypeScript + Vite + Tailwind CSS
- Backend: Java + Spring Boot + Maven
- Identity: Firebase Authentication
- Database: Cloud Firestore
- AI service: Python + FastAPI
- Image processing: OpenCV
- Future user-supplied disease model: Keras `.keras` or `.h5` behind a metadata-validated inference adapter; no architecture/model weights are assumed
- Image storage: provider-neutral port and private dev/test local adapter; production provider not selected

## Product decisions
- A user can own multiple farms.
- A user can be both an owner and a farmer.
- Farms contain multiple fields.
- Multiple farmers can be assigned to a field; one farmer can work across fields.
- Job approval does not automatically assign fields.
- Owners manually assign approved farmers.
- Farmers see only their assigned fields and authorized data.
- Farm public listing is opt-in.
- Payment entries are manual records unless a verified payment integration is later added.
- AI output must be labelled honestly until trained and validated.

## Current status
- Overall milestone: Milestone 6 — AI and Agricultural Monitoring.
- Current phase: Model-ready AI infrastructure, monitoring APIs, storage abstraction, field dashboard and regression coverage are implemented. Infrastructure scope passes; complete M6 product acceptance remains open for browser E2E and authenticated cross-service workflows.
- Accepted baseline: The user-provided M6 master prompt states Milestones 1–5 are accepted.
- Firebase project/configuration: Local Firestore Emulator only for M6 Rules tests; no production Firebase data or Rules deployment was used.
- AI model training: Not started. The user will supply and train/evaluate the actual model later; no weights, training, disease accuracy or real inference are claimed.
- Deployment: Not started.
- Latest test evidence: 216 Java, 67 frontend unit, 26 Firestore Rules emulator, and 17 Python tests passed; frontend production build passed. See `docs/reports/MILESTONE_6_TEST_REPORT.md`.
- Deployment: Not started. Production image storage provider remains unselected.
- Latest acceptance: Infrastructure PASS with limitations; full Milestone 6 product acceptance is not claimed. See `docs/reports/MILESTONE_6_FINAL_ACCEPTANCE_AUDIT.md`.
## Verified Log Entries

### 2026-11-18 (Milestone 6 model-ready infrastructure)
- Added a model directory contract and schemas without weights; supported formats are `.keras` and `.h5`.
- Added FastAPI registry, checksum/metadata/label/evaluation validation, OpenCV preprocessing, backend-key-authenticated inference and availability APIs. Missing model returns `MODEL_UNAVAILABLE` without disease class/confidence.
- Added Spring Boot image storage, monitoring repository/services/controllers, field authorization, telemetry, evidence summaries, irrigation plans, activity history and backend AI availability proxy.
- Added dashboard monitoring integration and Firestore indexes/deny rules. Production image storage remains unconfigured.
- Verified 216/216 Java tests, 67/67 frontend tests, 26/26 Rules emulator tests, 17/17 Python tests, and frontend production build. No full browser E2E, live Firebase, production storage, trained model, training/evaluation, or real disease inference was run.
- No production Rules deployment, release, Git staging/commit/push, or production data mutation occurred.

### 2026-11-17 (Milestone 3: Phase 3A â€” Complete Farm Management, Membership Persistence & Public Projection Foundation)
- Milestone/phase: Milestone 3 â€” Phase 3A (Full Implementation, Integration, Testing & Documentation)
- Change:
  1. Implemented Core Domain Models & Contracts:
     - `Farm`: Canonical ID format `farm-<uuid>` (41 chars) matching `KeyEncoder.validateFarmId`, `version` (int), `status` (`ACTIVE`, `SUSPENDED`, `ARCHIVED`), `visibility` (`PUBLIC`, `PRIVATE`), `activeFieldCount` (0 default).
     - `FarmMembership`: Authoritative role tracking (`OWNER`, `MANAGER`, `OBSERVER`) and operational lifecycle (`ACTIVE`, `REVOKED`).
     - `PublicFarmProjection`: Dedicated sanitized projection entity for `public_farms/{farmId}`, strictly excluding owner PII, safeUid, detailedAddress, and private metadata.
  2. Production Fail-Closed Repositories:
     - `FirestoreFarmRepository`: Dual-mode production Firestore repository with atomic multi-document transaction support, public projection querying, and fail-closed safety (prohibits in-memory fallback in production profile; throws `DatabaseUnavailableException` on live read/write errors).
     - `FarmMembershipRepository`: Upgraded from stub to production dual-mode fail-closed Firestore repository with active owner counting (`countActiveOwners`) for sole-owner protection.
  3. Authoritative Services:
     - `FarmService`: Atomic registration transactions, multi-farm listing, concurrency-safe updates (`StaleVersionException`), visibility transitions, and soft archival.
     - `FarmMembershipService`: Roster querying, member addition with profile verification (`UserRepository.findPrivateProfile`), role alteration, and soft revocation with immutable sole-owner demotion and revocation guards.
     - `PublicFarmProjectionService`: Authoritative projection synchronization and self-healing reconciliation.
  4. Secured REST Controllers & Endpoints:
     - `FarmController` (`/api/v1/farms`): `POST /`, `GET /`, `GET /{farmId}`, `PUT /{farmId}`, `PATCH /{farmId}/visibility`, `POST /{farmId}/archive`.
     - `FarmMembershipController` (`/api/v1/farms/{farmId}/members`): `GET /`, `POST /`, `PATCH /{userId}`, `DELETE /{userId}`.
     - `PublicFarmController` (`/api/v1/public/farms`): `GET /`, `GET /{farmId}` (unauthenticated `permitAll()`).
     - `SecurityConfig`: Configured `/api/v1/public/**` as `permitAll()`.
  5. Frontend Architecture & Multi-Farm UI:
     - `farmService.ts`: Full API client covering all 12 endpoints.
     - `FarmContext.tsx`: Active farm provider and mutation hooks with localStorage persistence.
     - `FarmSwitcher.tsx`: Interactive navbar dropdown with active role badges.
     - `CreateFarmModal.tsx` & `FarmMembersModal.tsx`: Accessible modal dialogs for farm registration and member roster management.
     - `DashboardPage.tsx`: Active farm card, real metrics, visibility toggles, and archival triggers.
     - `ExploreFarmsPage.tsx`: Publicly accessible farm directory with division/district query filters.
     - `App.tsx`: Wired `<FarmProvider>` and `/explore` route.
  6. Automated Verification & Regression Safety:
     - 27 new automated tests created across 4 test classes (`FarmDomainTest`, `FarmServiceTest`, `FirestoreFarmRepositoryFailClosedTest`, `FarmControllerIntegrationTest`).
     - All 107 backend tests pass (100% success rate, 0 failures, 0 regressions).
     - 12 new frontend tests created in `farmService.test.ts`. All 23 frontend tests pass.
     - Frontend Vite production build (`npm run build`) completes with 0 errors.
  7. Strict Execution Boundaries Maintained:
     - Zero Git commits, zero staged files, zero pushes.
     - Zero Firestore Security Rules modifications or deployment.
     - Phase 3B (Field CRUD & Geometry) strictly deferred.
- Evidence:
  - Backend test execution: `mvnw.cmd test` -> `Tests run: 107, Failures: 0, Errors: 0, Skipped: 0`.
  - Frontend test execution: `npm run test` -> `3 passed, 23 passed`.
  - Frontend build: `npm run build` -> `built in 684ms`.
- Status: READY FOR USER ACCEPTANCE â€” PHASE 3A
- Next approved action: Await explicit user review and acceptance of Phase 3A before starting Phase 3B. Do NOT implement Phase 3B or deploy rules without approval.
- Milestone/phase: Milestone 3 â€” Architecture Plan Revision 2 (Documentation-Only)
- Change:
  1. Comprehensive Documentation Audit & Revision:
     - Revised all five Milestone 3 planning documents in `docs/reports/`:
       1. `MILESTONE_3_CURRENT_STATE_AUDIT.md` (Revision 2)
       2. `MILESTONE_3_ARCHITECTURE_PLAN.md` (Revision 2)
       3. `MILESTONE_3_IMPLEMENTATION_PLAN.md` (Revision 2)
       4. `MILESTONE_3_API_AND_DATA_MODEL.md` (Revision 2)
       5. `MILESTONE_3_SECURITY_AND_TESTING_PLAN.md` (Revision 2)
  2. Public Farm Data Isolation (`public_farms/{farmId}`):
     - Isolated public farm data from private farm documents (`farms/{farmId}`), resolving direct client read PII leakage (`ownerUid`, `ownerSafeUid`, `detailedAddress`, internal notes).
     - Defined atomic dual-write registration and visibility transition transactions managed exclusively by backend `PublicFarmProjectionService`.
  3. Identifier Compatibility:
     - Preserved `KeyEncoder` validation regex `^[a-zA-Z0-9-]{1,64}$`.
     - Standardized farm IDs on `farm-<uuid>` (41 chars) and composite field document IDs on `{farmId}--{localFieldId}` (globally unique, <= 64 chars).
  4. Unified Permission Matrix:
     - Standardized authoritative role permissions across `OWNER`, `MANAGER`, `OBSERVER`, and public visitors; aligned with canonical `FarmRole` enum (removed obsolete `MEMBER` references).
  5. Scope Creep Removal:
     - Stripped all operational farmer assignment properties (`assignedFarmerUids`), assignment APIs, worker dashboards, and marketplace recruitment from Milestone 3; preserved deterministic key encoding contract for Milestone 4/5.
  6. Repository Execution Dependencies:
     - Scheduled `FarmMembershipRepository` production Cloud Firestore persistence for Phase 3A to support farm authorization and listing.
  7. Concurrency & Integrity:
     - Specified transaction-based optimistic locking (`version`, `expectedVersion`, HTTP 409 Conflict) and atomic `activeFieldCount` consistency.
  8. Archival & Boundary Policy:
     - Enforced soft archival (`status = ARCHIVED`); formally deferred polygon GeoJSON boundary validation to Milestone 6.
  9. Strict Boundaries Maintained:
     - Zero application source code, frontend code, or configuration modified. Zero tests fabricated. Live rules deployment locked.
- Evidence:
  - Exact file verification confirmed only the 5 planning documents were modified in `docs/reports/`.
  - Zero git commits, zero staging, zero pushes.
- Status: READY FOR USER APPROVAL â€” PHASE 3A
- Next approved action: Await explicit user authorization before starting Phase 3A. Do NOT implement application features or deploy rules without approval.

### 2026-11-17 (Milestone 2: Final Acceptance Cleanup & Evidence Reconciliation)
- Milestone/phase: Milestone 2 â€” Acceptance Cleanup & Reconciliation
- Change:
  1. Test Count Reconciliation:
     - Audited all 17 test files and 98 test methods.
     - Produced exact mapping of the 12 Live Authentication Objectives across `liveAuthClient.test.ts` (6 methods), `FirebaseLiveEndToEndVerificationTest.java` (3 methods), and `FirebaseAdminSdkLiveVerificationTest.java` (1 method).
     - Produced exact mapping of the 6 Live Firestore Objectives across `liveAuthClient.test.ts` (1 method) and `FirebaseLiveEndToEndVerificationTest.java` (3 methods).
     - Confirmed exact breakdown: 81 offline CI tests + 17 live cloud tests = 98 total test methods across the repo, all passing.
  2. Authority Distinction & Cloud Rules Notice:
     - Explicitly documented that backend Admin SDK operations run with service-account privilege and bypass security rules by Google Cloud architecture design.
     - Clarified that live Cloud Firestore rejection of client writes in `[LIVE-FS-01]` was enforced by live project default database policies, not our custom `firestore.rules` (which remain to be deployed post-authorization).
  3. Firestore Rules Deployment Readiness:
     - Created `.firebaserc` binding `default: "agroai-dev"` (verified with `firebase use`).
     - Verified `firestore.rules` and `firebase.json` alignment with 16/16 emulator tests passing.
     - Documented exact deployment command (`firebase deploy --only firestore:rules`) and post-deployment verification plan. Rules deployment held awaiting explicit user authorization.
  4. Privacy Cleanup:
     - Redacted all test emails, UIDs, phone numbers, and identifying test tokens in `docs/reports/MILESTONE_2_LIVE_FIREBASE_FINAL_VERIFICATION.md`.
  5. Created `docs/reports/MILESTONE_2_FINAL_ACCEPTANCE_REVIEW.md`.
- Evidence:
  - Repository test count audit: 98 test methods in 17 source files.
  - Project binding verified: `firebase use` -> `agroai-dev`.
  - Zero secrets or private keys exposed.
- Status: VERIFIED & COMPLETE (Formal Milestone 2 Acceptance Gate)
- Next approved action: Milestone 2 Acceptance Gate review by user. Do NOT start Milestone 3 without explicit authorization.

### 2026-11-17 (Live Firebase Authentication & Cloud Firestore Full Verification)
- Milestone/phase: Milestone 2 â€” Live Cloud Verification
- Change:
  1. Executed live client authentication verification (`frontend/src/live-test/liveAuthClient.test.ts`):
     - Created disposable test user (`createUserWithEmailAndPassword`) on live Firebase project `agroai-dev`.
     - Dispatched verification email (`sendEmailVerification`).
     - Retrieved 3-segment JWT ID token and verified forced token refresh (`getIdToken(true)`).
     - Verified logout (`signOut`, `currentUser == null`) and invalid password rejection (`auth/invalid-credential`).
     - Re-authenticated with valid credentials.
     - Verified live Cloud Firestore unauthorized client write rejection (`PERMISSION_DENIED: Missing or insufficient permissions`).
  2. Executed live backend Admin SDK verification (`backend/src/test/java/com/agroai/config/FirebaseLiveEndToEndVerificationTest.java`):
     - Verified live Bearer ID token with `DefaultFirebaseTokenVerifier`.
     - Synchronized `safeUid` custom claim via `FirebaseCustomClaimsService` and asserted claim persisted in live Auth `UserRecord`.
     - Executed transactional dual-write profile initialization to `users/{uid}` and `public_profiles/{uid}` on live Cloud Firestore (`profileVersion: 1`).
     - Verified permitted private profile read (with phone) and sanitized public profile read (without phone).
     - Verified optimistic concurrency control: valid update incremented version to 2; stale update with version 1 threw `StaleProfileVersionException` (HTTP 409).
     - Revoked refresh tokens via Admin SDK (`revokeRefreshTokens`) and verified online check in `verifyToken(idToken, true)` threw `REVOKED_ID_TOKEN`.
     - Purged disposable test documents from Cloud Firestore and deleted test user from Firebase Auth.
  3. Inspected `firestore.rules`, `firebase.json`, and CLI project status:
     - Flagged `.firebaserc` project binding requirement.
     - Prepared rules deployment readiness assessment; paused for explicit user authorization.
  4. Created `docs/reports/MILESTONE_2_LIVE_FIREBASE_FINAL_VERIFICATION.md`.
- Evidence:
  - Live client test: `7 passed (7)` âœ…
  - Live backend test: `6 passed (6), BUILD SUCCESS` âœ…
  - Full platform test suites passing (82 tests across unit, mock, emulator, and live).
- Status: VERIFIED & COMPLETE (Ready for Milestone 2 Acceptance Gate)
- Remaining risks:
  - Firestore security rules await user authorization for live deployment (`firebase deploy --only firestore:rules`).
- Next approved action: Milestone 2 Acceptance Gate review. Do NOT start Milestone 3 without explicit authorization.

### 2026-11-17 (Firebase Admin SDK Service Account Configuration for agroai-dev)
- Milestone/phase: Milestone 2 â€” Firebase Admin SDK Backend Configuration
- Change:
  1. Configured external service account JSON at `C:\Users\HP\.secrets\agroai-firebase-adminsdk.json` mapped via `GOOGLE_APPLICATION_CREDENTIALS`. Kept strictly external to repository, frontend, and Git.
  2. Hardened `FirebaseConfig.java`: validates credentials project ID against `agroai-dev` using `ServiceAccountCredentials.getProjectId()`, enforces single initialization (`FirebaseApp.getApps().isEmpty()`), prevents credentials exposure.
  3. Reinforced fail-closed policy in `FirestoreUserRepository.java`: added `checkConfiguredOrReady()` preventing silent in-memory fallback when credentials path is configured but initialization failed or file is invalid.
  4. Added `[FAIL-CLOSED-06]` regression test to `FirestoreUserRepositoryFailClosedTest.java`.
  5. Implemented live cloud verification test suite `FirebaseAdminSdkLiveVerificationTest.java`:
     - Secure file check (non-empty, zero secrets printed).
     - Admin SDK single initialization and project ID (`agroai-dev`).
     - Cloud Firestore safe non-destructive read (`public_profiles` query limit 1).
     - Firebase Auth custom user claims functionality (`safeUid`).
     - Clean `@AfterAll` JVM teardown preventing pollution of subsequent test suites.
  6. Created `docs/reports/FIREBASE_ADMIN_SDK_CONFIGURATION_REPORT.md`.
- Evidence:
  - Backend tests: `Tests run: 53, Failures: 0, Errors: 0, Skipped: 0, BUILD SUCCESS` âœ…
  - Frontend unit tests: `Tests: 11 passed (11)` âœ…
  - Frontend production build: `âœ“ 115 modules transformed, exit code 0` âœ…
  - Firestore Rules Emulator: `Tests: 16 passed (16), code 0` âœ…
  - AI service pytest: `5 passed in 0.74s` âœ…
- Status: VERIFIED (85 total automated tests passing; live Firebase cloud verified)
- Remaining risks:
  - Email/Password provider not yet enabled in Firebase Console.
  - Firestore rules not yet deployed to live cloud project (`firebase deploy --only firestore:rules`).
- Next approved action: Milestone 2 Acceptance Gate review. Do NOT start Milestone 3 without explicit authorization.

### 2026-11-17 (Milestone 2: Security Remediation & Final Verification)
- Milestone/phase: Milestone 2 â€” Security Remediation & Verification
- Change:
  1. Remediation A (Firestore UID & Custom Claims): Implemented `FirebaseCustomClaimsService.java` to synchronize `safeUid` custom user claim via Firebase Admin SDK. Updated `firestore.rules` with `hasSafeUid()` ensuring safe access denial on missing claims. Added token refresh in `AuthContext.tsx`.
  2. Remediation B (Fail-Closed Persistence): Refactored `FirestoreUserRepository.java` to eliminate silent in-memory fallback in production mode. Live Firestore errors throw `DatabaseUnavailableException` (HTTP 503). Production startup validates configured Firestore or fails fast with `IllegalStateException`.
  3. Remediation C (Token Revocation Policy): Implemented `@RequiresRevocationCheck` and `RevocationCheckInterceptor.java` registered in `WebMvcConfig.java`. High-risk endpoints (`PUT /me`, `POST /me/reconcile`, `POST /me/initialize`, `POST /me/claims/sync`) enforce online token revocation checking (`verifyToken(idToken, true)`), returning HTTP 401 on revoked tokens. Low-risk endpoints use fast cached JWKS.
  4. Remediation D (Email Verification Enforcement): Enforced backend verified email requirement on mutating operations (`PUT /me`, `POST /me/reconcile`), returning HTTP 403 `EMAIL_VERIFICATION_REQUIRED`. Frontend `ProfilePage.tsx` displays warning banners, pre-checks verification, and provides resend email button.
  5. Remediation E (Firestore Rules Emulator): Created root `firebase.json` and `frontend/src/rules/firestore.rules.test.ts`. Installed `@firebase/rules-unit-testing`. Executed all 16 tests inside live Firestore emulator via `firebase emulators:exec --only firestore` â€” 16/16 PASSED.
  6. Automated Testing: 77 total automated tests passing (Backend: 48, Rules Emulator: 16, Frontend: 8, AI service: 5). Clean production TypeScript build (105 modules, 0 errors).
- Evidence:
  - Backend test output: `Results: Tests run: 48, Failures: 0, Errors: 0, Skipped: 0`
  - Rules emulator output: `Tests: 16 passed (16), Duration: 9.39s, Script exited successfully (code 0)`
  - Frontend test output: `Tests: 8 passed (8), Duration: 725ms`
  - Frontend build output: `âœ“ built in 392ms`
  - AI test output: `5 passed, 1 warning in 0.80s`
- Status: VERIFIED (Remediation Complete, 77/77 tests passing)
- Next approved action: Firebase Web Configuration task (see log entry below). Do NOT start Milestone 3.

### 2026-11-17 (Firebase Web Configuration for agroai-dev)
- Milestone/phase: Milestone 2 â€” Firebase Web App Configuration (post-remediation)
- Change:
  1. Created `frontend/.env.local` with all 8 `VITE_FIREBASE_*` real credentials for project `agroai-dev` (git-ignored; credentials not stored in reports).
  2. Updated `frontend/.env.example` with all 8 `VITE_FIREBASE_*` placeholder variable names.
  3. Rewrote `frontend/src/services/firebase.ts`: added `getFirestore` (`db` export), `getAnalytics`/`isSupported` (`analyticsPromise` export), `getFirestoreDb()` helper; preserved all existing exports (`app`, `auth`, `getFirebaseAuth`, `getCurrentIdToken`, `isFirebaseClientConfigured`). Singleton guard via `getApps()`.
  4. Expanded `frontend/src/services/firebase.test.ts` from 3 to 6 tests (added firebaseConfig shape, app/auth/db exports, analyticsPromise resolution).
  5. Added `exclude` array to `frontend/tsconfig.app.json` for `src/**/*.test.ts`, `src/**/*.test.tsx`, `src/rules` to prevent Node.js-only test files from breaking `tsc -b`.
  6. Created `docs/reports/FIREBASE_WEB_CONFIGURATION_REPORT.md`.
- Evidence:
  - Frontend unit tests: `Tests: 11 passed (11), Duration: 974ms` âœ…
  - Firestore Rules Emulator: `Tests: 16 passed (16), Duration: 7.41s, Script exited successfully (code 0)` âœ…
  - Production build: `âœ“ 115 modules transformed, built in 731ms, exit code 0` âœ…
- Status: VERIFIED (83 total automated tests passing; build clean)
- Remaining risks:
  - Live cloud Firebase connectivity (actual auth/Firestore ops) not tested; requires deployed frontend or E2E environment.
  - Email/Password provider not yet enabled in Firebase Console.
  - Firestore rules not yet deployed to live project (`firebase deploy --only firestore:rules`).
- Next approved action: Milestone 2 Acceptance Gate review. Do NOT start Milestone 3 without explicit authorization.

## Verified Log Entries

### 2026-11-17 (Milestone 2: Authentication & User Management Full Delivery)
- Milestone/phase: Milestone 2 â€” Complete Delivery (Phases 2A, 2B, 2C)
- Change:
  1. Delivered Universal Deterministic Key Encoder (`com.agroai.util.KeyEncoder`):
     - Base64URL safe UID encoding (`safeUid(u) = "uid_" + base64url(u.getBytes(UTF-8))`).
     - Strict field ID regex validation (`^[a-zA-Z0-9-]{1,64}$`).
     - Deterministic composite membership keys (`mbr_${farmId}::${safeUid}`) and field assignment keys (`asgn_fld_${fieldId}::${safeUid}`).
  2. Implemented Backend Domain Models & Validation (`com.agroai.model`, `com.agroai.dto`):
     - `AccountStatus` (`ACTIVE`, `SUSPENDED`, `DELETED`), `UserProfile`, `PublicProfile`, `QuarantinedProfile`.
     - `FarmRole` (`OWNER`, `MANAGER`, `OBSERVER`), `FarmMembership`, `FieldAssignment`.
     - `InitializeProfileRequest`, `UpdateProfileRequest` with `@NotNull @Min(1) expectedVersion`.
     - Domain exceptions: `ProfileNotFoundException` (404), `StaleProfileVersionException` (409), `AccountSuspendedException` (403), `EmailVerificationRequiredException` (403), `UnauthorizedResourceAccessException` (403).
  3. Implemented Dual-Mode `FirestoreUserRepository`:
     - Live Firestore SDK dual-write transactions to `users/{uid}` and `public_profiles/{uid}` with `profileVersion` increment.
     - Four-case recovery algorithm: Case 1 (clean dual-write), Case 2 (reprojection from private), Case 3 (reconciliation transaction), Case 4 (orphan public quarantine to `quarantined_public_profiles/{id}`).
     - In-memory concurrent transactional fallback for offline testing and developer onboarding without crashing when credentials are not mounted.
  4. Implemented User Service & REST Controllers:
     - `UserService`: `getMyProfile` (strictly read-only), `initializeMyProfile` (idempotent, identity bound to token UID/email), `updateMyProfile` (optimistic version control), `reconcileMyProfile`, `getPublicProfile`.
     - `UserController` (`/api/v1/users`): `GET /me`, `POST /me/initialize`, `PUT /me`, `POST /me/reconcile`, `GET /{uid}/public`.
  5. Implemented Contextual Security Evaluators:
     - `FarmSecurityEvaluator`: `isFarmOwner`, `isFarmManager`, `isFarmMember`.
     - `FieldSecurityEvaluator`: `hasFieldAccess` (checks `ACTIVE` assignment status), `canSubmitTelemetry` (denies `OBSERVER`).
  6. Implemented Security Interceptors:
     - `FirebaseAuthenticationFilter`: Intercepts Bearer tokens and checks `accountStatus == SUSPENDED`, delegating to entry point with 403 `ACCOUNT_SUSPENDED`.
     - `FirebaseTokenVerifier`: Added overloaded `verifyToken(idToken, checkRevoked)` for online revocation check support.
  7. Authored Cloud Firestore Security Rules (`firestore.rules`):
     - Denies direct client writes to `users/{uid}` (Spring Boot Admin SDK exclusive).
     - Allows public read for `public_profiles/{uid}`.
     - Denies client reads/writes on `quarantined_public_profiles`.
     - Enforces roster privacy on `farm_members` and active assignment path lookups.
  8. Implemented Frontend Features & Views:
     - Updated `apiClient.ts`: Single-retry on 401 `TOKEN_EXPIRED`, explicit 403 immunity, shared refresh queue, infinite loop prevention (`_retry`).
     - Added `services/userService.ts`: Typed client wrapper for `/api/v1/users`.
     - Updated `AuthContext.tsx`: Full user profile management, `profileUninitialized` detection, perspective switcher (`owner` vs `farmer`), session persistence, dev mock signup preservation.
     - Added `RegistrationPage.tsx`: Full registration flow with instant backend profile initialization.
     - Updated `LoginPage.tsx`: Password reset modal (`sendPasswordResetEmail`), registration link.
     - Added `ProfilePage.tsx`: Profile view/edit, `profileVersion` optimistic locking, language selection, account standing badge, public projection card, self-healing reconcile trigger.
     - Updated `DashboardLayout.tsx`: Perspective switcher, dynamic role-based navigation, user badge, email verification badge.
     - Updated `App.tsx`: Registered `/register` and `/dashboard/profile` routes.
  9. Automated Testing & Verification:
     - Backend: 34 tests passed (`mvnw.cmd test` in 18.5s).
     - Frontend: 8 tests passed (`vitest run` in 598ms).
     - Frontend Build: Passed (`tsc -b && vite build` in 406ms, 105 modules, 0 errors).
     - AI Service: 5 tests passed (`pytest` in 0.65s).
     - Total: 47 automated tests passed.
- Evidence:
  - Backend test output: `Results: Tests run: 34, Failures: 0, Errors: 0, Skipped: 0`
  - Frontend test output: `Test Files: 2 passed (2), Tests: 8 passed (8)`
  - Frontend build output: `âœ“ built in 406ms`
  - AI test output: `5 passed, 1 warning in 0.65s`
- Status: VERIFIED (Milestone 2 Complete)
- Remaining risks:
  - User deployment of production Firebase service account credentials for online live verification.
- Next approved action:
  - Present Milestone 2 Acceptance Report to user and pause at the Milestone 2 Approval Gate. Do not begin Milestone 3.

## Verified Log Entries

### 2026-11-17 (Milestone 2: Revision 2.0 Planning Update)
- Milestone/phase: Milestone 2 â€” Planning Phase (Revision 2.0)
- Change:
  1. Addressed user review findings in `docs/reports/MILESTONE_2_IMPLEMENTATION_PLAN.md`.
  2. Implemented two-tier profile architecture: private `users/{uid}` (owner/backend only) and `public_profiles/{uid}` projection. Defined strict mutable vs immutable trusted fields (`accountStatus`, `uid`, `email` locked).
  3. Formulated token revocation and session lifecycle rules: client logout vs server-side revocation (`revokeRefreshTokens`), standard offline JWKS verification vs `checkRevoked=true` online check, documented production latency/security trade-offs, and defined behavior for suspended/disabled accounts.
  4. Specified idempotent registration deriving identity strictly from verified token, atomic profile creation, and self-healing recovery for partial registration failures.
  5. Standardized deterministic composite ID (`${farmId}_${userId}`) for `farm_members` across backend and Firestore rules, preventing duplicate memberships; detailed OWNER, MANAGER, OBSERVER permission matrices and REVOKED lifecycle handling.
  6. Specified single-retry interceptor logic on `TOKEN_EXPIRED`, explicit rejection of refresh on 403 Forbidden, handling of disabled/revoked tokens, and queue-based infinite loop prevention.
  7. Expanded testing matrix across Mock, Emulator, and Real Integration tiers for duplicate profiles, partial registration retry, revoked tokens, disabled users, suspended accounts, untrusted field edits, private profile isolation, and cross-farm/field access denial.
  8. Clarified Phase 2A scope: manual user setup vs agent backend implementation, and detailed verification through MockMvc and REST tests without frontend dependencies.
  9. Maintained zero code modifications in `frontend/`, `backend/`, and `ai-service/`.
- Evidence:
  - Plan document: `docs/reports/MILESTONE_2_IMPLEMENTATION_PLAN.md` (v2.0, 41 KB)
  - 0 application source code changes.
  - 0 commits/pushes.
- Status: VERIFIED (Revision 2.0 Complete)
- Remaining risks:
  - User creation of dedicated `agroai-dev` Firebase project and placement of service account key.
  - Disk space on Drive C: (1.93 GB free).
- Next approved action:
  - Present revised Milestone 2 Implementation Plan (v2.0) to user and pause for approval gate before beginning Phase 2A.

### 2026-11-17 (Milestone 2: Planning & Architecture Design Only)
- Milestone/phase: Milestone 2 â€” Planning Phase
- Change:
  1. Inspected existing documentation, schemas, and source code.
  2. Prepared comprehensive architecture and implementation plan in `docs/reports/MILESTONE_2_IMPLEMENTATION_PLAN.md`.
  3. Formulated dedicated Firebase setup instructions for `agroai-dev` preserving existing projects.
  4. Designed complete authentication architecture (registration, email/password login, logout, state persistence, Bearer token injection, token refresh, password reset) and defined separation of responsibilities across React, Firebase Auth, and Spring Boot.
  5. Specified Cloud Firestore `users/{uid}` schema, fields, validation rules, and account status lifecycle (`ACTIVE`, `SUSPENDED`, `DELETED`).
  6. Detailed contextual multi-role architecture, ensuring roles are not mutually exclusive global enums, and explaining the frontend UI perspective toggle vs. server-side authorization enforcement.
  7. Designed backend authorization mechanisms, token revocation trade-offs (`checkRevoked`), contextual security evaluators (`FarmSecurityEvaluator`, `FieldSecurityEvaluator`), and standardized `ApiResponse<T>` error envelopes.
  8. Defined complete `firestore.rules` security rules and emulator unit test strategy.
  9. Created testing matrix across 3 tiers (Unit/Mock, Firebase Local Emulator, Live integration).
  10. Formulated phased implementation sequence (Phases 2A, 2B, 2C) with strict approval gates.
  11. Preserved all source code and documentation; strictly no code implementation or secret generation performed.
- Evidence:
  - Plan document: `docs/reports/MILESTONE_2_IMPLEMENTATION_PLAN.md`
  - 0 application source code changes.
  - 0 commits/pushes.
- Status: VERIFIED (Planning Complete)
- Remaining risks:
  - User creation of dedicated `agroai-dev` Firebase project and placement of service account key.
  - Disk space on Drive C: (1.93 GB free).
- Next approved action:
  - Present Milestone 2 Implementation Plan to user and pause for approval gate before beginning Phase 2A.

### 2026-11-17 (Phase 1D: Integration, Live Multi-Service Verification & Acceptance Report)
- Milestone/phase: Milestone 1 â€” Phase 1D
- Change:
  1. Concurrently executed all three applications (FastAPI on port 8000, Spring Boot on port 8080, Vite frontend on port 5173).
  2. Verified live inter-service connectivity: Spring Boot `AiServiceHealthClient` queried FastAPI `/api/v1/health` in 178ms (`status: UP`).
  3. Verified fault-tolerance: when FastAPI was terminated, Spring Boot returned graceful diagnostic (`status: DOWN`, `responseTimeMs: 26`) without unhandled exceptions.
  4. Verified live security: protected endpoint `GET /api/v1/auth/me` rejected requests without token and with invalid token with `401 Unauthorized`.
  5. Verified live Firebase diagnostic: `GET /api/v1/health/firebase` reported `configured: false, sdkInitialized: false` safely without credential leaks.
  6. Reconciled all documentation: `docs/reports/MILESTONE_1_ACCEPTANCE.md`, `TASKS.md`, `MEMORY.md`, and `CHANGELOG.md`.
  7. Confirmed disk space: Drive C preserved at 1.93 GB free; Drive D at 9.05 GB free.
- Evidence:
  - Frontend HTTP 200 OK on `http://127.0.0.1:5173`
  - Backend HTTP 200 OK on `http://127.0.0.1:8080/api/v1/health`
  - Backend-to-AI ping: 178ms (`status: UP`)
  - AI offline fallback: 26ms (`status: DOWN`)
  - Protected route rejection: 401 Unauthorized
  - 26/26 automated tests passed across all modules
- Status: VERIFIED for Phase 1D / Milestone 1 Completed
- Remaining risks:
  - Live Firestore document operations will be connected once user provides dedicated Firebase credentials in Milestone 2.
- Next approved action:
  - Stop at Milestone 1 approval gate; await user authorization before starting Milestone 2.

### 2026-11-17 (Phase 1C: Frontend & AI Service Foundation)
- Milestone/phase: Milestone 1 â€” Phase 1C
- Change:
  1. Configured React Router in frontend (`App.tsx`) with PublicLayout, Authenticated DashboardLayout, and ProtectedRoute guards.
  2. Built `AuthContext` with support for both live Firebase Authentication (`onAuthStateChanged`) and development mock testing without crashing when public Firebase keys are omitted.
  3. Created centralized `apiClient` (Axios) with automated Firebase ID token injection via request interceptor, unified `ApiResponse<T>` response handling, and 401 session expiration event dispatching.
  4. Built agricultural landing page with Hero, platform pillars, and real-time backend/Firebase/AI health diagnostic monitor card.
  5. Built authenticated dashboard layout distinguishing Farm Owner vs Farmer contextual workspaces according to `docs/design/DESIGN.md`.
  6. Reorganized FastAPI AI service into modular package structure (`app/core/config.py`, `app/api/v1/api.py`, `app/api/v1/endpoints/health.py`, `app/schemas/health.py`) while preserving root `/health` and `/api/v1/health` endpoints.
  7. Added CORS middleware and OpenAPI documentation paths (`/api/v1/docs`, `/api/v1/openapi.json`) to AI service.
  8. Implemented backend `AiServiceHealthClient` and `GET /api/v1/health/ai` in Spring Boot with timeout configuration (5000ms) and connection failure handling.
  9. Added frontend Vitest unit tests (6 tests passed), AI service Pytest suite (5 tests passed), and backend Spring Boot test suite (15 tests passed).
- Evidence:
  - Frontend Vitest: 6 passed (apiClient token attachment, absence, headers; Firebase service safe fallback).
  - Frontend Build: `tsc -b && vite build` bundled 102 modules in 477ms (0 errors).
  - AI Service tests: 5 passed in 0.93s (`test_root_health`, `test_v1_health`, `test_v1_health_diagnostics`, `test_openapi_schema_available`, `test_cors_preflight_allowed_backend`).
  - Backend tests: 15 passed in 38.9s (`BUILD SUCCESS`, 0 failures, 0 errors).
  - Drive C disk space preserved at 1.89 GB free; Drive D at 9.05 GB free.
- Status: VERIFIED for Phase 1C
- Remaining risks:
  - Live end-to-end multi-service network integration across concurrent ports pending Phase 1D verification.
- Next approved action:
  - Phase 1D: Integration, Health Connectivity Verification, and Final Documentation for Milestone 1.

### 2026-11-17 (Phase 1B: Backend & Firebase Foundation)
- Milestone/phase: Milestone 1 â€” Phase 1B
- Change:
  1. Added `com.google.firebase:firebase-admin:9.4.3` and `spring-boot-starter-security` to backend `pom.xml`.
  2. Implemented `FirebaseConfig` with graceful unconfigured fallback to prevent startup crashes when service account credentials are not yet supplied.
  3. Implemented `FirebaseTokenVerifier` interface and `DefaultFirebaseTokenVerifier` using genuine `FirebaseAuth.verifyIdToken(idToken)`.
  4. Implemented `FirebaseAuthenticationFilter` and `FirebaseAuthenticationEntryPoint` for stateless Bearer token authentication.
  5. Configured `SecurityConfig` to expose public endpoints (`/api/v1/health/**`, `/actuator/**`) while securing protected routes.
  6. Implemented `FirebaseHealthService` and `GET /api/v1/health/firebase` diagnostic endpoint which safely reports configuration and SDK state without exposing secrets or filesystem paths.
  7. Implemented `GlobalExceptionHandler` with unified `ApiResponse<T>` error envelopes.
  8. Implemented protected endpoint `GET /api/v1/auth/me` to verify user context propagation.
  9. Added 14 unit and integration tests covering valid tokens, expired tokens, invalid signatures, revoked tokens, malformed tokens, missing headers, and health diagnostics.
- Evidence:
  - Backend tests: `Tests run: 14, Failures: 0, Errors: 0, Skipped: 0` (`BUILD SUCCESS` in 32s).
  - Frontend build: `tsc -b && vite build` built in 214ms with 0 errors.
  - AI Service tests: `pytest` passed 2 tests in 0.89s.
  - Disk space on Drive C preserved at 1.89 GB free; Drive D at 9.40 GB free.
- Status: VERIFIED for Phase 1B
- Remaining risks:
  - User needs to provision a dedicated Firebase project and service account private key outside the repository.
- Next approved action:
  - Phase 1C: Frontend & AI Service Foundation (centralized API client, base layouts, FastAPI client connectivity).

### 2026-11-17 (Phase 1A: Foundation & Scaffolding)
- Milestone/phase: Milestone 1 â€” Phase 1A (Foundation & Scaffolding)
- Change:
  1. Verified disk space constraints (Drive C: 1.91 GB free; Drive D: 9.46 GB free). Configured package managers (npm, maven, uv) to store caches and repos on Drive D (`D:\.npm-cache`, `D:\.m2\repository`, `D:\.uv-cache`).
  2. Installed Eclipse Temurin JDK 21.0.13 via winget. Configured `JAVA_HOME` and verified both `java` and `javac`.
  3. Initialized Git repository (`git init`) and established comprehensive `.gitignore`.
  4. Corrected documentation paths to `docs/architecture/ARCHITECTURE.md` and `docs/design/DESIGN.md` across root and skills documentation.
  5. Scaffolded React + TypeScript + Vite frontend. Tested `npm run build` (built in 231ms).
  6. Scaffolded Python 3.12 FastAPI AI service with `.venv` on Drive D. Implemented `/health` and `/api/v1/health` endpoints. Tested with pytest (2 tests passed).
  7. Scaffolded Java 21 + Spring Boot 3.3.6 backend with Maven Wrapper (`mvnw.cmd`). Implemented `/api/v1/health` with `ApiResponse<T>` envelope. Tested with Maven (`mvnw.cmd test` - 2 tests passed).
- Evidence:
  - `javac -version`: javac 21.0.13
  - `java -version`: openjdk version "21.0.13" 2026-10-20 LTS
  - Frontend build: `dist/index.html`, `dist/assets/*` generated without errors
  - AI Service tests: `pytest` executed with `2 passed, 1 warning in 0.77s`
  - Backend tests: `Tests run: 2, Failures: 0, Errors: 0, Skipped: 0` (`BUILD SUCCESS` in 52s)
- Status: VERIFIED for Phase 1A
- Remaining risks:
  - Low free disk space on Drive C (1.91 GB free) requires continuous discipline to direct large builds/caches to Drive D.
  - Dedicated Firebase project for AgroAI not yet configured.
- Next approved action:
  - Phase 1B: Backend and Firebase configuration (establish dedicated Firebase project, secure credentials outside repository, add token verification foundation).

## Required update format
For each update record:
- Date:
- Milestone/phase:
- Change:
- Evidence:
- Tests/builds:
- Status:
- Remaining risks:
- Next approved action:

## Important distinction
A planned technology is not an implemented integration. A generated file is not a tested feature. Update this file only with user-confirmed facts or tool/test evidence.


### 2026-11-17 — Milestone 5 audit, hardening and verification
- Source audit found an existing partial Milestone 5 implementation; updated the five audit/planning reports to reflect actual files rather than stale “not started” claims.
- Hardened assignment target eligibility and approved application linkage, prevented silent reactivation of released deterministic pairs, and made live release/reassignment plus audit writes transactional.
- Added sanitized farmer field DTO (no private notes), removed farmer email from assignment API/persistence mapping, made release reason optional, and removed misleading farmer telemetry/analysis UI claims.
- Added regression coverage for many-to-many assignments, missing farmer profile, release without reason, reassignment record/history, field-note omission and email omission.
- Separated live Firebase tests from default Maven runs with the explicit `live-firebase` profile.
- Verified standard suites: backend 193, frontend 60, Firestore Rules emulator 22, AI service 5; frontend build succeeds with a >500 kB bundle warning. Dedicated live Admin SDK read-only checks: 4 passed. Six live E2E Java and seven frontend live-auth methods were not executed.
- Status: Milestone 5 is NOT READY for user acceptance. See `docs/reports/MILESTONE_5_FINAL_INDEPENDENT_ACCEPTANCE_AUDIT.md` for remaining lifecycle, pagination, repeat-tenure and live transaction verification gaps.
- No production data writes, Rules deployment, app deployment, Git staging/commit/push or Milestone 6 work occurred.
