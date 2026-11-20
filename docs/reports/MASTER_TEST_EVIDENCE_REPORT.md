# Master Test Evidence Report

Date: 2026-11-18. Only independently executed local evidence is listed. Detailed M6 run table and prelim-attempt accounting: `MILESTONE_6_TEST_REPORT.md`.

| Test suite | Exact command | Executed | Passed | Failed | Skipped | Status |
|---|---|---:|---:|---:|---:|---|
| Frontend Vitest | `npm test -- --reporter=verbose` in `frontend` | 70 | 70 | 0 | 0 | PASS |
| Python | `.venv/Scripts/python -m pytest -q --basetemp=.pytest-temp-20261118-final` in `ai-service` | 17 | 17 | 0 | 0 | PASS |
| Playwright dev UI | `npx playwright test --config=playwright.config.ts --workers=1` in `frontend` | 3 | 3 | 0 | 0 | PASS; mock UI only |
| Playwright production preview | `npx vite build --config vite.production-test.config.ts`; `npx playwright test --config=playwright.production.config.ts` | 1 | 1 | 0 | 0 | PASS; no Firebase env |
| Maven | With JDK 21 `JAVA_HOME` and PATH, `./mvnw.cmd -o test` in `backend` | 216 | 216 | 0 | 0 | PASS; includes missing-storage-provider case |
| Firestore Rules | `$env:JAVA_HOME='C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot'; $env:Path="$env:JAVA_HOME\bin;$env:Path"; npx firebase emulators:exec --only firestore --project demo-agroai "npx vitest run src/rules/firestore.rules.test.ts"` in `frontend` | 26 | 26 | 0 | 0 | PASS; isolated emulator |
| Firebase live test | `npm run test:live` in `frontend` | 0 | 0 | 0 | 1 | NOT TESTED; safe skip |

Distinct executed count: **333 passed, 0 failed, 0 skipped, 0 aborted**; live test's skipped case is excluded. Build/lint/benchmark are not test cases. No aggregate/per-milestone count from historical docs is reused. Failed Python setup, missing Java env, absent emulator, and parallel Playwright artifact-collision attempts are documented separately and excluded from the clean run total.

Frontend production build: PASS, 142 modules, 1,026.52 kB JS chunk warning. Frontend lint: exit 0, existing warnings. The rules emulator invocation explicitly used project `demo-agroai`; matching ID is hardcoded in Rules test setup. No live Firebase calls.
