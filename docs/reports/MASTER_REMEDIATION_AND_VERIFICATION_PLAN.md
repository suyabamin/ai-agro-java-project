# Master Remediation and Verification Plan

**Date:** 2026-11-18  
**Scope:** Existing AgroAI repository; local, testable corrections only. Historical M1–M5 owner acceptance is preserved. M5 technical findings remain open. M6 remains technically NOT READY and owner acceptance is pending. M7 is not started/accepted and M8 is blocked.

## Executive inventory

The repository contains the React/Vite client, Spring Boot API, FastAPI model-independent inference service, Firestore Rules and emulator configuration, existing M1–M6 reports, and current tests. Git has zero tracked files and reports the workspace as untracked. No existing user work will be reset or removed.

| Severity | Finding and reproduction | Root cause / modules | Planned correction and closure evidence | Status/dependency |
|---|---|---|---|---|
| CRITICAL | With Firebase Web config absent, production previously rendered mock sign-in; mock auth persisted a user/token. | UI branch checked only isFirebaseClientConfigured; AuthContext and getCurrentIdToken accepted mock state without Vite DEV restriction. | DEV guards added to LoginPage, RegistrationPage, LandingPage, AuthContext and firebase.ts. Regression: frontend 70/70; unconfigured production build + Playwright preview 1/1; existing mock-auth UI remains separately tested. | CLOSED for this source-level defect; Firebase authenticated production flow remains NOT TESTED. |
| CRITICAL | Existing live-auth test created a user, sent verification email, attempted write, persisted ID token, omitted cleanup, and did not assert write denial. | `frontend/src/live-test/liveAuthClient.test.ts`. | Rewritten as opt-in sign-in of owner-provisioned disposable identity; requires explicit enable/approval/project match and credentials, no creation/email/write/token persistence; sign-out in finally. `npm run test:live` verified one test skipped. | Source hazards remediated; live test deliberately NOT TESTED. |
| HIGH | Existing Admin key resides under frontend source. It is ignored and not imported, but is in an inappropriate location. | frontend/src/types/.secrets/... and .gitignore. | Do not read/use the key. Preserve it; document owner action to move outside repository and rotate only if it was exposed/committed. Verify ignore/tracking/import/bundle status without secret contents. | Owner action; no key operation authorized. |
| HIGH | M5 technical audit records lifecycle recovery/races, pagination/performance, browser E2E, live transaction, repeat-tenure and TASKS follow-ups. | AssignmentLifecycleService, FieldAssignmentService/repositories, related tests and M5 reports. | Reproduce gaps locally; add deterministic fault/recovery/concurrency tests and make safe code fixes where feasible. Do not change historical owner acceptance or report unresolved external/live checks as passed. | OPEN; isolate local work and report limits. |
| HIGH | M6 real Firebase Auth, Admin persistence and complete authenticated flow are unverified. Production storage is unconfigured. | Frontend auth, Spring verifier/repositories, FastAPI client and M6 reports. | Keep the model-unavailable behavior; add model-independent tests and improve fail-safe paths. Do not use credentials or claim live integration. Production provider selection and live tests stay owner-blocked. | BLOCKED on project authorization/provider decisions; independent local tests remain feasible. |
| MEDIUM | Benchmark exception paths aborted without counting/reporting the failed sample. | ai-service/tools/benchmark_m6.py request_once and summary. | Exceptions and invalid/non-JSON responses now count as failed samples with reasons; rerun completed at 100 preprocessing/80 in-process API samples with zero failures. No production performance claim. | CLOSED for result/error accounting; local-only benchmark. |
| MEDIUM | Frontend production build has a >500 kB bundle warning. | Vite output; no performance budget documented. | Inspect bundle composition and apply code splitting only if justified without changing behavior; record before/after build evidence. | OPEN; investigate first. |
| MEDIUM | No CI workflow/deployment manifest is present; provider selection is intentionally pending. | Repository inventory and deployment docs. | Add no deploy automation. Document feasible local verification commands and current absence; do not select providers. | NOT IMPLEMENTED by design; owner decision required for deployment. |
| LOW | Existing reports and tracker have historical/technical status wording that can conflict with current evidence. | docs/reports, TASKS.md. | Update only reports touched by actual verified changes; preserve owner acceptance and distinguish tested/blocked/not tested. | OPEN; ongoing. |

## Product traceability snapshot

| Product area | Frontend | Backend/data | AI/Rules/tests | Current verification boundary |
|---|---|---|---|---|
| Auth/profile | AuthContext, login/registration, profile services | Firebase token filter, profile services/repos | Rules and security tests | Local backend tests pass; real Firebase auth pending. |
| Farms/fields | farm/field pages and services | farm/field services/repos | contextual security tests, Rules | Current full local suites are the aggregate; no per-feature current live test. |
| Marketplace/applications | job/application pages/services | job/application services/repos | domain/controller tests, Rules | Local suite; payment/review work remains unimplemented/open in TASKS. |
| Assignments/farmer workspace | assignment services/components/workspace | assignment lifecycle/services/repos | lifecycle/security tests and Rules | M5 technical follow-ups remain open despite owner acceptance. |
| Crop monitoring | FieldMonitoringPanel and monitoring service | monitoring controller/services/repository/storage port | FastAPI model-unavailable tests and Rules | Local mocks/emulator and unit coverage; real Auth/Firestore/storage flow not tested. |
| AI inference | upload/result UI | authenticated proxy/client | FastAPI validation, registry, preprocessing | MODEL_UNAVAILABLE only; no trained model or real inference. |
| Irrigation/telemetry/history | monitoring panel | telemetry, analysis, irrigation, history services | backend/frontend tests, indexes, Rules | Local tests; no production data path verified. |
| Production operations | no provider-specific hosting path | environment config only | no CI/deployment infra found | Not deployed; no production readiness evidence. |

## Workstreams and acceptance criteria

### 1. Security and credential safety
- Mock auth, mock token restore and mock-token retrieval are impossible in production builds.
- Live tests cannot contact Firebase without multiple explicit project and non-production opt-ins.
- No ID token, OAuth token, private key or user secret is printed or persisted.
- The service-account key is not imported/bundled; do not read or move it autonomously.
- Firebase Rules and backend authorization negative tests remain intact and are not weakened.

### 2. M5 technical follow-ups
- Add local tests for lifecycle batch failure/restart and deterministic active-assignment race behavior where the repository abstractions permit.
- Preserve all historical assignment records and owner acceptance.
- Clearly isolate what still requires a Firestore emulator/live isolated project.
- Keep payment, ratings, lifecycle, pagination and repeat-tenure open items visible unless implemented and verified.

### 3. M6 and integration
- Verify image validation, unavailable storage, model unavailable, telemetry, irrigation, history and pagination using current unit/emulator suites.
- No provider/model choice or live Firebase call.
- M6 owner acceptance remains pending until the owner reviews evidence and external prerequisites.

### 4. Frontend, backend and AI quality
- Preserve existing design and API contracts.
- Add focused tests for security guards and failures.
- Run frontend tests/lint/build/production-like browser checks; Python tests/benchmark; Maven tests; emulator Rules tests.
- Do not treat mock-auth or emulator results as live integration.

### 5. Documentation and submission
- Create execution, test-evidence, security, integration, performance and submission-readiness reports only from executed evidence.
- Record exact commands, counts, environment, blocked suites, external blockers and files changed.
- Do not edit MEMORY.md.

## External blockers

- Owner must revoke the previously exposed Firebase CLI OAuth grant/session and clear local CLI state; this agent will not access or alter it.
- Owner must confirm any isolated Firebase project, disposable identities and allowed operations before any future live test.
- Owner must move the ignored Admin key outside the repository using a secure owner-controlled process; no credential is used here.
- M6 production image storage requires an owner-approved provider if in scope.
- Real disease inference requires the owner's trained, licensed and evaluated model; do not supply one.
- No production hosting, budget, domain, observability or release target is approved.

## Execution order

1. Reproduce and close local frontend production mock-auth exposure.
2. Harden live-test source so default commands skip it and only explicit isolated test setup can opt in; do not run it.
3. Add/repair local M5 lifecycle and concurrency tests where deterministic and non-destructive.
4. Fix benchmark per-request exception reporting and rerun local measurements.
5. Re-run all feasible local suites and inspect artifacts.
6. Update execution/evidence/security/integration/performance reports.
7. Stop with M6 owner acceptance pending and M7/M8 gates intact.

## Current execution update (2026-11-18)

The mock-auth source-level production exposure and unsafe live-test side effects were corrected. Current clean executions: frontend 70/70, Python 17/17, Maven 216/216, Firestore emulator 26/26 under explicit `demo-agroai`, development mock UI E2E 3/3 (desktop/390×844/430×932), and unconfigured production-preview E2E 1/1. The full current test count is 333 across these distinct suites; build/lint/benchmark are not tests. The parallel browser attempt is invalid due to concurrent Playwright artifact collisions and is not counted. See MASTER_TEST_EVIDENCE_REPORT.md. M5 live transaction/performance follow-ups, M6 live integration/storage/model blockers and credential owner actions remain open.
