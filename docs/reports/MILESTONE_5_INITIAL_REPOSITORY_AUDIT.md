# Milestone 5 Initial Repository Audit

**Audit date:** 2026-11-17  
**Scope:** Read-only baseline audit before Milestone 5 changes

## Executive summary

The repository already contains a substantial Milestone 5 implementation. The previous version of this audit incorrectly described assignments as absent and is superseded by this report. The user-provided master prompt explicitly authorizes Milestone 5 and establishes Milestones 1–4 as accepted; the older `MEMORY.md` and `TASKS.md` status fields were stale and did not reflect the checked-in workspace contents.

## Repository and reusable components

- Spring Boot backend: `backend/src/main/java/com/agroai/` with Firebase token verification, contextual farm/field authorization, revocation checks, Firestore repositories, and DTO validation.
- Existing farm/field lifecycle: `FarmService`, `FieldService`, `FarmRepository`, `FieldRepository`, and versioned domain entities.
- Existing marketplace: `JobApplicationService`, `JobApplicationRepository`, and application statuses; approval is separate from assignment creation.
- Assignment implementation already present: `FieldAssignment`, `AssignmentHistory`, `FirestoreFieldAssignmentRepository`, `FirestoreAssignmentHistoryRepository`, `FieldAssignmentService`, `FieldAssignmentController`, `FarmerWorkspaceController`, and `FieldSecurityEvaluator`.
- Frontend already has assignment services/types/components and a farmer workspace page. `DashboardPage` routes the farmer perspective to `FarmerWorkspacePage`.
- Rules are in root `firestore.rules`; emulator tests are in `frontend/src/rules/firestore.rules.test.ts`.

## Baseline test evidence collected

Commands and results from this audit/continuation session:

| Suite | Command | Result |
|---|---|---|
| Backend | `backend: .\mvnw.cmd test -q` | PASS, 193 tests, 0 failures/errors/skips; Java 21, Spring Boot dev profile |
| Frontend | `frontend: npm.cmd test` | PASS, 7 files / 60 tests |
| Frontend build | `frontend: npm.cmd run build` | PASS; Vite emitted a >500 kB chunk warning |
| AI service regression | `ai-service: .\.venv\Scripts\python.exe -m pytest` | PASS, 5 tests; pytest cache permission warnings only |
| Firestore Rules | Initial `npm.cmd run test:rules` | Could not connect because emulator was not running; rerun via local emulator is in progress / reported separately |

The baseline is distinct from live Firebase verification. No production Firestore data or rules were changed.

## Findings and risks

1. Assignment identity used the deterministic `{field,f​​armer}` key as both active uniqueness key and permanent assignment record. The prior code could reactivate a released document, contradicting the required immutable tenure history. The continuation change now rejects reactivation; a generation-safe identifier strategy remains an architectural follow-up.
2. Assignment creation trusted a supplied UID without requiring an initialized, active user profile. It now fails closed for missing or inactive profiles.
3. Application links were checked for farm and APPROVED status but not for selected applicant identity. Applicant matching is now enforced; supplied job ID is checked against the application.
4. Farmer field detail previously returned the owner-facing `FieldResponseDTO`, including internal `notes`. A dedicated sanitized `FarmerFieldResponseDTO` now omits notes and owner-only metadata.
5. Assignment responses/persistence exposed farmer email to farm members. Email was removed from assignment API and stored assignment model mapping.
6. Release and reassignment consistency, field/farm lifecycle interactions, pagination, and load/performance evidence require further review.

## Boundaries

No Milestone 6 work, production deployment, live data mutation, Git staging, or commit was performed. Existing architecture was retained.
