# Milestone 6 Initial Repository Audit

**Audit date:** 2026-11-18  
**Scope:** Existing AgroAI monorepo, read-only inspection before M6 source changes. The user's future-model instruction is controlling: no model training, fabricated weights, arbitrary pretrained classifier, random labels, or invented confidence.

## Existing implementation inventory

| Area | Current state found |
|---|---|
| Frontend | React/TypeScript/Vite with authenticated dashboard, owner/farmer perspectives, farm/field pages and M5 assignment pagination. `/dashboard/monitoring`, `analysis`, `telemetry` and `records` route to the generic `DashboardPage`; no agricultural monitoring clients/components or image-upload UI exist. |
| Spring Boot | Firebase authentication, Firestore repositories, farm/field/membership/assignment services, contextual `FieldSecurityEvaluator`, and `AiServiceHealthClient` with a 5-second health timeout. No image, telemetry, AI analysis, irrigation, or unified monitoring-history controllers/models/repositories exist. |
| FastAPI | Root and v1 health endpoints only, with five health tests. `/health/diagnostics` reports `inference_ready=false`, `active_model=null`; its `image_pipeline: OpenCV-pipeline-staged` value is not backed by implementation and must be corrected. No upload/inference endpoint or registry exists. |
| Persistence/storage | Firestore is authoritative for business data. `firebase.json` configures Rules emulator only; no Firestore indexes file or image object-storage provider/configuration exists. Current project docs identify storage provider as undecided. No binary image storage exists. |
| Model assets | No `ai model/` directory and no model weights/label metadata were found. `ai-service` has `MODEL_PATH=models/` only as an unused setting. Current Python venv has none of `cv2`, `tensorflow`, `PIL`, or `numpy` installed. |
| Security | Firebase ID token and contextual farm/field authorization exist. Active assigned farmers require a matching active assignment, active account, active farm and active field. Admin SDK bypasses Firestore Rules. Rules default-deny unknown collections; new client reads/writes therefore need explicit review and should remain backend-mediated. |
| Tests | Existing baseline is 202 Java, 60 frontend unit, 25 Rules emulator, 5 Python; these are M5-reported/current evidence, not rerun during this initial audit. M6 AI service has only health tests; no M6 Java, UI, upload, storage, telemetry or integration tests exist. |

## Architecture and current API map

Current request path is React → `/api/v1` Spring Boot → Firestore; Spring Boot can query FastAPI `/api/v1/health`. FastAPI has `/health`, `/api/v1/health`, `/api/v1/health/diagnostics`, and OpenAPI only. Existing backend API groups cover auth/users, farms/fields, assignments/farmer workspace, jobs/applications. No M6 endpoint exists. The relevant reusable APIs are field lookup, `FarmSecurityEvaluator`/`FieldSecurityEvaluator`, active membership/assignment checks, `ApiResponse`, `CursorPage`, Firebase repositories, and existing field dashboard route.

Existing main data collections include `users`, `farms`, `farm_members`, `fields`, `field_assignments`, `active_field_assignment_locks`, `assignment_history`, `jobs`, `applications`, and related history/message collections. M6 candidate collections (`field_images`, `soil_telemetry`, `ai_analysis_results`, `irrigation_plans`) are not currently implemented. New records must reference existing `farmId` and `fieldId`; actor UID comes from the verified principal.

## Dependencies and environment

- Frontend dependencies are already installed; no chart or browser E2E package was identified in `package.json`.
- Backend is Java 21/Spring Boot 3.3.6 with Firebase Admin and Spring validation; no object-storage, image-decoding, or AI SDK dependencies exist.
- AI service requirements currently include FastAPI, Uvicorn, Pydantic, pytest and HTTPX only. OpenCV/TensorFlow/image libraries are absent in the active venv. Add OpenCV as an installable dependency; TensorFlow must remain optional and is not needed to serve MODEL_UNAVAILABLE.
- Firebase credential path/project are environment configuration; no production Firestore or object-storage credentials/provider were established by this audit. No secret values were read.

## Security risks and test gaps

1. No model registry or metadata validation currently distinguishes a valid trained model from a missing/invalid artifact.
2. The diagnostics health field could imply an image pipeline exists when it does not.
3. No protected image bytes or metadata lifecycle exists; trusting upload MIME/extension or allowing public object URLs would be unsafe.
4. The Python service currently has no service-to-service authentication. Any inference route must require backend-only authentication and must not accept user identity/authorization claims from the frontend.
5. No M6 collection Rules, bounded query definitions, idempotency, analysis transitions, telemetry validation, irrigation evidence, or M6 integration tests exist.
6. Storage provider selection, production hosting, malware scanning, retention, and model training/evaluation remain external/project-owner decisions. Use a configurable local development adapter and fail closed for unconfigured production storage; do not silently choose a paid provider.

## Reusable components

- Existing Firebase authentication and verified `FirebaseUserDetails` principal.
- `FarmSecurityEvaluator` and `FieldSecurityEvaluator` for owner/manager/observer and active assigned-farmer access.
- Existing Farm/Field repositories and field crop/soil/irrigation metadata.
- Firestore dual-mode repository patterns and failure-closed behavior.
- `ApiResponse`, cursor pagination DTO/utilities, Spring validation, FastAPI settings, and dashboard layout/routes.

## Strategy

Build model infrastructure first: `ai model/` contract documentation (no weights), model metadata/registry/loader/inference abstractions, image validation/preprocessing contract, health readiness tied to actual model availability, protected inference endpoint, and explicit `MODEL_UNAVAILABLE` response with null disease/confidence. Then add provider-neutral storage, backend metadata/telemetry/analysis/irrigation/history APIs and field authorization; integrate the frontend into the field dashboard. Use rule-based irrigation only with explicitly configured/versioned thresholds and return insufficient-data otherwise. Test missing/invalid model, malformed uploads, role boundaries, telemetry validation, analysis/irrigation lifecycle, pagination, timeout/error paths and regressions. Do not claim model training, disease accuracy, production storage, Firebase live persistence, browser E2E or performance without evidence.

