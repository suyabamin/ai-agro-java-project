# AgroAI — Milestone 3: Implementation Plan
## Farm and Field Management Execution Plan

**Project:** AgroAI Platform  
**Target Milestone:** Milestone 3 — Farm and Field Management  
**Revision:** Revision 2  
**Date:** 2026-11-17  
**Author:** Lead Software Architect & Security Engineer  
**Status:** PLANNING ONLY — PENDING USER APPROVAL (Strictly Documentation-Only — Zero Application Code Modified)  
**Implementation Authorization:** NOT GRANTED  
**Firebase Deployment Authorization:** NOT GRANTED  

---

## Revision History

| Revision | Date | Description | Status |
|---|---|---|---|
| **Revision 1** | 2026-11-17 | Initial Milestone 3 implementation plan. Structured into 3 phases (3A, 3B, 3C). Deferred `FarmMembershipRepository` Firestore implementation to Phase 3C; included assignment UI and worker hooks. | Superceded |
| **Revision 2** | 2026-11-17 | Comprehensive execution dependency correction: (1) Moved `FarmMembershipRepository` production Firestore persistence into Phase 3A (eliminating authorization dependency on in-memory stubs); (2) Added `PublicFarmProjectionService` and atomic projection transactions to Phase 3A; (3) Added `FarmMembershipController` to Phase 3A for membership management; (4) Standardized field IDs on `{farmId}--{localFieldId}` in Phase 3B; (5) Enforced transaction-based optimistic concurrency (`version`, `expectedVersion`, HTTP 409 Conflict) and `activeFieldCount` consistency; (6) Restated Gate 1 and Gate 2 review boundaries; (7) Completely removed farmer assignment implementation tasks, endpoints, and UI; (8) Locked live Firestore rules deployment. | **CURRENT AUTHORITATIVE BASELINE** |

---

## 1. Plan Overview & Execution Principles

Milestone 3 is structured into **three integrated delivery packages** (Phases 3A, 3B, and 3C) governed by **two major approval gates**.

```
+---------------------------------------------------------------------------------------------------+
|                              MILESTONE 3 EXECUTION ARCHITECTURE & GATES                           |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  [PHASE 3A: Farm Domain & Membership Foundation]                                                  |
|  - Farm domain model & validation (farm-<uuid>)                                                   |
|  - FirestoreFarmRepository (dual-mode live/fail-closed)                                           |
|  - FirestoreFarmMembershipRepository (dual-mode live/fail-closed)                                 |
|  - PublicFarmProjectionService (atomic dual-write projection engine)                              |
|  - FarmService & FarmMembershipService                                                            |
|  - FarmController (/api/v1/farms) & FarmMembershipController (/api/v1/farms/{farmId}/members)      |
|  - Transactional optimistic concurrency & visibility transitions                                 |
|  - Frontend: farmService.ts, FarmContext, FarmSwitcher, CreateFarmModal, FarmDashboardPage        |
|  - Tier 1 & Tier 2 Automated Tests                                                                |
|                                                                                                   |
|                                    │                                                              |
|                                    ▼                                                              |
|  [PHASE 3B: Field Management & Dedicated Field Dashboard]                                         |
|  - Field domain model & composite IDs ({farmId}--{localFieldId})                                  |
|  - FirestoreFieldRepository (dual-mode live/fail-closed)                                          |
|  - FieldService with atomic activeFieldCount increment/decrement                                 |
|  - FieldController (/api/v1/farms/{farmId}/fields)                                                |
|  - Soft archival enforcement (OWNER-only)                                                         |
|  - Frontend: fieldService.ts, FieldListPage, CreateFieldModal, FieldDashboardPage                 |
|  - Tier 1 & Tier 2 Automated Tests                                                                |
|                                                                                                   |
|                                    │                                                              |
|                                    ▼                                                              |
|  ═══════════════════════════════════════════════════════════════════════════════════════════════  |
|  [APPROVAL GATE 1: Core Domain Delivery Review]                                                   |
|  - Verify complete farm & field creation, multi-farm switching, membership rules, and tests.      |
|  - Explicit user approval required before proceeding to Phase 3C.                                 |
|  ═══════════════════════════════════════════════════════════════════════════════════════════════  |
|                                                                                                   |
|                                    │                                                              |
|                                    ▼                                                              |
|  [PHASE 3C: Public Discovery, Security & Final Verification]                                      |
|  - PublicFarmController (/api/v1/public/farms) reading strictly from public_farms/{farmId}        |
|  - Frontend ExploreFarmsPage connected to public API                                              |
|  - Comprehensive Firestore Rules Emulator test suite (firestore.rules.test.ts)                    |
|  - Cross-farm data isolation, role matrix verification, and regression tests                      |
|  - Acceptance evidence collection and documentation updates                                       |
|                                                                                                   |
|                                    │                                                              |
|                                    ▼                                                              |
|  ═══════════════════════════════════════════════════════════════════════════════════════════════  |
|  [APPROVAL GATE 2: Milestone 3 Final Acceptance Gate]                                             |
|  - Review MILESTONE_3_ACCEPTANCE_REPORT.md; user formally accepts Milestone 3.                    |
|  ═══════════════════════════════════════════════════════════════════════════════════════════════  |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
```

---

## 2. Phase 3A: Farm Domain & Membership Foundation

### 2.1 Scope & Objectives
Deliver production-grade farm registration, ownership assignment, multi-farm listing, membership management, public projection synchronization, and the core farm dashboard shell across backend and frontend.

### 2.2 Critical Dependency Correction
`FarmMembershipRepository` **must** be implemented with production Cloud Firestore persistence in Phase 3A. The farm authorization evaluator (`FarmSecurityEvaluator`) and farm listing service strictly depend on reading persisted `farm_members` documents. Postponing this repository to Phase 3C would leave Phase 3A authorization running on an in-memory test stub.

### 2.3 Backend Implementation Tasks
1. **Domain Models & Enums (`com.agroai.model`):**
   - Create `Farm.java`: `farmId`, `name`, `description`, `ownerUid`, `ownerSafeUid`, `district`, `division`, `detailedAddress`, `totalAreaHectares`, `visibility` (`FarmVisibility`), `status` (`FarmStatus`), `activeFieldCount`, `activeCropTypes`, `version`, `registeredAt`, `updatedAt`, `archivedAt`.
   - Create `PublicFarmProjection.java`: `farmId`, `name`, `description`, `district`, `division`, `totalAreaHectares`, `activeFieldCount`, `activeCropTypes`, `farmVersion`, `projectionVersion`, `registeredAt`, `updatedAt`.
   - Verify existing `FarmMembership.java`, `FarmRole.java` (`OWNER`, `MANAGER`, `OBSERVER`), and `MembershipStatus.java` (operating strictly with `ACTIVE` and `REVOKED`; `INVITED` and `DECLINED` are deferred to future invitation workflows).
2. **DTOs (`com.agroai.dto`):**
   - `CreateFarmRequest.java`: `farmId` (validated `^[a-zA-Z0-9-]{1,64}$`), `name`, `description`, `district`, `division`, `detailedAddress`, `totalAreaHectares`, `visibility`.
   - `UpdateFarmRequest.java`: `name`, `description`, `district`, `division`, `detailedAddress`, `totalAreaHectares`, `expectedVersion`.
   - `UpdateFarmVisibilityRequest.java`: `visibility` (`PUBLIC` / `PRIVATE`), `expectedVersion`.
   - `AddFarmMemberRequest.java`: `userId` (raw Firebase UID), `role` (`MANAGER` or `OBSERVER`).
   - `UpdateFarmMemberRoleRequest.java`: `role` (`MANAGER` or `OBSERVER`).
   - `FarmResponseDTO.java`, `PublicFarmResponseDTO.java`, `FarmMemberResponseDTO.java`.
3. **Persistence Repositories (`com.agroai.repository`):**
   - Implement `FirestoreFarmRepository.java`:
     - Implements `FarmRepository` interface.
     - Dual-mode architecture: live Cloud Firestore in production, fail-closed with `DatabaseUnavailableException` on connection errors, thread-safe memory fallback for offline dev/test.
     - Methods: `save(Farm farm)`, `findById(String farmId)`, `findByOwnerUid(String ownerUid)`, `update(Farm farm, int expectedVersion)`, `archive(String farmId, int expectedVersion)`.
   - Upgrade `FarmMembershipRepository.java`:
     - Convert from in-memory stub to dual-mode Cloud Firestore repository (`farm_members` collection).
     - Deterministic document keying: `KeyEncoder.membershipDocId(farmId, userId)`.
     - Methods: `saveMembership(FarmMembership m)`, `findMembership(String farmId, String rawUserId)`, `findActiveMembershipsByUser(String rawUserId)`, `findMembersByFarm(String farmId)`, `revokeMembership(String farmId, String rawUserId)`.
4. **Service Layer (`com.agroai.service`):**
   - Implement `PublicFarmProjectionService.java`:
     - Manages atomic creation, update, and deletion of `public_farms/{farmId}` documents in synchronization with `farms/{farmId}`.
     - Enforces projection version validation (`projectionVersion == farm.getVersion()`) and sets `status = "ACTIVE"`, `visibility = "PUBLIC"`.
     - Implements self-healing recovery: cleans up orphaned public projections if private farm is private/archived/missing, and regenerates missing projections if active public farm lacks a projection.
     - Governed by Firestore SDK 5-retry policy with exponential backoff on transient contention (`ABORTED`, `UNAVAILABLE`).
     - Maps errors to standard HTTP status codes: Stale version -> 409 Conflict, retry exhaustion -> 503 Service Unavailable, missing farm -> 404 Not Found, bad input -> 400 Bad Request.
   - Implement `FarmService.java`:
     - `registerFarm(FirebaseUserDetails user, CreateFarmRequest request)`: Executes single Firestore transaction creating private farm, owner membership (`mbr_${farmId}::${safeUid}`), and public projection (if `PUBLIC`).
     - `getMyFarms(FirebaseUserDetails user)`: Queries active memberships for user, then loads corresponding farm records.
     - `getFarmById(String farmId, FirebaseUserDetails user)`: Validates membership via `@farmSecurity.isFarmMember`.
     - `updateFarm(String farmId, UpdateFarmRequest request, FirebaseUserDetails user)`: Enforces `expectedVersion` check in transaction; updates public projection if active and public.
     - `updateVisibility(String farmId, UpdateFarmVisibilityRequest request, FirebaseUserDetails user)`: Transactionally flips visibility; creates or deletes `public_farms/{farmId}` atomically.
     - `archiveFarm(String farmId, int expectedVersion, FirebaseUserDetails user)`: Soft-archives farm; deletes public projection.
   - Implement `FarmMembershipService.java`:
     - `getMembers(String farmId, FirebaseUserDetails user)`: Requires `OWNER` or `MANAGER`.
     - `addMember(String farmId, AddFarmMemberRequest request, FirebaseUserDetails user)`: Requires `OWNER`; prevents adding existing member or sole-owner duplicate.
     - `updateMemberRole(String farmId, String targetUserId, UpdateFarmMemberRoleRequest request, FirebaseUserDetails user)`: Requires `OWNER`; prevents demoting sole owner.
     - `revokeMember(String farmId, String targetUserId, FirebaseUserDetails user)`: Requires `OWNER`; prevents removing sole owner; performs soft revocation.
5. **REST Controllers (`com.agroai.controller`):**
   - Implement `FarmController.java` (`/api/v1/farms`):
     - `POST /` (Register farm): Requires authenticated user with verified email and `@RequiresRevocationCheck`.
     - `GET /` (List my farms): Requires authenticated user.
     - `GET /{farmId}` (Get farm): `@PreAuthorize("@farmSecurity.isFarmMember(authentication, #farmId)")`.
     - `PUT /{farmId}` (Update farm): `@PreAuthorize("@farmSecurity.isFarmOwner(authentication, #farmId)")` with `@RequiresRevocationCheck`.
     - `PATCH /{farmId}/visibility` (Toggle visibility): `@PreAuthorize("@farmSecurity.isFarmOwner(authentication, #farmId)")` with `@RequiresRevocationCheck`.
     - `POST /{farmId}/archive` (Archive farm): `@PreAuthorize("@farmSecurity.isFarmOwner(authentication, #farmId)")` with `@RequiresRevocationCheck`.
   - Implement `FarmMembershipController.java` (`/api/v1/farms/{farmId}/members`):
     - `GET /`: `@PreAuthorize("@farmSecurity.isFarmManager(authentication, #farmId)")`.
     - `POST /`: `@PreAuthorize("@farmSecurity.isFarmOwner(authentication, #farmId)")` with `@RequiresRevocationCheck`.
     - `PATCH /{userId}`: `@PreAuthorize("@farmSecurity.isFarmOwner(authentication, #farmId)")` with `@RequiresRevocationCheck`.
     - `DELETE /{userId}`: `@PreAuthorize("@farmSecurity.isFarmOwner(authentication, #farmId)")` with `@RequiresRevocationCheck`.

### 2.4 Frontend Implementation Tasks
1. **API Client Services (`frontend/src/services/farmService.ts`):**
   - Typed Axios client methods covering all `/api/v1/farms` and `/api/v1/farms/{farmId}/members` endpoints.
2. **Farm Context (`frontend/src/context/FarmContext.tsx`):**
   - Global state exposing `farms: Farm[]`, `activeFarm: Farm | null`, `setActiveFarm(farm: Farm)`, `isLoadingFarms: boolean`, `refreshFarms()`.
   - Automatically synchronizes with authenticated session; selects first owned/managed farm on login.
3. **UI Components (`frontend/src/components` & `frontend/src/pages`):**
   - `FarmSwitcher.tsx`: Integrated into `DashboardLayout` header. Displays active farm, dropdown list of user's farms, and "+ Register New Farm" action.
   - `CreateFarmModal.tsx`: Accessible dialog for farm registration with inline validation for farm ID (`^[a-zA-Z0-9-]{1,64}$`), name, district, division, area, and visibility.
   - `FarmDashboardPage.tsx`: Scoped to active farm. Displays metric cards (total area, active field count, status, visibility badge), farm settings panel, and membership management tab (for owners/managers).
   - `FarmMembersModal.tsx`: Roster management dialog allowing owners to add members (`MANAGER` or `OBSERVER`), alter roles, and revoke memberships.

---

## 3. Phase 3B: Field Management & Dedicated Field Dashboard

### 3.1 Scope & Objectives
Deliver field creation, listing, updating, soft archival, active field count synchronization, and the dedicated field dashboard shell across backend and frontend.

### 3.2 Field Identifier Standard & Arithmetic Breakdown
All field documents in Cloud Firestore top-level collection `fields` use the composite identifier:
`{farmId}--{localFieldId}`
(e.g., `farm-550e8400-e29b-41d4-a716-446655440000--field-01`).

**Identifier Arithmetic Specifications:**
- Parent `farmId` maximum length: Standard UUID format is 41 characters (`farm-` + 36-char UUIDv4). Any parent farm containing fields must have `farmId` length <= 41 characters.
- Separator: Exactly 2 characters (`--`).
- `localFieldId` length range: 1 to 21 characters (`^[a-zA-Z0-9-]{1,21}$`).
- **Maximum Composite ID Length:** 41 (`farmId`) + 2 (`--`) + 21 (`localFieldId`) = **64 characters**, adhering strictly to `KeyEncoder.validateFieldId` regex `^[a-zA-Z0-9-]{1,64}$`.
- **Instance Example Arithmetic:** `farm-550e8400-e29b-41d4-a716-446655440000--field-01` has length 41 (`farmId`) + 2 (`--`) + 8 (`field-01`) = 51 characters. Note that 51 characters is the length of this specific 8-character slug instance, whereas 64 characters is the maximum allowable composite length.
- Existing vs Proposed `KeyEncoder` Methods: Composite field document IDs are concatenated in the service layer (`farmId + "--" + localFieldId`) and validated using existing `KeyEncoder.validateFieldId(compositeId)`. Zero modifications to `KeyEncoder.java` are required.

### 3.3 Backend Implementation Tasks
1. **Domain Models & Enums (`com.agroai.model`):**
   - Create `Field.java`: `fieldId` (composite doc ID), `localFieldId`, `farmId`, `name`, `cropType` (`CropType`), `soilType` (`SoilType`), `areaHectares`, `irrigationType` (`IrrigationType`), `status` (`FieldStatus`), `notes`, `version`, `createdAt`, `updatedAt`, `archivedAt`.
   - Create Enums: `FieldStatus` (`ACTIVE`, `FALLOW`, `PREPARATION`, `ARCHIVED`), `SoilType` (`CLAY`, `SANDY`, `LOAMY`, `SILTY`, `PEATY`, `CHALKY`), `CropType` (`RICE`, `WHEAT`, `JUTE`, `MAIZE`, `POTATO`, `TEA`, `VEGETABLES`, `OTHER`), `IrrigationType` (`RAIN_FED`, `CANAL`, `DRIP`, `SPRINKLER`, `GROUNDWATER_TUBEWELL`).
2. **DTOs (`com.agroai.dto`):**
   - `CreateFieldRequest.java`: `localFieldId` (validated `^[a-zA-Z0-9-]{1,21}$`), `name`, `cropType`, `soilType`, `areaHectares`, `irrigationType`, `notes`.
   - `UpdateFieldRequest.java`: `name`, `cropType`, `soilType`, `areaHectares`, `irrigationType`, `status`, `notes`, `expectedVersion`.
   - `FieldResponseDTO.java`: Complete authenticated field representation.
3. **Persistence Repository (`com.agroai.repository`):**
   - Implement `FirestoreFieldRepository.java`:
     - Dual-mode implementation (live Cloud Firestore + fail-closed guard + memory fallback).
     - Query: `findByFarmIdAndStatus(String farmId, FieldStatus status)`.
     - Transactional save and update with version validation.
4. **Service Layer (`com.agroai.service/FieldService.java`):**
   - `createField(String farmId, CreateFieldRequest request, FirebaseUserDetails user)`:
     - Validates caller is `OWNER` or `MANAGER`.
     - Derives composite ID: `fieldId = farmId + "--" + request.localFieldId()`.
     - In a single transaction: verifies farm exists and is `ACTIVE`; verifies field does not exist; writes field document; increments farm `activeFieldCount` and updates `activeCropTypes`; updates public projection if farm is `PUBLIC`.
   - `getFieldsByFarm(String farmId, FirebaseUserDetails user)`: Requires `isFarmMember`.
   - `getFieldById(String farmId, String fieldId, FirebaseUserDetails user)`: Requires `isFarmMember`.
   - `updateField(String farmId, String fieldId, UpdateFieldRequest request, FirebaseUserDetails user)`:
     - Validates caller is `OWNER` or `MANAGER`.
     - Inside transaction: validates `expectedVersion`; updates field details; updates farm's `activeCropTypes` if crop changed; updates public projection if applicable.
   - `archiveField(String farmId, String fieldId, int expectedVersion, FirebaseUserDetails user)`:
     - **Strictly restricted to `OWNER`.**
     - Inside transaction: validates `expectedVersion`; verifies field is not already archived; sets `status = ARCHIVED`, `archivedAt = Instant.now()`; atomically decrements farm `activeFieldCount`; updates public projection if applicable.
5. **REST Controller (`com.agroai.controller/FieldController.java`):**
   - `/api/v1/farms/{farmId}/fields`:
     - `POST /`: `@PreAuthorize("@farmSecurity.isFarmManager(authentication, #farmId)")` with `@RequiresRevocationCheck`.
     - `GET /`: `@PreAuthorize("@farmSecurity.isFarmMember(authentication, #farmId)")`.
     - `GET /{fieldId}`: `@PreAuthorize("@farmSecurity.isFarmMember(authentication, #farmId)")`.
     - `PUT /{fieldId}`: `@PreAuthorize("@farmSecurity.isFarmManager(authentication, #farmId)")` with `@RequiresRevocationCheck`.
     - `POST /{fieldId}/archive`: `@PreAuthorize("@farmSecurity.isFarmOwner(authentication, #farmId)")` with `@RequiresRevocationCheck`.

### 3.4 Frontend Implementation Tasks
1. **API Client (`frontend/src/services/fieldService.ts`):**
   - Typed Axios client methods for field CRUD and archival under `/api/v1/farms/{farmId}/fields`.
2. **Pages & Components (`frontend/src/pages` & `frontend/src/components`):**
   - `FieldListPage.tsx`: Displays field cards/table under the active farm. Shows name, crop badge, soil type, area, irrigation type, and status chip.
   - `CreateFieldModal.tsx`: Validated dialog for adding a field (localFieldId, name, crop, soil, area, irrigation).
   - `FieldDashboardPage.tsx`: Dedicated field view (`/dashboard/farms/:farmId/fields/:fieldId`). Displays detailed field metrics, status toggle, and architectural placeholder cards for future modules (Soil Telemetry, Crop Monitoring, Field Workers) without premature functionality.

---

## 4. APPROVAL GATE 1 — Farm and Field Foundation Review

Upon completion of Phase 3A and Phase 3B:
1. Conduct code and architectural inspection of all new domain models, repositories, services, controllers, and frontend pages.
2. Verify all Tier 1 (Unit) and Tier 2 (Mock Integration) automated tests execute with 100% pass rate.
3. Verify atomic farm registration, membership creation, and field count consistency.
4. Verify optimistic concurrency controls reject stale versions with HTTP 409 Conflict.
5. **PAUSE FOR EXPLICIT USER AUTHORIZATION.** Do not proceed to Phase 3C without user sign-off.

---

## 5. Phase 3C: Public Discovery, Security & Final Verification

### 5.1 Scope & Objectives
Deliver public farm discovery via sanitized projection allowlists, verify Cloud Firestore security rules in the emulator, execute cross-farm isolation tests, and prepare final acceptance documentation.

### 5.2 Backend Tasks
1. Implement `PublicFarmController.java` (`/api/v1/public/farms`):
   - Unauthenticated endpoints (`permitAll()` in `SecurityConfig`).
   - `GET /`: Queries `public_farms` collection with pagination and optional filters (`district`, `division`, `cropType`). Returns array of `PublicFarmResponseDTO`.
   - `GET /{farmId}`: Reads `public_farms/{farmId}`; returns `PublicFarmResponseDTO`; returns 404 Not Found if missing or private.
   - **Never queries `farms/{farmId}` or exposes private fields.**

### 5.3 Frontend Tasks
1. Implement `ExploreFarmsPage.tsx`:
   - Connected to live public discovery API.
   - Search bar by farm name, district dropdown filter, division filter.
   - Responsive grid of public farm cards showing name, district, active crops, field count, and total area.
   - Detail preview modal.
2. Update `LandingPage.tsx`:
   - Connects featured agricultural initiatives section to public API.

### 5.4 Security Rules Emulator & Multi-Tier Verification Tasks
1. Review proposed Firestore Security Rules for Milestone 3:
   - `farms/{farmId}`: Private only; read allowed if `isFarmMember(farmId)`. Public read **strictly denied**. Client write denied.
   - `public_farms/{farmId}`: Public read allowed if unauthenticated visitor and active. Client write denied.
   - `farm_members/{membershipId}`: Read allowed only for active members of the same farm. Client write denied.
   - `fields/{fieldDocumentId}`: Read allowed only for active members of parent farm. Client write denied.
2. Expand `frontend/src/rules/firestore.rules.test.ts`:
   - Add dedicated emulator test cases verifying:
     - Public projection reading permitted for visitors.
     - Private farm reading denied for non-members and unauthenticated visitors.
     - Direct client writes denied on `farms`, `public_farms`, `farm_members`, and `fields`.
     - Cross-farm member roster isolation.

---

## 6. APPROVAL GATE 2 — Milestone 3 Final Acceptance

The milestone is formally accepted only when:
1. All Phase 3A, 3B, and 3C deliverables are complete and verified.
2. All Tier 1, Tier 2, and Tier 3 automated tests pass with zero regressions against the existing 98-test baseline.
3. Security rules emulator verification confirms complete private farm data isolation.
4. `MEMORY.md` and acceptance reports are updated with factual, verified evidence.
5. **The user explicitly authorizes Milestone 3 completion.**
