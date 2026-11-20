# Milestone 5 Repeat Assignment Report

**Status: IMPLEMENTED; unit tests and local Firestore emulator transaction/concurrency test pass.**

Each tenure receives an immutable `asgn_tenure_<uuid>` document ID. A deterministic `active_field_assignment_locks` document per farm/field/farmer pair holds the active tenure ID. Creation reads the lock and writes the tenure, lock and history in the same Firestore transaction; release reads and removes only the lock that points to the released tenure and appends a history event. Reassignment releases the prior tenure and installs the new pair lock transactionally. A pre-migration deterministic assignment document remains a fallback when no lock exists.

This prevents two successful active tenures for one pair under Firestore transaction retry/conflict semantics; random IDs alone are not the uniqueness control. If a process fails before transaction commit, none of tenure/lock/history writes commit. If it fails after commit, the persisted lock and immutable records are authoritative. Lock cleanup is conditional on tenure ID, so a stale release cannot delete a newer lock.

**Evidence:** full backend suite 202/202 passed; dedicated local Firestore Emulator test `FirebaseAssignmentEmulatorLiveTest` passed 1/1, verifying repeated tenures, preserved release reason, persisted history and concurrent pair creation. Firestore Rules emulator passed 25/25 with lock-based farmer access and direct-write denial.

No production migration or writes were performed. Legacy lockless active records remain readable through the fallback. Dedicated forced mid-transaction failure injection and retry-count instrumentation were **NOT TESTED**. Assignment/history lookup is paginated by document ID; chronological order is not promised across pages where IDs are random. Per-tenure history ordering remains by document ID for API pagination.
