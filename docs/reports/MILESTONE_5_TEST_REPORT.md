# Milestone 5 Remediation Test Report

**Date:** 2026-11-18. Counts below derive from current test source and latest local execution artifacts.

## Reconciled inventory

| Subsystem | Physical source cases | Standard CI cases | Latest execution |
|---|---:|---:|---|
| Java | 213 (202 standard, 4 Admin SDK live, 6 Firebase E2E, 1 assignment Emulator) | 202 | Full Maven suite: 202 passed, 0 failed/errors/skipped |
| Frontend unit | 60 | 60 | Vitest: 60 passed across 7 files |
| Firestore Rules | 25 | 25 | Local Firestore Emulator: 25 passed |
| Python | 5 | 5 | Pytest: 5 passed |
| Frontend live-auth | 7 | excluded | Not run |
| **Total** | **310** | **292** | **292 standard cases passed** |

The Java total is verified from source annotations: 202 standard + 4 Admin SDK live + 6 E2E + 1 assignment emulator. Surefire XML from the full suite reports 202 cases, 0 failures/errors/skips. Targeted runs are not added to pass totals. The assignment emulator test was separately executed and passed 1/1; it is already included in the physical count and is excluded from standard CI. The current live-auth file contains 7 `it()` cases; matches on `it(` inside `split(` expectations are not test cases. Baseline reported for M4 is 242 standard tests; current 292 is +50.

## Commands and outcomes

| Exact command | Working directory | Result |
|---|---|---|
| `.\mvnw.cmd test -q` | `backend` | Exit 0; 202/202 passed |
| `.\mvnw.cmd '-Dtest=FieldAssignmentServiceTest,FieldAssignmentControllerIntegrationTest,FarmerWorkspaceControllerIntegrationTest,FirestoreFieldAssignmentRepositoryFailClosedTest,ContextualSecurityTest,CursorPaginationTest,FarmServiceTest,FieldServiceTest' test -q` | `backend` | Exit 0; focused coverage passed; overlaps full suite and not added to inventory |
| `.\mvnw.cmd '-Dtest=FarmServiceTest,FieldServiceTest' test -q` | `backend` | Exit 0; lifecycle focus passed; overlaps full suite |
| `firebase.cmd --config ..\firebase.json emulators:exec --project agroai-rules-test --only firestore "npm.cmd run test:rules -- --reporter=dot"` | `frontend` | Exit 0; 25/25 |
| `firebase.cmd --config ..\firebase.json emulators:exec --project agroai-assignment-emulator --only firestore "cmd /c .\mvnw.cmd -Plive-firebase -Dtest=FirebaseAssignmentEmulatorLiveTest test -q"` | `backend` | Exit 0; 1/1 local emulator test |
| `npm.cmd test -- --run` | `frontend` | Exit 0; 60/60, 7 files |
| `npm.cmd run build` | `frontend` | Previously passed in this remediation; emits >1 MB minified chunk warning |
| `.\.venv\Scripts\python.exe -m pytest -q` | `ai-service` | Exit 0; 5/5, 3 environment/deprecation warnings |

The emulator tests use isolated local project IDs and do not access production Firestore. No Rules deploy was performed. First assignment-emulator attempt failed due the test racing an already active tenure; the fixture was corrected to release the tenure before concurrency testing, and the rerun passed.

## Explicitly not tested

Browser E2E/manual farmer-to-manager workflow, performance/large-dataset benchmark, cursor pagination under insert/release churn, lifecycle multi-batch partial-failure/resume and assignment-vs-lifecycle race, simultaneous membership/profile revocation races, Firebase Auth disable exactly at commit, production Firestore/index behavior, and production persistence. The 4 Admin SDK tests and 6 live E2E tests were not run; the 7 live-auth tests remain excluded. No live credential/account mutations were attempted.

The local test evidence does not establish production deployment or live persistence. The project owner retains acceptance authority.
