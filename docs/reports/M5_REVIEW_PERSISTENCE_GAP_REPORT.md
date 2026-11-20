# M5 Review Persistence and Security Gap Audit

Date: 2026-11-19. Scope: review create/read code present at start of the review persistence continuation. This is a technical audit, not owner acceptance.

## Findings before remediation

1. **Firestore path exists but was unverified.** `AssignmentReviewRepository` uses `assignment_reviews/{assignmentId}` and a transaction read-before-create. The earlier 6-test suite mocked this repository and set Firebase uninitialized, so it tested memory behavior only. No emulator proof existed.
2. **Create authorization uses persisted objects in production.** The service reads assignment tenure, farm membership, and farm status inside the same Firestore transaction; it requires exact `OWNER` + `ACTIVE`, and permits only terminal assignment statuses. Firestore Admin SDK bypasses client Rules, so this check is essential.
3. **Read authorization had a consistency gap.** Assignment, membership and review were read separately. Membership revocation or tenure changes could race the authorization/read sequence. It also granted access if the authenticated user had no private profile, because the existing authentication filter rejects a non-active profile only when a profile exists.
4. **Participant semantics.** The farmer UID comes from the persisted assignment document, never the request. Owner status comes from persisted farm membership. Unrelated UIDs are rejected. Account deletion semantics were not explicit; fail-closed active-profile enforcement is required for reads/writes.
5. **Archived farm behavior.** Creation already rejects non-ACTIVE farms; this is a conservative fail-closed implementation pending explicit owner direction. Reads should not expose a review for an inactive farm unless the policy is clarified; deny is the conservative choice.
6. **Uniqueness.** The deterministic review ID and transaction `create` prevent replacement; emulator contention/race behavior was not yet exercised. Memory-mode uniqueness was covered only by unit tests.
7. **Data-access boundary.** HTTP routes are authenticated by Spring Security, and the service performs resource authorization. Firestore client Rules default-deny unknown collections, but they cannot protect Admin SDK reads. The service is therefore the required trusted access boundary; repository methods must remain internal implementation details and never be exposed directly.
8. **Edit policy.** The approved 24-hour window and server-side timing are recorded. One edit versus multiple edits, post-window moderation/correction and withdrawal are explicitly unresolved. No edit operation will be added until edit-count behavior is decided; create-only is safer than inventing an irreversible restriction or permission.

## Payment contract blockers

Owner-approved scope does not determine whether payer/receiver are registered-user references or names, who may be associated with a farm-level record, or how an immutable correction/reversal is represented. Status names/transitions and pre-finalization deletion are explicitly open. Those determine persisted fields, authorization and UI; no payment API/UI should assume them. Independent frontend and test work may continue without claiming a payment feature.

## Remediation plan

- Make review reads transactional and require active private profiles for both actor and exact participants.
- Add Firestore Emulator tests under a `demo-` project, asserting the running emulator project/host and exercising create/read, owner/farmer/unrelated authorization, validation/eligibility, and concurrent duplicate requests with synthetic data only.
- Add/retain HTTP unauthenticated rejection and Rules client-denial coverage; document which layers are directly exercised.
- Keep edits blocked pending the single-vs-multiple decision; preserve no public aggregates.
- Keep payment blocked on the policy questions above; then implement only an approved contract and add responsive owner/farmer UI once APIs exist.
- Run focused/full Maven, Firestore Rules emulator, frontend unit/build, and Playwright; distinguish mock UI from API/auth/emulator evidence.

Environment observed: Temurin JDK 21.0.13, Firebase CLI 15.24.0, configured Firestore emulator host `127.0.0.1:8085`. Test project must be `demo-agroai-review`, never the configured default `agroai-dev`. No credentials or live Firebase access used.
