# Unified Project Baseline Audit

**Date:** 2026-11-18. Scope: existing workspace and Milestone 6 blocker resolution. Milestones 7 and 8 were not started.

## Architecture and feature state

- Frontend: React 19, TypeScript, Vite; Firebase Web Auth when configured and a development mock-auth route when Firebase client settings are absent.
- Backend: Java 21, Spring Boot 3.3.6, Maven Wrapper; protected APIs verify Firebase ID tokens when configured.
- Persistence: Firebase Admin/Cloud Firestore repositories and Firestore Rules; Firestore emulator is bound to 127.0.0.1:8085.
- AI: Python 3.12 FastAPI, preprocessing and model registry. No owner-supplied trained model is present; API preserves MODEL_UNAVAILABLE.
- M6 includes crop image metadata/storage abstraction, soil telemetry, irrigation lifecycle/history, cursor pagination and frontend rendering.
- TASKS.md says M2 awaits user acceptance; M3/M4 are accepted; M5 remains IN_PROGRESS / REVIEW_REQUIRED; M6 is not ready/accepted. M7/M8 remain gated.

## Current environment and verification

Temurin JDK 21.0.13 at C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot; Maven Wrapper pins 3.9.9; Node 26.4.0/npm 11.17.0; existing ai-service .venv has Python 3.12.13.

Fresh 2026-11-18 verification: frontend 70/70, Python 17/17, Playwright mock-auth desktop/mobile 3/3, unconfigured production-preview auth guard 1/1, backend Maven 216/216, Firestore Rules emulator 26/26. Production build passed (142 modules; JS 1,026.52 kB, large-chunk warning). Distinct executed aggregate: 333 passed, 0 failed, 0 skipped, 0 aborted; separate live Firebase suite was default-skipped (1 case). The initial parallel Playwright artifact-collision attempt is excluded. Benchmark is local synthetic preprocessing and in-process no-model API only. See the current M6 test report.

## Untested/incomplete

Real Firebase Auth/token verification, authenticated Spring authorization against a live isolated project, Firestore persistence through Firebase Admin, complete authenticated cross-service flow, production storage, real model inference/evaluation, production performance and deployment remain NOT TESTED. An ignored Admin service-account JSON for agroai-dev exists, but its authorization/isolation status was not confirmed and it was not used. Frontend Firebase settings are absent. No production data or image was accessed.

## Workspace/scope risks

Git reports project paths as untracked (??), so a conventional tracked diff is unavailable. Preserve all existing files. No stage/commit/push/reset/delete; MEMORY.md unchanged. Passing Playwright screenshots are under frontend/test-results; the runner clears that directory at startup. No Rules deployment/live writes. Stop at M6 acceptance gate.


