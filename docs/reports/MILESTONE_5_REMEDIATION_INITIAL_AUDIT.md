# Milestone 5 Remediation Initial Audit

**Audit date:** 2026-11-17  
**Method:** fresh, read-only inspection of the workspace, source, task tracker, existing reports, and test configuration. No implementation changes had been made when this audit was started.

## Repository and preservation state

`git status --short` reports every root project item as untracked (`??`); `git diff --stat` and `git diff --cached --stat` are empty. There is no tracked-file baseline from which to distinguish prior implementation changes. All files are therefore treated as pre-existing user work. No staging, reset, cleanup, commit, push, or deployment was performed.

Existing Milestone 5 reports include initial repository audit, architecture map, gap analysis, implementation plan/report, API/data model, security audit, test strategy/report, performance report, regression report, and final acceptance audit. The final audit recommends NOT READY and explicitly says it is an implementation-agent self-review, not a genuinely independent review.

## Existing implementation and test evidence

Backend assignment service supports create, release, reassignment, history, manager/farmer views, and uses Firestore transactions for core live mutations. It uses a single deterministic field/farmer assignment ID, so a released tenure blocks future tenures. List APIs/repository methods return unbounded lists. Assignment manager/account eligibility checks happen outside mutation transactions. Farmer workspace rejects archived fields but does not consistently account for inactive fields or farm status. Firestore Rules authorize active assignment by deterministic document status, but do not check farm/field lifecycle status.

Previous reports claim 193 backend + 60 frontend + 22 Rules emulator + 5 Python standard passes (=280), with a 242-case Milestone 4 standard baseline. They separately report 4 live read-only Admin SDK checks passed, 6 backend live E2E methods and 7 frontend live-auth tests not run. These are historical report claims, not rerun evidence in this audit. Frontend package scripts exclude live-auth and Rules suites from standard tests; Maven excludes Firebase live classes except under `live-firebase`. No browser E2E framework is declared in the frontend package manifest. Previous reports say the frontend build passes with a >500 kB chunk warning and no performance benchmark was run.

## Reconciled source counts and fresh execution

Source inspection after the initial audit found 204 Java `@Test` methods, 90 frontend `it()` cases, and 5 Python test cases (299 physical cases). Java divides into 194 standard, 4 live Admin SDK, and 6 live E2E; frontend divides into 60 standard, 23 Rules and 7 live-auth. This resolves the 7-versus-9 disagreement: current source has 7 live-auth cases. The M4 final independent audit also explains that an earlier count of 9 was a regex artifact; current source is the controlling inventory.

Fresh verification: backend full run exit 0 with 193 tests; after adding one lifecycle test, focused `ContextualSecurityTest` exit 0 with 5 tests. These runs give 194 distinct standard backend cases when overlapping class tests are deduplicated. Frontend standard tests 60 passed; Rules emulator 23 passed; Python 5 passed; frontend build passed. Standard total is 282, compared with M4's documented baseline 242 (+40). Historical live Admin SDK 4/4 was not rerun and is not counted in standard passes. Six backend live E2E and seven frontend live-auth cases remain unexecuted.

## Security and documentation findings

Open reported risks include lifecycle orphaning/access, no repeat-tenure identity strategy, unbounded lists, transaction-time revocation races, no live assignment transactions, no browser E2E, and no workload performance evidence. Firebase Admin writes bypass Firestore Rules, so emulator Rules tests cannot prove backend transaction authorization. Existing TASKS M5 section contains these open items and additionally lists payments/reviews; the remediation scope does not implicitly implement those unrelated features. `MEMORY.md` is read-only for this work and will not be changed.

## Required remediation sequence

1. Reconcile exact source test inventory and available environments; keep historical evidence distinct from fresh execution.
2. Define and enforce lifecycle behavior, preserve history, and support safe repeat tenures without duplicate active assignments.
3. Introduce bounded cursor pagination in server repositories and authorized endpoints.
4. Close or bound mutation authorization races for current membership/account state.
5. Run safe isolated live/emulator and UI workflows where available; otherwise report exact non-execution reason and manual steps.
6. Run requested regression suites, record actual counts and durations, and perform a final self-audit without claiming separate independent review.

No production data writes, Rules deployment, Milestone 6 work, or MEMORY.md changes are authorized or planned.
