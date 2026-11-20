# M5 Backend Authorization Verification

**Finding:** M5-AUTH-01  
**Severity:** HIGH  
**Status:** PARTIAL  
**Date:** 2026-11-19

- **Source:** PRD FR-02, FR-09, FR-10, FR-16; `docs/architecture/AUTHORIZATION.md`; `RULES.md` §17–21. Backend authorization is authoritative because Admin SDK access bypasses Firestore Rules.
- **Existing behavior:** assignment service derives actor UID from the authenticated backend principal at controller boundary and checks active farm membership/role; assignment creation/release/reassignment check field/farm and immutable tenure references. Active assignment governs farmer workspace access.
- **Changed files:** only `backend/src/test/java/com/agroai/config/FirebaseAssignmentEmulatorLiveTest.java` was changed for this continuation; no production authorization code changed. Assignment create/archive and release/reassign concurrency checks were added to isolated emulator coverage.
- **Exact verification:** `.\mvnw.cmd -o test` in `backend`: total 219 tests, 0 failures, 0 errors, 0 skipped. Relevant class reports: `FieldAssignmentServiceTest` 13/13; `FieldAssignmentControllerIntegrationTest` 10/10; `ContextualSecurityTest` 6/6; `FirebaseAuthenticationIntegrationTest` 8/8. These use isolated/in-memory repositories and mocked token verification. Assignment Firestore emulator suite: 2/2, direct service calls with synthetic identity and synthetic emulator credential.
- **What these tests show:** unit/service authorization branches distinguish OWNER/MANAGER/OBSERVER/stranger; MockMvc verifies API status/results and derives identity from test token verifier; emulator exercises assignment transactions against local Firestore.
- **What they do not show:** genuine Firebase ID-token verification against live Auth; Spring Boot request authorization backed by emulator Firestore; payment/review endpoints (absent); all forged payment/review IDs, cross-farm review visibility, and owner-versus-manager rules for new resources.
- **Root cause of remaining gap:** payment/review persistence and API do not exist; live credentials and real Firebase integration are prohibited in this run.
- **Evidence:** `backend/target/surefire-reports/TEST-com.agroai.service.FieldAssignmentServiceTest.xml`, `TEST-com.agroai.controller.FieldAssignmentControllerIntegrationTest.xml`, `TEST-com.agroai.security.ContextualSecurityTest.xml`, `TEST-com.agroai.security.FirebaseAuthenticationIntegrationTest.xml`, and `TEST-com.agroai.config.FirebaseAssignmentEmulatorLiveTest.xml`.
- **Remaining limitation:** backend assignment authorization has local test coverage, not real Firebase Auth / production IAM proof. Payment and review authorization remain BLOCKED and NOT TESTED.
