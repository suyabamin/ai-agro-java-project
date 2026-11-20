# AgroAI — Milestone 3: Architecture Plan
## Farm and Field Management Architecture

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
| **Revision 1** | 2026-11-17 | Initial Milestone 3 planning baseline. Proposed top-level collections, contextual role models, and basic CRUD flows. | Superceded |
| **Revision 2** | 2026-11-17 | Comprehensive architectural consistency and security revision: (1) Isolated public farm discovery into `public_farms/{farmId}` with strict field projections, eliminating private PII leaks; (2) Adopted hyphenated UUIDs (`farm-<uuid>`) and composite field IDs (`{farmId}--{localFieldId}`) fully compatible with `KeyEncoder`'s `^[a-zA-Z0-9-]{1,64}$` regex; (3) Unified the authoritative permission matrix across all documents; (4) Completely stripped premature farmer assignment features; (5) Scheduled `FarmMembershipRepository` Firestore implementation for Phase 3A; (6) Replaced theoretical `@Version` annotations with real Firestore transaction-based optimistic concurrency; (7) Standardized on `activeFieldCount` with transactional consistency; (8) Defined soft archival without hard cascades; (9) Documented query-justified composite indexes; (10) Formally deferred GeoJSON boundary polygon validation; (11) Enforced live rules deployment lock. | **CURRENT AUTHORITATIVE BASELINE** |

---

## 1. Architectural Vision & Principles

Milestone 3 establishes the operational domain hierarchy of the AgroAI agricultural platform: **multi-farm ownership, contextual farm roles, field management, and secure public discovery**.

```
+---------------------------------------------------------------------------------------------------+
|                                 AGROAI MILESTONE 3 DOMAIN HIERARCHY                               |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  [AUTHENTICATED USER] (Firebase UID)                                                              |
|     │                                                                                             |
|     ├── owns / manages (1:N) ────► [FARM MEMBERSHIP] (farm_members/mbr_${farmId}::${safeUid})    |
|     │                                    │                                                        |
|     │                                    ▼                                                        |
|     │                              [PRIVATE FARM] (farms/{farmId})                                |
|     │                                    │                                                        |
|     │                                    ├── 1:1 Synchronized (Opt-in) ──► [PUBLIC PROJECTION]    |
|     │                                    │                                 (public_farms/{farmId})|
|     │                                    │                                                        |
|     │                                    └── contains (1:N) ─────────────► [FIELD]                |
|     │                                                                      (fields/{docId})       |
|     │                                                                                             |
|     └── (DEFERRED: M4/M5) ───────► [FIELD ASSIGNMENT] (field_assignments/asgn_fld_...::uid_...)   |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
```

### Core Architectural Principles

1. **Decoupled Contextual Roles:** Farm ownership and management are not global user attributes. A single authenticated user can be an `OWNER` of Farm A, a `MANAGER` of Farm B, an `OBSERVER` of Farm C, and hold no permissions on Farm D.
2. **Physical Data Isolation for Public Visibility:** To eliminate data leakage via direct client SDK reads, public farm data is physically isolated in a separate collection (`public_farms/{farmId}`). The private farm document (`farms/{farmId}`) is **never** readable by unauthenticated clients or non-members.
3. **Deterministic & Path-Safe Firestore Keying:** All document identifiers strictly adhere to the pre-existing `KeyEncoder` validation regex (`^[a-zA-Z0-9-]{1,64}$`). No underscores are used in farm or field identifiers. Membership identifiers use deterministic composite paths (`mbr_${farmId}::${safeUid}`).
4. **Backend-Authoritative Security:** Because the Firebase Admin SDK bypasses Cloud Firestore Security Rules by Google Cloud architecture design, every backend service independently enforces identity verification, verified-email checks, token revocation status, and contextual role permissions before issuing any database command.
5. **Real Transactional Concurrency & Consistency:** Firestore provides no automatic Spring Data `@Version` entity locking. Concurrency control is enforced via Firestore transactions reading an explicit `version` field, validating it against caller-provided `expectedVersion`, and atomically incrementing it.
6. **Strict Milestone Scope Boundaries:** All worker recruitment, job applications, farmer assignment APIs, assignment repositories, and farmer-specific field access are strictly excluded from Milestone 3 and deferred to Milestones 4 and 5.

---

## 2. Public Farm Data Isolation Architecture (Critical Correction A)

### 2.1 The Firestore Security Problem

In Cloud Firestore, security rules operate at the document level: when a client is granted `allow read` on a document, the client SDK can read **every field** contained in that document. Rules cannot selectively mask or project specific fields.

Under the initial Milestone 3 proposal, `farms/{farmId}` was readable by any unauthenticated visitor when `visibility == 'PUBLIC'`. This created an unacceptable vulnerability: direct client SDK queries could extract sensitive private fields, including:
- Farm creator's raw Firebase UID (`ownerUid`) and safe UID (`ownerSafeUid`).
- Detailed physical street/village address (`detailedAddress`).
- Private contact phone numbers or emergency contacts.
- Internal administrative notes and operational metadata.

Relying on backend API DTO filtering (`PublicFarmResponseDTO`) is insufficient because client applications using the Firebase Web SDK could query Firestore directly, bypassing backend DTO filters entirely.

### 2.2 Dual-Collection Physical Isolation

To solve this, AgroAI implements complete physical isolation across two separate top-level collections:

```
+----------------------------------------------------+       +----------------------------------------------------+
|               PRIVATE FARM DOCUMENT                |       |              PUBLIC PROJECTION DOCUMENT            |
|                 farms/{farmId}                     |       |               public_farms/{farmId}                |
+----------------------------------------------------+       +----------------------------------------------------+
| - farmId: "farm-550e8400-e29b-41d4-a716-44665544"  |       | - farmId: "farm-550e8400-e29b-41d4-a716-44665544"  |
| - name: "Green Valley Agro"                        |       | - name: "Green Valley Agro"                        |
| - description: "Sustainable rice farming"          |       | - description: "Sustainable rice farming"          |
| - district: "Dinajpur"                             |       | - district: "Dinajpur"                             |
| - division: "Rangpur"                              |       | - division: "Rangpur"                              |
| - totalAreaHectares: 12.5                          |       | - totalAreaHectares: 12.5                          |
| - visibility: "PUBLIC"                             |       | - activeFieldCount: 4                              |
| - status: "ACTIVE"                                 |       | - activeCropTypes: ["RICE", "WHEAT"]               |
| - activeFieldCount: 4                              |       | - farmVersion: 2                                   |
| - activeCropTypes: ["RICE", "WHEAT"]               |       | - projectionVersion: 2                             |
| - version: 2                                       |       | - registeredAt: 2026-11-17T10:00:00Z               |
| - registeredAt: 2026-11-17T10:00:00Z               |       | - updatedAt: 2026-11-17T11:30:00Z                  |
| - updatedAt: 2026-11-17T11:30:00Z                  |       +----------------------------------------------------+
|                                                    |
| [SENSITIVE / PRIVATE FIELDS - NEVER IN PUBLIC]     |
| - ownerUid: "pL8w9YxQZ1234567890abcdefgh"          |
| - ownerSafeUid: "uid_cEw4d1l4..."                  |
| - detailedAddress: "Plot 42, Road 7, Chirirbandar" |
| - internalNotes: "Land lease renewal due 2028"     |
+----------------------------------------------------+
```

### 2.3 Field Projection Specification

| Field Name | In `farms/{farmId}` (Private) | In `public_farms/{farmId}` (Public) | Field Purpose & Privacy Justification |
|---|:---:|:---:|---|
| `farmId` | ✅ Yes | ✅ Yes | Canonical farm identifier matching `^[a-zA-Z0-9-]{1,64}$`. |
| `name` | ✅ Yes | ✅ Yes | Public display name of the farm. |
| `description` | ✅ Yes | ✅ Yes | Public description of agricultural operations. |
| `district` | ✅ Yes | ✅ Yes | General administrative district for geographic discovery. |
| `division` | ✅ Yes | ✅ Yes | General administrative division for regional filtering. |
| `totalAreaHectares` | ✅ Yes | ✅ Yes | Aggregated farm scale metric. |
| `activeFieldCount` | ✅ Yes | ✅ Yes | Number of non-archived, actively managed fields. |
| `activeCropTypes` | ✅ Yes | ✅ Yes | Array of currently cultivated crops (e.g. `["RICE", "WHEAT"]`). |
| `status` | ✅ Yes | ✅ Yes | Public projection explicitly contains `status: "ACTIVE"` to allow client rule predicates. |
| `visibility` | ✅ Yes | ✅ Yes | Public projection explicitly contains `visibility: "PUBLIC"` to allow client rule predicates. |
| `registeredAt` | ✅ Yes | ✅ Yes | Platform registration timestamp. |
| `updatedAt` | ✅ Yes | ✅ Yes | Last modification timestamp. |
| `farmVersion` | ❌ (called `version`) | ✅ Yes | Stored version of the parent private farm document. |
| `projectionVersion` | ❌ (not applicable) | ✅ Yes | Monotonically increasing projection generation counter. |
| `ownerUid` | ✅ Yes | ❌ **PROHIBITED** | Sensitive identity; prevents user enumeration and account correlation. |
| `ownerSafeUid` | ✅ Yes | ❌ **PROHIBITED** | Internal deterministic path key; private account security. |
| `detailedAddress` | ✅ Yes | ❌ **PROHIBITED** | Exact physical security protection; prevents trespassing/theft. |
| `internalNotes` | ✅ Yes | ❌ **PROHIBITED** | Private operational notes and tenant lease data. |

### 2.4 Public Firestore Read Security Architecture

Unauthenticated clients reading `public_farms/{farmId}` are prevented from accessing projections belonging to private, suspended, or archived farms through a **defense-in-depth architecture** combining authoritative document lifecycle management and security rule predicates:

#### 1. Primary Defense: Authoritative Lifecycle Deletion
The backend service `PublicFarmProjectionService` transactionally ensures that:
- Farms registered as `PRIVATE` have **zero** document created in `public_farms/{farmId}`.
- When an active public farm transitions to `PRIVATE`, or is `ARCHIVED`, or is `SUSPENDED`, the transaction **physically deletes** `public_farms/{farmId}`.
- Thus, private, archived, or suspended farms do not exist in `public_farms`. Any client query returns 404 / empty document.

#### 2. Secondary Defense: Rule-Level Predicates
The projection document itself stores `status: "ACTIVE"` and `visibility: "PUBLIC"`. The Firestore Security Rule enforces:
```javascript
match /public_farms/{farmId} {
  allow read: if resource.data.status == 'ACTIVE' && resource.data.visibility == 'PUBLIC';
  allow write: if false; // Managed exclusively by Spring Boot Admin SDK
}
```
This ensures that even if an orphaned, stale, or partially initialized projection document existed, unauthenticated clients are strictly denied read access by the Firestore Security Rules engine.

#### 3. Evaluation of Cross-Document `get()` Alternative and Its Limitations
If Firestore Rules were instead designed to use `get()` to read the private farm document:
```javascript
// Alternative cross-document inspection (Evaluated and rejected for scalability reasons)
function isPublicActiveInPrivateDoc(farmId) {
  return get(/databases/$(database)/documents/farms/$(farmId)).data.visibility == 'PUBLIC' &&
         get(/databases/$(database)/documents/farms/$(farmId)).data.status == 'ACTIVE';
}
```
While this helper function would allow Firestore rules to inspect private documents (because rule helper functions run with internal rule evaluation context), this approach has **three fatal architectural limitations**:
1. **Billing & Quota Amplification:** Every read to `public_farms/{farmId}` incurs an automatic extra read charge for `farms/{farmId}`, doubling Firestore document read consumption.
2. **Execution Quotas:** Firestore limits security rules to a maximum of 10 `get()` calls per request. Batch reads or multi-document operations quickly exhaust this quota.
3. **Collection Query Incompatibility:** In Cloud Firestore, security rules cannot dynamically filter collection queries (`list` / `where` queries) using cross-document `get()`. If a visitor executes `collection('public_farms').get()`, Firestore rules cannot inspect parent documents per item, causing the entire query to fail with `PERMISSION_DENIED`.

Therefore, the combination of **transactional lifecycle deletion** and **projection-stored status predicates** is the authoritative, production-grade architecture.

#### 4. Absolute Private Farm Inaccessibility
The private farm collection rule remains strictly member-only:
```javascript
match /farms/{farmId} {
  allow read: if isFarmMember(farmId);
  allow write: if false;
}
```
Because unauthenticated visitors possess no valid `request.auth.uid` or `safeUid` claim, `isFarmMember(farmId)` evaluates to `false`. Private farm documents are **never accessible** to public visitors under any circumstances.

### 2.5 Authoritative Projection Lifecycle, Failure & Recovery

The backend service `PublicFarmProjectionService` (invoked exclusively by `FarmService`) is the **sole authoritative owner** of `public_farms/{farmId}` documents. Direct client writes are strictly denied in Firestore security rules.

#### A. Atomic Farm Registration
1. If registered with `visibility == FarmVisibility.PRIVATE`:
   - Single Firestore transaction creates:
     - `farms/{farmId}` (`visibility = PRIVATE`, `version = 1`, `activeFieldCount = 0`).
     - `farm_members/mbr_${farmId}::${safeUid}` (`role = OWNER`, `status = ACTIVE`).
   - No document is written to `public_farms/{farmId}`.
2. If registered with `visibility == FarmVisibility.PUBLIC`:
   - Single Firestore transaction atomically creates three documents:
     - `farms/{farmId}` (`visibility = PUBLIC`, `version = 1`, `activeFieldCount = 0`).
     - `farm_members/mbr_${farmId}::${safeUid}` (`role = OWNER`, `status = ACTIVE`).
     - `public_farms/{farmId}` (`status = ACTIVE`, `visibility = PUBLIC`, `farmVersion = 1`, `projectionVersion = 1`, sanitized fields).
   - If the transaction fails, zero documents are written (fail closed).

#### B. Atomic Visibility Transitions & Failure Behavior
1. **Transition: PRIVATE → PUBLIC**
   - Executed inside a single Firestore transaction:
     - Read `farms/{farmId}`; verify caller is `OWNER`.
     - Verify current version matches `expectedVersion`. If mismatch, abort with `StaleVersionException` (HTTP 409).
     - Increment private farm version: `newVersion = version + 1`.
     - Update private farm: `visibility = PUBLIC`, `version = newVersion`, `updatedAt = Instant.now()`.
     - Write sanitized projection to `public_farms/{farmId}` with `status = ACTIVE`, `visibility = PUBLIC`, `farmVersion = newVersion`, `projectionVersion = newVersion`.
2. **Transition: PUBLIC → PRIVATE**
   - Executed inside a single Firestore transaction:
     - Read `farms/{farmId}`; verify caller is `OWNER`.
     - Verify current version matches `expectedVersion`. If mismatch, abort with `StaleVersionException` (HTTP 409).
     - Increment private farm version: `newVersion = version + 1`.
     - Update private farm: `visibility = PRIVATE`, `version = newVersion`, `updatedAt = Instant.now()`.
     - Delete `public_farms/{farmId}` document.
3. **Failure Behavior:** If the transaction aborts due to contention, timeout, or network disconnect, Cloud Firestore automatically discards all pending writes. Neither the private document nor the public projection is altered.

#### C. Atomic Farm Archival / Status Suspension
- When a farm transitions to `ARCHIVED` or `SUSPENDED`:
  - Executed inside a single Firestore transaction:
    - Update `farms/{farmId}`: `status = ARCHIVED`, `archivedAt = Instant.now()`, `version = version + 1`.
    - Delete `public_farms/{farmId}` if it exists.
  - Public discovery never returns archived or suspended farms under any circumstances.

#### D. Concurrency Protection & Version Validation
- Every update to `public_farms/{farmId}` asserts that `projectionVersion == privateFarm.version`.
- Firestore transactions monitor all read document references (`farms/{farmId}` and `public_farms/{farmId}`). If any concurrent writer commits a change to either document while the transaction is running, Firestore aborts the transaction and initiates automatic retry.

#### E. Transaction Retry Policy
- The Cloud Firestore Admin SDK implements bounded automatic transaction retries for transient conflicts (such as `ABORTED` or `UNAVAILABLE` errors).
- Maximum retries: 5 attempts with exponential backoff and jitter.
- If all 5 attempts fail due to sustained contention, the transaction terminates and throws `DatabaseUnavailableException` (mapped to HTTP 503).

#### F. HTTP Error Mapping
- Optimistic Concurrency Conflict: Throws `StaleVersionException` -> Mapped by `GlobalExceptionHandler` to **HTTP 409 Conflict**.
- Transaction Retry Exhaustion / Database Failure: Throws `DatabaseUnavailableException` -> Mapped to **HTTP 503 Service Unavailable**.
- Farm or Field Not Found: Throws `ResourceNotFoundException` -> Mapped to **HTTP 404 Not Found**.
- Invalid Input or Unparseable Slug: Throws `IllegalArgumentException` -> Mapped to **HTTP 400 Bad Request**.
- Unauthorized Caller: Throws `UnauthorizedResourceAccessException` -> Mapped to **HTTP 403 Forbidden**.

#### G. Recovery from Inconsistent Projection States (Self-Healing)
Adopting the proven self-healing pattern established in `FirestoreUserRepository` (Milestone 2):
1. **Orphan Public Projection Recovery:** If a public projection `public_farms/{farmId}` exists but the parent `farms/{farmId}` is private, archived, suspended, or deleted, any backend read or scheduled maintenance task detects the anomaly and transactionally deletes the orphan projection.
2. **Missing Public Projection Recovery:** If `farms/{farmId}` has `visibility == PUBLIC` and `status == ACTIVE`, but `public_farms/{farmId}` is missing (e.g., following an administrative data restoration), the backend automatically regenerates the public projection from the private farm record.

#### H. State & Projection Availability Matrix

| Farm Status | Farm Visibility | Private Document (`farms`) | Public Projection (`public_farms`) | Public API Discovery |
|---|---|---|---|---|
| `ACTIVE` | `PUBLIC` | Exists | **Exists & Synchronized** (`status=ACTIVE, visibility=PUBLIC`) | **Visible** |
| `ACTIVE` | `PRIVATE` | Exists | **Does NOT Exist (Deleted)** | **Hidden (404)** |
| `ARCHIVED` | `PUBLIC` | Exists (`ARCHIVED`) | **Does NOT Exist (Deleted)** | **Hidden (404)** |
| `ARCHIVED` | `PRIVATE` | Exists (`ARCHIVED`) | **Does NOT Exist (Deleted)** | **Hidden (404)** |
| `SUSPENDED` | Any | Exists (`SUSPENDED`)| **Does NOT Exist (Deleted)** | **Hidden (404)** |

---

## 3. Universal Identifier Strategy (Critical Correction B)

### 3.1 KeyEncoder Compatibility

The verified `KeyEncoder.java` implementation enforces:
```java
private static final Pattern FIELD_ID_PATTERN = Pattern.compile("^[a-zA-Z0-9-]{1,64}$");
private static final Pattern FARM_ID_PATTERN = Pattern.compile("^[a-zA-Z0-9-]{1,64}$");
```

Proposed identifiers containing underscores (such as `farm_<uuid>` or `fld_<uuid>`) fail `KeyEncoder.validateFarmId` and `validateFieldId` with an `IllegalArgumentException`.

### 3.2 Canonical Milestone 3 Identifier Formats

```
+---------------------------------------------------------------------------------------------------+
|                                  CANONICAL IDENTIFIER SPECIFICATION                               |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  1. FARM IDENTIFIER (farmId)                                                                      |
|     Format: "farm-" + UUIDv4 (lowercase hyphens)                                                  |
|     Example: "farm-550e8400-e29b-41d4-a716-446655440000"                                         |
|     Standard Length: 5 ("farm-") + 36 (UUID) = 41 characters (<= 64)                               |
|     Maximum Permissible Length for Parent Farm with Fields: 41 characters                          |
|     Validation: KeyEncoder.validateFarmId(farmId) -> Matches ^[a-zA-Z0-9-]{1,64}$                |
|                                                                                                   |
|  2. FIELD COMPOSITE DOCUMENT IDENTIFIER (fieldDocumentId)                                         |
|     Collection: fields/{fieldDocumentId} (Top-level globally unique document key)                  |
|     Composition: {farmId} + "--" + {localFieldId}                                                 |
|     Separator: Exactly 2 characters ("--")                                                        |
|     Instance Example: "farm-550e8400-e29b-41d4-a716-446655440000--field-01"                       |
|     Instance Example Length: 41 (farmId) + 2 ("--") + 8 ("field-01") = 51 characters               |
|     MAXIMUM COMPOSITE LENGTH: 41 (max farmId) + 2 ("--") + 21 (max localFieldId) = 64 characters  |
|     Validation: KeyEncoder.validateFieldId(fieldDocumentId) -> Matches ^[a-zA-Z0-9-]{1,64}$       |
|                                                                                                   |
|  3. LOCAL FIELD IDENTIFIER (localFieldId)                                                         |
|     Format: Short human-meaningful slug per farm (e.g., "field-01", "north-plot", "paddy-b")     |
|     Length Range: 1 to 21 characters                                                              |
|     Validation: Matches ^[a-zA-Z0-9-]{1,21}$                                                      |
|     Note: Stored as a distinct attribute 'localFieldId' inside the field document.                |
|                                                                                                   |
|  4. SAFE USER IDENTIFIER (safeUid)                                                                |
|     Format: "uid_" + Base64Url(rawUid.getBytes(UTF_8)) without padding                            |
|     Example: "uid_cEw4d1l4UVoxMjM0NTY3ODkwYWJjZGVmZ2g"                                            |
|     Validation: Generated exclusively by KeyEncoder.encodeUid(rawUid)                             |
|                                                                                                   |
|  5. FARM MEMBERSHIP DOCUMENT IDENTIFIER (membershipId)                                            |
|     Collection: farm_members/{membershipId}                                                       |
|     Format: "mbr_" + cleanFarmId + "::" + safeUid                                                 |
|     Example: "mbr_farm-550e8400-e29b-41d4-a716-446655440000::uid_cEw4d1l4UVoxMj..."              |
|     Validation: KeyEncoder.membershipDocId(farmId, rawUserId)                                     |
|     Note: Contains '_' and '::' for path safety; governed by membershipDocId, NOT validateFarmId.|
|                                                                                                   |
|  6. DEFERRED FIELD ASSIGNMENT IDENTIFIER (assignmentId - M4/M5 Compatibility Only)                 |
|     Collection: field_assignments/{assignmentId}                                                 |
|     Format: "asgn_fld_" + cleanFieldDocumentId + "::" + safeUid                                   |
|     Example: "asgn_fld_farm-550e...--field-01::uid_cEw4d1l4..."                                  |
|     Validation: KeyEncoder.assignmentDocId(fieldDocumentId, rawFarmerId)                          |
|                                                                                                   |
|  7. EXISTING VS PROPOSED KEYENCODER METHODS:                                                      |
|     - Existing in KeyEncoder.java: encodeUid, validateFarmId, validateFieldId, membershipDocId,   |
|       and assignmentDocId.                                                                        |
|     - Milestone 3 Concatenation: Composite field IDs are constructed in the service layer via     |
|       String concatenation ({farmId} + "--" + {localFieldId}) and validated with existing         |
|       validateFieldId. Zero modifications to KeyEncoder.java are required.                        |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
```

---

## 4. Authoritative Permission Matrix (Critical Correction C)

This matrix is canonical and supersedes all prior drafts. It must be reflected identically across service logic, security evaluators, API specifications, and test assertions.

| Resource Operation | `OWNER` | `MANAGER` | `OBSERVER` | Assigned `FARMER` (Deferred M4) | Unauthenticated Public Visitor |
|---|:---:|:---:|:---:|:---:|:---:|
| **Register New Farm** | Any Authenticated | Any Authenticated | Any Authenticated | Any Authenticated | ❌ Denied (401) |
| **View Private Farm Details (`farms/{farmId}`)** | ✅ Allowed | ✅ Allowed | ✅ Allowed | ❌ Denied | ❌ Denied (401/403) |
| **View Public Projection (`public_farms/{farmId}`)** | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed (if `ACTIVE` & `PUBLIC`) |
| **Update Farm Details (Name, Bio, Area)** | ✅ Allowed | ❌ Denied (403) | ❌ Denied (403) | ❌ Denied | ❌ Denied (401/403) |
| **Change Farm Visibility (`PUBLIC` / `PRIVATE`)** | ✅ Allowed | ❌ Denied (403) | ❌ Denied (403) | ❌ Denied | ❌ Denied (401/403) |
| **View Farm Member Roster** | ✅ Allowed | ✅ Allowed | ❌ Denied (403) | ❌ Denied | ❌ Denied (401/403) |
| **Add Member (`MANAGER` / `OBSERVER`)** | ✅ Allowed | ❌ Denied (403) | ❌ Denied (403) | ❌ Denied | ❌ Denied (401/403) |
| **Update Member Role (`MANAGER` ↔ `OBSERVER`)** | ✅ Allowed | ❌ Denied (403) | ❌ Denied (403) | ❌ Denied | ❌ Denied (401/403) |
| **Revoke Membership (`MANAGER` / `OBSERVER`)** | ✅ Allowed | ❌ Denied (403) | ❌ Denied (403) | ❌ Denied | ❌ Denied (401/403) |
| **Create Field Under Farm** | ✅ Allowed | ✅ Allowed | ❌ Denied (403) | ❌ Denied | ❌ Denied (401/403) |
| **View Field Overview & Dashboard** | ✅ Allowed | ✅ Allowed | ✅ Allowed | Deferred M4 (Assigned Field Only)| ❌ Denied (401/403) |
| **Update Field Details (Crop, Soil, Status)** | ✅ Allowed | ✅ Allowed | ❌ Denied (403) | ❌ Denied | ❌ Denied (401/403) |
| **Archive Field (`status = ARCHIVED`)** | ✅ Allowed | ❌ Denied (403) | ❌ Denied (403) | ❌ Denied | ❌ Denied (401/403) |
| **Archive Farm (`status = ARCHIVED`)** | ✅ Allowed | ❌ Denied (403) | ❌ Denied (403) | ❌ Denied | ❌ Denied (401/403) |

### Role Definition Semantics
- **`OWNER`:** Full governance authority over the farm organization. Automatically assigned to the farm creator upon registration. Only an `OWNER` can modify farm metadata, change public visibility, manage the membership roster, archive fields, or archive the farm. Sole owners cannot be demoted or removed.
- **`MANAGER`:** Operational agronomy authority. Granted by an `OWNER` to an existing authenticated user. Can create fields, inspect member lists, and update field crop, soil, and operational status. Cannot alter farm visibility, mutate farm ownership, manage members, or archive fields/farms.
- **`OBSERVER`:** Read-only inspection authority (e.g. agricultural inspectors, agronomists, passive landowners). Can inspect private farm details, field metrics, and field dashboards. Cannot perform any mutations.
- **Assigned `FARMER` (Deferred to Milestones 4 & 5):** Worker assigned to specific fields via `FieldAssignment`. Field-scoped access will be introduced in Milestone 4. Milestone 3 implements no farmer-specific field access.
- **Unauthenticated Public Visitor:** May access only the sanitized `public_farms` collection via `/api/v1/public/farms`. Has zero read or write access to private farm, membership, or field documents.

---

## 5. Concurrency Controls & Active Field Count Consistency (Critical Correction F)

### 5.1 Real Transaction-Based Optimistic Concurrency

Spring Data `@Version` has no native effect on Cloud Firestore SDK document writes. AgroAI enforces optimistic concurrency via Cloud Firestore transactions:

```
+---------------------------------------------------------------------------------------------------+
|                         TRANSACTIONAL OPTIMISTIC CONCURRENCY WORKFLOW                             |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  Caller Client (HTTP PUT/PATCH)                                                                   |
|     │                                                                                             |
|     ├── Sends Request with 'expectedVersion' (e.g. expectedVersion = 2)                            |
|     ▼                                                                                             |
|  Spring Boot Service (inside db.runTransaction)                                                   |
|     │                                                                                             |
|     ├── 1. Read document snapshot: DocumentSnapshot snap = transaction.get(docRef).get();         |
|     ├── 2. Extract current version: int currentVersion = snap.getLong("version").intValue();      |
|     ├── 3. Assert: if (currentVersion != request.getExpectedVersion())                            |
|     │         └── throw new StaleVersionException(request.getExpectedVersion(), currentVersion);  |
|     │             (Maps to HTTP 409 Conflict via GlobalExceptionHandler)                          |
|     ├── 4. Mutate domain fields and increment version: newVersion = currentVersion + 1;           |
|     ├── 5. Apply atomic writes: transaction.set(docRef, updatedMap);                              |
|     │      (Also synchronizes public projection if applicable)                                    |
|     ▼                                                                                             |
|  Firestore Engine                                                                                 |
|     └── Evaluates read locks; commits if unchanged; automatically retries up to 5 times on        |
|         transient lock contention before throwing transaction execution exception.                |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
```

- Initial version on creation: `version = 1`.
- On every mutating update (`PUT /api/v1/farms/{farmId}`, `PUT /api/v1/farms/{farmId}/fields/{fieldId}`):
  - Client must supply `expectedVersion`.
  - Mismatch results in immediate abort and HTTP 409 Conflict.

### 5.2 Active Field Count Consistency (`activeFieldCount`)

To eliminate naming confusion and desynchronization:
1. The property is canonicalized as **`activeFieldCount`** across private farm documents, public projections, domain models, and DTOs.
2. It represents strictly the count of fields with `status != FieldStatus.ARCHIVED`.
3. **Atomic Field Creation:**
   - Inside the field creation transaction:
     - Read `farms/{farmId}`; assert status is `ACTIVE`.
     - Create `fields/{fieldDocumentId}` with `status = ACTIVE`.
     - Increment private farm: `activeFieldCount = activeFieldCount + 1`, `version = version + 1`.
     - If the farm is `PUBLIC`, atomically update `public_farms/{farmId}` with new `activeFieldCount` and updated `activeCropTypes`.
4. **Atomic Field Archival:**
   - Inside the field archival transaction:
     - Read `fields/{fieldDocumentId}`; assert current status is `ACTIVE` (or `FALLOW`/`PREPARATION`). If already `ARCHIVED`, abort with 400 Bad Request to prevent duplicate decrements.
     - Update field: `status = ARCHIVED`, `archivedAt = Instant.now()`.
     - Decrement private farm: `activeFieldCount = Math.max(0, activeFieldCount - 1)`, `version = version + 1`.
     - If the farm is `PUBLIC`, atomically update `public_farms/{farmId}`.

### 5.3 Soft Archival Policy

- **No Hard Cascades:** Hard deleting a farm or field destroys historical audit trails and breaks foreign key integrity. AgroAI strictly enforces **soft archival**.
- Farm Archival (`POST /api/v1/farms/{farmId}/archive`):
  - Marks `farms/{farmId}` with `status = ARCHIVED`, `archivedAt = Instant.now()`.
  - Atomically deletes `public_farms/{farmId}`.
  - Field documents under the farm remain preserved in Firestore; access is gated because `FarmSecurityEvaluator` verifies parent farm status is `ACTIVE`.
- Restoration is outside Milestone 3 scope and marked deferred.

---

## 6. Firestore Composite Index Specifications

Based on exact query patterns in Milestone 3 repositories, the following composite indexes are required. (Documented for deployment planning; live deployment remains locked).

| Collection | Fields & Direction | Query Method / Justification |
|---|---|---|
| `farms` | `ownerUid` (ASC), `status` (ASC), `registeredAt` (DESC) | `FarmRepository.findByOwnerUid`: Lists active and archived farms owned by a specific user, sorted chronologically. |
| `farm_members` | `userId` (ASC), `status` (ASC) | `FarmMembershipRepository.findActiveMembershipsByUser`: Retrieves all active farm memberships for the authenticated user to populate the frontend `FarmSwitcher`. |
| `farm_members` | `farmId` (ASC), `status` (ASC), `joinedAt` (ASC) | `FarmMembershipRepository.findMembersByFarm`: Retrieves active member roster for an authorized farm overview. |
| `fields` | `farmId` (ASC), `status` (ASC), `name` (ASC) | `FieldRepository.findByFarmIdAndStatus`: Lists active fields under a specific farm sorted alphabetically. |
| `public_farms` | `division` (ASC), `district` (ASC), `registeredAt` (DESC) | `PublicFarmProjectionRepository.search`: Powers public farm discovery directory with regional filtering. |
| `public_farms` | `registeredAt` (DESC) | `PublicFarmProjectionRepository.findAllRecent`: Powers default public explore landing view. |

---

## 7. GeoJSON Boundary Validation Scope (Milestone 3 Deferral)

The original proposal referenced farm land boundaries. Milestone 3 formally establishes the following boundary policy:

1. **Milestone 3 Core:** Farm boundaries are **deferred** to Milestone 6 (Mapping and GIS Integration). Milestone 3 farms and fields use administrative regional designations (`district`, `division`, `detailedAddress`) and numerical area metrics (`totalAreaHectares`, `areaHectares`).
2. **Security Reason for Deferral:** Firestore has no native GeoJSON polygon validation. Accepting unvalidated polygon rings from client requests introduces severe risks of invalid coordinate references, self-intersecting polygons, winding-order bugs, and denial-of-service via huge payloads.
3. **Future Architecture Target (Milestone 6 Specification):**
   - Coordinate Reference System: WGS84 (`EPSG:4326`).
   - Coordinate Ordering: `[longitude, latitude]` per GeoJSON RFC 7946.
   - Geometry Type: Strictly `Polygon` (single exterior ring; counter-clockwise winding).
   - Coordinate Limits: Longitude `[-180.0, 180.0]`, Latitude `[-90.0, 90.0]`.
   - Ring Closure: First coordinate must exactly equal last coordinate.
   - Max Vertices: Max 100 vertices per boundary ring.

---

## 8. Deferred Functionality Registry

To prevent scope creep, the following capabilities are explicitly declared deferred and excluded from Milestone 3:

| Deferred Capability | Target Milestone | Architectural Reason |
|---|:---:|---|
| **Farmer-to-Field Assignments** | Milestone 4 & 5 | Requires farmer marketplace, applications, and job contracts before operational assignments can exist. |
| **FieldAssignmentRepository Production Persistence** | Milestone 4 | In-memory stub preserved for backward compatibility; production implementation deferred. |
| **Worker Dashboards & Farmer Field Access** | Milestone 4 | Farmers gain field access in Milestone 4 via approved marketplace assignments. |
| **Job Postings & Recruitment Marketplace** | Milestone 4 | Core marketplace domain. |
| **GeoJSON Polygon Boundary Capture & GIS** | Milestone 6 | Requires GeoJSON parser, spatial validation, and interactive map components. |
| **Farm Ownership Transfer** | Post-M3 | Requires multi-stage acceptance workflow between two verified owners. |
| **Farm & Field Restoration from Archive** | Post-M3 | Archival is one-way soft deletion in Milestone 3. |
