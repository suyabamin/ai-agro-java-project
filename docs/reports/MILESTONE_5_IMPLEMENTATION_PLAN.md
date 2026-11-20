# Milestone 5 Implementation Plan and Phase Status

**Updated:** 2026-11-17. The repository already contains implementation across the four phases; this plan tracks verification and remediation rather than rebuilding those systems.

## Phase 5A — Domain and persistence foundation

Existing: `FieldAssignment`, `AssignmentStatus`, `AssignmentHistory`, repository interfaces and Firestore implementations, deterministic key generation, fail-closed configured-Firebase behavior.

Remaining: add persistent multi-tenure identity strategy if repeat assignments to the same farmer/field must be supported; validate repository mapping and transaction semantics against Firestore emulator or focused serialization tests.

## Phase 5B — Assignment management workflows

Existing: manager create/list/release/reassign endpoints, role checks, application link validation, assignment audit events, frontend assignment modal and overview.

Remaining: make release plus audit atomic; make reassignment atomic; enforce idempotency/OCC semantics; consider farmer selection UI and derive source job ID from a validated application.

## Phase 5C — Farmer workspace

Existing: active assignments/history endpoints and `FarmerWorkspacePage`, field access guarded by active assignment.

Completed in continuation: farmer index route already uses the page; sanitized field DTO excludes private notes; assignment API no longer returns farmer email.

Remaining: align workspace labels with implemented functions, enrich assignment cards with farm/field names where safe, add component tests and verify post-release cache invalidation.

## Phase 5D — Security, integration and hardening

Existing: Firestore rules deny client writes; rules tests include assignment rules; backend security and regression test suites.

Remaining: execute rules suite through local emulator; add cross-role, revoked, lifecycle, spoofed metadata, concurrency and repeated-tenure tests; document pagination/performance limitation; run complete regression and independent source audit.

## Acceptance gates

Each phase is recorded as implementation-present and verification-in-progress until its scoped tests and report are reconciled. No rules deployment, production data mutation, application deployment, or Git history change is authorized.
