# Milestone 6 Browser E2E Report

Date: 2026-11-18. Clean runs were performed sequentially to avoid collisions between Playwright configurations.

## Development UI workflow — PASS, 3/3

Command from `frontend`: `npx playwright test --config=playwright.config.ts --workers=1`.

| Project | Viewport | Result |
|---|---:|---|
| chromium-desktop | 1440×900 | 1/1 PASS |
| chromium-mobile | 390×844 | 1/1 PASS |
| chromium-mobile-large | 430×932 | 1/1 PASS |

Each project verifies protected dashboard redirect, development mock owner sign-in and sign-out, field monitoring rendering, page/panel/row overflow assertions, telemetry submission and Save reading confirmation, invalid-image rejection, MODEL_UNAVAILABLE response, and Load More for images, analyses and irrigation plans. Source: `frontend/e2e/monitoring.spec.ts`.

**Authentication classification:** development mock-auth UI E2E with intercepted API fixtures. It does not authenticate with Firebase, call Spring Boot, or verify Firestore persistence.

The previous mobile issue was attributed in the retained M6 work to the horizontal dashboard flex shell, fixed-width sidebar and intrinsic min-width behavior that forced overflow and made monitoring controls inaccessible. The existing responsive CSS fix is verified by the clean width assertions and successful click on Save reading at both mobile sizes; this run made no UI layout code changes.

## Unconfigured production preview — PASS, 1/1

Commands: `npx vite build --config vite.production-test.config.ts`; then `npx playwright test --config=playwright.production.config.ts` from `frontend`.

The isolated test build uses an empty environment directory and has no Firebase Web configuration. The browser seeds a prior mock user and mock token in local storage, then verifies they do not authenticate the landing page or protected dashboard; login/registration show explicit unavailable states and no quick mock controls. This is a local production-bundle behavior check, not a Firebase-authenticated test.

## Invalid runner attempt

An initial run launched development and production specs in parallel under broad default test discovery. The production test hit the development server and concurrent runs collided in Playwright artifact paths (ENOENT); five results were invalid. `playwright.config.ts` now selects only the development monitoring spec; the production config selects its dedicated auth spec. Both clean serial runs passed. This invalid run is not included in test totals.

## Artifacts

The configs retain output. Screenshots from the latest clean dev run:

- `frontend/test-results/monitoring-protected-navig-a18f4-rkflows-and-cursor-controls-chromium-desktop/monitoring-layout.png`
- `frontend/test-results/monitoring-protected-navig-a18f4-rkflows-and-cursor-controls-chromium-mobile/monitoring-layout.png`
- `frontend/test-results/monitoring-protected-navig-a18f4-rkflows-and-cursor-controls-chromium-mobile-large/monitoring-layout.png`

Production test output is isolated in `frontend/test-results-production/`. Playwright clears output at the next run for that config, so preserve/copy artifacts before rerunning if longer retention is needed. Traces/screenshots are diagnostic UI artifacts only and contain no real user data. No live Firebase account or real user image was used.
