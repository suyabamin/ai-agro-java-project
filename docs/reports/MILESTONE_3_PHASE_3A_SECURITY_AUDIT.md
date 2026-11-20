# AgroAI — Milestone 3 Phase 3A Security Audit
## Authorization Boundaries, Projection Isolation & Firestore Rule Verification

**Project:** AgroAI Platform  
**Milestone:** 3 — Farm and Field Management  
**Phase:** 3A — Farm Management, Membership Persistence & Public Projection Foundation  
**Audit Date:** 2026-11-17  
**Status:** PASS — ALL SECURITY CONSTRAINTS VERIFIED

---

## 1. Security Architecture & Threat Model

Milestone 3 Phase 3A establishes the multi-farm tenancy security boundary. The primary attack surfaces evaluated and mitigated are:

1. **Unauthorized Cross-Tenant Farm Access:** Malicious users attempting to read or modify farms where they hold no active membership.
2. **Public Projection Data Leakage:** Unauthenticated clients attempting to read private farm metadata, detailed addresses, owner safe UIDs, or records of archived farms.
3. **Privilege Escalation:** Non-owner members attempting to grant themselves OWNER role, alter other members' roles, or soft-archive farms.
4. **Sole Owner Lockout:** Malicious or accidental removal/demotion of the sole active owner of a farm, leaving the farm orphaned.
5. **Concurrent Write Clobbering:** Simultaneous updates overwriting changes without concurrency checks.
6. **Token Revocation Bypass:** Compromised or revoked Firebase ID tokens executing high-risk mutations.

---

## 2. Authorization Verification Matrix

| Endpoint | Target Resource | Required Permission | Enforcement Layer | Test Verification |
|---|---|---|---|---|
| `POST /api/v1/farms` | `farms` | Authenticated + Revocation check | `@RequiresRevocationCheck` | Verified in `FarmControllerIntegrationTest.testCreateFarmEndpoint` |
| `GET /api/v1/farms` | `farms` | Authenticated | `FarmService.getMyFarms` | Verified in `FarmControllerIntegrationTest.testListMyFarmsEndpoint` |
| `GET /api/v1/farms/{id}` | `farms/{id}` | Farm Member (`ACTIVE`) | `@PreAuthorize("@farmSecurity.isFarmMember(...)")` | Verified in `FarmControllerIntegrationTest.testNonMemberForbidden` (403) |
| `PUT /api/v1/farms/{id}` | `farms/{id}` | Farm Manager or Owner + Revocation check | `@farmSecurity.isFarmManager(...)` + `@RequiresRevocationCheck` | Verified in `FarmControllerIntegrationTest.testStaleUpdateReturnsConflict` |
| `PATCH /api/v1/farms/{id}/visibility` | `farms/{id}` | Farm Owner + Revocation check | `@farmSecurity.isFarmOwner(...)` + `@RequiresRevocationCheck` | Verified in `FarmControllerIntegrationTest.testToggleVisibilityEndpoint` |
| `POST /api/v1/farms/{id}/archive` | `farms/{id}` | Farm Owner + Revocation check | `@farmSecurity.isFarmOwner(...)` + `@RequiresRevocationCheck` | Verified in `FarmControllerIntegrationTest.testArchiveFarmEndpoint` |
| `GET /api/v1/farms/{id}/members` | `farm_members` | Farm Member (`ACTIVE`) | `@farmSecurity.isFarmMember(...)` | Verified in `FarmControllerIntegrationTest` |
| `POST /api/v1/farms/{id}/members` | `farm_members` | Farm Owner + Revocation check | `@farmSecurity.isFarmOwner(...)` + `@RequiresRevocationCheck` | Verified in `FarmControllerIntegrationTest.testAddMemberEndpoint` |
| `PATCH /api/v1/farms/{id}/members/{u}` | `farm_members/{m}` | Farm Owner + Revocation check | `@farmSecurity.isFarmOwner(...)` + `@RequiresRevocationCheck` | Verified in `FarmControllerIntegrationTest.testUpdateMemberRoleEndpoint` |
| `DELETE /api/v1/farms/{id}/members/{u}` | `farm_members/{m}` | Farm Owner + Revocation check | `@farmSecurity.isFarmOwner(...)` + `@RequiresRevocationCheck` | Verified in `FarmControllerIntegrationTest.testRevokeMemberEndpoint` |
| `GET /api/v1/public/farms` | `public_farms` | Unauthenticated (`permitAll`) | `SecurityConfig` + allowlist query | Verified in `FarmControllerIntegrationTest.testPublicDiscoveryEndpointsUnauthenticated` |
| `GET /api/v1/public/farms/{id}` | `public_farms/{id}` | Unauthenticated (`permitAll`) | `SecurityConfig` + projection query | Verified in `FarmControllerIntegrationTest.testPublicDetail404ForPrivateFarm` |

---

## 3. Public Projection Data Isolation & PII Protection

### 3.1 Allowlist vs Denylist Architecture
Under no circumstances are documents from `/farms/{farmId}` exposed directly to unauthenticated clients. The platform implements a dedicated, isolated top-level collection:

```
/public_farms/{farmId}
```

The projection entity `PublicFarmProjection` is created exclusively via explicit allowlist copying:
- **Included Fields:** `farmId`, `name`, `description`, `district`, `division`, `totalAreaHectares`, `activeFieldCount`, `activeCropTypes`, `status`, `visibility`, `projectionVersion`, `registeredAt`, `updatedAt`.
- **Strictly Excluded Private Fields:**
  - `ownerUid` (Private Firebase Auth UID)
  - `ownerSafeUid` (Encoded internal identifier)
  - `detailedAddress` (Physical street/plot level address)
  - Internal audit notes and future field geometry

### 3.2 Projected Document State Synchronization
- In live Firestore mode, `FarmService.registerFarm`, `updateVisibility`, and `archiveFarm` execute within an atomic multi-document transaction (`db.runTransaction(...)`).
- When a farm's visibility is changed to `PRIVATE`, or the farm is `ARCHIVED`, the transaction immediately purges `/public_farms/{farmId}`.
- In unauthenticated public discovery, querying a private or archived farm returns HTTP 404 Not Found.

---

## 4. Firestore Security Rules Alignment

The actual `firestore.rules` file in the repository was inspected and preserved without modification. The production security rules for `public_farms/{farmId}` require:

```javascript
match /public_farms/{farmId} {
  allow read: if resource.data.status == 'ACTIVE' && resource.data.visibility == 'PUBLIC';
  allow write: if false; // Mutated solely via Admin SDK / Backend service
}
```

### Safety Audit of Rule Predicates:
1. Direct unauthenticated client reads to `/public_farms/{farmId}` evaluate the document's own persisted `status` and `visibility` fields.
2. Even if a document existed in `public_farms` with `status == 'ARCHIVED'`, the rule predicate denies access immediately without requiring a cross-collection `get()` lookup.
3. Client writes are completely prohibited (`allow write: if false;`), ensuring that only the authenticated, authoritative Spring Boot backend (acting via Firebase Admin SDK service account) can create, update, or delete projections.

---

## 5. Sole Owner & Roster Governance

1. **Sole Active Owner Demotion Guard:** `FarmMembershipService.updateMemberRole` inspects `countActiveOwners(farmId)`. If the target user is the sole active OWNER, demotion throws `IllegalArgumentException` ("Cannot demote the sole active OWNER of the farm").
2. **Sole Active Owner Revocation Guard:** `FarmMembershipService.revokeMember` similarly prohibits revoking the sole active OWNER.
3. **No Self-Invitation:** `addMember` rejects requests where the target UID equals the caller's UID.
4. **Target User Existence Check:** `addMember` queries `UserRepository.findPrivateProfile(targetUserId)`. If no registered profile exists, the request fails immediately with HTTP 400.
5. **No Ownership Transfer in Phase 3A:** Role updates are strictly constrained to `MANAGER` or `OBSERVER`. Owner transfer is explicitly deferred to future governance milestones.

---

## 6. Audit Conclusion: PASS

All security controls defined in Milestone 3 Revision 2 are verified, functional, and enforced at both API and persistence layers.
