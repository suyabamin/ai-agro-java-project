# AgroAI — Milestone 3 Phase 3A Test Report
## Comprehensive Test Execution, Concurrency & Security Verification

**Project:** AgroAI Platform  
**Milestone:** 3 — Farm and Field Management  
**Phase:** 3A — Farm Management, Membership Persistence & Public Projection Foundation  
**Report Date:** 2026-11-17  
**Test Frameworks:** JUnit 5, Spring MockMvc, Mockito, Vitest  
**Outcome:** ALL TEST SUITES PASSING (Zero Regressions)

---

## 1. Test Execution Summary

| Domain / Suite | Class / Module | Tests Executed | Passed | Failed | Errors |
|---|---|---|---|---|---|
| **Farm Domain & ID Arithmetic** | `FarmDomainTest` | 5 | 5 | 0 | 0 |
| **Fail-Closed Repository** | `FirestoreFarmRepositoryFailClosedTest` | 3 | 3 | 0 | 0 |
| **Farm & Membership Service** | `FarmServiceTest` | 7 | 7 | 0 | 0 |
| **Farm REST API & Security** | `FarmControllerIntegrationTest` | 11 | 11 | 0 | 0 |
| **Existing M1/M2 Backend Baseline** | Full Suite (`UserControllerTest`, `ContextualSecurityTest`, `RevocationPolicyIntegrationTest`, etc.) | 80 | 80 | 0 | 0 |
| **Frontend Farm Client Unit** | `farmService.test.ts` | 12 | 12 | 0 | 0 |
| **Existing Frontend Baseline** | `firebase.test.ts`, `apiClient.test.ts` | 11 | 11 | 0 | 0 |
| **Frontend Production Build** | TypeScript (`tsc -b`), Vite Bundle | 1 | 1 | 0 | 0 |

---

## 2. Detailed Test Cases & Results

### 2.1 Farm Domain & Identifier Arithmetic (`FarmDomainTest`)
- **[TEST-DOM-01] Farm ID Regex & Length Contract:** Validated `^[a-zA-Z0-9-]{1,64}$` for canonical `farm-<uuid>` format (41 chars). Rejects empty string, underscores (`_`), slashes (`/`), and lengths > 64 chars. **PASS**
- **[TEST-DOM-02] Composite Field ID Arithmetic:** Validated composite `{farmId}--{localFieldId}` <= 64 chars arithmetic: 41 chars farmId + 2 chars separator + 8 chars localFieldId = 51 chars; maximum bound 41 + 2 + 21 = 64 chars. Correctly rejects 65 chars. **PASS**
- **[TEST-DOM-03] Farm Domain Defaults:** Validated version initializes to 1, status to ACTIVE, activeFieldCount to 0, timestamps initialized, and soft-archival transitions. **PASS**
- **[TEST-DOM-04] Public Projection Allowlist Sanitization:** Validated `PublicFarmProjection.fromPrivate(farm)` copies only allowlist fields (name, district, division, totalAreaHectares, etc.) and strictly omits ownerUid, safeUid, detailedAddress, and private metadata. **PASS**
- **[TEST-DOM-05] Farm Membership Role & Status Transitions:** Validated role changes, active and revoked status tracking, and member metadata. **PASS**

### 2.2 Dual-Mode Fail-Closed Persistence (`FirestoreFarmRepositoryFailClosedTest`)
- **[FAIL-CLOSED-FARM-01] Dev/Offline Mode:** Safe in-memory store operates transparently when Firebase is uninitialized. **PASS**
- **[FAIL-CLOSED-FARM-02] Live Firestore Fail-Closed Safety:** In live mode (`isInitialized == true`), read failures throw `DatabaseUnavailableException` without silently degrading to in-memory store. **PASS**
- **[FAIL-CLOSED-FARM-03] Membership Fail-Closed Safety:** Live membership queries throw `DatabaseUnavailableException` on underlying Firestore SDK failures. **PASS**

### 2.3 Farm & Membership Service (`FarmServiceTest`)
- **[SVC-01] Public Farm Registration:** Atomically registers farm entity, OWNER membership, and public projection. **PASS**
- **[SVC-02] Private Farm Registration:** Atomically registers farm entity and OWNER membership; ensures public projection is NOT created. **PASS**
- **[SVC-03] Optimistic Concurrency:** Validates `expectedVersion`. Confirms version increment on valid update; throws `StaleVersionException` (HTTP 409) on stale update. **PASS**
- **[SVC-04] Visibility Transition Lifecycle:** Dynamic toggling: PRIVATE to PUBLIC creates projection; PUBLIC to PRIVATE purges projection. **PASS**
- **[SVC-05] Soft Archival:** Soft-archives farm, records `archivedAt`, increments version, and purges public projection. **PASS**
- **[SVC-06] Sole Owner Protection:** Protects sole active OWNER from demotion to MANAGER/OBSERVER and prevents revocation. **PASS**
- **[SVC-07] Member Management Lifecycle:** OWNER adds MANAGER (validates profile exists, prevents self-invite), updates role to OBSERVER, and performs soft revocation. **PASS**

### 2.4 Farm Controller MockMvc Integration (`FarmControllerIntegrationTest`)
- **[API-01] Unauthenticated Denial:** `GET /api/v1/farms` returns 401 Unauthorized without Bearer token. **PASS**
- **[API-02] Farm Registration:** `POST /api/v1/farms` returns 201 Created with canonical farm ID and OWNER role. **PASS**
- **[API-03] List My Farms:** `GET /api/v1/farms` returns authenticated user's active farms. **PASS**
- **[API-04] Non-Member Denial:** Non-member accessing `GET /api/v1/farms/{farmId}` receives 403 Forbidden. **PASS**
- **[API-05] Concurrency Conflict:** `PUT /api/v1/farms/{farmId}` with stale version returns 409 Conflict. **PASS**
- **[API-06] Visibility Toggle:** `PATCH /api/v1/farms/{farmId}/visibility` toggles visibility and increments version. **PASS**
- **[API-07] Farm Archival:** `POST /api/v1/farms/{farmId}/archive` returns 200 OK. **PASS**
- **[API-08] Add Member:** `POST /api/v1/farms/{farmId}/members` adds MANAGER and returns 201 Created. **PASS**
- **[API-09] Update Member Role:** `PATCH /api/v1/farms/{farmId}/members/{userId}` updates role to OBSERVER. **PASS**
- **[API-10] Revoke Member:** `DELETE /api/v1/farms/{farmId}/members/{userId}` soft-revokes membership. **PASS**
- **[API-11] Unauthenticated Public Discovery:** `GET /api/v1/public/farms` and `GET /api/v1/public/farms/{farmId}` return 200 OK without Bearer token; private farm returns 404 Not Found. **PASS**

### 2.5 Frontend Unit & Integration Tests (`farmService.test.ts`)
- **12 unit tests** covering all 12 API methods with Axios mocks and parameter assertions: 100% PASS.

---

## 3. Regression Verification

All 80 existing backend tests from Milestones 1 and 2 and all 11 existing frontend tests executed with zero regressions:
- Backend Health check endpoints: PASS
- Firebase Authentication filter: PASS
- Email verification policy: PASS
- High-risk token revocation check interceptor: PASS
- User profile initialization & reconciliation: PASS
- Custom claims synchronization (`safeUid`): PASS
