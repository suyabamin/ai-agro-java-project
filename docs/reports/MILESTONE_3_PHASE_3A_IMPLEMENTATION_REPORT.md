# AgroAI — Milestone 3 Phase 3A Implementation Report
## Farm Management, Membership Persistence & Public Projection Foundation

**Project:** AgroAI Platform  
**Milestone:** 3 — Farm and Field Management  
**Phase:** 3A — Farm Management, Membership Persistence & Public Projection Foundation  
**Implementation Date:** 2026-11-17  
**Status:** COMPLETE  
**Firebase Rules Deployment:** NOT CONDUCTED (Awaiting explicit authorization)  
**Git Working Tree:** UNCHANGED COMMITS (Zero staged / committed / pushed files)

---

## 1. Executive Summary

Milestone 3 Phase 3A establishes the core multi-farm tenancy architecture for the AgroAI platform. All components specified in the Milestone 3 Revision 2 architecture baseline have been fully implemented, integrated, and verified across both backend and frontend layers.

Phase 3A delivers:
1. **Domain Models & Persistence:** Production-ready `Farm`, `FarmMembership`, and `PublicFarmProjection` entities backed by fail-closed Firestore repositories with in-memory dev/offline isolation.
2. **Atomic Registration & Transactions:** Atomic multi-document Firestore transactions that simultaneously persist the farm entity, establish the creator's authoritative `OWNER` membership, and generate the public projection if visibility is `PUBLIC`.
3. **Public Data Isolation:** Total physical isolation of sanitized public projections under `public_farms/{farmId}`, strictly excluding owner PII, safe UIDs, detailed addresses, and operational notes.
4. **Optimistic Concurrency Control:** Strict version checking via `expectedVersion` with transactional incrementation, failing with HTTP 409 Conflict (`StaleVersionException`) upon concurrent conflict.
5. **Membership Security & Governance:** Role-based permissions (`OWNER`, `MANAGER`, `OBSERVER`), immutable sole-owner demotion/revocation guards, and explicit user-existence checks against registered profiles.
6. **REST API Endpoints:** 12 secured and public REST endpoints across `FarmController`, `FarmMembershipController`, and `PublicFarmController`.
7. **Frontend Experience:** Complete multi-farm context (`FarmContext`), live workspace switcher (`FarmSwitcher`), registration modal (`CreateFarmModal`), membership management modal (`FarmMembersModal`), active farm metrics dashboard, and public directory exploration (`ExploreFarmsPage`).

---

## 2. Implemented Backend Architecture

### 2.1 Domain Entities and Contracts

| Class | Location | Purpose | Concurrency / Key Contract |
|---|---|---|---|
| `Farm` | `com.agroai.model` | Core farm domain entity | `version` integer, `^[a-zA-Z0-9-]{1,64}$` |
| `FarmMembership` | `com.agroai.model` | Farm member binding | Composite ID: `KeyEncoder.membershipDocId(farmId, uid)` |
| `PublicFarmProjection` | `com.agroai.model` | Sanitized public allowlist projection | Stored in `public_farms/{farmId}`, versioned |
| `FarmRole` | `com.agroai.model` | Role enum (`OWNER`, `MANAGER`, `OBSERVER`) | Non-transferable in 3A; sole owner protected |
| `FarmStatus` | `com.agroai.model` | Lifecycle enum (`ACTIVE`, `SUSPENDED`, `ARCHIVED`) | ARCHIVED triggers projection purge |
| `FarmVisibility` | `com.agroai.model` | Visibility enum (`PUBLIC`, `PRIVATE`) | Controls public projection lifecycle |
| `MembershipStatus` | `com.agroai.model` | Operational enum (`ACTIVE`, `REVOKED`) | Strictly dual-state in Milestone 3 |

### 2.2 Production Repositories & Fail-Closed Guard

- **`FirestoreFarmRepository` (`com.agroai.repository`):**
  - Production Firestore repository with support for transaction contexts (`saveInTransaction`, `findByIdInTransaction`).
  - Implements fail-closed production environment protection: fails application startup with `IllegalStateException` if `production` profile is active while Firebase is uninitialized.
  - Fail-closed runtime safety: when initialized, any Firestore SDK failure throws `DatabaseUnavailableException` rather than silently degrading to memory.
  - Safe in-memory store in dev/offline mode.

- **`FarmMembershipRepository` (`com.agroai.repository`):**
  - Upgraded from stub to production dual-mode fail-closed Firestore repository.
  - Supports transactional operations (`saveMembershipInTransaction`, `findMembershipInTransaction`).
  - Evaluates active memberships and counts active owners (`countActiveOwners`) for sole-owner protection.

### 2.3 Services & Business Logic

- **`FarmService` (`com.agroai.service`):**
  - `registerFarm`: Generates canonical `farm-<uuid>` ID, validates ownership, atomically saves farm, OWNER membership, and conditional public projection.
  - `getMyFarms`: Retrieves all farms where caller holds an active membership.
  - `getFarmById`: Retrieves farm details; enforces active membership.
  - `updateFarm`: Concurrency-safe metadata updates for OWNER or MANAGER.
  - `updateVisibility`: Toggles PUBLIC/PRIVATE and creates/purges public projection in a transaction.
  - `archiveFarm`: Soft-archives farm, records `archivedAt`, increments version, and purges public projection.
  - `listPublicFarms` & `getPublicFarmById`: Unauthenticated sanitized projection retrieval.

- **`FarmMembershipService` (`com.agroai.service`):**
  - `getMembers`: Retrieves active and revoked roster for farm members.
  - `addMember`: Grants `MANAGER` or `OBSERVER` to an existing user; enforces profile existence.
  - `updateMemberRole`: Updates member role; prevents sole-owner demotion.
  - `revokeMember`: Soft-revokes membership (`status = REVOKED`); prevents sole-owner revocation.

- **`PublicFarmProjectionService` (`com.agroai.service`):**
  - Manages authoritative synchronization of sanitized projections in `public_farms/{farmId}`.
  - Provides transaction-aware creation, update, and deletion methods.
  - Includes `reconcileProjection` self-healing utility.

### 2.4 REST Controllers & Endpoints

| Method | Route | Security / PreAuthorize | Revocation Check | Description |
|---|---|---|---|---|
| `POST` | `/api/v1/farms` | Authenticated | Yes (`@RequiresRevocationCheck`) | Register new farm & OWNER membership |
| `GET` | `/api/v1/farms` | Authenticated | No | List my active farms |
| `GET` | `/api/v1/farms/{farmId}` | `@farmSecurity.isFarmMember` | No | Get farm details |
| `PUT` | `/api/v1/farms/{farmId}` | `@farmSecurity.isFarmManager` | Yes (`@RequiresRevocationCheck`) | Update farm metadata (optimistic concurrency) |
| `PATCH` | `/api/v1/farms/{farmId}/visibility` | `@farmSecurity.isFarmOwner` | Yes (`@RequiresRevocationCheck`) | Toggle farm visibility |
| `POST` | `/api/v1/farms/{farmId}/archive` | `@farmSecurity.isFarmOwner` | Yes (`@RequiresRevocationCheck`) | Soft-archive farm |
| `GET` | `/api/v1/farms/{farmId}/members` | `@farmSecurity.isFarmMember` | No | List farm member roster |
| `POST` | `/api/v1/farms/{farmId}/members` | `@farmSecurity.isFarmOwner` | Yes (`@RequiresRevocationCheck`) | Add MANAGER/OBSERVER member |
| `PATCH` | `/api/v1/farms/{farmId}/members/{userId}` | `@farmSecurity.isFarmOwner` | Yes (`@RequiresRevocationCheck`) | Update member role |
| `DELETE` | `/api/v1/farms/{farmId}/members/{userId}` | `@farmSecurity.isFarmOwner` | Yes (`@RequiresRevocationCheck`) | Revoke farm membership |
| `GET` | `/api/v1/public/farms` | `permitAll()` | No | Public farm discovery directory |
| `GET` | `/api/v1/public/farms/{farmId}` | `permitAll()` | No | Public farm sanitized detail |

---

## 3. Implemented Frontend Architecture

1. **`frontend/src/types/farm.ts`**: Complete TypeScript definitions for domain types, enums, and request payloads.
2. **`frontend/src/services/farmService.ts`**: Axios client methods handling all 12 backend endpoints with automatic Bearer token injection and 401 retry recovery.
3. **`frontend/src/context/FarmContext.tsx`**: React context provider managing active farm selection, farm listing, caching in `localStorage`, and asynchronous mutation handlers.
4. **`frontend/src/components/farm/FarmSwitcher.tsx`**: Header dropdown selector providing active farm role badges and seamless switching between multiple farms.
5. **`frontend/src/components/farm/CreateFarmModal.tsx`**: Accessible modal form for farm registration with Bangladeshi administrative division dropdowns and validation.
6. **`frontend/src/components/farm/FarmMembersModal.tsx`**: Modal dialog for managing member rosters, granting roles, and revoking memberships.
7. **`frontend/src/pages/DashboardPage.tsx`**: Comprehensive dashboard displaying active farm details, metrics, visibility toggles, and archival controls.
8. **`frontend/src/pages/ExploreFarmsPage.tsx`**: Publicly accessible directory displaying sanitized farm projections with division/district filtering.
9. **`frontend/src/App.tsx`**: Configured with `<FarmProvider>` wrapper and registered `/explore` route.

---

## 4. Verification Summary

- **Backend Unit & Integration Tests:** 17 test suites, 96 tests passed cleanly with 0 failures and 0 errors.
- **Frontend Unit Tests:** 3 test suites, 23 tests passed with 100% success.
- **Frontend Production Build:** Vite build passed with 0 TypeScript errors.
- **Regression Verification:** Zero regressions across Milestone 1 (Health, Auth) and Milestone 2 (User Profiles, Custom Claims).
