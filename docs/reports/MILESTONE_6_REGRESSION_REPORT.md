# Milestone 6 Regression Report

**Date:** 2026-11-19  
**Milestone:** M6 — AI and Agricultural Monitoring Infrastructure  

---

## 1. Verified Suite Execution Table

| Suite | Scope / Environment | Executed | Passed | Failed | Skipped | Status |
|---|---|---:|---:|---:|---:|---|
| **Java Maven Backend Suite** | Unit, Service, Controller & Repository tests (offline JDK 21) | 250 | 250 | 0 | 0 | **PASS** |
| **Python Pytest Suite** | AI Service schemas, OpenCV preprocessing, `MODEL_UNAVAILABLE` contracts | 17 | 17 | 0 | 0 | **PASS** |
| **Frontend Vitest Suite** | Services, API clients, authentication guards, payment/review services | 76 | 76 | 0 | 0 | **PASS** |
| **Firestore Rules Emulator** | Security rules test in live emulator (`demo-agroai`) | 26 | 26 | 0 | 0 | **PASS** |
| **Live Firestore Monitoring Emulator** | `FirebaseMonitoringEmulatorLiveTest` (`demo-agroai-monitoring`) | 1 | 1 | 0 | 0 | **PASS** |
| **Playwright E2E Suite** | 15 tests across 3 projects: Chromium Desktop, Mobile, Mobile-Large | 15 | 15 | 0 | 0 | **PASS** |

**Total Executed:** **385 automated tests, 385 passed, 0 failed, 0 skipped.**

---

## 2. Milestone 6 Domain Verification Evidence

1. **Image Upload & Storage Neutrality:**
   - Provider-neutral `ImageStorage` abstraction tested.
   - Development profile provides `LocalDevelopmentImageStorage`.
   - Production profile (`application-prod.yml`) fails closed with HTTP 503 (`IMAGE_STORAGE_UNAVAILABLE`) when `agroai.storage.provider` is `none` or unconfigured.
   - GCS configuration supported via `agroai.storage.provider=gcs` and `agroai.storage.gcs.bucket-name`.

2. **Authorization & Tenant Isolation:**
   - `MonitoringAuthorizationService` strictly verifies `farmId` matches `fieldId`. Mismatched IDs throw `FieldNotFoundException(fieldId)`.
   - Cross-farm and cross-field read/write accesses denied with 403 `UnauthorizedResourceAccessException`.
   - Suspended farms and archived fields reject monitoring submissions.
   - Direct client reads and writes to monitoring collections denied by Cloud Firestore security rules (`firestore.rules` lines 179-183).

3. **Telemetry Validation & Idempotency:**
   - `SoilTelemetryService` verifies finite numeric values and bounds observation timestamps to past/present.
   - Out-of-range sensor readings are flagged with `OUT_OF_RANGE` status and structured warnings.
   - Idempotency enforced via `clientEventId`: identical repeat submissions return existing records; conflicting payloads throw `IllegalArgumentException`.
   - Verified by `SoilTelemetryServiceTest` (6/6 PASS).

4. **Irrigation Planner Contract:**
   - Explainable rule-based engine comparing recent (within 24 hours) valid soil moisture against configurable threshold.
   - Returns `INSUFFICIENT_DATA` when threshold unconfigured, reading missing, invalid, or older than 24 hours.
   - Produces `IRRIGATION_NEEDED` or `NO_IRRIGATION_NEEDED` when valid recent data is present.
   - Leaves `estimatedWaterLiters = null` honestly without pretending agronomic crop models exist.
   - Enforces lifecycle status transitions (`DRAFT → SCHEDULED/CANCELLED → COMPLETED/CANCELLED`).
   - Verified by `IrrigationPlanningServiceTest` (5/5 PASS).

5. **AI Model Boundary & Disease Analysis Lifecycle:**
   - Decoupled FastAPI AI Service (`ai-service`).
   - Analysis lifecycle (`PENDING → PROCESSING → COMPLETED / FAILED`).
   - Strict `MODEL_UNAVAILABLE` fail-closed behavior when weights are missing.
   - Verified by `DiseaseAnalysisServiceTest` (2/2 PASS) and `ai-service` pytest suite (17/17 PASS).
