# Milestone 5 Requirements and Gap Analysis

**Updated:** 2026-11-17 after source inspection

| Requirement | Existing implementation/evidence | Gap or resolution |
|---|---|---|
| Many-to-many farmer/field relationships | `FieldAssignmentService`, deterministic pair IDs, active lists by farmer/field/farm | Works for distinct farmer-field pairs; same-pair repeated tenure not supported without new identity scheme |
| Explicit assignment; approval does not auto-assign | Creation endpoint is explicit; application service has no assignment side effect | Covered by existing application workflow and assignment unit/API tests; add stronger regression assertion if absent |
| OWNER/MANAGER mutate, OBSERVER read only | `@PreAuthorize` plus service membership checks | Keep as canonical authorization model |
| Active farm, field-to-farm and field lifecycle validation | Service checks farm/field ownership and archival at creation | Farm `SUSPENDED` policy and archive with active assignments need hardening |
| Eligible farmer | Profile existence and ACTIVE account now required | Profile read is outside assignment transaction; user status can race with assignment |
| Approved application linkage | Farm, applicant, status and optional job ID validation now checked | Withdrawal/invalidation semantics require explicit policy; source job should be copied from application when omitted |
| Release and audit | Release updates record, then writes audit; repeated release is idempotent | Must be one Firestore transaction; enforce expected version on repeated requests consistently |
| Reassignment | Existing service releases old then invokes create | Not atomic; failure can leave partial workflow. Same-pair rehire currently rejected to preserve prior tenure |
| Farmer field privacy | Sanitized DTO omits notes; assignment email removed | Need verify other farm metadata is not returned; current response includes operational soil/crop information only |
| Farmer dashboard | `FarmerWorkspacePage`; `DashboardPage` renders it by perspective | UI lists IDs, not farm/field names; avoid claiming future telemetry features are available |
| Firestore rules | Direct assignment/history writes denied; active assignment check exists | Emulator coverage and execution need verification; rule read policy currently permits farmer reading own released record for history |
| Pagination/performance | Repository query methods exist | Assignment/history queries are unbounded; no performance benchmark or pagination |
| Audit immutability | Client writes denied, server generates metadata | Admin write paths are not technically immutable; transaction and tamper tests needed |

## Changed during continuation

- Added `FarmerFieldResponseDTO` to prevent private field notes and owner-facing metadata from crossing the farmer API boundary.
- Removed farmer email from assignment response and Firestore mapping.
- Added active profile/account validation and application-to-farmer/job consistency checks.
- Changed released-pair behavior from silent reactivation to a rejected state transition.

These changes preserve the previous API architecture and Firestore rules deployment boundary.
