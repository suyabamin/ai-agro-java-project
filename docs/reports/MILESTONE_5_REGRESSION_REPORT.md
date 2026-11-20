# Milestone 5 Remediation Regression Report

## Results

| Area | Command | Result |
|---|---|---|
| Java backend | `\.\mvnw.cmd test -q` from `backend` | Exit 0; 202/202 passed, no failures/errors/skips |
| Frontend | `npm.cmd test -- --run` from `frontend` | Exit 0; 60/60 across 7 files |
| Firestore Rules | Local emulator `test:rules` command in `MILESTONE_5_TEST_REPORT.md` | Exit 0; 25/25 |
| Assignment persistence/concurrency | Local Firestore emulator + `FirebaseAssignmentEmulatorLiveTest` | Exit 0; 1/1 |
| Python AI service | `\.venv\Scripts\python.exe -m pytest -q` from `ai-service` | Exit 0; 5/5 |
| Frontend build | `npm.cmd run build` from `frontend` | Previously passed; large-chunk warning (>1 MB minified) |

Distinct standard inventory is 292 (202 Java + 60 frontend + 25 Rules + 5 Python). The separate 1-case assignment emulator run is excluded from standard inventory. Focused reruns overlap and are not counted again. See `MILESTONE_5_TEST_REPORT.md` for source reconciliation and excluded live suites.

## Regressions and limits

The first assignment emulator run failed because its concurrency phase attempted assignment while its earlier tenure was still active. The test was corrected to release that tenure first; the second local emulator run passed. No test assertions were weakened.

Not tested: browser E2E/manual workflow, realistic performance/large dataset, cursor changes between page requests, lifecycle batch interruption/recovery, lifecycle and membership revocation races, Firebase Auth state change at commit, or production persistence/index configuration. No Firebase Rules deployment or production Firestore write occurred.

No Git staging/commit/push/reset/rebase/clean, `MEMORY.md` modification, or Milestone 6 work occurred.
