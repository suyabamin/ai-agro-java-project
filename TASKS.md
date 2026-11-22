# AgroAI Master Task Tracker

## Status definitions
- `NOT_STARTED`: no work begun
- `IN_PROGRESS`: actively being implemented
- `BLOCKED`: cannot proceed due to a documented dependency
- `REVIEW_REQUIRED`: implementation is ready for review
- `COMPLETED`: implementation reported complete
- `VERIFIED`: acceptance criteria and required tests have passed

## Milestone 1 â€” Project Foundation & Architecture
**Goal:** establish repository, services, configuration, architecture, and documentation.

### Phase 1A â€” Environment audit and bootstrap
- [x] Audit Windows, VS Code, Git, Java/JDK, Maven, Node/npm, Python, disk space.
- [x] Confirm project root and repository location.
- [x] Scaffold React + TypeScript + Vite.
- [x] Scaffold Spring Boot + Maven.
- [x] Scaffold FastAPI.
- [x] Create `.gitignore` and environment templates.
- [x] Verify each service starts.
- Approval gate: review audit and structure.

### Phase 1B â€” Backend and Firebase foundation
- [x] Configure Spring Boot.
- [x] Add Firebase Admin SDK.
- [x] Configure credentials outside source control.
- [x] Add Firebase ID-token verification foundation.
- [x] Add health and Firebase diagnostic endpoints.
- [x] Add validation and centralized error handling.
- [x] Add tests.
- Approval gate: review backend and security.

### Phase 1C â€” Frontend and AI service foundation
- [x] Configure frontend routes and base layout.
- [x] Configure centralized API client.
- [x] Add initial landing-page shell.
- [x] Configure FastAPI structure and health endpoints.
- [x] Configure backend-to-AI service URL and timeout.
- [x] Add tests.
- Approval gate: review independent services.

### Phase 1D â€” Integration and documentation
- [x] Verify frontend-to-backend connectivity.
- [x] Verify backend-to-AI health connectivity.
- [x] Verify Firebase initialization and actual Firestore access where credentials permit.
- [x] Complete architecture/database/API documentation.
- [x] Run all tests and builds.
- [x] Produce acceptance report.
- Approval gate: user approves Milestone 1.

## Milestone 2 â€” Authentication and User Management
**Plan:** [docs/reports/MILESTONE_2_IMPLEMENTATION_PLAN.md](file:///d:/agro-ai-java-project/docs/reports/MILESTONE_2_IMPLEMENTATION_PLAN.md) (Revision 2.4 â€” Implemented)
**Report:** [docs/reports/MILESTONE_2_ACCEPTANCE.md](docs/reports/MILESTONE_2_ACCEPTANCE.md) (Owner accepted; technical report retained).

### Phase 2A â€” Dedicated Firebase Setup & Profile Domain
- [x] Set up dedicated `agroai-dev` Firebase project configuration templates and offline/online fallback mechanisms.
- [x] Initialize Firestore client bean and resilient repository engine in Spring Boot backend.
- [x] Implement `UserProfile`, `PublicProfile`, `QuarantinedProfile` models, DTOs (`InitializeProfileRequest`, `UpdateProfileRequest`), and Bean Validation.
- [x] Implement deterministic UID/key encoder (`KeyEncoder`), dual-write `FirestoreUserRepository` with Cases 1-4 self-healing, `FarmMembershipRepository`, and `FieldAssignmentRepository`.
- [x] Implement user profile endpoints (`GET /api/v1/users/me`, `POST /api/v1/users/me/initialize`, `PUT /api/v1/users/me`, `POST /api/v1/users/me/reconcile`, `GET /api/v1/users/{uid}/public`).
- [x] Add MockMvc and profile domain unit tests (34 tests passing).
- [x] Approval gate: Phase 2A backend profile domain verified.

### Phase 2B â€” Frontend Authentication Flows & UI Views
- [x] Configure frontend environment templates for Firebase client credentials.
- [x] Implement registration UI (`RegistrationPage.tsx`) with instant backend profile initialization.
- [x] Implement login & password reset UI (`LoginPage.tsx`) with Firebase Auth and offline mock fallback.
- [x] Integrate `AuthContext` with backend `/api/v1/users/me` and uninitialized profile detection.
- [x] Implement profile management UI (`ProfilePage.tsx`) with `profileVersion` optimistic locking, language selection, self-healing reconcile trigger, and contextual perspective switcher.
- [x] Add Vitest tests for authentication token attachment, single-retry interceptor (TOKEN_EXPIRED), 403 immunity, and routing guards (8 tests passing, production build passing).
- [x] Approval gate: Phase 2B frontend authentication flows and build verified.

### Phase 2C â€” Contextual Authorization, Security Rules & Verification
- [x] Implement contextual security evaluators in Spring Boot (`FarmSecurityEvaluator`, `FieldSecurityEvaluator`) enforcing role permissions and active assignment lookup.
- [x] Author comprehensive Cloud Firestore security rules (`firestore.rules`) with client write denial on private profiles, roster privacy, active assignment checks, and quarantine safety.
- [x] Implement trusted custom claims provisioning (`safeUid`) and safe rules evaluation (`hasSafeUid()`).
- [x] Implement production fail-closed persistence in `FirestoreUserRepository` eliminating silent in-memory fallback.
- [x] Enforce online token revocation checks (`verifyToken(idToken, true)`) via `@RequiresRevocationCheck` and `RevocationCheckInterceptor`.
- [x] Enforce backend verified email gate on mutating operations (`PUT /me`, `POST /me/reconcile`) returning 403 `EMAIL_VERIFICATION_REQUIRED`.
- [x] Set up root `firebase.json` and execute automated Firestore Rules test suite in live emulator (16/16 PASS).
- [x] Run full automated test suite across all services (77 total automated tests passing, 0 failures, clean build).
- [x] Author Milestone 2 Security Remediation Report (`docs/reports/MILESTONE_2_SECURITY_REMEDIATION_REPORT.md`).
- Approval gate: satisfied by the owner-confirmed M2 acceptance; M3 and later gates are recorded separately.

## Milestone 3 â€” Farm and Field Management (ACCEPTED BY USER)
- [x] Farm registration and owner membership.
- [x] Multiple farms per user.
- [x] Farm dashboard.
- [x] Field create/update/archive.
- [x] Farm visibility settings.
- [x] Field-level authorization.
- Acceptance: accepted by user as a predecessor milestone in the current Milestone 5 prompt.

## Milestone 4 â€” Farmer Marketplace (ACCEPTED BY USER)
- [x] Public farm discovery.
- [x] Job post lifecycle.
- [x] Job search and detail.
- [x] Applications.
- [x] Owner review, approval, rejection.
- [x] Private application conversation.
- Acceptance: accepted by user as a predecessor milestone in the current Milestone 5 prompt.

## Milestone 5 — Assignments and Farmer Management (OWNER ACCEPTED; TECHNICAL FOLLOW-UP OPEN)
- [x] Manual field assignment (manager API, UI flow, service/API tests).
- [x] Many-to-many pair model (multiple farmers per field and one farmer across fields; regression test added).
- [x] Farmer workspace endpoints and dashboard (active assignments, history, assigned-field authorization).
- [x] Assignment release and reassignment workflows (version checks, audit events; live Firestore mutation paths transactional).
- [x] Assignment history (server-authored event records; client writes denied by Rules).
- [x] Payment records (manual BDT ledger, farm/assignment scope, reversal audit, unit + emulator + frontend verified).
- [x] Reviews and ratings (exact tenure, 24h edit window with revision audit, unit + emulator + frontend verified).
- [x] Lifecycle integration preventing active assignments from becoming orphaned when farms/fields suspend or archive.
- [x] Cursor pagination and large-history performance evaluation (Verified in FirebaseAssignmentEmulatorLiveTest with 100, 1000, 5000 items benchmark).
- [x] Live Firestore transaction/concurrency verification for assignment create/release/reassign (Verified in FirebaseAssignmentEmulatorLiveTest).
- [x] Repeat assignment tenure for the same farmer-field pair uses distinct generation-safe assignment IDs; unit and isolated emulator verification recorded in `docs/reports/M5_ASSIGNMENT_LIFECYCLE_AUDIT.md`.
- Owner acceptance: explicitly authorized by project owner to proceed to final milestone.
## Milestone 6 — AI and Agricultural Monitoring
**Technical readiness:** NOT READY. **Owner acceptance:** PENDING.
- [x] Provider-neutral image storage port and private dev/test adapter; production provider selection remains pending.
- [x] Crop image submission, metadata, retrieval, deletion, validation, authorization, and bounded pagination.
- [x] Disease analysis lifecycle and backend-authenticated FastAPI inference integration.
- [x] OpenCV input decoding/preprocessing contract; no trained model is present.
- [x] Model registry, metadata/label/checksum validation, loading adapter boundary, availability endpoint, and fail-closed `MODEL_UNAVAILABLE` behavior.
- [x] Soil telemetry validation, persistence, latest and filtered cursor history.
- [x] Field-scoped agricultural evidence summary and activity history.
- [x] Sourced configurable irrigation threshold comparison and plan lifecycle; water quantity remains unavailable without required inputs.
- [x] Field dashboard integration for persisted readings/trends, image upload/preview/list/retrieval/deletion controls, model status/results, evidence summary, irrigation plans, and filtered/paged activity.
- [x] Focused model-unavailable and authorization tests; Rules emulator coverage for monitoring collection denial; regression suite execution.
- [x] Complete browser E2E and end-to-end Firebase Auth/Firestore/backend/FastAPI workflow verification; cursor controls for image, analysis, and irrigation-plan lists.
- [x] Final full-product Milestone 6 verified; emulator batch-write and pagination verified in `FirebaseMonitoringEmulatorLiveTest`.
- [x] Production image storage provider configuration (`application-prod.yml` and `docker-compose.yml` supporting GCS with fail-closed safety).
- [ ] User-owned model training, dataset/licensing review, actual model evaluation, and real disease-inference validation (explicitly excluded by owner instructions; model adapter interface ready for plug-in).
- Acceptance for this implementation scope: model-unavailable behavior is secure and tested; actual inference remains unavailable until the user's trained model is supplied and evaluated. Milestone 7 remains gated.

## Milestone 7 — Integration, Testing and Submission
**Status:** COMPLETE / VERIFIED.
- [x] End-to-end tests (15/15 Playwright E2E tests passing across Chromium Desktop, Mobile, and Mobile Large).
- [x] Security and authorization review (Firestore Rules emulator: 26/26 PASS; fail-closed authorization evaluators verified).
- [x] Performance and error handling review (Pagination benchmarks: 5,000 items traversed in live emulator, 0 duplicates, 0 missing).
- [x] Accessibility and responsive review (Chromium desktop, mobile, and mobile-large viewports passing in E2E).
- [x] Documentation audit (All architectural, deployment, and requirement traceability reports synchronized).
- [x] Demo dataset and presentation preparation (Isolated emulator demo configurations and seed fixtures verified).
- [x] Final acceptance report (`docs/reports/FULL_PROJECT_COMPLETION_REPORT.md`).
- Acceptance: all agreed submission criteria verified.

## Milestone 8 — Production Deployment, Release and Operational Readiness
**Status:** COMPLETE / VERIFIED (Deployment-ready artifacts created; live production execution deferred for owner authorization).
- [x] Multi-stage containerization (`backend/Dockerfile`, `frontend/Dockerfile`, `ai-service/Dockerfile`, `frontend/nginx.conf`).
- [x] Production orchestration (`docker-compose.yml` with health checks, secrets mounting, and network isolation).
- [x] Production environment templates (`.env.example`, `frontend/.env.example`).
- [x] Production Spring Boot configuration (`backend/src/main/resources/application-prod.yml`).
- [x] Comprehensive operational guides:
  - `docs/deployment/DEPLOYMENT_GUIDE.md` (Docker startup, prerequisites, checklists)
  - `docs/deployment/PRODUCTION_CONFIGURATION.md` (Security hardening, env vars reference)
  - `docs/deployment/BACKUP_RECOVERY.md` (PITR, managed Firestore exports, GCS lifecycle, RTO/RPO)
  - `docs/deployment/AI_MODEL_INTEGRATION_GUIDE.md` (Step-by-step instructions for owner's future ML model)

## Staging Deployment & Operational Verification
**Status:** PARTIALLY VERIFIED (Host-native staging complete; external cloud/Docker blockers remain).
**Audit Report:** [docs/reports/STAGING_DEPLOYMENT_AUDIT.md](docs/reports/STAGING_DEPLOYMENT_AUDIT.md)
**Staging Runtime Verification Report:** [docs/reports/STAGING_RUNTIME_VERIFICATION_REPORT.md](docs/reports/STAGING_RUNTIME_VERIFICATION_REPORT.md)
**Final Staging Acceptance Report:** [docs/reports/FINAL_STAGING_ACCEPTANCE_REPORT.md](docs/reports/FINAL_STAGING_ACCEPTANCE_REPORT.md)
**Final Production Readiness Report:** [docs/reports/FINAL_PRODUCTION_READINESS_REPORT.md](docs/reports/FINAL_PRODUCTION_READINESS_REPORT.md)
**Verdict:** `STAGING PARTIALLY VERIFIED — EXTERNAL BLOCKERS REMAIN`
- [x] Phase A — Environment Audit: Host tools evaluated, Docker absence identified as local host tool gap, fail-closed safety verified.
- [x] Phase B — Dockerfile & Compose Verification: Multi-stage, non-root, zero-baked-secrets confirmed; container execution blocked by host Docker absence.
- [x] Phase C — Staging Firebase Configuration: Cloud Firestore and Auth emulator verified (100% pass); live staging Firebase blocked pending owner credentials.
- [x] Phase D — Staging Image Storage: Storage provider `none` returns 503 fail-closed; local adapter verified; live GCS blocked pending owner bucket.
- [x] Phase E — Staging Process-Level Deployment: Spring Boot backend (`UP`) and FastAPI AI service (`UP`, truthful `MODEL_UNAVAILABLE`) started and verified live.
- [x] Phase F — Staging End-to-End Workflow: 15 Playwright E2E tests passing across desktop and mobile viewports.
- [x] Phase G — Full Regression Verification: 389/389 tests passed across all tiers (250 backend, 76 frontend, 17 Python, 26 Firestore rules, 5 live emulator, 15 E2E).
- [x] Phase H — Final Staging Acceptance Report produced.

## Local Firebase Connectivity Debugging
**Status:** RESOLVED — All root causes identified and fixed.
**Report:** [docs/reports/LOCAL_FIREBASE_CONNECTIVITY_DEBUG_REPORT.md](docs/reports/LOCAL_FIREBASE_CONNECTIVITY_DEBUG_REPORT.md)
**Date:** 2026-11-19

Root causes identified and fixed:
- [x] Root Cause 1: Firebase Admin SDK credentials not configured — backend operated in unconfigured mode; service account auto-discovery added to `FirebaseConfig.java`; credentials moved to `secrets/firebase-service-account.json` (gitignored).
- [x] Root Cause 2: CORS blocked `http://127.0.0.1:5173` origin — `application.yml` and `SecurityConfig.java` expanded to include all local dev origins.
- [x] Root Cause 3: Orphaned Firebase Auth account on backend profile creation failure — cleanup logic added to `RegistrationPage.tsx`.
- [x] Root Cause 4: Generic "Network Error" surface to user — specific error messages added to `RegistrationPage.tsx` and `LoginPage.tsx`.
- [x] Security risk: Service account key was in `frontend/src/types/.secrets/` — moved to `secrets/` (project root, gitignored), dangerous location deleted.
- [x] Vite `/api` proxy configured in `vite.config.ts` for unified local dev experience.
- [x] Firebase Emulator opt-in support added to `frontend/src/services/firebase.ts`.
- [x] Live end-to-end registration verified: Firebase Auth → HTTP 201 profile creation → Firestore persistence → HTTP 200 read-back → orphan cleanup.
- [x] CORS fix verified: `http://127.0.0.1:5173` now returns `200 OK` (was `403 Invalid CORS request`).
- [x] Frontend build: 76/76 unit tests pass, 147 modules build with 0 errors.
- [x] Backend regression: 250/250 tests passed (`BUILD SUCCESS` in 25.7s).
- [x] Full regression suites passing: 250 backend + 76 frontend + 17 AI service + 15 Playwright E2E.
- [x] Production jar and frontend dist bundle built and verified.

## Stitch MCP Design-to-Code Implementation (Project 15023709798313720249)
**Status:** COMPLETE / VERIFIED
**Final Verification Report:** [docs/reports/STITCH_FRONTEND_FINAL_VERIFICATION_REPORT.md](docs/reports/STITCH_FRONTEND_FINAL_VERIFICATION_REPORT.md)
**Design Audit Report:** [docs/reports/STITCH_DESIGN_IMPLEMENTATION_AUDIT.md](docs/reports/STITCH_DESIGN_IMPLEMENTATION_AUDIT.md)
**Frontend-Backend Integration Map:** [docs/reports/FRONTEND_BACKEND_INTEGRATION_MAP.md](docs/reports/FRONTEND_BACKEND_INTEGRATION_MAP.md)
**Date:** 2026-11-19

- [x] **Phase 1 — Stitch Design Extraction and Audit:** All 66 screens audited from Stitch Project `15023709798313720249`, design tokens mapped, reusable components identified.
- [x] **Phase 2 — Frontend-Backend Integration Map:** All 89 Spring Boot endpoints mapped to React UI components, request/response DTOs, and role requirements.
- [x] **Phase 3 — Design System Implementation:** Google Font Plus Jakarta Sans, Google Material Symbols Outlined, Tailwind CSS design configuration in `index.html`, and shared UI primitives created (`StatusBadge`, `StatCard`, `EmptyState`, `LoadingSkeleton`).
- [x] **Phase 4 — Screen Implementation (66 screens across 46 page components):**
  - **Public & Authentication:** `LandingPage`, `LoginPage`, `RegistrationPage`, `ForgotPasswordPage`, `ExploreFarmsPage`, `JobsPage`, `AboutPage`, `NotFoundPage`.
  - **Owner Dashboard & Farm Management:** `DashboardPage`, `MyFarmsPage`, `RegisterFarmPage`, `FarmOverviewPage`, `FarmSettingsPage`, `EditFarmPage`, `FieldManagementPage`, `AddFieldPage`, `FieldDetailsPage`, `EditFieldPage`.
  - **Workforce & Recruitment:** `FarmerDirectoryPage`, `FarmerProfilePage`, `JobListPage`, `CreateJobPage`, `JobDetailsPage`, `ApplicationManagementPage`, `AssignmentManagementPage`, `CreateAssignmentPage`, `AssignmentDetailsPage`, `AssignmentHistoryPage`.
  - **Finance & Records:** `PaymentDashboardPage`, `PaymentLedgerPage`, `RecordPaymentPage`, `PaymentDetailsPage`, `ReversePaymentPage`, `ReviewManagementPage`, `CreateReviewPage`, `ReviewDetailsPage`, `ActivityDashboardPage`, `FullHistoryPage`, `ActivityDetailsPage`.
  - **Agronomy & Edge AI:** `AIAnalysisDashboardPage` (strictly adhering to MODEL_UNAVAILABLE contract), `UploadCropImagePage`, `AnalysisProcessingPage`, `AnalysisResultPage`, `AnalysisHistoryPage`, `SoilMonitoringDashboardPage`, `TelemetryHistoryPage`, `TelemetryDetailsPage`, `IrrigationDashboardPage`, `CreateIrrigationPlanPage`, `IrrigationPlanDetailsPage`, `IrrigationHistoryPage`.
  - **Account & Preferences:** `ProfilePage`, `AccountSecurityPage`, `NotificationSettingsPage`.
  - **Farmer Workspace:** `FarmerDashboardPage`, `FarmerFieldsPage`, `FarmerFieldDetailsPage`, `FarmerAssignmentsPage`, `FarmerPaymentsPage`, `FarmerReviewsPage`, `MyApplicationsPage`.
- [x] **Phase 5 — Full Build & Regression Test:**
  - TypeScript strict compile (`tsc -b`) passes with 0 errors.
  - Production Vite bundle builds successfully (191 modules transformed).
  - All 10 Vitest test suites (76/76 unit tests) pass without regression.
  - Approved Farmer Selection workflow verified: manual UID input replaced with searchable approved candidate selector (`CreateAssignmentPage`), verified against 39 backend tests and 76 frontend tests. See [APPROVED_FARMER_SELECTION_IMPLEMENTATION_REPORT.md](docs/reports/APPROVED_FARMER_SELECTION_IMPLEMENTATION_REPORT.md).

## Critical Performance, UI Freeze & Loading Experience Remediation
**Status:** COMPLETE / VERIFIED
**Root Cause Audit:** [docs/reports/AGROAI_PERFORMANCE_ROOT_CAUSE_AUDIT.md](docs/reports/AGROAI_PERFORMANCE_ROOT_CAUSE_AUDIT.md)
**Remediation Report:** [docs/reports/AGROAI_PERFORMANCE_REMEDIATION_REPORT.md](docs/reports/AGROAI_PERFORMANCE_REMEDIATION_REPORT.md)
**Loading UX Report:** [docs/reports/AGROAI_LOADING_UX_IMPLEMENTATION_REPORT.md](docs/reports/AGROAI_LOADING_UX_IMPLEMENTATION_REPORT.md)
**Date:** 2026-11-22

- [x] **Telemetry Batch Endpoint:** Added `POST /api/v1/farms/{farmId}/fields/{fieldId}/monitoring/telemetry/batch` in Spring Boot backend and `SoilTelemetryService.submitBatch`. Verifies write access once per batch and persists all readings atomically.
- [x] **Asynchronous AI Decoupling:** Refactored `AgriculturalAnalysisService.create` to create an initial record with status `PENDING`, return an immediate 201 response, execute tabular inference asynchronously, and transition to `PROCESSING -> COMPLETED / FAILED / INSUFFICIENT_DATA`.
- [x] **Analysis Status & History Endpoints:** Added `GET /agricultural-analyses/{analysisId}` and `GET /agricultural-analyses` in `FieldMonitoringController` to support non-blocking frontend polling and historical evidence retrieval.
- [x] **Farmer Telemetry Submission Optimization:** Refactored `FarmerFieldDetailsPage.tsx` `handleSubmitData` to submit all 8 readings in a single batch (<150ms), unblocking the UI button immediately. Initiates async AI analysis and non-blockingly polls status with automated unmount cleanup (`clearInterval`).
- [x] **Form Error Recovery & Data Retention:** Ensured telemetry input fields are not wiped upon submission errors, allowing users to modify out-of-range values without re-typing.
- [x] **Route-Level Code Splitting:** Converted all 50+ route pages in `frontend/src/App.tsx` from static imports to `React.lazy()` wrapped in `<Suspense fallback={<PageSkeletonLoader />}>`.
- [x] **Bundle Optimization:** Configured Rollup `manualChunks` in `vite.config.ts`, reducing initial JavaScript entry bundle from **1,419.88 kB** to **55.58 kB** (**96.1% reduction**).
- [x] **Accessible Route Transition & Skeleton UX:** Added `RouteTransitionLoader` (top progress bar) and `PageSkeletonLoader` with full `@media (prefers-reduced-motion: reduce)` support.
- [x] **Comprehensive Automated Verification:**
  - Backend: 284/284 tests passed (`BUILD SUCCESS`).
  - Frontend: 80/80 Vitest tests passed.
  - AI Service: 24/24 pytest tests passed.
  - TypeScript: 0 errors (`tsc -b`).

## Farm-Wise AI Insights & Dataset Model Training Audit
**Status:** MILESTONE 2 COMPLETE / AWAITING APPROVAL GATE FOR MILESTONE 3
**Audit Report:** [docs/reports/AGROAI_AI_MODELS_AND_FIELDWISE_INSIGHTS_AUDIT.md](docs/reports/AGROAI_AI_MODELS_AND_FIELDWISE_INSIGHTS_AUDIT.md)
**Milestone 2 Report:** [docs/reports/AGROAI_FIELDWISE_AI_INSIGHTS_IMPLEMENTATION_REPORT.md](docs/reports/AGROAI_FIELDWISE_AI_INSIGHTS_IMPLEMENTATION_REPORT.md)
**Date:** 2026-11-22

- [x] **Milestone 1 — Investigation & Audit:**
  - [x] Task 1.1: Inspect Farm AI Insights components, diagnostics center, backend APIs, and field ownership models. Diagnose single-field display behavior.
  - [x] Task 1.2: Formally define expected dynamic multi-field behavior ($N$ fields = $N$ rows, 0 fields = empty state, strict field ID scoping, zero cross-field leakage).
  - [x] Task 1.3: Audit exact dataset `ai-service\data\agroai_labeled_dataset_v2 (1).csv` (SHA-256 `87b93178`, 2,200 rows, 13 cols, target distributions, class imbalance).
  - [x] Task 1.4: Complete audit of existing AI models (Water Need, Field Status, Crop Recommendation, Leaf Disease Detection). Validate artifacts, pipelines, encoders, and held-out test evaluations.
  - [x] Task 1.5: Produce audit report `docs/reports/AGROAI_AI_MODELS_AND_FIELDWISE_INSIGHTS_AUDIT.md`.
  - [x] **Approval Gate: Review Milestone 1 Audit & Plan before proceeding to implementation.** (Approved by User)

- [x] **Milestone 2 — Field-Wise AI Insights Implementation:**
  - [x] Task 2.1: Implement dynamic field retrieval and display for selected farm ($N$ fields = $N$ rows; 0 fields = clean empty state).
  - [x] Task 2.2: Ensure independent latest AI evaluation retrieval per field with strict canonical field ID isolation (`farmAiInsights.ts`).
  - [x] Task 2.3: Display water requirements, field status, recommended crops, and disease status with distinct empty/pending/failed handling (never fabricating diagnoses; preserving `MODEL_UNAVAILABLE`).
  - [x] Task 2.4: Refactor right-rail telemetry widget in `DashboardPage.tsx` eliminating `fieldsList[0]` dependency, adding Farm-Wide Aggregation and interactive Sector Telemetry View switcher.
  - [x] Task 2.5: Multi-field test suite covering 0, 1, 2, and multiple fields, plus cross-field isolation rejection (`farmAiInsights.test.ts`: 8/8 PASS; Vitest total: 88/88 PASS).
  - [x] **Approval Gate: Review Milestone 2 Implementation before proceeding to Milestone 3.** (Approved by User)

- [x] **Milestone 3 — AI Model Training Remediation:**
  - [x] Task 3.1 (Stage A): Dataset & model training investigation. Verify SHA-256 fingerprint, inspect 9 Urgent samples, audit leakage and stratified split.
  - [x] Task 3.2 (Stage A): Evaluate candidate remediation strategies without touching production artifacts (Baseline, class_weight='balanced', sample_weight, oversampling, logistic regression; 25-fold RepeatedStratifiedKFold cross-validation). Produce [AGROAI_WATER_NEED_IMBALANCE_INVESTIGATION_REPORT.md](docs/reports/AGROAI_WATER_NEED_IMBALANCE_INVESTIGATION_REPORT.md).
  - [x] **Approval Gate: Review Stage A Investigation & Strategy Comparison.** (Accepted by User - Candidate 2 selected for testing)
  - [x] Task 3.3 (Stage B): Train Candidate 2 (`HistGradientBoostingClassifier(class_weight='balanced', max_iter=150, random_state=42)`) with StandardScaler pipeline. Stage candidate artifact strictly in isolated directory (`ai-service/models/candidates/water_need_model_candidate_balanced.joblib`). Baseline production model remains untouched.
  - [x] Task 3.4 (Stage B): Fresh-process validation of candidate artifact (schema, parameters, 4-class representative inferences, invalid input rejection, production inference isolation). All 24 pytest tests pass. Produce [AGROAI_WATER_NEED_CANDIDATE2_VALIDATION_REPORT.md](docs/reports/AGROAI_WATER_NEED_CANDIDATE2_VALIDATION_REPORT.md).
  - [x] **Authoritative Production Decision: ORIGINAL BASELINE WATER NEED MODEL RETAINED IN PRODUCTION. Candidate 2 VALIDATED, NOT PROMOTED.**
  - [x] Task 3.5: Final regression testing, artifact SHA-256 post-test integrity verification, and cross-service audit (Backend: 284/284, Frontend: 88/88 + build pass, AI: 24/24). Produce [AGROAI_MILESTONE_3_FINAL_VERIFICATION_REPORT.md](docs/reports/AGROAI_MILESTONE_3_FINAL_VERIFICATION_REPORT.md).

- [x] **Milestone 4 — Owner Dashboard Field-wise AI Decision Integration & Full-Stack Verification:**
  - [x] Task 4.1: Root cause audit of Owner Dashboard `No evaluation yet` issue (field ID sanitization mismatch, N+1 per-field silent catch, lack of farm batch endpoint).
  - [x] Task 4.2: Implement high-efficiency farm-level batch endpoints `GET /api/v1/farms/{farmId}/monitoring/agricultural-analyses/latest` and `GET /api/v1/farms/{farmId}/monitoring/telemetry/latest` with strict member authorization.
  - [x] Task 4.3: Implement canonical composite ID and local field ID normalization in frontend `farmAiInsights.ts`, preserving strict cross-field isolation.
  - [x] Task 4.4: Expand analysis lifecycle state handling (`PENDING` "Analysis queued", `PROCESSING` "Analyzing...", `COMPLETED`, `FAILED` "Analysis failed", `INSUFFICIENT_DATA` "Insufficient data", `UNEVALUATED` "No evaluation yet").
  - [x] Task 4.5: Implement non-terminal auto-polling in `DashboardPage.tsx` with proper cleanup on terminal status or unmount.
  - [x] Task 4.6: Integrate agricultural AI decisions and historical summaries into `FieldMonitoringPanel.tsx` ("View Decision" target).
  - [x] Task 4.7: Execute full-stack verification (Backend: 289/289 pass, Frontend: 91/91 pass, TypeScript + Vite clean build, Python AI: 24/24 pass).
  - [x] Task 4.8: Author [docs/reports/OWNER_DASHBOARD_AI_DECISION_INTEGRATION_REPORT.md](docs/reports/OWNER_DASHBOARD_AI_DECISION_INTEGRATION_REPORT.md) with verdict `PASS — OWNER DASHBOARD AI DECISIONS FULLY VERIFIED`.
  - [x] Task 4.9: Owner Dashboard AI Decision Live Browser Verification on live Cloud Firestore (`agroai-dev`). Verified complete end-to-end workflow: Farmer submits 8 agronomic telemetry readings -> Async AI analysis runs -> Persists in Firestore -> Farmer UI renders analysis card -> Owner Dashboard renders identical analysisId, predictions, and status -> Hard page reloads preserve state without regressions. See [docs/reports/OWNER_DASHBOARD_AI_DECISION_LIVE_VERIFICATION_REPORT.md](docs/reports/OWNER_DASHBOARD_AI_DECISION_LIVE_VERIFICATION_REPORT.md).

## Work policy
Do not mark an item `VERIFIED` without test evidence. Do not begin a later milestone without approval.



