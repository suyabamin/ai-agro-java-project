# Milestone 5 Remediation Security Audit

**Date:** 2026-11-18  
**Reviewer:** implementation agent; no separate reviewer participated. Not an independent review.

## Verified controls

- Assignment mutations derive actor UID from verified authentication and transactionally revalidate active manager/owner membership, Firestore account profile, farmer profile, farm/field status, assignment/active pair lock and linked application state.
- Generation-safe tenure IDs and active-pair locks are written/released transactionally. Local Firestore Emulator test passed 1/1 including concurrent duplicate requests, lifecycle release, history and subsequent pair reuse.
- Farmer field access requires active assignment, ACTIVE account profile, ACTIVE farm and matching ACTIVE field in backend and Rules.
- Lifecycle status gates precede bounded, resumable assignment release/history. Field counts and projections are updated with status changes.
- Assignment pages use bounded cursors; compatibility Firestore collection reads cap at 100.
- Rules emulator passed 25/25; backend 202/202; frontend 60/60.

## Residual findings

| Severity | Finding | State |
|---|---|---|
| Medium | Firebase Auth disable/revocation cannot be read atomically in Firestore transactions; request-time validation leaves a cross-service timing window. | Documented residual |
| Medium | Lifecycle multi-batch interruption/resume and lifecycle-vs-assignment races lack direct emulator tests. | Not tested |
| Medium | Large dataset/cursor churn and performance are not verified. | Not tested |
| Medium | Manager membership and Firebase Auth disable concurrent revocation races lack dedicated tests. | Not tested |
| Medium | Browser journeys and cache invalidation lack E2E evidence. | Not tested |
| Low | Frontend build emits >1 MB minified bundle warning. | Open |

No production Firebase access, Rules deployment, or independent review occurred. These gaps keep Milestone 5 **NOT READY**.
