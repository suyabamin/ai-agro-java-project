# Changelog

All notable project changes should be recorded here.

Use dated entries and distinguish planned changes from completed changes.

## [Unreleased]

### 2026-11-17 — Milestone 2 Security Remediation & Verification Complete
#### Added
- `FirebaseCustomClaimsService.java`: Backend custom claim provisioning for `safeUid`, preserving existing claims.
- Root `firebase.json`: Configured Firestore emulator on port 8085 for non-production security rules verification.
- `frontend/src/rules/firestore.rules.test.ts`: Automated Firestore Rules test suite covering 16 security rules assertions executed via `firebase emulators:exec --only firestore`.
- `RequiresRevocationCheck.java` annotation and `RevocationCheckInterceptor.java` registered in `WebMvcConfig.java` to enforce online token revocation checks (`verifyToken(idToken, true)`) on high-risk endpoints (`PUT /me`, `POST /me/reconcile`, `POST /me/initialize`, `POST /me/claims/sync`).
- `DatabaseUnavailableException.java` and handler in `GlobalExceptionHandler.java` (HTTP 503 `DATABASE_UNAVAILABLE`).
- Automated tests: `RevocationPolicyIntegrationTest.java` (3 tests), `EmailVerificationPolicyTest.java` (4 tests), `FirestoreUserRepositoryFailClosedTest.java` (5 tests), `FirebaseCustomClaimsServiceTest.java` (2 tests).

#### Changed
- `FirestoreUserRepository.java`: Removed silent in-memory fallback in production mode. Live Firestore operations now fail closed with `DatabaseUnavailableException`. Added `@PostConstruct` validation rejecting uninitialized in-memory execution in production profile.
- `firestore.rules`: Added `hasSafeUid()` helper; verified `safeUid` custom claim presence and validity on membership and assignment lookups.
- `UserService.java`: Enforced verified email on mutating operations (`PUT /me`, `POST /me/reconcile`); automatically synchronizes `safeUid` custom claim on initialization and reconciliation.
- `ProfilePage.tsx`: Added amber/red warning banners for unverified email, client pre-check, and "Send Verification Email" button.
- `AuthContext.tsx`: Added automatic token refresh (`getIdToken(true)`) after profile initialization and reconciliation to fetch `safeUid` claim.

#### Verified
- Backend tests: 48 passed (`mvnw.cmd test` in 31.9s, 0 failures, 0 errors).
- Firestore Rules Emulator tests: 16 passed (`firebase emulators:exec --only firestore "npm run --prefix frontend test:rules"` in 9.39s, 0 failures).
- Frontend Vitest tests: 8 passed (`npm test` in 725ms, 0 failures).
- Frontend production build: Passed (`tsc -b && vite build` in 392ms, 105 modules, 0 errors).
- AI service tests: 5 passed (`pytest` in 0.80s, 0 failures).
- Consolidated total: 77 automated tests passing across all tiers (100% PASS).

### 2026-11-17 — Milestone 2: Authentication & User Management Complete
#### Added
- Universal Deterministic Key Encoder (`KeyEncoder.java`) implementing UTF-8 Base64URL safe UID encoding, field ID regex validation (`^[a-zA-Z0-9-]{1,64}$`), composite farm membership keys (`mbr_${farmId}::${safeUid}`), and composite field assignment keys (`asgn_fld_${fieldId}::${safeUid}`).
- Domain models and enums: `AccountStatus` (`ACTIVE`, `SUSPENDED`, `DELETED`), `UserProfile` (`users/{uid}` with `profileVersion`), `PublicProfile` (`public_profiles/{uid}`), `QuarantinedProfile` (`quarantined_public_profiles/{id}`), `FarmRole` (`OWNER`, `MANAGER`, `OBSERVER`), `MembershipStatus`, `FarmMembership`, `AssignmentStatus`, `FieldAssignment`.
- Data transfer objects with validation: `InitializeProfileRequest`, `UpdateProfileRequest` (with `@NotNull @Min(1) expectedVersion`), `UserProfileDTO`, `PublicProfileDTO`.
- Domain exceptions handled by `GlobalExceptionHandler`: `ProfileNotFoundException` (404), `StaleProfileVersionException` (409), `AccountSuspendedException` (403), `EmailVerificationRequiredException` (403), `UnauthorizedResourceAccessException` (403).
- Dual-mode repositories:
  - `FirestoreUserRepository`: Cloud Firestore SDK dual-write transactions to `users/{uid}` and `public_profiles/{uid}`, optimistic concurrency check, 4-case self-healing recovery with orphan public profile quarantine, plus an in-memory concurrent fallback for offline development and testing.
  - `FarmMembershipRepository`: Storage and retrieval of composite membership records.
  - `FieldAssignmentRepository`: Storage and retrieval of composite field assignment records with historical archive.
- Services and Evaluators:
  - `UserService`: `getMyProfile` (strictly read-only), `initializeMyProfile` (idempotent, identity bound to token UID/email), `updateMyProfile` (optimistic version control), `reconcileMyProfile`, `getPublicProfile`.
  - `FarmSecurityEvaluator`: Contextual role checks (`isFarmOwner`, `isFarmManager`, `isFarmMember`).
  - `FieldSecurityEvaluator`: `hasFieldAccess` (checks `ACTIVE` assignment status), `canSubmitTelemetry` (denies `OBSERVER`).
- Security enhancements:
  - `FirebaseAuthenticationFilter`: Intercepts Bearer tokens and checks `accountStatus == SUSPENDED`, delegating to entry point with 403 `ACCOUNT_SUSPENDED`.
  - `FirebaseTokenVerifier`: Added overloaded `verifyToken(idToken, checkRevoked)` for online revocation check support.
  - Root `firestore.rules`: Denies direct client writes to `users/{uid}` (Spring Boot Admin SDK exclusive), public read for `public_profiles/{uid}`, client denial on `quarantined_public_profiles`, roster privacy on `farm_members`, and active assignment path lookups.
- REST Controllers:
  - `UserController` (`/api/v1/users`): `GET /me`, `POST /me/initialize`, `PUT /me`, `POST /me/reconcile`, `GET /{uid}/public`.
- Frontend implementations:
  - `apiClient.ts`: Single-retry on 401 `TOKEN_EXPIRED`, explicit 403 immunity (no retry on forbidden), shared refresh promise queue, and infinite loop prevention (`_retry`).
  - `services/userService.ts`: Typed client wrapper for `/api/v1/users`.
  - `AuthContext.tsx`: Full user profile management, `profileUninitialized` detection, perspective switcher (`owner` vs `farmer`), session persistence, dev mock signup preservation.
  - `pages/RegistrationPage.tsx`: Full registration flow with instant backend profile initialization.
  - `pages/LoginPage.tsx`: Password reset modal (`sendPasswordResetEmail`), registration link, enhanced error reporting.
  - `pages/ProfilePage.tsx`: Profile view/edit, `profileVersion` optimistic locking, language selection, account standing badge, public projection card, self-healing reconcile trigger.
  - `components/layout/DashboardLayout.tsx`: Perspective switcher, dynamic role-based navigation, user badge, email verification badge.
  - `App.tsx`: Registered `/register` and `/dashboard/profile` routes.

#### Verified
- Backend Maven tests: 34 passed (`mvnw.cmd test` in 18.5s) covering `KeyEncoderTest` (7 tests), `UserControllerTest` (8 tests), `ContextualSecurityTest` (4 tests), `FirebaseAuthenticationIntegrationTest` (8 tests), `DefaultFirebaseTokenVerifierUnitTest` (3 tests), `HealthControllerTest` (3 tests), and `AgroAiApplicationTests` (1 test).
- Frontend Vitest tests: 8 passed (`npm test` in 598ms) verifying token attachment, single-retry on 401 `TOKEN_EXPIRED`, 403 immunity, and Firebase service.
- Frontend production build: Passed (`tsc -b && vite build` in 406ms, 105 modules, 0 errors).
- AI service tests: 5 passed (`pytest` in 0.65s).
- Total automated tests passing: 47 / 47. 0 failures, 0 regressions.
### Added
- Initial project documentation baseline.
- Phase 1A scaffolding: React + TypeScript + Vite frontend, Spring Boot 3.3.6 (Java 21) backend with Maven Wrapper, FastAPI AI service (Python 3.12).
- Git repository initialization and comprehensive `.gitignore`.
- Root and per-service `.env.example` templates and `.npmrc` cache configuration.
- Phase 1B backend & Firebase foundation: official Firebase Admin SDK 9.4.3, Spring Security, genuine token verification pipeline, stateless authentication filter, safe health diagnostics (`GET /api/v1/health/firebase`), and centralized exception handler.
- Phase 1C frontend & AI service foundation: React Router routing, PublicLayout, DashboardLayout (Owner vs Farmer views), AuthContext, centralized Axios apiClient with automatic Bearer token injection, landing page hero with live health monitor, modular FastAPI route package (`app/api/v1/endpoints/health.py`, `app/core/config.py`, `app/schemas/health.py`), and Spring Boot backend-to-AI health diagnostic client (`GET /api/v1/health/ai`).
- Phase 1D integration: concurrent multi-service execution, live inter-service connectivity validation (frontend -> backend -> AI service), resilience testing for service outages, and final Milestone 1 acceptance report.

### Fixed
- Corrected relative documentation paths to `docs/architecture/ARCHITECTURE.md` and `docs/design/DESIGN.md` in `AGENTS.md`, `README.md`, and `skills/`.
- Ensured response output stream flush in `FirebaseAuthenticationEntryPoint` for clean 401 JSON envelopes.

### Verified
- Temurin JDK 21 installation (`javac 21.0.13` and `java 21.0.13`).
- Frontend production build (`tsc -b && vite build`: PASS, 102 modules in 477ms).
- Frontend Vitest tests (`npm test`: 6 passed in 889ms).
- AI service health and contract tests (`pytest`: 5 passed in 0.93s).
- Backend tests (`mvnw.cmd test`: 15 passed in 38.9s across token verifier unit tests, MockMvc authentication filter integration tests, and health diagnostics including AI service client).
- Live concurrent integration across ports 5173, 8080, and 8000: Spring Boot queried FastAPI health in 178ms (`status: UP`); handled offline AI failure gracefully in 26ms (`status: DOWN`); live protected endpoint rejected unauthenticated calls with 401.

## Entry format
### YYYY-MM-DD
#### Added
- ...

#### Changed
- ...

#### Fixed
- ...

#### Verification
- Commands:
- Results:
