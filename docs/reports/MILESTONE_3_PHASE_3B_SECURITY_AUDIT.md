# AgroAI — Milestone 3 Phase 3B Security Audit
## Field Subsystem Security, Multi-Tenancy & Authorization Audit

**Project:** AgroAI Platform  
**Milestone:** 3 — Farm and Field Management  
**Phase:** 3B — Field Management Subsystem  
**Audit Date:** 2026-11-17  
**Auditor:** AgroAI Security & QA Architecture Team  
**Audit Status:** APPROVED (Zero Critical / High / Medium Vulnerabilities)

---

## 1. Audit Scope & Security Objectives

This audit inspects the security architecture of the Phase 3B Field Management subsystem:
1. **Multi-Tenancy & Resource Isolation:** Verifying that field records cannot be created under, attached to, or accessed across foreign farms.
2. **Role-Based Access Control (RBAC):** Verifying distinct privileges among `OWNER`, `MANAGER`, and `OBSERVER` roles for field-level operations.
3. **Session Integrity & Token Revocation:** Verifying enforcement of active authentication and revoked token checks (`@RequiresRevocationCheck`).
4. **Identifier Canonicalization & Injection Resistance:** Verifying strict enforcement of the 64-character ceiling and character constraints on `localFieldId` and `fieldDocId`.
5. **Fail-Closed Resilience:** Verifying fail-closed protections against database dropouts and configuration anomalies.
6. **Concurrency Safety:** Verifying optimistic locking to prevent lost updates during concurrent edits.

---

## 2. Security Findings & Verifications

### 2.1 Multi-Tenancy & Cross-Farm Isolation

- **Invariant:** A field belongs to exactly one farm. Composite key format: `{farmId}--{localFieldId}`.
- **Verification:**
  - `FieldService.getFieldById` and `updateField` verify that `field.getFarmId().equals(farmId)`. If a caller passes a mismatched `farmId` and `fieldId`, access is immediately denied.
  - Furthermore, `FieldSecurityEvaluator` / `@farmSecurity.isFarmMember(#farmId)` checks caller membership against the farm specified in the URL before method execution.
  - Non-members receive HTTP 403 Forbidden without any disclosure of field metadata.

### 2.2 Privilege Separation Matrix (RBAC)

| Endpoint | Operation | Minimum Allowed Role | Denied Roles | Verified Test Case |
|---|---|---|---|---|
| `POST /api/v1/farms/{farmId}/fields` | Create Field | `MANAGER` | `OBSERVER`, Non-member | `testCreateFieldAsObserverForbidden` |
| `GET /api/v1/farms/{farmId}/fields` | List Fields | `OBSERVER` | Non-member, Revoked | `testListFieldsAsNonMemberForbidden` |
| `GET /api/v1/farms/{farmId}/fields/{id}` | Inspect Field | `OBSERVER` | Non-member, Revoked | `testListFieldsAsNonMemberForbidden` |
| `PUT /api/v1/farms/{farmId}/fields/{id}` | Update Metadata | `MANAGER` | `OBSERVER`, Non-member | `testUpdateFieldAsObserverForbidden` |
| `POST /api/v1/farms/{farmId}/fields/{id}/archive` | Archive Field | `OWNER` | `MANAGER`, `OBSERVER`, Non-member | `testArchiveFieldAsManagerForbidden` |

**Significance:** Only the `OWNER` can archive a field, preventing operational managers from permanently reducing the farm's active field count or acreage without owner authorization.

### 2.3 Token Revocation & Stale Session Protection

- All state-mutating endpoints (`POST /fields`, `PUT /fields/{id}`, `POST /fields/{id}/archive`) are annotated with `@RequiresRevocationCheck`.
- The AOP aspect `RevocationCheckAspect` queries `RevocationService` with the user's UID and token issue timestamp before allowing execution.
- If a user's tokens were invalidated (e.g., password reset, administrative revocation), requests immediately fail with HTTP 401 Unauthorized (`TokenRevokedException`).

### 2.4 Identifier Canonicalization & Firestore Key Limits

- Firestore document paths have a hard limit of 1500 bytes, but document IDs should be concise and predictable. AgroAI enforces a 64-character ceiling on document IDs across the platform.
- **Arithmetic Check:**
  - `farmId` length = 41 chars (`farm-` + 36-char UUIDv4).
  - Separator = 2 chars (`--`).
  - `localFieldId` regex = `^[a-zA-Z0-9-]{1,21}$` (max 21 chars).
  - Maximum composite length = $41 + 2 + 21 = 64$ characters.
- `KeyEncoder.validateLocalFieldId` strictly rejects path traversal symbols (`/`, `\`, `..`), database control characters (`$`, `*`, `?`), spaces, and unicode homoglyphs.

### 2.5 Concurrency Race Condition Protection

- Field updates enforce optimistic locking:
  ```java
  if (!field.getVersion().equals(request.getExpectedVersion())) {
      throw new StaleVersionException(
          String.format("Field version conflict for field '%s'. Current version: %d, expected: %d",
              fieldId, field.getVersion(), request.getExpectedVersion())
      );
  }
  ```
- If two managers attempt to edit crop types or irrigation schemes concurrently, the second update fails with HTTP 409 Conflict, preventing silent data overwrite.

### 2.6 Fail-Closed Production Behavior

- `FirestoreFieldRepository` implements fail-closed design:
  - If `production` profile is active and Firebase is uninitialized, startup fails via `@PostConstruct validateEnvironmentSafety()`.
  - In production mode, if a Firestore read or write fails, the exception is wrapped and rethrown as `DatabaseUnavailableException` (HTTP 503).
  - It **never** silently returns an empty list or attempts in-memory fallback during a production database outage.

---

## 3. Security Recommendations

1. **Firestore Client-Side Security Rules:** Client-side writes to `/fields/{fieldId}` remain strictly disabled (`allow write: if false`). Read permissions in `firestore.rules` are restricted to authenticated users who are active farm members or actively assigned farmers.
2. **Audit Logging:** Field creation, metadata updates, and archival operations are logged with structured context (`farmId`, `fieldId`, `callerUid`, `version`), providing complete traceability.

---

## 4. Conclusion

The Phase 3B Field Management subsystem satisfies all security, tenancy isolation, and authorization criteria established in the AgroAI Architecture Baseline.
