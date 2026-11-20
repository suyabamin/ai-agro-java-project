# AgroAI — Milestone 4 Test Report
## Automated Test Execution, Coverage Reconciliation & Verification

**Project:** AgroAI Platform  
**Repository:** `D:\agro-ai-java-project`  
**Milestone:** 4 — Farmer Marketplace  
**Execution Date:** November 17, 2026  
**Status:** 100% PASS across Backend, Frontend, Rules Emulator, and AI Service  

---

## 1. Test Execution Summary

| Test Suite | Framework / Tool | Baseline Tests | Milestone 4 New Tests | Total Tests | Status |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Java Backend** | JUnit 5 / Surefire / Mockito | 116 | +49 | **165** | **PASS (0 failures)** |
| **Frontend Unit** | Vitest | 30 | +22 | **52** | **PASS (0 failures)** |
| **Rules Emulator** | Firebase Rules Emulator / Vitest | 16 | +4 | **20** | **PASS (0 failures)** |
| **Python AI Service** | Pytest | 5 | 0 | **5** | **PASS (0 failures)** |
| **TOTAL** | | **167** | **+75** | **242** | **100% PASS** |

---

## 2. Backend Test Inventory (+49 New Tests)

### 1. `JobDomainTest.java` (5 Tests)
- `[DOM-JOB-01]` Job entity defaults (DRAFT status, zero applications, version 1).
- `[DOM-JOB-02]` Job ID pattern validation rejects malformed characters.
- `[DOM-JOB-03]` Number of positions validation (minimum 1).
- `[DOM-JOB-04]` Salary range validation (minimumSalary <= maximumSalary).
- `[DOM-JOB-05]` OCC version incrementation behavior.

### 2. `FirestoreJobRepositoryFailClosedTest.java` (3 Tests)
- `[REPO-JOB-01]` Fail-closed behavior on uninitialized Firebase when querying jobs.
- `[REPO-JOB-02]` Dev in-memory fallback CRUD operations.
- `[REPO-JOB-03]` Pagination bounds handling for public marketplace queries.

### 3. `FirestoreJobApplicationRepositoryFailClosedTest.java` (3 Tests)
- `[REPO-APP-01]` Deterministic ID query fails closed when uninitialized.
- `[REPO-APP-02]` Dev in-memory duplicate application rejection.
- `[REPO-APP-03]` Dev in-memory status transition and history persistence.

### 4. `JobServiceTest.java` (8 Tests)
- `[SVC-JOB-01]` Create Job as Owner or Manager succeeds with DRAFT or PUBLISHED status.
- `[SVC-JOB-02]` Create Job as Observer throws UnauthorizedResourceAccessException.
- `[SVC-JOB-03]` Update Job succeeds and increments entity version (OCC).
- `[SVC-JOB-04]` Update Job with mismatched expected version throws StaleVersionException.
- `[SVC-JOB-05]` Publish Job transitions DRAFT/PAUSED to PUBLISHED.
- `[SVC-JOB-06]` Pause and Close Job transitions succeed.
- `[SVC-JOB-07]` Archive Job succeeds for Owner but throws 403 for Manager.
- `[SVC-JOB-08]` Public job listing query correctly enriches public farm details.

### 5. `JobApplicationServiceTest.java` (8 Tests)
- `[SVC-APP-01]` Apply for published job succeeds with deterministic doc ID.
- `[SVC-APP-02]` Duplicate application throws DuplicateApplicationException (409 Conflict).
- `[SVC-APP-03]` Farm member applying to own farm throws IllegalArgumentException.
- `[SVC-APP-04]` Candidate withdraws application marks status WITHDRAWN.
- `[SVC-APP-05]` Application review workflow: SUBMITTED → UNDER_REVIEW → SHORTLISTED → REJECTED.
- `[SVC-APP-06]` Application approval: SHORTLISTED → APPROVED (Verifies NO field assignments created).
- `[SVC-APP-07]` Invalid state transition (e.g. SUBMITTED directly to APPROVED) throws InvalidStateTransitionException.
- `[SVC-APP-08]` Candidate discussion messaging persists and logs correctly.

### 6. `JobControllerIntegrationTest.java` (14 Tests)
- `[API-JOB-01]` POST `/api/v1/farms/{farmId}/jobs` as Owner returns 201 Created.
- `[API-JOB-02]` POST `/api/v1/farms/{farmId}/jobs` as Manager returns 201 Created.
- `[API-JOB-03]` POST `/api/v1/farms/{farmId}/jobs` as Observer returns 403 Forbidden.
- `[API-JOB-04]` POST `/api/v1/farms/{farmId}/jobs` unauthenticated returns 401 Unauthorized.
- `[API-JOB-05]` GET `/api/v1/farms/{farmId}/jobs` as active member returns 200 OK.
- `[API-JOB-06]` GET `/api/v1/farms/{farmId}/jobs` as non-member returns 403 Forbidden.
- `[API-JOB-07]` PUT `/api/v1/farms/{farmId}/jobs/{jobId}` as Manager returns 200 OK.
- `[API-JOB-08]` PUT `/api/v1/farms/{farmId}/jobs/{jobId}` stale version returns 409 Conflict.
- `[API-JOB-09]` POST `/api/v1/farms/{farmId}/jobs/{jobId}/publish` returns 200 OK.
- `[API-JOB-10]` POST `/api/v1/farms/{farmId}/jobs/{jobId}/pause` and `/close` return 200 OK.
- `[API-JOB-11]` POST `/api/v1/farms/{farmId}/jobs/{jobId}/archive` as Owner returns 200 OK.
- `[API-JOB-12]` POST `/api/v1/farms/{farmId}/jobs/{jobId}/archive` as Manager returns 403 Forbidden.
- `[API-JOB-13]` GET `/api/v1/public/jobs` public unauthenticated returns 200 OK with filtered list.
- `[API-JOB-14]` GET `/api/v1/public/jobs/{jobId}` public unauthenticated returns 200 OK with enriched farm data.

### 7. `ApplicationControllerIntegrationTest.java` (8 Tests)
- `[API-APP-01]` POST `/api/v1/jobs/{jobId}/applications` returns 201 Created.
- `[API-APP-02]` POST `/api/v1/jobs/{jobId}/applications` duplicate submission returns 409 Conflict.
- `[API-APP-03]` GET `/api/v1/users/me/applications` returns 200 OK with candidate's submissions.
- `[API-APP-04]` POST `/api/v1/applications/{appId}/withdraw` candidate withdrawal returns 200 OK.
- `[API-APP-05]` GET `/api/v1/farms/{farmId}/applications` as Manager returns 200 OK.
- `[API-APP-06]` GET `/api/v1/farms/{farmId}/applications` as Observer returns 403 Forbidden.
- `[API-APP-07]` Full recruitment workflow: review, shortlist, approve returns 200 OK (verifies no field assignments).
- `[API-APP-08]` Private candidate discussion thread: POST and GET messages return 200 OK.

---

## 3. Frontend Test Inventory (+22 New Tests)

### `jobService.test.ts` (10 Tests)
- `fetchFarmJobs` calls GET `/farms/{farmId}/jobs` with default `includeUnpublished=true`.
- `fetchJobById` calls GET `/farms/{farmId}/jobs/{jobId}`.
- `createJob` calls POST `/farms/{farmId}/jobs` with payload.
- `updateJob` calls PUT `/farms/{farmId}/jobs/{jobId}` with OCC version.
- `publishJob` calls POST `/farms/{farmId}/jobs/{jobId}/publish`.
- `pauseJob` calls POST `/farms/{farmId}/jobs/{jobId}/pause`.
- `closeJob` calls POST `/farms/{farmId}/jobs/{jobId}/close`.
- `archiveJob` calls POST `/farms/{farmId}/jobs/{jobId}/archive`.
- `fetchPublicJobs` calls GET `/public/jobs` with filters.
- `fetchPublicJobById` calls GET `/public/jobs/{jobId}`.

### `applicationService.test.ts` (12 Tests)
- `applyForJob` calls POST `/jobs/{jobId}/applications`.
- `getMyApplications` calls GET `/users/me/applications` with pagination.
- `getApplicationById` calls GET `/applications/{applicationId}`.
- `withdrawApplication` calls POST `/applications/{applicationId}/withdraw`.
- `getFarmApplications` calls GET `/farms/{farmId}/applications` with filters.
- `reviewApplication` calls POST `/farms/{farmId}/applications/{applicationId}/review`.
- `shortlistApplication` calls POST `/farms/{farmId}/applications/{applicationId}/shortlist`.
- `approveApplication` calls POST `/farms/{farmId}/applications/{applicationId}/approve`.
- `rejectApplication` calls POST `/farms/{farmId}/applications/{applicationId}/reject`.
- `getApplicationHistory` calls GET `/applications/{applicationId}/history`.
- `getApplicationMessages` calls GET `/applications/{applicationId}/messages`.
- `sendMessage` calls POST `/applications/{applicationId}/messages`.

---

## 4. Firestore Security Rules Tests (+4 New Tests)

Execution command: `npx firebase emulators:exec --only firestore "npm --prefix frontend run test:rules"`
Result: **20 passed (20)**

### New Rule Tests:
- `[RULE-17]` Published jobs publicly readable; DRAFT jobs require active farm membership.
- `[RULE-18]` Candidate applicant and active farm member can read application; strangers cannot.
- `[RULE-19]` Candidate applicant and active farm member can read history and messages; strangers cannot.
- `[RULE-20]` All direct client writes to jobs, applications, history, messages denied (`allow write: if false`).

---

## 5. Python AI Service Tests (5 Baseline Tests)

Execution command: `py -m pytest`
Result: **5 passed in 0.97s** (100% healthy, zero regressions).

---

## 6. Conclusion

The entire multi-tier test harness for AgroAI (Java, TypeScript, Firestore Rules Emulator, Python) executed with **zero failures and zero regressions**. Milestone 4 satisfies all testing requirements.
