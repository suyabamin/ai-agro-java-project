# AgroAI — Milestone 4 Security Audit
## Authorization Symmetry, Token Revocation, Input Sanitation & Multi-Tenant Isolation

**Project:** AgroAI Platform  
**Repository:** `D:\agro-ai-java-project`  
**Milestone:** 4 — Farmer Marketplace  
**Audit Date:** November 17, 2026  
**Auditor:** Application Security & Independent Audit Team  

---

## 1. Executive Summary

A comprehensive source-level and test-verified security audit was conducted on Milestone 4 across the Java Spring Boot backend, Firestore Security Rules, and React frontend.

The audit verified:
1. **Zero Client Write Attack Surface:** All mutation operations across `jobs`, `applications`, `application_history`, and `application_messages` collections are strictly denied in `firestore.rules` (`allow write: if false`). All state mutations are channeled through verified Spring Boot backend endpoints authenticated via Firebase Admin SDK.
2. **Symmetrical RBAC Enforcement:** Controller-level security expressions (`@farmSecurity.isOwnerOrManager`, `@farmSecurity.isMember`) are mirrored by fail-closed service-layer membership validation.
3. **Revocation Check Enforcement:** State-mutating endpoints (`POST`, `PUT`) are annotated with `@RequiresRevocationCheck`, triggering synchronous Firebase token revocation checks.
4. **Collision-Proof Multi-Tenant Isolation:** The deterministic application document ID `app_${jobId}::${safeUid}` prevents cross-tenant or duplicate application injections.
5. **No Scope Leakage to Field Assignments:** Verified that `JobApplicationService.approveApplication` **strictly does not** touch the `field_assignments` collection.

---

## 2. Security Controls & RBAC Matrix

| Operation | Endpoint | Min Role | Spring Security | Service-Level Check | Revocation Check |
| :--- | :--- | :---: | :---: | :---: | :---: |
| Post Job | `POST /farms/{farmId}/jobs` | MANAGER | `@farmSecurity.isOwnerOrManager` | Verified Membership | **YES** |
| List Farm Jobs | `GET /farms/{farmId}/jobs` | OBSERVER | `@farmSecurity.isMember` | Verified Membership | NO |
| Update Job | `PUT /farms/{farmId}/jobs/{id}` | MANAGER | `@farmSecurity.isOwnerOrManager` | Verified Membership + OCC | **YES** |
| Publish Job | `POST /farms/{farmId}/jobs/{id}/publish` | MANAGER | `@farmSecurity.isOwnerOrManager` | Verified Membership | **YES** |
| Pause Job | `POST /farms/{farmId}/jobs/{id}/pause` | MANAGER | `@farmSecurity.isOwnerOrManager` | Verified Membership | **YES** |
| Close Job | `POST /farms/{farmId}/jobs/{id}/close` | MANAGER | `@farmSecurity.isOwnerOrManager` | Verified Membership | **YES** |
| Archive Job | `POST /farms/{farmId}/jobs/{id}/archive` | **OWNER** | `@farmSecurity.isOwner` | Verified OWNER Role | **YES** |
| Public Browse | `GET /public/jobs` | Public | None | Filter `status == PUBLISHED` | NO |
| Public Detail | `GET /public/jobs/{id}` | Public | None | Verified `status == PUBLISHED` | NO |
| Apply Job | `POST /jobs/{id}/applications` | Candidate | Authenticated | Prohibit farm members; OCC | **YES** |
| My Applications | `GET /users/me/applications` | Candidate | Authenticated | Query bounded to `auth.uid` | NO |
| Withdraw Application | `POST /applications/{id}/withdraw`| Candidate | Authenticated | Verified `applicantUid == uid` | **YES** |
| List Applications | `GET /farms/{farmId}/applications` | MANAGER | `@farmSecurity.isOwnerOrManager` | Verified Membership | NO |
| Review Candidate | `POST /farms/{farmId}/applications/{id}/review` | MANAGER | `@farmSecurity.isOwnerOrManager` | State transition check | **YES** |
| Shortlist Candidate| `POST /farms/{farmId}/applications/{id}/shortlist`| MANAGER | `@farmSecurity.isOwnerOrManager` | State transition check | **YES** |
| Approve Candidate | `POST /farms/{farmId}/applications/{id}/approve` | MANAGER | `@farmSecurity.isOwnerOrManager` | OCC check (NO field asgn) | **YES** |
| Reject Candidate | `POST /farms/{farmId}/applications/{id}/reject` | MANAGER | `@farmSecurity.isOwnerOrManager` | OCC check | **YES** |
| Post Message | `POST /applications/{id}/messages`| Candidate/Mgr | Authenticated | Symmetrical authorization | **YES** |

---

## 3. Threat Modeling & Vulnerability Verification

### 3.1. Replay & Race Conditions on Application Submission
- **Threat:** Malicious script rapidly posts identical application payloads simultaneously to create duplicate records or skew application counts.
- **Defense:** Deterministic Document ID calculation:
  ```java
  String appId = KeyEncoder.applicationDocId(jobId, applicantUid);
  // Evaluates to: app_job-123::uid_ZmFybWVy...
  ```
  `jobApplicationRepository.findById(appId)` detects existing record and throws `DuplicateApplicationException` (409 Conflict). Atomic transaction prevents counters from desynchronizing.

### 3.2. Unauthorized Access to Farm Job Applications
- **Threat:** Unauthenticated visitors or non-member attackers read private candidate notes, resumes, or communications.
- **Defense:** 
  - Spring Security: `@PreAuthorize("@farmSecurity.isOwnerOrManager(#farmId, authentication)")`.
  - Firestore Security Rules:
    ```rules
    match /applications/{applicationId} {
      allow read: if isAuthenticated() && (
        resource.data.applicantUid == request.auth.uid ||
        isFarmMember(resource.data.farmId)
      );
      allow write: if false;
    }
    ```
    Strangers and unauthenticated queries receive immediate `PERMISSION_DENIED`. Verified by `[RULE-18]`.

### 3.3. Privilege Escalation to Archive Job
- **Threat:** Farm Manager or Observer attempts to archive a job.
- **Defense:** `JobController.archiveJob` requires `@farmSecurity.isOwner(#farmId, authentication)`. Furthermore, `JobService.archiveJob` verifies `membership.getRole() == FarmRole.OWNER`. Tested by `[API-JOB-12]` returning 403 Forbidden.

### 3.4. Token Revocation
- **Threat:** A compromised user whose session was revoked continues modifying farm jobs.
- **Defense:** All `@PostMapping`, `@PutMapping` endpoints pass through `RevocationCheckAspect`, querying `tokenVerifier.verifyToken(token, true)` with `checkRevoked = true`.

---

## 4. Security Audit Verdict

**AUDIT RESULT: FULL PASS**  
The implementation complies fully with all enterprise security invariants of AgroAI. No security regressions or privilege leaks detected.
