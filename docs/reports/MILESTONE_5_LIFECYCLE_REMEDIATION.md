# Milestone 5 Lifecycle Remediation

**Status: Implemented with bounded recovery and history. Core service tests pass; lifecycle race/failure injection remains unverified.**

## Policy

- Only ACTIVE farms and fields allow farmer operational access.
- Suspending or archiving a farm, or changing a field away from ACTIVE / archiving it, first commits the status gate and projection/count changes, then releases active assignments in bounded pages of 100. Every release uses the standard transaction and appends immutable RELEASED history.
- The operation records PROCESSING/COMPLETED state and last processed assignment ID in `assignment_lifecycle_operations`. Retrying the same lifecycle request resumes from the cursor. A failed batch leaves the resource inaccessible while cleanup can be retried; already released assignments are safe to skip.
- Reactivation does not revive released tenures. It is denied while a cleanup operation is processing and starts a new lifecycle cycle once completed. Archived farms/fields remain non-reactivatable under existing transition policy.
- Field transitions maintain `activeFieldCount` and public projection in the field/farm transaction. Farm suspend/archive removes public projection; farm reactivation reconciles it.

The lifecycle status gate and individual assignment release are separate transactions because Firestore transactions cannot safely contain unbounded assignment writes. An assignment creation racing a status change reads the same farm/field documents: if the status transition commits first, creation fails its ACTIVE-state check; if creation commits first, the resumable scan includes that tenure. This expected serialization follows Firestore transaction semantics but was not directly race-tested.

## Verification and limits

`FarmServiceTest` covers suspend/reactivate status and projection; `FieldServiceTest` covers deactivation/reactivation active-field count; full backend suite passed 202/202. The local Firestore emulator integration test verifies tenure release/history mechanics and concurrent pair creation (1/1). Lifecycle processing across multiple batches, injected partial failure/resume, concurrent assignment-vs-suspend, concurrent release-vs-archive, and status-triggered history in the emulator were **NOT TESTED**. No field deletion API exists in this scope; archival is the supported soft-delete policy. Farm/field records and assignment history are retained.
