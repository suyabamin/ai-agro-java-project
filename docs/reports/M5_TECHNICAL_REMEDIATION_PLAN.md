# M5 Technical Remediation Plan

**Date:** 2026-11-18  
**Historical owner acceptance:** ACCEPTED  
**Technical closure at start:** NOT YET VERIFIED  
**Scope:** local M5 assignment lifecycle, bounded pagination, emulator isolation, Firebase credential safety and evidence. No live Firebase, credential use, production change, Git staging, or owner acceptance is authorized.

## Repository/baseline finding

`git rev-parse --show-toplevel` identifies this directory as the worktree, `.git` exists, and `git -C .. rev-parse --show-toplevel` fails (parent is not a worktree). `git status -sb` says “No commits yet on master”; `git ls-files` is empty and all project paths are untracked. There are Codex-managed refs under `.git/refs/codex`, but no normal baseline commit or index. This is an initialized but unborn Git repository, not a nested checkout. Git cannot provide a trustworthy diff against a committed project baseline. No repository metadata will be changed. Owner recommendation: make a verified, access-controlled copy of the full project (including `.git` and ignored files) before any future baseline/index setup; verify the copy before changing Git state. Do not delete, initialize, reset, or stage anything.

## Findings and work plan

| Severity | Finding / affected area | Root cause and reproduction | Planned correction | Acceptance evidence / current status |
|---|---|---|---|---|
| HIGH | Assignment lifecycle batch interruption/recovery; `AssignmentLifecycleService`, assignment repository/service, emulator tests | Existing implementation persists a resume cursor after each candidate and uses bounded pages of 100, but no forced partial-progress emulator test proves resume or multi-page completion. Inspect current source; seed >100 assignments and inject a failure after several releases. | Add emulator-only failure/resume and >100 record lifecycle tests; preserve status gate and history. Verify released records stay released and no active records remain after retry. | Exact emulator command on a `demo-` project; count, page count, released/history totals, and failure point recorded. Must distinguish emulator from live concurrency. OPEN. |
| HIGH | Emulator project isolation; `FirebaseAssignmentEmulatorLiveTest` | Test hardcodes `agroai-assignment-emulator`, which is not a `demo-` ID. | Change only the test project constant to a `demo-` ID and run with an explicit matching emulator CLI project. Confirm emulator output says demo and non-emulated access fails closed. | Emulator run must use same exact ID in CLI and test source. OPEN. |
| HIGH | Large-history pagination consistency/performance; `FirestoreFieldAssignmentRepository`, cursor tests | Firestore pages are ordered by document ID and bounded, but no sufficiently large emulator dataset currently proves complete, duplicate-free traversal. | Add a seeded emulator benchmark over multiple page sizes/dataset sizes; record query/page count, wall time, unique/duplicate/missing counts. Treat as local emulator evidence only; document cursor semantics under mutation. | At least 1,000 synthetic records, no user data, exact per-size counts, latency statistics across repeated complete traversals. OPEN. |
| HIGH | Secrets under frontend source; Admin key path, `.gitignore`, Vite bundling/build | Ignored Admin JSON is inside `frontend/src`; accidental import could bundle it. No owner-approved safe destination is available, and deleting/moving the only copy is prohibited. | Do not read/use/move the key. Verify ignore and untracked status, source imports and generated bundle via path-only/boolean checks. Add an explicit Vite build guard that rejects known service-account/private-key file patterns under the frontend root if feasible without rejecting public Firebase config. | No privileged key in source imports or build output; key remains owner-only relocation item. OPEN owner action. |
| HIGH | Live Auth test safety; `frontend/src/live-test/liveAuthClient.test.ts` | Recently hardened but inline environment guard has no isolated local unit tests. | Extract a pure opt-in policy function and test missing opt-in, missing approval, project mismatch, missing disposable credentials/config, and allowed guarded config with test doubles. Keep default live test skipped; never execute it. | Unit tests have no Firebase/network dependencies; `npm run test:live` executes 0 and skips. OPEN. |
| MEDIUM | Firestore transaction failure behavior; assignment repository/service/emulator test | Pair uniqueness and transactions are covered, but injected failure after queued writes and retry are not. | Add local emulator test that injects an exception after transaction writes are queued, verifies tenure/lock/history are absent, then retries and verifies atomic success. | Emulator test only; do not claim production behavior beyond Firestore transaction contract. OPEN. |
| MEDIUM | Assignment/history page consistency/churn | Cursors are exclusive document-ID cursors, not snapshots; insertions before the cursor can be absent from the current traversal and changed active results can shift membership. | Add deterministic emulator pagination test for stable dataset plus insert-before/after cursor behavior; document restart semantics and bounded reads. | Exact duplicate/missing analysis and query counts; do not claim snapshot consistency. OPEN. |
| MEDIUM | Lifecycle/status concurrency | Farm/field status gate and assignment release are separate bounded operations; existing reports state races were reasoned about but not directly tested. | Add emulator test exercising create versus lifecycle gate where deterministic; separately report nondeterministic simultaneous operation evidence and residual external/live limits. | Must not infer all production races from one local run. OPEN. |
| MEDIUM | Payments/reviews/ratings, `TASKS.md` | Tracker marks manual payment records and ratings open; repository search found no payment/rating domain/API modules. Application review is implemented, but payment ledger/review-per-assignment is not. | Preserve as incomplete scope; inspect PRD and API placeholders; do not fabricate a payment provider/success or ratings. No code feature added absent a bounded agreed design. | Record exact source inventory and distinguish NOT IMPLEMENTED from NOT TESTED. OPEN product work. |
| MEDIUM | Exposed Firebase CLI session | Historical command output exposed OAuth session material. | No CLI auth inspection or live command. Owner revokes grant/session and runs `firebase logout`. | BLOCKED on owner action; never claim completed. |
| LOW | No independent reviewer / no commit baseline | No conventional index/commit exists; previous M5 audit was by implementation agent. | Document review limitations and exact worktree status; owner can arrange independent review after safe backup/baseline. | OPEN review limitation. |

## Scope traceability

- Assignment domain: `FieldAssignmentService`, `AssignmentLifecycleService`, `FirestoreFieldAssignmentRepository`, `FirestoreAssignmentHistoryRepository`, DTOs, controllers and existing unit/MockMvc tests.
- Firebase safety: root `.gitignore`, `.firebaserc`, `firebase.json`, frontend Firebase service/config/build/test files, backend Admin configuration, live Auth test, Firestore Rules emulator suite.
- Payments and reviews: PRD FR-16 and TASKS M5 items. Current application decision/review workflow is separate from farm-work ratings and payment ledger.

## Test strategy

1. Run focused backend service/repository tests after each change.
2. Run an isolated Firestore Emulator with explicit `demo-...` project, matching test source project ID; never use `.firebaserc` default for this suite.
3. Test seeded cursor traversal at 1k records and small/empty/final pages; collect actual repeated-run timings and counts.
4. Run frontend guard unit tests and normal frontend tests/build. `npm run test:live` must safely skip; never opt in.
5. Run full backend/Rules/frontend/Python/M6 regression serially where artifact or emulator ports could conflict.
6. Report unit, emulator and any live tests separately. Live tests are prohibited in this assignment.

## External blockers

- Owner must revoke the exposed Firebase OAuth session/grant and clear local CLI auth.
- Owner must choose a protected destination for the ignored Admin key and decide whether/how to rotate it. No safe owner-approved destination is available to this run.
- No production Firestore behavior or credential-backed Admin integration can be verified.
- No conventional Git baseline exists; preserve an owner-controlled verified backup before future Git initialization/staging/index creation.
- Payment/review product semantics require owner/product clarification before implementation; no financial provider or payment success may be invented.

## Change constraints

No `MEMORY.md` edits; no `TASKS.md` completion marks without evidence; historical M5 owner acceptance remains ACCEPTED; M5 technical closure only follows evidence and independent review; M6 remains NOT READY/acceptance pending; M7/M8 remain blocked.

## Verification addendum — 2026-11-19 (supersedes the initial OPEN labels above where noted)

- Lifecycle interruption/retry and exact `demo-agroai-assignment` emulator isolation: verified for the synthetic 106-record scenario; see `M5_ASSIGNMENT_LIFECYCLE_AUDIT.md` and `M5_FAILURE_RECOVERY_AND_CONCURRENCY_REPORT.md`.
- Repeat tenure: verified by service unit coverage and emulator path; TASKS line corrected accordingly.
- Local live-auth guard tests: verified 5 passed; real auth test remains skipped and NOT TESTED.
- Storage local-provider fallback: `matchIfMissing` removed and tests added. It is available only under dev/test profiles with an explicit `local` setting; no prod bean appears without approved provider.
- Local history pagination for 100/1k/5k records, insert-before/after semantics, queued-history transaction rollback/retry, four coordinated local races, fail-closed emulator guard, and M5 mock-auth owner/farmer UI workflows are now tested. Details and exact measurements are in companion reports.
- Still HIGH/BLOCKED: payments and assignment reviews/ratings are explicitly in PRD FR-16 and M5 TASKS but lack data/policy decisions and implementation; Admin key remains inside frontend source; historical OAuth session revocation and local logout are unconfirmed; live Firestore and production behavior are untested; release/reassign and competing lifecycle races remain untested. These findings keep M5 NOT READY.
- Rules emulator, frontend tests/build, Python tests, backend suite, and combined Playwright evidence are captured in `M5_REGRESSION_REPORT.md`. Browser flows use development mock authentication and mocked API fixtures.
