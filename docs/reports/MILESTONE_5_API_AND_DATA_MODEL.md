# Milestone 5 API and Data Model

## Firestore collections

### `field_assignments/{assignmentId}`

New `assignmentId` values use `asgn_tenure_<uuid>` and represent immutable tenures. Stored fields include farm/field IDs, farmer UID and safe UID, assignment actor UID, optional source application/job IDs, status, permission list, timestamps, release metadata and version. Farmer email is not stored by the current repository mapping. The separate `active_field_assignment_locks/{pairId}` document transactionally maps each farmer-field pair to its current active tenure; it is server-write-only in Rules. Lockless legacy deterministic assignment documents remain supported during migration.

### `assignment_history/{historyId}`

History IDs use `asgn_hist_${UUID}`. Events record assignment ID, farm, field, farmer, event type, actor UID/role, reason, optional source application and timestamp. Client reads are scoped by farmer or active farm membership; all client writes are denied.

## API endpoints

All endpoints use `/api/v1`, Firebase ID-token authentication except otherwise noted, and JSON `ApiResponse` envelopes.

| Method and path | Authorization | Request / response | Behavior and errors |
|---|---|---|---|
| `POST /farms/{farmId}/fields/{fieldId}/assignments` | Active OWNER/MANAGER; revocation check | `CreateAssignmentRequest`; `FieldAssignmentResponseDTO` | Explicit assignment. Validates active profile, farm/field ownership and optional approved application. Returns 201; 400 invalid state/input, 403 unauthorized, 404 resource missing, 409 duplicate, 503 persistence failure. Firestore creation and assignment event use one transaction. |
| `GET /farms/{farmId}/fields/{fieldId}/assignments?cursor=&size=` | Active farm member | Cursor page response | Returns bounded, document-ID ordered tenure pages. |
| `GET /farms/{farmId}/assignments?cursor=&size=` | Active farm member | Cursor page response | Farm-scoped bounded, document-ID ordered pages. |
| `POST /farms/{farmId}/fields/{fieldId}/assignments/{assignmentId}/release` | Active OWNER/MANAGER; revocation check | Optional reason + expected version; assignment response | Releases active record; same-state repeat is idempotent. Live Firestore status and audit writes are transactional. |
| `POST /farms/{farmId}/fields/{fieldId}/assignments/{assignmentId}/reassign` | Active OWNER/MANAGER; revocation check | New farmer, reason, optional permissions/version/application | Releases outgoing and creates incoming record; live implementation uses one transaction. Same farmer-field pair with a prior released record is rejected. |
| `GET /farms/{farmId}/fields/{fieldId}/assignments/{assignmentId}/history?cursor=&size=` | Active farm member | Cursor page response | Reads bounded events for a verified assignment. |
| `GET /farmers/me/assignments?cursor=&size=` | Authenticated farmer | Cursor page response | Farmer active assignments; UID comes from verified principal, not request input. |
| `GET /farmers/me/assignments/history?cursor=&size=` | Authenticated farmer | Cursor page response | UID-scoped; historical view does not grant field access. |
| `GET /farmers/me/fields/{fieldId}` | Authenticated farmer with active assignment, active farm and active field | `FarmerFieldResponseDTO` | Returns operational field metadata only; excludes private `notes`, owner profile and other farmer details. Farm suspension/archive and non-ACTIVE field status deny assigned-farmer access. |

## Concurrency and validation

Create uses Firestore transaction read-before-write against the deterministic pair document; duplicate attempts converge on the same key. Release validates optional `expectedVersion`, increments version, and writes its audit event atomically in live mode. Reassignment validates the outgoing version and target pair and writes release, new assignment, and both history events in one transaction. Mock/in-memory tests do not prove live Firestore transaction behavior.

Farmer operational access requires a matching ACTIVE tenure, ACTIVE farm, ACTIVE field and ACTIVE private account status in backend authorization and Firestore Rules. Farm suspension/archive and field deactivation/archive trigger bounded resumable assignment releases with immutable history events. Farm/field reactivation does not revive released tenures. Assignment pages default to 25 and cap at 100; see the pagination, lifecycle and repeat-assignment reports for consistency and recovery limits.

## API example

```http
POST /api/v1/farms/farm-.../fields/farm-...--plot-01/assignments
Authorization: Bearer <Firebase ID token>
Content-Type: application/json

{"farmerUid":"<eligible-user-uid>","permissions":["READ","WRITE_LOGS"]}
```

The API does not accept actor UID, assignment status, timestamps, safe UID, or release actor metadata from the request.
