# AgroAI — Crop Leaf Disease Model Integration Report

**Date:** 2026-11-25  
**Scope:** End-to-end integration of pretrained `crop_disease_model.tflite` across FastAPI, Spring Boot, Firestore persistence contracts, and React (Farmer & Owner workflows).

---

## 1. Model File Locations
- `ai-service/app/models/disease/__init__.py`
- `ai-service/app/models/disease/crop_disease_model.tflite` (16,523,924 bytes)
- `ai-service/app/models/disease/class_names.json` (2,849 bytes)
- `ai-service/app/models/disease/conversion_report.json` (3,317 bytes)

Resolved at runtime via `Path(__file__).resolve().parents[1] / "models" / "disease"` in `ai-service/app/core/config.py` (or `AGROAI_DISEASE_MODEL_DIR` env override). No absolute Windows paths are hardcoded; model files are not exposed over static URLs or duplicated in Spring Boot.

---

## 2. Actual Model Metadata & Class Mapping Validation
Verified directly via `ai-edge-litert` 2.4.0 (`ai_edge_litert.interpreter.Interpreter`) on Python 3.12.13:
- **Input tensor:** `serving_default_input_layer_2:0`, shape `[1, 224, 224, 3]`, dtype `float32`, quantization `(0.0, 0)`, RGB `[0, 255]`.
- **Embedded normalization:** `conversion_report.json` confirms `1/255` rescaling and `EfficientNetB0 normalization_1` are embedded inside the TFLite graph.
- **Output tensor:** `StatefulPartitionedCall_1:0`, shape `[1, 94]`, dtype `float32`, quantization `(0.0, 0)`, 94-way softmax probabilities summing to `1.000000` (verified on black and mid-gray synthetic probes).
- **Class mapping:** `class_names.json` verified to contain 94 contiguous integer keys `"0"` through `"93"`, including 16 healthy/normal classes (`*_Healthy`, `*_healthy`, `Jute_Healthy Leaf`, and `Rice_normal`).

---

## 3. Verified Input Preprocessing & Model Loading Architecture
- **Service:** `ai-service/app/services/disease_detection_service.py` (`DiseaseDetectionService`, version `letterbox-224-rgb128-f32-0-255-v1`).
- **Loading:** Loaded once via `@lru_cache(maxsize=1)` singleton (`get_disease_service()`), protected by `threading.Lock()` for safe concurrent `interpreter.invoke()`. Fails closed (`MODEL_UNAVAILABLE`) if model or mapping is missing, corrupt, or incompatible.
- **Validation:** Sniffs PNG/JPEG magic bytes, enforces `MAX_IMAGE_BYTES` (8 MiB), rejects mismatched MIME types, empty/corrupt files, and out-of-bounds dimensions.
- **Preprocessing:** Decodes via `cv2.imdecode(..., cv2.IMREAD_COLOR)` (EXIF-aware), converts BGR → RGB, resizes preserving aspect ratio, centers on `224×224` `RGB(128, 128, 128)` letterbox canvas, outputs `float32` in `[0, 255]` (no external division by 255).

---

## 4. FastAPI Endpoints
- `POST /api/v1/inference/disease` (authenticated via `X-AI-Service-Key`; accepts both raw image bytes from Spring Boot and `multipart/form-data`). Returns `status`, `model_name`, `model_version`, `predicted_class`, `predicted_class_id`, `confidence_score`, `alternatives`, `success`, `classIndex`, `diseaseName`, `confidence`, `isHealthy`, `topPredictions`, `preprocessingVersion`, `limitations`, `is_mock: false`.
- `GET /api/v1/inference/availability`: Reports `AVAILABLE` with `class_count: 94`, input specs, and `preprocessing_version`.
- `GET /api/v1/health/diagnostics`: Reports `inference_ready: true` and `active_model: "crop_disease_model@su-0.1-tflite"`.

---

## 5. Spring Boot Integration, Authorization & Persistence
- **Authorization:** `MonitoringAuthorizationService.requireWriteAccess` enforces authenticated active user, active farm/field, and `OWNER`/`MANAGER` or actively assigned `FARMER` with monitoring write permission; `requireReadAccess` / `requireFarmReadAccess` enforces Owner and assigned Farmer visibility.
- **Image Storage:** Reuses `CropImageService` + `ImageStorage` (`LocalDevelopmentImageStorage` in `dev`/`test`; production cloud bucket remains unconfigured and fails closed).
- **Persistence & Lifecycle:** `DiseaseAnalysisService` canonicalizes `fieldId` from the authorized `Field` entity, creates `ai_analysis_results` record (`analysisType: "DISEASE_DETECTION"`) through `PENDING -> PROCESSING -> COMPLETED / FAILED / MODEL_UNAVAILABLE`, and stores `imageStorageKey`, `submittedBy`, `diseaseName`, `classIndex`, `confidence`, `isHealthy`, `topPredictions`, `preprocessingVersion`, `completedAt`, `failureReason`.
- **Tabular Isolation & Batch Endpoint:** `AgriculturalAnalysisService.getLatestForFarm` and `DiseaseAnalysisService.list` filter by `analysisType` so disease scans never overwrite or shadow Water Need / Field Status / Crop Recommendation. Added `GET /api/v1/farms/{farmId}/monitoring/disease-analyses/latest` on `FarmMonitoringController` to avoid N+1 queries.

---

## 6. React Farmer & Owner UI
- **Shared Component:** `frontend/src/components/monitoring/DiseaseDetectionCard.tsx` renders `analysisId`, `StatusBadge`, processing spinner, fail-closed error + retry state, Healthy vs Disease Detected badge, confidence %, Top 3 predictions with progress bars, timestamp, model version, and AI-assisted disclaimer.
- **Farmer Experience (`FarmerFieldDetailsPage.tsx`):** Drag-and-drop & file picker upload, preview with Remove button, upload/inference progress states, retry on error, `DiseaseDetectionCard`, and dedicated `Disease Detections` history tab.
- **Owner Experience (`FieldDetailsPage.tsx` & `DashboardPage.tsx`):** Displays the same persisted `analysisId`, prediction, confidence, Healthy/Disease status, and history without running a second inference; `DashboardPage.tsx` uses the single batch endpoint `/disease-analyses/latest`.

---

## 7. Model Limitations
- 94 output classes cover 14 crop/fruit groups under controlled dataset conditions; no local field evaluation dataset is present in the workspace.
- Output confidence is an uncalibrated softmax score and is presented strictly as AI-assisted decision support, not a guaranteed agronomic diagnosis.
- Existing tabular models (Water Need, Field Status, Crop Recommendation) remain completely separate and unmodified.

---

## 8. Executed Tests & Exact Results

| Suite | Command | Result | Scope |
|---|---|---|---|
| Python AI Service (`pytest`) | `.\.venv\Scripts\pytest.exe -q` | **32 passed** (100%) | Real TFLite loading, 94-class mapping, letterbox preprocessing, JPEG/PNG inference, invalid/corrupt/empty/undersized rejection, multipart & raw API, health diagnostics, tabular tests |
| Spring Boot Backend (`mvnw.cmd test`) | `.\mvnw.cmd test -Dtest=DiseaseAnalysisServiceTest,AgriculturalAnalysisServiceTest,FarmMonitoringControllerIntegrationTest,FieldMonitoringControllerIntegrationTest,MonitoringAuthorizationServiceTest` | **40 passed, 0 failures, 0 errors** | Disease persistence, canonical fieldId, fail-closed error handling, tabular/disease isolation, farm batch queries, monitoring authorization & controllers |
| Frontend Unit Tests (`vitest`) | `npm test -- --run` | **112 passed** across 14 files (100%) | `DiseaseDetectionCard` & `farmAiInsights` integration, monitoring service, i18n/theme, farm/field/assignment services |
| Frontend Production Build | `npm run build` (`tsc -b && vite build`) | **PASS** (0 errors, 201 modules, 670ms) | Full TypeScript compilation and Vite bundle |

### Not Executed / Blocked
- **Live Browser E2E & Live Firestore Persistence:** **NOT EXECUTED** — Spring Boot (`8080`), FastAPI (`8000`), and Firebase Firestore Emulator (`8085`) were not running simultaneously with authenticated Firebase test accounts during this offline verification run.
- **Production Cloud Image Storage:** **NOT CONFIGURED** — `application-dev.yml` uses `local` storage; production cloud bucket selection remains an open architectural decision.

---

## 9. Local Git Commits
*(Retrieved via `git log -n 5 --oneline` after Milestone 4 commit; documentation commit follows)*
- `549d08a` — `add disease model implementation audit`
- `ffae504` — `add disease model files`
- `232c8fd` — `add disease model loader and inference api`
- `c50f4a8` — `connect disease inference and farm batch endpoint in backend`
- Milestone 4 & Milestone 5 commits recorded in local `main` history (no remote push performed).
