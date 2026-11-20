# M5 Failure Recovery and Concurrency Report

**Finding:** M5-CONC-01  
**Severity:** HIGH  
**Status:** PARTIAL  
**Date:** 2026-11-19

## Assignment and lifecycle invariants

Existing service evidence includes `FieldAssignmentServiceTest` (13 tests) and an isolated Firestore Emulator class (2 test methods). Coordinated latches create concurrent starts; invariants are checked from final stored state. The emulator suite covers same-pair uniqueness, different farmers on the same field, same farmer across fields, repeat release, transaction rollback/retry, bounded lifecycle pagination and interrupted lifecycle resume.

This continuation added tests in `backend/src/test/java/com/agroai/config/FirebaseAssignmentEmulatorLiveTest.java` for:

- Release racing with reassignment on the same tenure. The old tenure must end, no more than one replacement tenure may be active, and history remains linked to the specific IDs.
- Assignment creation racing with the Firestore field-archive status gate. Creation either fails after seeing ARCHIVED or succeeds before the gate and is subsequently released by the lifecycle operation; final state has no active assignment.
- Two independent lifecycle workers releasing the same 12 synthetic assignments. Final state has 12 released records, zero active records, and exactly one RELEASED event each.
- Duplicate release call after completion, verifying that client retry does not add duplicate history. Concurrent release helper permits one `DatabaseUnavailableException` retry and reports the observed retry count.

## Execution and observed outcomes

Exact command (PowerShell, from repository root):

```powershell
$env:JAVA_HOME='C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
& "$env:APPDATA\npm\firebase.cmd" emulators:exec --only firestore --project demo-agroai-assignment "cd backend && mvnw.cmd -o -Plive-firebase -Dtest=FirebaseAssignmentEmulatorLiveTest test"
```

The final post-edit execution passed 2/2 tests, 0 failures/errors/skips; emulator output confirmed project `demo-agroai-assignment`. It measured two concurrent releases with `retries=0`. This final run included all added race and idempotent-history assertions. The separate full Maven default suite passed 219/219 and excludes this emulator class.

An earlier execution of the expanded test encountered Firestore Emulator `ABORTED: Transaction lock timeout` while two release transactions contended on one active-pair lock; the affected service surfaced `DatabaseUnavailableException`. The test was changed to exercise a single idempotent caller retry and assert no duplicate release event. The successful follow-up run did not need this retry (`retries=0`), so recovery from that specific transient failure was not observed in the successful run. Exact intermediate stack trace is retained in `backend/target/surefire-reports/TEST-com.agroai.config.FirebaseAssignmentEmulatorLiveTest.xml` until the final rerun overwrites it; the failure is documented here rather than counted as a final test failure.

## Limits and remaining tests

- This tests local Firestore Emulator transaction behavior only; no production concurrency or live Firestore guarantee is inferred.
- Create-vs-archive coverage coordinates the actual field document status transaction with assignment creation, then runs the existing lifecycle release operation. It is not a live `FieldService` request or real Firebase Auth request.
- A repeated release call is tested for idempotent history; no injected network timeout after a committed response, client retry exhaustion, or assignment-create idempotency-key contract was tested.
- Two reassignment races, conflicting managers, release/reassign retries, transient network partitions, and production concurrency remain NOT TESTED.
- Payment duplicate submission and concurrent update are BLOCKED because owner decisions on record multiplicity and edit rules are missing. Concurrent review creation is BLOCKED because review resource/content decisions and implementation are missing.
- Lifecycle worker overlap passed in the emulator but does not prove worker leases/coordination under production load. There is no distributed lease preventing multiple workers from beginning the same operation.

## Evidence

Code/test: `backend/src/test/java/com/agroai/config/FirebaseAssignmentEmulatorLiveTest.java`; source: `backend/src/main/java/com/agroai/service/FieldAssignmentService.java`, `AssignmentLifecycleService.java`, `FirestoreFieldAssignmentRepository.java`; results: `backend/target/surefire-reports/TEST-com.agroai.config.FirebaseAssignmentEmulatorLiveTest.xml`. Assignment transaction source and emulator isolation details are in `M5_FIRESTORE_EMULATOR_ISOLATION_REPORT.md`.
