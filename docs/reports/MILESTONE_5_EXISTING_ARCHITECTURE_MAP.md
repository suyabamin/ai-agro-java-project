# Milestone 5 Existing Architecture Map

**Audit date:** 2026-11-17

## Request and data flow

1. React routes authenticated users through `ProtectedRoute` and `DashboardLayout`; `DashboardPage` selects the farmer workspace when the user's contextual perspective is `farmer`.
2. `assignmentService.ts` calls the Spring API through the centralized authenticated `apiClient.ts`.
3. `FirebaseAuthenticationFilter` verifies Firebase ID tokens. Manager controllers use `@PreAuthorize` farm evaluators; consequential manager mutations also use `@RequiresRevocationCheck`.
4. `FieldAssignmentService` verifies membership/role and farm/field/application state, then delegates persistence to assignment repositories.
5. Firebase Admin SDK writes Firestore collections; direct client writes are denied by `firestore.rules`.
6. Farmer field reads are checked by `FieldSecurityEvaluator` and the workspace controller; farmer response data is now mapped through `FarmerFieldResponseDTO`.

## Assignment storage as implemented

- `field_assignments/{asgn_fld_<fieldDocumentId>::<safeUid>}` is the current deterministic assignment record.
- `assignment_history/{asgn_hist_<UUID>}` stores append-only assignment/release event documents.
- The deterministic document identifier is also used as the uniqueness key. It prevents concurrent duplicate active assignments because creation reads and writes the same document in a Firestore transaction.
- This key design does not support multiple stable assignment tenures for the same farmer and field. Current continuation code rejects reactivation after release to protect the previous tenure. A future generation-aware record plus deterministic active-pair lock would be needed to support recurring assignments cleanly.

## Authorization boundaries

- `OWNER` and `MANAGER`: create/release/reassign; `OBSERVER`: read-only.
- Farmer assignment queries are scoped by `farmerSafeUid` derived server-side from the authenticated UID.
- Farmer field details require active assignment; archived fields are hidden.
- Firestore rules deny client writes to assignment and audit collections and check active assignment status for field reads.
- Farm private profile data, private notes, and farmer email must not be exposed through farmer workspace or assignment-list APIs. Assignment APIs now omit email; farmer field DTO omits notes.

## Integration caveats

- Application approval does not call `FieldAssignmentService`; assignment remains an explicit operation.
- Application-linked assignment validates farm, selected applicant, APPROVED status, and any supplied job ID.
- The current UI accepts farmer UID and optional application ID instead of providing an eligible-farmer picker; this is a usability and completeness gap.
- Release persistence and audit history are separate writes outside the creation transaction path; reassignment consists of multiple operations and is not fully atomic. This is a high-priority reliability gap.
- Farm suspension/archival and field archival need a consistent policy for active assignments.
- Live Firestore repositories issue unbounded list queries; pagination is not implemented.

## Architecture decision

Retain the existing Spring Boot + Firestore + React architecture. Do not change established `KeyEncoder` encodings in this milestone without a separately reviewed migration plan.
