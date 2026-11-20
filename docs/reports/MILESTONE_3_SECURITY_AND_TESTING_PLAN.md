# AgroAI — Milestone 3: Security and Testing Plan
## Multi-Tiered Verification, Threat Model & Testing Architecture

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
| **Revision 1** | 2026-11-17 | Initial security and testing plan. Included tests allowing public read directly on `farms/{farmId}`, referenced non-existent `FarmRole.MEMBER`, and included farmer assignment tests. | Superceded |
| **Revision 2** | 2026-11-17 | Comprehensive security and verification revision: (1) Replaced public read rule on `farms/{farmId}` with dedicated `public_farms/{farmId}` rules; (2) Removed all farmer assignment emulator and integration tests; (3) Unified authoritative permission matrix; (4) Added membership lifecycle security tests (sole-owner protection, duplicate prevention); (5) Added optimistic concurrency conflict tests (HTTP 409); (6) Separated test tiers into four clear categories with live cloud tests locked; (7) Honestly preserved historical 98-test baseline without claiming re-execution; (8) Reasserted live Firestore rules deployment lock. | **CURRENT AUTHORITATIVE BASELINE** |

---

## 1. Threat Model & Security Architecture

### 1.1 Threat Vectors & Mitigation Strategy

```
+---------------------------------------------------------------------------------------------------+
|                                 MILESTONE 3 THREAT MITIGATION MATRIX                              |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  [THREAT 1: Public Farm Data Exposure]                                                            |
|  - Threat: Client queries /farms/{farmId} directly to steal owner UID, address, and notes.        |
|  - Mitigation: Physical collection isolation. /farms/{farmId} read is strictly member-only.      |
|    Public discovery is served exclusively from /public_farms/{farmId} with allowlist fields only.|
|                                                                                                   |
|  [THREAT 2: Admin SDK Rules Bypass]                                                               |
|  - Threat: Attacker calls REST APIs hoping Admin SDK bypasses security checks.                    |
|  - Mitigation: Independent server-side evaluation. Spring Boot @farmSecurity checks caller identity|
|    and farm_members records before executing any Firestore SDK call.                              |
|                                                                                                   |
|  [THREAT 3: Path Injection & Key Corruption]                                                      |
|  - Threat: Path traversal using slashes, colons, or dots in farm or field IDs.                    |
|  - Mitigation: Strict validation via KeyEncoder.validateFarmId / validateFieldId against          |
|    ^[a-zA-Z0-9-]{1,64}$. Hyphenated UUIDs (farm-<uuid>) and composite IDs ({farmId}--{localId}). |
|                                                                                                   |
|  [THREAT 4: Cross-Farm Data Manipulation]                                                         |
|  - Threat: Member of Farm A creates or edits fields referencing Farm B.                           |
|  - Mitigation: Scoped authorization. Service verifies field's parent farmId matches path farmId   |
|    and confirms caller's role in that specific farm before issuing any mutation.                  |
|                                                                                                   |
|  [THREAT 5: Sole-Owner Demotion / Farm Hijacking]                                                  |
|  - Threat: Farm owner accidentally or maliciously removes themselves, stranding the farm.         |
|  - Mitigation: Membership safeguards. FarmMembershipService forbids demoting or revoking the      |
|    sole OWNER. Ownership transfer is deferred out of scope.                                       |
|                                                                                                   |
|  [THREAT 6: Revoked Token Exploitation]                                                           |
|  - Threat: Revoked user performs mutations before token expires (1-hour JWT window).               |
|  - Mitigation: RevocationCheckInterceptor forces live online revocation check on all mutating     |
|    endpoints (@RequiresRevocationCheck). Revoked tokens are rejected immediately with HTTP 401.   |
|                                                                                                   |
|  [THREAT 7: Unverified Account Abuse]                                                             |
|  - Threat: Bot accounts create farms or add members without email verification.                   |
|  - Mitigation: Verified-email requirement strictly enforced on all farm and field mutations.       |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
```

---

## 2. Authoritative Permission Matrix

This table represents the single source of truth for contextual authority across Milestone 3:

| Operation | `OWNER` | `MANAGER` | `OBSERVER` | Public Visitor |
|---|:---:|:---:|:---:|:---:|
| **View Private Farm (`farms/{farmId}`)** | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No (401/403) |
| **View Public Projection (`public_farms/{farmId}`)** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes (if active) |
| **Update Farm Information (Name, Bio, Area)** | ✅ Yes | ❌ No (403) | ❌ No (403) | ❌ No (401/403) |
| **Toggle Farm Visibility (`PUBLIC`/`PRIVATE`)** | ✅ Yes | ❌ No (403) | ❌ No (403) | ❌ No (401/403) |
| **Archive Farm (`status = ARCHIVED`)** | ✅ Yes | ❌ No (403) | ❌ No (403) | ❌ No (401/403) |
| **View Farm Member Roster** | ✅ Yes | ✅ Yes | ❌ No (403) | ❌ No (401/403) |
| **Add Member (`MANAGER` / `OBSERVER`)** | ✅ Yes | ❌ No (403) | ❌ No (403) | ❌ No (401/403) |
| **Update Member Role (`MANAGER` ↔ `OBSERVER`)** | ✅ Yes | ❌ No (403) | ❌ No (403) | ❌ No (401/403) |
| **Revoke Membership (`status = REVOKED`)** | ✅ Yes | ❌ No (403) | ❌ No (403) | ❌ No (401/403) |
| **Create Field Under Farm** | ✅ Yes | ✅ Yes | ❌ No (403) | ❌ No (401/403) |
| **View Field Overview & Dashboard** | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No (401/403) |
| **Update Field (Crop, Soil, Area, Status)** | ✅ Yes | ✅ Yes | ❌ No (403) | ❌ No (401/403) |
| **Archive Field (`status = ARCHIVED`)** | ✅ Yes | ❌ No (403) | ❌ No (403) | ❌ No (401/403) |

*Scope Notice:* Farmer assignment permissions are **deferred** to Milestone 4.

---

## 3. Proposed Cloud Firestore Security Rules (Documentation-Only)

The following rules specification defines the target security configuration to be validated in the local emulator during Phase 3C.

> [!IMPORTANT]
> **LIVE RULES DEPLOYMENT IS LOCKED.** The actual `firestore.rules` file in the workspace remains unchanged during this documentation task. Deployment (`firebase deploy --only firestore:rules`) is strictly prohibited until explicit user authorization.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null && request.auth.uid != null;
    }

    function hasSafeUid() {
      return isAuthenticated() && 
        'safeUid' in request.auth.token && 
        request.auth.token.safeUid is string && 
        request.auth.token.safeUid.size() > 4;
    }

    function membershipDocId(farmId, safeUid) {
      return 'mbr_' + farmId + '::' + safeUid;
    }

    function isFarmMember(farmId) {
      return hasSafeUid() && 
        exists(/databases/$(database)/documents/farm_members/$(membershipDocId(farmId, request.auth.token.safeUid))) &&
        get(/databases/$(database)/documents/farm_members/$(membershipDocId(farmId, request.auth.token.safeUid))).data.status == 'ACTIVE';
    }

    // --- Private Farms Collection ---
    // Strictly member-only. NEVER publicly readable.
    match /farms/{farmId} {
      allow read: if isFarmMember(farmId);
      allow write: if false; // Managed exclusively by Spring Boot Admin SDK
    }

    // --- Public Farm Projections Collection ---
    // Sanitized projection. Readable by anyone only when status is ACTIVE and visibility is PUBLIC.
    // Projections of private, suspended, or archived farms are transactionally deleted by backend
    // and rejected by this rule predicate if orphaned.
    match /public_farms/{farmId} {
      allow read: if resource.data.status == 'ACTIVE' && resource.data.visibility == 'PUBLIC';
      allow write: if false; // Synchronized exclusively by Spring Boot Admin SDK
    }

    // --- Farm Members Collection ---
    // Roster privacy: only members of the same farm can view.
    match /farm_members/{membershipId} {
      allow read: if isAuthenticated() && isFarmMember(resource.data.farmId);
      allow write: if false;
    }

    // --- Fields Collection ---
    // Top-level fields: readable only by active farm members.
    match /fields/{fieldDocumentId} {
      allow read: if isAuthenticated() && isFarmMember(resource.data.farmId);
      allow write: if false;
    }

    // --- Existing Milestone 2 Collections (Preserved) ---
    match /users/{uid} {
      allow read: if isAuthenticated() && request.auth.uid == uid;
      allow write: if false;
    }

    match /public_profiles/{uid} {
      allow read: if isAuthenticated();
      allow write: if false;
    }

    match /quarantined_public_profiles/{quarantineId} {
      allow read, write: if false;
    }
  }
}
```

### 3.1 Architectural Analysis: Cross-Document `get()` Alternative & Its Limitations
If Firestore Security Rules were designed to use `get()` to inspect the private farm document:
```javascript
// Alternative cross-document inspection (Evaluated and rejected for scalability reasons)
function isPublicActiveInPrivateDoc(farmId) {
  return get(/databases/$(database)/documents/farms/$(farmId)).data.visibility == 'PUBLIC' &&
         get(/databases/$(database)/documents/farms/$(farmId)).data.status == 'ACTIVE';
}
```
While functional for single-document `get` requests, this approach introduces three fatal production limitations:
1. **Billing & Quota Amplification:** Every read on `public_farms/{farmId}` triggers an automatic second billable read on `farms/{farmId}`, doubling read consumption.
2. **Quota Limits:** Firestore rules enforce a hard maximum of 10 `get()` calls per security evaluation.
3. **Collection Query Incompatibility:** In Cloud Firestore, rules cannot dynamically evaluate cross-document `get()` calls during collection listing queries (`collection('public_farms').get()`), causing public search and exploration queries to fail with `PERMISSION_DENIED`.

Therefore, storing `status: 'ACTIVE'` and `visibility: 'PUBLIC'` directly on `public_farms/{farmId}` and combining that with transactional deletion upon private/archived/suspended transitions provides complete defense-in-depth without any of the limitations of `get()`.

---

## 4. Multi-Tiered Testing Strategy

Testing is organized into five strict tiers to isolate local, emulator, and live environments:

```
+---------------------------------------------------------------------------------------------------+
|                                  MILESTONE 3 TESTING PYRAMID                                      |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  [TIER 5: Live Firebase Cloud Verification] (LOCKED — Authorized Post-Gate Only)                 |
|  - Real Firebase Auth + Live Cloud Firestore tests with disposable farm data                      |
|                                                                                                   |
|  [TIER 4: Frontend Component & Navigation Tests] (Vitest)                                         |
|  - FarmSwitcher, CreateFarmModal, FarmDashboardPage, FieldListPage, ExploreFarmsPage             |
|                                                                                                   |
|  [TIER 3: Cloud Firestore Rules Emulator Tests] (Vitest + @firebase/rules-unit-testing)           |
|  - Dedicated local emulator tests verifying /farms, /public_farms, /farm_members, /fields         |
|                                                                                                   |
|  [TIER 2: Backend MockMvc Integration Tests] (JUnit 5 + Spring Boot)                              |
|  - FarmController, FarmMembershipController, FieldController, PublicFarmController               |
|                                                                                                   |
|  [TIER 1: Backend Domain & Repository Unit Tests] (JUnit 5)                                       |
|  - KeyEncoder boundaries, DTO Bean Validations, dual-mode repository fail-closed tests            |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
```

---

### 4.1 Tier 1: Backend Domain & Repository Unit Tests

| Test ID | Scope / Target | Description | Expected Outcome |
|---|---|---|---|
| `[M3-UNIT-01]` | `KeyEncoderTest` | Validate valid farm ID: `farm-550e8400-e29b-41d4-a716-446655440000` | Pass; matches `^[a-zA-Z0-9-]{1,64}$` |
| `[M3-UNIT-02]` | `KeyEncoderTest` | Reject farm ID containing underscores: `farm_550e8400...` | Throws `IllegalArgumentException` |
| `[M3-UNIT-03]` | `KeyEncoderTest` | Validate composite field document ID: `farm-...--field-01` | Pass; matches `^[a-zA-Z0-9-]{1,64}$` |
| `[M3-UNIT-04]` | `KeyEncoderTest` | Reject field ID containing slashes, colons, or >64 characters | Throws `IllegalArgumentException` |
| `[M3-UNIT-05]` | `KeyEncoderTest` | Verify deterministic membership doc ID: `mbr_${farmId}::${safeUid}` | Deterministic output starting with `mbr_` |
| `[M3-UNIT-06]` | `CreateFarmRequestTest` | Validate Bean Validation on `CreateFarmRequest` (missing name, area < 0.1) | Fails validation with expected message |
| `[M3-UNIT-07]` | `CreateFieldRequestTest` | Validate Bean Validation on `CreateFieldRequest` (invalid local ID, area < 0.01) | Fails validation with expected message |
| `[M3-UNIT-08]` | `FirestoreFarmRepositoryTest` | Save and retrieve farm in dual-mode repository (in-memory mode) | Exact match of saved attributes |
| `[M3-UNIT-09]` | `FirestoreFarmMembershipRepositoryTest` | Save, find, and revoke membership | Status transitions to `REVOKED` |
| `[M3-UNIT-10]` | `FirestoreFieldRepositoryTest` | Save field and query by farm ID and status | Returns active fields |
| `[M3-UNIT-11]` | `FirestoreFarmRepositoryFailClosedTest` | Fail-closed guard: simulate Firestore failure when configured | Throws `DatabaseUnavailableException` (HTTP 503) |

---

### 4.2 Tier 2: Backend MockMvc Integration Tests

| Test ID | Endpoint / Scenario | Security Context | Expected Outcome |
|---|---|---|---|
| `[M3-API-01]` | `POST /api/v1/farms` | Authenticated (Verified Email) | 201 Created; returns `FarmResponseDTO`; atomic owner membership created |
| `[M3-API-02]` | `POST /api/v1/farms` | Unauthenticated | 401 Unauthorized |
| `[M3-API-03]` | `POST /api/v1/farms` | Unverified Email | 403 Forbidden (`EMAIL_VERIFICATION_REQUIRED`) |
| `[M3-API-04]` | `POST /api/v1/farms` | Duplicate `farmId` | 409 Conflict |
| `[M3-API-05]` | `GET /api/v1/farms` | Authenticated | 200 OK; returns array of user's active farms |
| `[M3-API-06]` | `GET /api/v1/farms/{farmId}` | Authenticated (`FarmRole.OWNER` or `MANAGER` or `OBSERVER`) | 200 OK; returns private farm details |
| `[M3-API-07]` | `GET /api/v1/farms/{farmId}` | Authenticated (Non-member) | 403 Forbidden (`Access Denied`) |
| `[M3-API-08]` | `PUT /api/v1/farms/{farmId}` | Authenticated (`FarmRole.OWNER`, valid `expectedVersion`) | 200 OK; increments version to 2 |
| `[M3-API-09]` | `PUT /api/v1/farms/{farmId}` | Authenticated (`FarmRole.OWNER`, stale `expectedVersion`) | 409 Conflict (`StaleVersionException`) |
| `[M3-API-10]` | `PUT /api/v1/farms/{farmId}` | Authenticated (`FarmRole.MANAGER`) | 403 Forbidden (Only `OWNER` can edit farm info) |
| `[M3-API-11]` | `PATCH /api/v1/farms/{farmId}/visibility` | Authenticated (`FarmRole.OWNER`, PRIVATE → PUBLIC) | 200 OK; creates `public_farms/{farmId}` projection |
| `[M3-API-12]` | `PATCH /api/v1/farms/{farmId}/visibility` | Authenticated (`FarmRole.OWNER`, PUBLIC → PRIVATE) | 200 OK; deletes `public_farms/{farmId}` projection |
| `[M3-API-13]` | `POST /api/v1/farms/{farmId}/archive` | Authenticated (`FarmRole.OWNER`) | 200 OK; marks `ARCHIVED`; deletes public projection |
| `[M3-API-14]` | `POST /api/v1/farms/{farmId}/members` | Authenticated (`FarmRole.OWNER`, add `MANAGER`) | 201 Created; persists `FarmMembership` |
| `[M3-API-15]` | `DELETE /api/v1/farms/{farmId}/members/{userId}` | Authenticated (`FarmRole.OWNER`, attempt remove self) | 400 Bad Request (Cannot remove sole owner) |
| `[M3-API-16]` | `POST /api/v1/farms/{farmId}/fields` | Authenticated (`FarmRole.MANAGER`) | 201 Created; increments parent `activeFieldCount` |
| `[M3-API-17]` | `POST /api/v1/farms/{farmId}/fields` | Authenticated (`FarmRole.OBSERVER`) | 403 Forbidden (`OBSERVER` cannot create fields) |
| `[M3-API-18]` | `POST /api/v1/farms/{farmId}/fields/{fieldId}/archive` | Authenticated (`FarmRole.OWNER`) | 200 OK; marks `ARCHIVED`; decrements `activeFieldCount` |
| `[M3-API-19]` | `POST /api/v1/farms/{farmId}/fields/{fieldId}/archive` | Authenticated (`FarmRole.MANAGER`) | 403 Forbidden (Only `OWNER` can archive fields) |
| `[M3-API-20]` | `GET /api/v1/public/farms` | Unauthenticated (Public Visitor) | 200 OK; returns public projections from `public_farms` |
| `[M3-API-21]` | `GET /api/v1/public/farms/{farmId}` | Unauthenticated (Public Visitor, Private Farm) | 404 Not Found |

---

### 4.3 Tier 3: Cloud Firestore Rules Emulator Tests (`firestore.rules.test.ts`)

| Test ID | Collection & Target | Auth Context | Expected Outcome |
|---|---|---|---|
| `[M3-RULE-01]` | `/farms/{farmId}` — Read | Unauthenticated Visitor | **DENY** (Private collection) |
| `[M3-RULE-02]` | `/farms/{farmId}` — Read | Authenticated Non-member | **DENY** (Private collection) |
| `[M3-RULE-03]` | `/farms/{farmId}` — Read | Authenticated Active Member (`isFarmMember`) | **PERMIT** |
| `[M3-RULE-04]` | `/farms/{farmId}` — Client Write | Any User (Auth or Unauth) | **DENY** (`allow write: if false;`) |
| `[M3-RULE-05]` | `/public_farms/{farmId}` — Read | Unauthenticated Visitor (`status == 'ACTIVE'`, `visibility == 'PUBLIC'`) | **PERMIT** |
| `[M3-RULE-05b]`| `/public_farms/{farmId}` — Read | Unauthenticated Visitor (Stale/Orphaned projection: status != 'ACTIVE') | **DENY** |
| `[M3-RULE-06]` | `/public_farms/{farmId}` — Client Write | Any User | **DENY** (`allow write: if false;`) |
| `[M3-RULE-07]` | `/farm_members/{membershipId}` — Read | Active Member of Same Farm | **PERMIT** |
| `[M3-RULE-08]` | `/farm_members/{membershipId}` — Read | Non-member of Farm | **DENY** |
| `[M3-RULE-09]` | `/farm_members/{membershipId}` — Client Write | Any User | **DENY** (`allow write: if false;`) |
| `[M3-RULE-10]` | `/fields/{fieldDocumentId}` — Read | Active Member of Parent Farm | **PERMIT** |
| `[M3-RULE-11]` | `/fields/{fieldDocumentId}` — Read | Non-member of Parent Farm | **DENY** |
| `[M3-RULE-12]` | `/fields/{fieldDocumentId}` — Client Write | Any User | **DENY** (`allow write: if false;`) |

---

### 4.4 Tier 4: Frontend Component & Navigation Tests (Vitest)

| Test ID | Component | Scenario | Expected Outcome |
|---|---|---|---|
| `[M3-FE-01]` | `FarmSwitcher` | User owns 3 farms | Renders dropdown with all 3 farms; indicates active farm |
| `[M3-FE-02]` | `FarmSwitcher` | User switches active farm | Updates `FarmContext` and triggers field list reload |
| `[M3-FE-03]` | `CreateFarmModal` | Valid form submission | Dispatches `POST /api/v1/farms`; closes modal; updates switcher |
| `[M3-FE-04]` | `CreateFarmModal` | Validation errors (empty name, invalid ID) | Displays inline errors; blocks submission |
| `[M3-FE-05]` | `FarmDashboardPage` | Owner view vs Manager view | Renders member management and visibility toggle for owner; hides for manager |
| `[M3-FE-06]` | `FieldListPage` | Farm has active fields | Renders field cards with crop badge, soil type, and area |
| `[M3-FE-07]` | `FieldDashboardPage` | Renders field detail view | Displays field properties and future module placeholder cards |
| `[M3-FE-08]` | `ExploreFarmsPage` | Renders public directory | Displays public cards; filters by district; omits private owner info |

---

## 5. Existing 98-Test Baseline Disclosure

AgroAI maintains a strict policy of test reporting integrity:
- **Historical Repository Baseline:** Exactly **98 automated test methods** across 17 test source files (81 offline CI tests + 17 live cloud tests).
- **Current Task Disclosure:** This revision was strictly a **documentation-only audit and plan**. Zero test suites were executed during this task. The 98-test baseline is documented honestly as historical verification evidence from Milestone 2 and has not been fabricated or re-run.

---

## 6. Live Firebase Rules Deployment Lock

Live deployment of Cloud Firestore Security Rules remains **LOCKED**.
- Command `firebase deploy --only firestore:rules` is strictly prohibited during planning.
- Proposed rules must be verified in the local emulator (`npm run test:rules`) during Phase 3C before any live deployment authorization is requested from the user.
