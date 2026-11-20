# M5 Assignment Browser E2E Report

**Finding:** M5-E2E-01 — owner and farmer assignment UI workflows.
**Severity:** HIGH. **Status:** PARTIAL.

Command: `npx playwright test e2e/m5-assignment.spec.ts` from `frontend`.

Test: `M5 owner assigns, releases, reviews history, then creates a distinct tenure`.

| Browser project | Viewport | Result |
|---|---:|---|
| chromium-desktop | 1440×900 | PASS |
| chromium-mobile | 390×844 | PASS |
| chromium-mobile-large | 430×932 | PASS |

Owner test: signs in using existing Vite development mock authentication, opens an owned farm/field, assigns a disposable fixture farmer, sees ASSIGNED history, releases the assignment, sees the retained RELEASED row and audit event, then assigns the same farmer again and verifies two distinct assignment rows (one active, one historical).

Farmer test: signs in using development mock authentication, changes to Farmer View, confirms only the server fixture's assigned field is rendered, opens its permitted operational details, views a released tenure in history, and refreshes the route. The API fixture deliberately includes one assigned field and no unassigned field. This tests UI rendering, not a backend authorization denial.

All API requests are routed to local Playwright fixtures. These tests are UI E2E with mocked API and development mock authentication; they are not Firebase Auth, Spring Boot, Firestore, or Rules integration.

The owner test exposed a real UI defect: the list rendered active assignments only, and when active count was zero the empty-state branch hid all historical records. `FieldAssignmentsSection` now renders all records and offers release only for ACTIVE records. Assignment form labels also now associate with their inputs for accessible selectors.

Screenshots and Playwright traces are in `frontend/test-results/` under the `m5-assignment-*` output folders. During authoring, five intermediate runs each had 3 failed M5 cases (15 failed case executions across overlapping reruns): ambiguous field selector; unassociated farmer label; unassociated release-reason label; a history row hidden at zero active assignments (real UI bug); and an ambiguous RELEASED assertion. These locator issues were corrected and the UI defect fixed. They are intermediate failed attempts, not suppressed results. Final targeted M5 run passed 6/6; final combined run passed 9/9 including 3 M6 monitoring cases.

Not covered by this UI suite: server-side farmer access revocation, direct URL/API authorization attacks, session expiry, network failure, invalid farmer IDs, backend business behavior, or real login. These require additional backend/API integration evidence; M5 remains NOT READY.

## Prompt 4 continuation addendum — 2026-11-19

No payment or assignment-review UI was added. These workflows have no page, form, API, or persistence implementation; adding fixture-based UI now would misrepresent missing business contracts. The existing 6 M5 Playwright cases remain mock-auth/fixture-only and do not cover payment or review behavior. Manual payment, post-termination review eligibility, participant visibility, and duplicate review E2E are NOT TESTED. They remain blocked as detailed in `M5_OWNER_DECISION_REPORT.md`.

The combined regression was rerun with `npm run test:e2e` in `frontend`: 9/9 passed (6 M5, 3 M6), desktop/mobile 390×844/mobile 430×932 projects. `frontend/test-results/` retains six PNG screenshots (three M5 assignment tenure screenshots and three M6 monitoring layout screenshots). This successful run did not generate Playwright traces; the Maven Surefire emulator XML/text reports retain detailed backend emulator output. No Firebase-authenticated or production API workflow ran.
