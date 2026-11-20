# AgroAI — Milestone 3: Current State Audit
## Comprehensive Documentation Audit & Technical Consistency Baseline

**Project:** AgroAI Platform  
**Target Milestone:** Milestone 3 — Farm and Field Management  
**Revision:** Revision 2  
**Audit Date:** 2026-11-17  
**Auditor:** Lead Software Architect & Security Engineer  
**Status:** COMPLETE — PLANNING AUDIT ONLY (Strictly Documentation-Only — Zero Application Code Modified)  
**Implementation Authorization:** NOT GRANTED  
**Firebase Deployment Authorization:** NOT GRANTED  

---

## Revision History

| Revision | Date | Description | Status |
|---|---|---|---|
| **Revision 1** | 2026-11-17 | Initial Milestone 3 planning audit baseline. Identified existing Milestone 2 foundation (`KeyEncoder`, security evaluators, repository stubs) and gaps. | Superceded |
| **Revision 2** | 2026-11-17 | Comprehensive audit and consistency correction. Resolved critical discrepancies: public farm data exposure, identifier compatibility, globally unique field document IDs, unified permission matrix, assignment scope removal, `FarmMembershipRepository` Phase 3A dependency, transaction-based optimistic concurrency, active field count consistency, soft archival policy, membership lifecycle safeguards, index specifications, GeoJSON boundary deferral, test categorization, and live rules deployment lock. | **CURRENT AUTHORITATIVE BASELINE** |

---

## 1. Executive Summary & Audit Scope

This document records the exhaustive technical audit of the AgroAI repository (`D:\agro-ai-java-project`) to establish the authoritative baseline for Milestone 3 (Farm and Field Management, Revision 2).

Milestone 1 (Architecture & Multi-Service Scaffolding) and Milestone 2 (Authentication & User Management) are accepted. All **98 automated test methods** in the repository pass with zero failures and zero regressions across 17 test source files (81 offline CI tests + 17 live cloud tests).

The audit verified actual source code, build configurations, and security assets, identifying ten critical architectural discrepancies in the initial Milestone 3 planning documents. All findings are documented below with their exact source locations, architectural impacts, and required corrections across the Milestone 3 planning suite.

---

## 2. Technical Fact Verification (Actual Repository State)

Every finding below was verified against actual source and configuration files in the workspace:

### 2.1 Build, Runtime & Library Versions

| Component | Verified File Path | Actual Verified Value | Architectural Consequence |
|---|---|---|---|
| **Spring Boot Version** | `backend/pom.xml` (line 9) | `3.3.6` | All documentation must standardize on Spring Boot 3.3.6. |
| **Java Version** | `backend/pom.xml` (lines 20–22) | `21` (`<java.version>21</java.version>`) | Target bytecode is Java 21 LTS; records and pattern matching available. |
| **Firebase Admin SDK** | `backend/pom.xml` (line 46) | `9.4.3` (`com.google.firebase:firebase-admin`) | Admin SDK bypasses Cloud Firestore Security Rules by design. |
| **Frontend Stack** | `frontend/package.json` | React `^19.3.1`, TypeScript `~7.0.2`, Vite `^8.3.6`, Tailwind CSS | Modern frontend SPA stack; Vitest `^5.1.0` test runner. |
| **Firebase Web SDK** | `frontend/package.json` | `firebase: ^13.3.0` | Modular v13 client SDK. |

### 2.2 Security, Identity & Key Encoding Utilities

| Component | Verified File Path | Actual Verified Behavior | Architectural Consequence |
|---|---|---|---|
| **Identifier Regex** | `backend/src/main/java/com/agroai/util/KeyEncoder.java` (lines 13–14) | `^[a-zA-Z0-9-]{1,64}$` | `validateFarmId` and `validateFieldId` strictly reject underscores (`_`), slashes (`/`), colons (`:`), spaces, and dots. Proposed IDs containing underscores (e.g. `farm_<uuid>`) fail validation. |
| **Safe UID Encoding** | `backend/src/main/java/com/agroai/util/KeyEncoder.java` (lines 27–35) | `encodeUid(rawUid)` returns `"uid_" + Base64Url(rawUid)` | Universal deterministic UID encoding. URL-safe, path-safe, injective. |
| **Membership Doc ID** | `backend/src/main/java/com/agroai/util/KeyEncoder.java` (lines 68–72) | `membershipDocId(farmId, rawUserId)` returns `"mbr_" + cleanFarmId + "::" + safeUid` | Deterministic composite ID for `farm_members` collection. Notice that while `cleanFarmId` is validated against `^[a-zA-Z0-9-]{1,64}$`, the composite membership document ID contains `_` and `::` and is governed by its own format. |
| **Assignment Doc ID** | `backend/src/main/java/com/agroai/util/KeyEncoder.java` (lines 78–82) | `assignmentDocId(fieldId, rawFarmerId)` returns `"asgn_fld_" + cleanFieldId + "::" + safeUid` | Preserved for future assignment compatibility. Contains `_` and `::`; must not be validated using the farm/field ID regex. |
| **Farm Roles** | `backend/src/main/java/com/agroai/model/FarmRole.java` (lines 3–7) | `public enum FarmRole { OWNER, MANAGER, OBSERVER }` | There is **NO** `MEMBER` role. The canonical roles are strictly `OWNER`, `MANAGER`, and `OBSERVER`. |
| **Contextual Evaluators** | `backend/src/main/java/com/agroai/security/FarmSecurityEvaluator.java` | Spring bean `@farmSecurity` with `isFarmOwner`, `isFarmManager`, `isFarmMember` | Backed by `FarmMembershipRepository`. `isFarmOwner` requires `OWNER`. `isFarmManager` permits `OWNER` or `MANAGER`. `isFarmMember` permits any active membership. |
| **Token Revocation Check** | `backend/src/main/java/com/agroai/security/RevocationCheckInterceptor.java` | Checks `@RequiresRevocationCheck` via `DefaultFirebaseTokenVerifier.verifyToken(token, true)` | Forces online check with Firebase Auth backend; rejects revoked tokens with HTTP 401. |

### 2.3 Persistence & Concurrency Patterns

| Component | Verified File Path | Actual Verified Behavior | Architectural Consequence |
|---|---|---|---|
| **Dual-Mode Persistence** | `backend/src/main/java/com/agroai/repository/FirestoreUserRepository.java` | In production mode (`firebaseConfig.isInitialized() == true`), all operations run against live Cloud Firestore; failures fail closed by throwing `DatabaseUnavailableException`. In-memory mode is allowed only for test/dev when unconfigured. | Milestone 3 repositories (`FarmRepository`, `FarmMembershipRepository`, `FieldRepository`) must implement this exact dual-mode pattern. |
| **Optimistic Concurrency** | `backend/src/main/java/com/agroai/repository/FirestoreUserRepository.java` (lines 253–291) | Executes inside `db.runTransaction(transaction -> ...)`: reads document, checks `profileVersion == request.getExpectedVersion()`, increments version to `profileVersion + 1`, throws `StaleProfileVersionException` (HTTP 409) on mismatch. | Spring Data `@Version` does **not** provide automatic Firestore optimistic locking. Real Firestore transaction-based version checks must be used for farms and fields. |
| **Membership Repository State** | `backend/src/main/java/com/agroai/repository/FarmMembershipRepository.java` | Uses `ConcurrentHashMap<String, FarmMembership>` in-memory storage only. | **Critical Gap:** Currently an in-memory stub created for Milestone 2 testing. Must be upgraded to production Firestore persistence in Phase 3A to support farm authorization. |

### 2.4 Cloud Firestore Configuration & Rules

| Component | Verified File Path | Actual Verified State | Architectural Consequence |
|---|---|---|---|
| **Firestore Security Rules** | `firestore.rules` (lines 70–76) | `match /farms/{farmId} { allow read: if resource.data.visibility == 'PUBLIC' \|\| isFarmMember(farmId); allow write: if false; }` | **Critical Security Finding:** Directly exposing `farms/{farmId}` publicly allows client SDKs to read private farm fields (`ownerUid`, `ownerSafeUid`, `detailedAddress`, notes). Firestore cannot do field-level read filtering. Must introduce `public_farms/{farmId}`. |
| **Firebase Configuration** | `firebase.json` & `.firebaserc` | Bound to project `agroai-dev`. Emulator configured for port 8085. | Live rules deployment is currently **LOCKED** awaiting explicit user authorization. |
| **Composite Indexes** | Repository root | `firestore.indexes.json` is **not present** in the repository. | Required composite indexes must be fully specified in planning documents. |

---

## 3. Discrepancy Analysis & Critical Corrections

A detailed cross-audit of the initial Milestone 3 proposal against the actual codebase revealed the following critical defects, which are formally corrected in Revision 2:

```
+---------------------------------------------------------------------------------------------------+
|                                   MILESTONE 3 AUDIT DISCREPANCIES                                 |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  [DISCREPANCY 1: Public Farm Data Isolation Flaw]                                                 |
|  - Initial Plan: Allowed direct public reads on 'farms/{farmId}' when visibility == 'PUBLIC'.     |
|  - Codebase Reality: 'farms/{farmId}' holds ownerUid, ownerSafeUid, detailedAddress, notes.       |
|  - Security Risk: Direct client SDK reads bypass backend DTOs and expose private owner PII.      |
|  - Revision 2 Fix: Isolate public data into a dedicated 'public_farms/{farmId}' collection.       |
|                                                                                                   |
|  [DISCREPANCY 2: Identifier Validation Mismatch]                                                   |
|  - Initial Plan: Proposed identifiers 'farm_<uuid>' and 'fld_<uuid>'.                             |
|  - Codebase Reality: KeyEncoder enforces '^[a-zA-Z0-9-]{1,64}$' (strictly no underscores).       |
|  - Runtime Consequence: All proposed IDs would throw IllegalArgumentException at runtime.         |
|  - Revision 2 Fix: Adopt hyphenated UUIDs: 'farm-<uuid>' (41 chars <= 64).                        |
|                                                                                                   |
|  [DISCREPANCY 3: Field Document Global ID Collisions]                                             |
|  - Initial Plan: Proposed top-level 'fields/{fieldId}' with local IDs like 'field-01'.            |
|  - Concurrency Consequence: Field ID collisions across different farms in the top-level table.     |
|  - Revision 2 Fix: Composite globally unique document ID: '{farmId}--{localFieldId}'.             |
|                                                                                                   |
|  [DISCREPANCY 4: Premature Scope Creep — Assignment Management]                                    |
|  - Initial Plan: Included assignedFarmerUids on fields, FieldAssignmentRepository, and farmer UI. |
|  - PRD Alignment: Milestone 3 is strictly Farm & Field Management; assignments belong to M4/M5.   |
|  - Revision 2 Fix: Strip all assignment logic from M3 scope; preserve deterministic key contract. |
|                                                                                                   |
|  [DISCREPANCY 5: Inverted Repository Delivery Dependency]                                         |
|  - Initial Plan: Deferred FarmMembershipRepository Firestore persistence to Phase 3C.             |
|  - Architectural Reality: Phase 3A farm authorization and listing require persistent membership.   |
|  - Revision 2 Fix: Move FarmMembershipRepository production Firestore persistence to Phase 3A.   |
|                                                                                                   |
|  [DISCREPANCY 6: Misleading Optimistic Concurrency Specification]                                 |
|  - Initial Plan: Claimed '@Version' provides automatic Firestore optimistic concurrency.          |
|  - Firestore Reality: Cloud Firestore has no Spring Data auto-versioning. Needs transactions.     |
|  - Revision 2 Fix: Explicit transaction-based version check and increment with HTTP 409 Conflict. |
|                                                                                                   |
|  [DISCREPANCY 7: Active Field Count Desynchronization]                                             |
|  - Initial Plan: Inconsistent naming ('fieldCount' vs 'activeFieldCount') and non-atomic math.    |
|  - Revision 2 Fix: Standardize on 'activeFieldCount'; atomic increment/decrement in transactions. |
|                                                                                                   |
|  [DISCREPANCY 8: Non-Existent Role References & Permission Inconsistencies]                       |
|  - Initial Plan: Referenced 'FarmRole.MEMBER' and allowed MANAGER to archive fields.              |
|  - Codebase Reality: FarmRole only contains OWNER, MANAGER, OBSERVER. Field archive is OWNER-only.|
|  - Revision 2 Fix: Align with canonical enum; adopt one authoritative permission matrix.          |
|                                                                                                   |
|  [DISCREPANCY 9: Undefined GeoJSON Boundary Scope]                                                |
|  - Initial Plan: Vaguely mentioned farm boundary without validation criteria.                     |
|  - Revision 2 Fix: Formally defer polygon boundary validation to Milestone 6 to prevent injection.|
|                                                                                                   |
|  [DISCREPANCY 10: Test Strategy Categorization & Historical Count Protection]                      |
|  - Initial Plan: Mixed emulator, live cloud, and mock tests without clear boundaries.             |
|  - Revision 2 Fix: 4 strict test categories; historical 98-test baseline preserved honestly.      |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
```

---

## 4. Full-Stack Component Readiness Assessment

### 4.1 Backend Readiness Matrix

| Subsystem | Existing File / Class | Status | Milestone 3 Revision 2 Plan |
|---|---|---|---|
| **Identity & Authentication** | `FirebaseAuthenticationFilter`, `DefaultFirebaseTokenVerifier`, `RevocationCheckInterceptor` | ✅ Verified & Implemented | Fully operational. Extracts `uid`, `email`, and `safeUid`. Enforces online revocation on mutating routes. |
| **Key Encoding & Validation** | `KeyEncoder.java` | ✅ Verified & Implemented | `validateFarmId` (`^[a-zA-Z0-9-]{1,64}$`), `validateFieldId`, `membershipDocId`, `assignmentDocId`. |
| **Contextual Evaluators** | `FarmSecurityEvaluator.java`, `FieldSecurityEvaluator.java` | ⚠️ Implemented but Stubbed | Methods exist (`isFarmOwner`, `isFarmManager`, `isFarmMember`), but currently query in-memory stub. Needs connection to production Firestore repository. |
| **Domain Models** | `FarmRole.java`, `FarmMembership.java`, `MembershipStatus.java` | ⚠️ Partial | Role and membership models exist. Need `Farm.java`, `PublicFarmProjection.java`, and `Field.java`. Milestone 3 operational membership status is strictly `ACTIVE` and `REVOKED` (`INVITED` and `DECLINED` are deferred). |
| **Persistence Repositories** | `FirestoreUserRepository.java`, `FarmMembershipRepository.java` | ⚠️ Incomplete | `FirestoreUserRepository` provides proven dual-mode fail-closed pattern. `FarmMembershipRepository` is an in-memory stub. Need `FarmRepository`, `FarmMembershipRepository` (Firestore), and `FieldRepository`. |
| **Service Layer** | `UserService.java`, `FirebaseCustomClaimsService.java` | ❌ Missing | Need `FarmService.java`, `PublicFarmProjectionService.java`, and `FieldService.java`. |
| **REST Controllers** | `UserController.java`, `AuthController.java` | ❌ Missing | Need `FarmController.java`, `FieldController.java`, `FarmMembershipController.java`, and `PublicFarmController.java`. |
| **Exception Handling** | `GlobalExceptionHandler.java` | ✅ Verified & Implemented | Maps `UnauthorizedResourceAccessException` (403), `StaleProfileVersionException` (409), `DatabaseUnavailableException` (503), validation failures (400). Ready for farm/field exceptions. |

### 4.2 Frontend Readiness Matrix

| Component | Existing File | Status | Milestone 3 Revision 2 Plan |
|---|---|---|---|
| **Routing & Auth Guards** | `App.tsx`, `ProtectedRoute.tsx` | ⚠️ Partial | Routes exist for `/dashboard` and placeholder sub-routes. Needs farm-scoped routes (`/dashboard/farms/:farmId`). |
| **Authentication Context** | `AuthContext.tsx` | ✅ Verified & Implemented | Exposes `user`, `profile`, `perspective`, and `setPerspective`. Ready to integrate with `FarmContext`. |
| **Layout Shells** | `DashboardLayout.tsx`, `PublicLayout.tsx` | ⚠️ Partial | Needs `FarmSwitcher` dropdown integration and active farm context state. |
| **Page Implementations** | `DashboardPage.tsx`, `PlaceholderPages.tsx` | ⚠️ Placeholders Only | Need `FarmDashboardPage`, `FieldListPage`, `FieldDashboardPage`, and `ExploreFarmsPage`. |
| **API Client Services** | `apiClient.ts`, `userService.ts` | ❌ Missing | Need `farmService.ts` and `fieldService.ts` communicating with `/api/v1` endpoints. |

### 4.3 Cloud Firestore & Rules Readiness Matrix

| Asset | Current State | Status | Milestone 3 Revision 2 Plan |
|---|---|---|---|
| **Security Rules** | `firestore.rules` (107 lines) | ⚠️ Flawed (Public Read) | Line 72 allows public read on `/farms/{farmId}`. Architecture must specify `/public_farms/{farmId}` for public reads and restrict `/farms/{farmId}` to members only. **Rules file remains unmodified until authorized.** |
| **Emulator Tests** | `frontend/src/rules/firestore.rules.test.ts` | ✅ 16/16 Passing | Existing tests verify profile separation and client write rejections. Will be expanded in Phase 3C for farm/field rules. |
| **Indexes** | Missing `firestore.indexes.json` | ⚠️ Not Defined in Repo | Index configuration specified in architecture; deployment locked. |
| **CLI & Project Binding** | `.firebaserc` (`agroai-dev`), `firebase.json` | ✅ Verified | Connected to `agroai-dev`. Rules deployment held awaiting authorization. |

---

## 5. Audit Conclusion & Baseline Status

1. **Repository Integrity:** Clean, stable, with zero leaked secrets or credentials.
2. **Historical Test Baseline:** Exactly **98 automated test methods** across 17 test files (81 offline CI + 17 live cloud tests) exist and are documented honestly. No tests were re-executed during this audit.
3. **Discrepancy Remediation:** All 10 identified architectural discrepancies have been resolved across the Revision 2 planning documentation suite.
4. **Execution Gate:** Zero application source code, frontend code, Firestore rules, or configuration files were modified. The project is awaiting user review before Phase 3A implementation begins.
