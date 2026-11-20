# M5 Regression Report

Date: 2026-11-19. These are current executions for this M5 continuation session. Counts are per executed test suite; historical results and intermediate attempts are not added to the final pass totals.

## Executed results

| Suite | Exact command | Executed | Passed | Failed | Errors | Skipped | Outcome / evidence |
|---|---|---:|---:|---:|---:|---:|---|
| Frontend unit | `npm test` (from `frontend`) | 76 | 76 | 0 | 0 | 0 | PASS; 10 test files (including `reviewService.test.ts` and `paymentService.test.ts`). Vitest output. |
| Frontend production build | `npm run build` (from `frontend`) | — | — | — | — | — | PASS; TypeScript strict (`tsc -b`) + Vite; 147 modules transformed; exit code 0. `frontend/dist/`. |
| Python | `.\.venv\Scripts\python.exe -m pytest -q --basetemp .pytest-temp-m5-master4` (from `ai-service`) | 17 | 17 | 0 | 0 | 0 | PASS; 1 warning (deprecation). Pytest output. |
| Backend Maven full default suite | `.\mvnw.cmd -o test` (from `backend`; with Temurin JDK 21) | 239 | 239 | 0 | 0 | 0 | PASS / BUILD SUCCESS. Includes `AssignmentReviewServiceTest` (10/10) and `PaymentServiceTest` (10/10). `backend/target/surefire-reports/`. |
| Firestore Rules emulator | `firebase emulators:exec --only firestore --project demo-agroai "npm --prefix frontend run test:rules"` | 26 | 26 | 0 | 0 | 0 | PASS; emulator explicitly used `demo-agroai` and shut down cleanly. |
| Assignment Firestore emulator | `firebase emulators:exec --only firestore --project demo-agroai-assignment "cd backend && mvnw.cmd -o -Plive-firebase -Dtest=FirebaseAssignmentEmulatorLiveTest test"` | 2 | 2 | 0 | 0 | 0 | PASS; isolated demo project, including M5 race/retry assertions and history pagination benchmarks (100, 1000, 5000 records). |
| Review & Payment Firestore emulator | `firebase emulators:exec --only firestore --project demo-agroai-review-payment "cd backend && mvnw.cmd -o -Plive-firebase -Dtest=FirebaseReviewAndPaymentEmulatorLiveTest test"` | 2 | 2 | 0 | 0 | 0 | PASS; isolated demo project `demo-agroai-review-payment`, atomic transaction create, duplicate race prevention, 24h review edit, payment ledger, reversals, authorization. |
| Combined Playwright UI E2E | `npm run test:e2e` (from `frontend`) | 9 | 9 | 0 | 0 | 0 | PASS; 6 M5 owner/farmer fixture workflows and 3 M6 monitoring workflows across desktop, 390×844, 430×932. |

Current executed test cases across these disjoint named suites: **371** (76 + 17 + 239 + 26 + 2 + 2 + 9). The frontend build is a compilation check, not an individual test case, and is listed separately.

## Exact execution commands

```powershell
# Frontend unit tests
cd d:\agro-ai-java-project\frontend
npm test

# Frontend production build
npm run build

# Playwright E2E tests
npm run test:e2e

# AI service Python suite
cd d:\agro-ai-java-project\ai-service
.\.venv\Scripts\python.exe -m pytest -q --basetemp .pytest-temp-m5-master4

# Backend full offline test suite
cd d:\agro-ai-java-project\backend
$env:JAVA_HOME='C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
.\mvnw.cmd -o test

# Root: Firestore Security Rules Emulator
cd d:\agro-ai-java-project
& "$env:APPDATA\npm\firebase.cmd" emulators:exec --only firestore --project demo-agroai "npm --prefix frontend run test:rules"

# Root: Assignment Firestore Emulator Live Test
& "$env:APPDATA\npm\firebase.cmd" emulators:exec --only firestore --project demo-agroai-assignment "cd backend && mvnw.cmd -o -Plive-firebase -Dtest=FirebaseAssignmentEmulatorLiveTest test"

# Root: Review & Payment Firestore Emulator Live Test
& "$env:APPDATA\npm\firebase.cmd" emulators:exec --only firestore --project demo-agroai-review-payment "cd backend && mvnw.cmd -o -Plive-firebase -Dtest=FirebaseReviewAndPaymentEmulatorLiveTest test"
```

## Not run / blocked / not tested

- **Live Cloud Firebase Auth / Firestore:** NOT TESTED; prohibited by safety rules. No credentials or live project access used.
- **External payment gateway integration:** NOT TESTED / NOT APPLICABLE; payments are manual internal records only.
- **Dedicated Playwright E2E for new review/payment modals:** NOT TESTED via Playwright (tested via Vitest unit tests, production build compilation, and manual DOM component structure; existing Playwright suite 9/9 covers pre-existing core flows).
- **Admin key relocation/rotation and OAuth session revocation:** Owner actions, NOT TESTED.

## Interpretation

All implemented M5 assignment, review, and payment features pass local unit, build, and Firestore emulator integration suites. Historical M5 owner acceptance remains **ACCEPTED**. Technical readiness remains **NOT READY** pending owner live Firebase authorization and credential management.
