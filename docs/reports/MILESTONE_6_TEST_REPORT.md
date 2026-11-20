# Milestone 6 Test Report — Fresh Local Verification

Run date: 2026-11-18. Counts below reflect distinct clean current runs. This report does not claim live Firebase, real production storage, or real inference.

| Category | Exact command | Discovered | Executed | Passed | Failed | Skipped | Aborted | Result |
|---|---|---:|---:|---:|---:|---:|---:|---|
| Frontend Vitest | `npm test -- --reporter=verbose` (frontend) | 70 | 70 | 70 | 0 | 0 | 0 | PASS |
| Frontend production build | `npm run build` (frontend) | — | — | — | — | — | — | PASS; TypeScript + Vite; 142 modules; 1,026.52 kB JS and existing >500 kB warning |
| Python pytest | `.venv/Scripts/python -m pytest -q --basetemp=.pytest-temp-20261118-final` (ai-service) | 17 | 17 | 17 | 0 | 0 | 0 | PASS; 1 third-party deprecation warning |
| Mock-auth browser UI E2E | `npx playwright test --config=playwright.config.ts --workers=1` (frontend) | 3 | 3 | 3 | 0 | 0 | 0 | PASS; desktop, 390×844, 430×932 |
| Production-preview auth guard E2E | `npx vite build --config vite.production-test.config.ts`; then `npx playwright test --config=playwright.production.config.ts` (frontend) | 1 | 1 | 1 | 0 | 0 | 0 | PASS; no Firebase env; mock user/token seeded in browser storage |
| Java backend Maven | `$env:JAVA_HOME='C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot'; $env:Path="$env:JAVA_HOME\bin;$env:Path"; .\mvnw.cmd -o test` (backend) | 216 | 216 | 216 | 0 | 0 | 0 | PASS; includes explicit missing-storage-provider test; offline dependencies available |
| Firestore Rules emulator | `$env:JAVA_HOME='C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot'; $env:Path="$env:JAVA_HOME\bin;$env:Path"; npx firebase emulators:exec --only firestore --project demo-agroai "npx vitest run src/rules/firestore.rules.test.ts"` (frontend) | 26 | 26 | 26 | 0 | 0 | 0 | PASS; emulator explicitly identifies `demo-agroai` |
| Live Firebase Auth test | `npm run test:live` (frontend) | 1 | 0 | 0 | 0 | 1 | 0 | NOT TESTED; safely skipped by default |
| Frontend lint | `npm run lint` (frontend) | — | — | — | — | — | — | PASS exit; existing warnings remain |

Lint note: the final `npm run lint` was run concurrently with a build and returned exit 0, but Oxlint also traversed generated `dist-production-test` JavaScript and emitted many generated-code warnings. A focused source lint after the build, `npx oxlint src e2e playwright.config.ts playwright.production.config.ts vite.config.ts vite.e2e.config.ts vite.production-test.config.ts`, exited 0 with existing source warnings. This project lint scope should exclude generated output for a clean, reproducible lint report.

**Distinct executed test total:** 333 = frontend 70 + Python 17 + mock UI E2E 3 + production-preview E2E 1 + Maven 216 + Rules 26. **333 passed, 0 failed, 0 skipped, 0 aborted** among these executed suites. The default-skipped live suite is separate and excluded. Build, lint and benchmark are not test counts. No per-milestone M1–5 count is inferred from these combined suites.

## Failed/invalid attempts, separately accounted

- Initial Python `pytest -q` attempted 17 cases: 11 passed and 6 errored during `tmp_path` setup because Windows denied scanning `C:\Users\HP\AppData\Local\Temp\pytest-of-HP`. The retry used `--basetemp` inside the service workspace and passed all 17; retry cases are not added to the aggregate.
- Initial direct Rules Vitest command had 26 skipped tests and the suite setup failed with `ECONNREFUSED 127.0.0.1:8085`; no emulator was running. The later `emulators:exec --project demo-agroai` run genuinely executed all 26 and passed.
- Initial Maven command `.\mvnw.cmd -o test` without a session `JAVA_HOME` exited before tests: “JAVA_HOME not found in your environment.” An interim run then passed 215 tests; the final run after adding `CropImageServiceStorageUnavailableTest` passed 216/216.
- An initial parallel Playwright run combined distinct configs sharing `test-results`; one case nominally passed and five failed (including missing artifact files) while the production test ran against the development server. The run is invalid/aborted evidence and excluded. The configs were separated and rerun serially: development suite 3/3 and production-preview 1/1.

## Emulator isolation evidence

`firebase emulators:exec --only firestore --project demo-agroai ...` printed that `demo-agroai` is a demo project and non-emulated services fail closed. `firebase.json` binds Firestore to `127.0.0.1:8085`; the Rules test source explicitly passes the same `projectId: 'demo-agroai'`. `.firebaserc` still defaults to `agroai-dev`, but the exact CLI project flag overrides that default. No live Firebase account was accessed, and Rules were not deployed.

## Evidence paths and limits

- Browser specs: `frontend/e2e/monitoring.spec.ts`, `frontend/e2e/production-auth.spec.ts`.
- Browser config: `frontend/playwright.config.ts`, `frontend/playwright.production.config.ts`.
- Emulator log: root `firestore-debug.log` (emulator execution is also reflected in the terminal output for this run).
- Local benchmark measurements: `docs/reports/MASTER_PERFORMANCE_REPORT.md`.
- Live Firebase Auth, real token verification, Firebase Admin persistence, authenticated full-stack flow, production storage, real model inference/evaluation and deployment: **NOT TESTED**.
