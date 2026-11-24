# AgroAI — Crop Leaf Disease Model Implementation Audit

**Date:** 2026-11-25  
**Scope:** Milestone 1 (Repository Audit & Model Metadata Inspection)  
**Target Model:** `ai-service/app/models/disease/crop_disease_model.tflite`

---

## 1. Actual Model File Locations

| Artifact | Path | Size | Status |
|---|---|---|---|
| TFLite Model | `ai-service/app/models/disease/crop_disease_model.tflite` | 16,523,924 bytes (~15.76 MiB) | Present, verified |
| Class Mapping | `ai-service/app/models/disease/class_names.json` | 2,849 bytes | Present, 94 classes (`"0"`–`"93"`) |
| Conversion Report | `ai-service/app/models/disease/conversion_report.json` | 3,317 bytes | Present (TensorFlow 2.20.0 export metadata) |

---

## 2. Verified TFLite Model Metadata (Directly Inspected via `ai-edge-litert` 2.4.0)

Inspected directly on `Python 3.12.13` using `ai_edge_litert.interpreter.Interpreter`:

### Input Tensor
- **Name:** `serving_default_input_layer_2:0`
- **Shape:** `[1, 224, 224, 3]` (batch=1, height=224, width=224, channels=3)
- **Dtype:** `float32`
- **Channel Order:** RGB
- **Quantization:** None (`scale=0.0, zero_point=0`)
- **Pixel Range:** `[0, 255]` (`float32`)
- **Embedded Normalization:** Confirmed via `conversion_report.json` (`rescaling: multiply by 1/255` + `EfficientNetB0 normalization_1` with ImageNet mean/variance are embedded inside the `.tflite` graph). Therefore, application preprocessing MUST preserve `[0, 255]` `float32` RGB values and MUST NOT divide by 255.

### Output Tensor
- **Name:** `StatefulPartitionedCall_1:0`
- **Shape:** `[1, 94]`
- **Dtype:** `float32`
- **Quantization:** None (`scale=0.0, zero_point=0`)
- **Activation:** Already 94-way softmax probabilities summing to `1.000000` (verified on black and mid-gray synthetic probes matching `conversion_report.json` parity). Do NOT apply softmax again.

### Class Mapping (`class_names.json`)
- **Structure:** JSON object mapping stringified indices `"0"` through `"93"` to 94 class labels.
- **Contiguity:** Verified contiguous `0..93` with no gaps or duplicates.
- **Healthy / Normal Classes (16 classes):**
  - `2`: `Banana_Healthy`
  - `6`: `Banana_leaf_Healthy`
  - `12`: `Cauliflower_Healthy`
  - `16`: `Corn_Healthy`
  - `20`: `Cotton_Healthy`
  - `22`: `Guava_fruit_Healthy`
  - `28`: `Guava_leaf_Healthy`
  - `32`: `Jute_Healthy Leaf`
  - `37`: `Mango_Healthy`
  - `44`: `Papaya_Healthy`
  - `55`: `Potato_Healthy_Potatoes`
  - `68`: `Rice_normal` *(Note: uses `_normal` rather than `_Healthy`)*
  - `69`: `Sugarcane_Healthy`
  - `79`: `Tea_healthy`
  - `90`: `Tomato_healthy`
  - `91`: `Wheat_Healthy`

---

## 3. Existing Architecture & Integration Points

### 3.1 FastAPI AI Service (`ai-service/`)
- **Existing routes:** `POST /api/v1/inference/disease`, `GET /api/v1/inference/availability`, `GET /api/v1/health/diagnostics`, `POST /api/v1/inference/tabular`.
- **Auth:** `X-AI-Service-Key` header verified via `hmac.compare_digest`.
- **Current gap:** `inference.py` loads `ModelRegistry(settings.MODEL_DIR)` pointing to `../ai model` for `.keras`/`.h5` files, which is absent, returning `MODEL_UNAVAILABLE`. `ai-edge-litert` was not yet in `requirements.txt`.

### 3.2 Spring Boot Backend (`backend/`)
- **Controllers:** `FieldMonitoringController` (`/api/v1/farms/{farmId}/fields/{fieldId}/monitoring/...`) and `FarmMonitoringController` (`/api/v1/farms/{farmId}/monitoring/...`).
- **Services:** `DiseaseAnalysisService`, `CropImageService`, `AiInferenceClient`, `AgriculturalAnalysisService`, `MonitoringAuthorizationService`.
- **Storage:** `ImageStorage` port with `LocalDevelopmentImageStorage` active under `dev`/`test` profile (`agroai.storage.provider: local`). Production storage provider remains unconfigured by design.
- **Persistence:** `FirestoreFieldMonitoringRepository` writing to `ai_analysis_results`, `field_images`, and `field_activity`.
- **Current gaps:**
  1. `DiseaseAnalysisService.submit` does not canonicalize `fieldId` from the `Field` returned by `authorization.requireWriteAccess`.
  2. `DiseaseAnalysisService` does not yet persist `isHealthy`, `classIndex`, `confidence`, `topPredictions`, `preprocessingVersion`, `completedAt`, or `imageStorageKey`.
  3. `AgriculturalAnalysisService.getLatestForFarm` and `DiseaseAnalysisService.list` query `ai_analysis_results` without isolating `analysisType`, which would allow disease analyses to shadow tabular analyses (or vice versa).
  4. `FarmMonitoringController` lacks a batch `/disease-analyses/latest` endpoint to avoid N+1 queries on the Owner Dashboard.

### 3.3 React Frontend (`frontend/`)
- **Farmer UI:** `FarmerFieldDetailsPage.tsx` has a basic file input and upload button; lacks drag-and-drop, remove/replace, Top 3 predictions, Healthy/Disease badge, model version, retry, and dedicated disease history.
- **Owner UI:** `FieldDetailsPage.tsx`, `DashboardPage.tsx`, and `AIAnalysisDashboardPage.tsx` show `MODEL_UNAVAILABLE` placeholders for disease status instead of persisted disease detection results.

---

## 4. Required Changes & Risks

1. **FastAPI:** Implement singleton thread-safe `DiseaseDetectionService` using `ai_edge_litert.interpreter`, EXIF-aware OpenCV preprocessing (aspect-ratio-preserving letterbox 224×224 with `RGB(128,128,128)`, `float32` `[0, 255]`), and wire into `/api/v1/inference/disease`, `/availability`, and `/health/diagnostics`.
2. **Spring Boot:** Canonicalize `fieldId`, enrich persisted disease fields, isolate `analysisType` in queries so tabular AI is untouched, add `GET /api/v1/farms/{farmId}/monitoring/disease-analyses/latest`, and add unit/integration tests.
3. **Frontend:** Upgrade `FarmerFieldDetailsPage.tsx`, `FieldDetailsPage.tsx`, `DashboardPage.tsx`, `AIAnalysisDashboardPage.tsx`, and `farmAiInsights.ts` to render real disease results, Top 3 predictions, polling for non-terminal states, and history.
4. **Risks:**
   - **Model size (16.5 MB):** Under GitHub's 100 MB limit, safe for local Git commit, though we will verify `git status` and diff carefully.
   - **Production image storage:** Only `local` dev/test storage adapter is configured; production cloud bucket remains unconfigured and will fail closed if `prod` profile is used without a provider.
   - **Model accuracy:** 94-class PlantVillage/combined crop dataset predictions are AI-assisted decision support only, not a guaranteed agronomic diagnosis.
