# Milestone 5 Membership and Account Revocation Report

**Status: Firestore authorization is transaction-revalidated; Firebase Auth revocation remains request-time and externally non-atomic.**

Create, release and reassignment transactions re-read the actor's private user profile, canonical active farm membership/role, farmer profile, farm, field, assignment/active-pair lock, and linked application state before writing. Inactive or missing actor/farmer profiles fail closed. The same transaction-time checks are used by lifecycle-triggered assignment release. Farmer field access checks the active assignment tenure plus active farm/field and ACTIVE private account status. `FirebaseAuthenticationFilter` rejects account statuses other than ACTIVE; operational farmer reads request online token revocation validation.

Firestore `users/{uid}.accountStatus` is the transactional account-state source of truth. Firebase Auth disabled/revoked state is a separate service and cannot be read atomically inside a Firestore transaction. Protected mutations and operational field reads therefore perform online revocation validation at request entry, while transaction checks serialize Firestore profile/membership/resource state with writes. A Firebase Auth change occurring after token verification but before a Firestore commit is not transactionally excluded; this residual cross-service race is explicit.

**Verification:** full backend suite 202/202 passed, including membership/profile authorization regressions; Rules emulator 25/25 passed. Dedicated assignment emulator test passed 1/1 for transaction uniqueness/concurrent pair creation. Dedicated simultaneous membership-revocation-vs-create/release, Auth disable-vs-commit, stale-token, and UID-spoof concurrent race tests were **NOT TESTED**. Existing targeted revocation and principal-derived UID tests remain part of the backend suite.

Rules deny client writes to assignments/history/active-pair locks; Admin SDK writes bypass Rules and rely on backend checks. Rules were tested locally and not deployed.
