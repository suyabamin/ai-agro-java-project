# Milestone 5 Test Strategy

## Suites and exact commands

| Suite | Command | Purpose |
|---|---|---|
| Java backend | from `backend`: `.\mvnw.cmd test -q` | Unit, repository, security and MockMvc regression tests |
| Frontend unit | from `frontend`: `npm.cmd test` | API services and frontend behavior; excludes emulator and live tests |
| Frontend build | from `frontend`: `npm.cmd run build` | TypeScript and production bundle compilation |
| Firestore rules | from `frontend`: `npm.cmd run test:rules`, with local emulator on port 8085 | Rules access-control behavior |
| AI service regression | from `ai-service`: `.\.venv\Scripts\python.exe -m pytest` | Existing non-Milestone-5 service regression only |

The AI service is regression coverage only; no Milestone 6 work is in scope. Live Firebase tests remain separate and must not be inferred from emulator or mock tests.

## Required assignment assertions

- Active duplicate prevention, multiple farmers per field, one farmer across fields.
- Released assignment cannot grant field access or silently reactivate.
- Release/reassign writes and history are atomic and version-aware.
- Source application is APPROVED and matches farm, job, and selected farmer.
- Missing/suspended user profiles, archived/suspended farms, archived fields, observers, and cross-farm attempts fail closed.
- Request-supplied actor, timestamps, status, or UID cannot override server metadata.
- Farmer history is UID-scoped; field response excludes private notes and other farmers' information.
- Rules deny unauthenticated/cross-user reads and all client mutations; existing Milestone 1–4 rules remain valid.

## Test count reporting

Count source test methods separately from executed tests. Report pass/fail/error/skip/abort/exclusion and duration per command. Do not count live or skipped cases as passed. Use Surefire XML, Vitest output, and pytest output as evidence. Emulator tests are not considered executed if the emulator cannot start or connect.

## Performance

No benchmark or scale target is pre-established. Record test dataset, execution environment, duration, Firestore reads where observable, query bounds and pagination status. Current assignment list methods are unbounded and require follow-up before making scale claims.
