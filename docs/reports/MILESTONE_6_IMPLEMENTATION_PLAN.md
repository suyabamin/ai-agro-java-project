# Milestone 6 Implementation Plan

The user explicitly authorized proceeding after audit. The model/training update narrows the disease-classification deliverable: infrastructure is implemented now, actual disease classification remains unavailable until the user supplies and evaluates their model.

## Phase 6A — Model-ready AI and image foundation

- Create `ai model/README.md`, metadata and label-map schemas; no weight files.
- Add model registry, metadata/checksum/label validation, lazy loader and inference protocol in FastAPI.
- Validate/normalize image inputs and report preprocessing requirements; do not imply OpenCV is present unless the runtime dependency is available.
- Add backend-authenticated inference endpoint and strict result validation; missing model returns HTTP success with explicit `MODEL_UNAVAILABLE`, no class/confidence, not COMPLETED.
- Update diagnostics and implement Python tests for missing/invalid model, image invalidity, service-key failure and inference-adapter schema.

## Phase 6B — Authorized crop image workflow

- Define storage port, configurable local development/test adapter, and production fail-closed behavior until an approved provider is configured.
- Add secure multipart validation, opaque object keys, metadata-only Firestore records, cursor listing/details/retrieval/deletion, access authorization and orphan cleanup behavior.
- Wire analysis request to image reference through backend, never allow AI service Firestore writes.

## Phase 6C — Telemetry and analysis lifecycle

- Add typed telemetry records, units/range/timestamp validation, duplicate IDs, bounded history/latest queries, and field-specific authorization.
- Add analysis states and safe persistence of `MODEL_UNAVAILABLE` as unavailable/failed semantics without disease label, confidence or completed-success status.
- Add authenticated backend-to-AI timeout/auth/error mapping and immutable history events.

## Phase 6D — Transparent irrigation and unified field history

- Implement versioned configurable thresholds only; without configured thresholds or sufficient readings, respond `INSUFFICIENT_DATA` and no volume estimate.
- Persist input snapshot, rules version, rationale, source references and plan lifecycle.
- Add cursor-paginated field history for images, telemetry, analyses, irrigation and failures.

## Phase 6E — Frontend integration, security and regression

- Add field monitoring UI for image upload/list/preview, model unavailable messaging, telemetry submit/history/charts, analysis status/history, and irrigation plans/history.
- Keep charts tied to persisted readings and clearly state that disease inference is not operational before a model is supplied.
- Add unit/integration/Rules tests, execute all suites/builds, reconcile physical vs executed test counts, update architecture/API/schema/security docs, README, TASKS and MEMORY.

## Risks and assumptions

- No storage provider is selected; local dev storage is for development/testing only, production writes fail closed without provider configuration.
- No model files exist and TensorFlow is absent; real inference, accuracy, and training are intentionally out of scope.
- No Firebase credentials or production project are assumed. Firestore behavior can be unit/emulator tested only if local emulator configuration supports required workflows.
- OpenCV is not installed in the current Python venv. Add the dependency and attempt install/test; if network/platform blocks installation, keep OpenCV-dependent readiness false and record the limitation.
- No browser E2E runner or chart library is installed. Avoid adding large dependencies unless needed; test UI state/components and document absent browser evidence.
- Existing M5 APIs/security must remain compatible; no changes to M1–M5 contracts absent a necessary additive endpoint.

## Affected areas

`ai-service/app` and Python requirements/tests; new `ai model/` contract docs; backend monitoring models/DTOs/controllers/services/repositories/config/security/tests; frontend types/services/components/dashboard integration/tests; `firestore.rules` and Rules tests if direct reads are introduced (preferred path remains backend only); docs architecture/API/schema/security and M6 reports; README/TASKS/MEMORY after verified implementation.

