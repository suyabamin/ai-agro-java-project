# Milestone 5 Implementation Report

**Date:** 2026-11-17

## Scope delivered

The workspace already contained the assignment domain, Firestore repositories, manager APIs, farmer APIs, frontend components, Firestore rules and tests. This continuation audited and corrected gaps in that implementation rather than replacing the architecture.

- Added active user-profile/account validation for assignment targets.
- Validated that a linked application belongs to the selected farmer and farm, is APPROVED, and matches a supplied job ID; live create/reassign transactions re-read application state.
- Prevented silent reactivation of a released deterministic farmer-field assignment.
- Made live Firestore release and audit writes transactional.
- Made live reassignment write outgoing release, new assignment, and audit entries in one transaction; rejects an existing target pair.
- Made release reason optional as specified.
- Added `FarmerFieldResponseDTO`, excluding private field notes and owner-only fields.
- Removed farmer email from assignment responses and repository writes.
- Updated farmer-facing copy/navigation so it does not claim crop analysis or telemetry is available in Milestone 5.
- Added service/API regression assertions for missing farmer profile, release without a reason, stable reassignment history, email omission, and private field note omission.

## Phase summary

| Phase | Status | Evidence / remaining work |
|---|---|---|
| 5A Domain and persistence | Implemented with limitation | Existing domain/repositories and fail-closed tests. Deterministic pair ID does not support another tenure for the same pair; silent reactivation is now rejected. |
| 5B Management workflows | Implemented; verification incomplete | Manager API, create/release/reassign, role checks and audit. Mock tests cover the memory path; no live Firestore transaction test. |
| 5C Farmer workspace | Implemented; usability gaps remain | Farmer endpoints/page and active-assignment access; field detail sanitized. Lists show IDs rather than farm/field names; no component or browser E2E suite. |
| 5D Security/hardening | Partial | 22 rules emulator tests pass; full local unit/build regressions pass. No production checks, scale tests, concurrency emulator tests or fully bounded list queries. |

## Boundaries

No Milestone 6 feature, live Firestore data mutation, Firebase Rules deployment, app deployment, Git stage, commit or push was performed. Existing Milestones 1–4 source was preserved.
