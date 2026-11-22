# AgroAI — Performance & UX Freeze Root Cause Audit

**Date:** 2026-11-22  
**Component:** Frontend (`frontend/`), Backend (`backend/`), AI Service (`ai-service/`)  
**Status:** Audit Completed — Remediation Planned  

---

## 1. Executive Summary

A comprehensive performance and usability investigation across AgroAI revealed the root causes of the severe browser freeze during "Upload Agricultural Field Data", overall sluggishness, monolithic bundle size, and absent route transition feedback.

The performance issues stem from four architectural bottlenecks:
1. **Sequential Telemetry Network Waterfall:** In `FarmerFieldDetailsPage.tsx`, submitting field data triggers **8 sequential HTTP `POST` requests in a `for` loop**, followed by a synchronous AI analysis creation request and two subsequent reload requests — resulting in an **11-request network storm** taking 5–15+ seconds during which the UI is completely blocked.
2. **Synchronous AI Inference in HTTP Request Thread:** `AgriculturalAnalysisService.create(...)` executes tabular model inference (`AiInferenceClient.inferTabular`) synchronously inside the incoming HTTP thread, keeping the client connection waiting rather than transitioning through an asynchronous `PENDING -> PROCESSING -> COMPLETED / FAILED` lifecycle.
3. **Monolithic 1.42 MB Frontend Bundle:** `frontend/src/App.tsx` statically imports all 50+ application pages, resulting in a single minified JavaScript bundle of **1,419.88 kB (356.17 kB gzip)** with zero route-level code splitting.
4. **Lack of Route Transition & Async Polling UX:** The application lacks a global route transition progress indicator, lazy route `<Suspense>` fallbacks, and non-blocking asynchronous analysis polling, leaving users stranded on blank screens or unresponsive states during navigation and data submission.

---

## 2. Root Cause Analysis

### 2.1 "Upload Agricultural Field Data" Browser Freeze
- **File:** `frontend/src/pages/FarmerFieldDetailsPage.tsx` (`handleSubmitData`, lines 173–239)
- **Mechanism:**
  ```typescript
  for (const item of itemsToSubmit) {
    await monitoringService.submitTelemetry(targetFarmId, targetFieldId, { ... });
  }
  const analysisRes = await monitoringService.createAnalysis(targetFarmId, targetFieldId);
  const [telRes, analRes] = await Promise.allSettled([ ... ]);
  ```
- **Bottlenecks:**
  1. **8 Sequential Roundtrips:** Nitrogen, Phosphorus, Potassium, Air Temperature, Relative Humidity, Soil pH, Rainfall, and Soil Moisture are submitted sequentially. Each roundtrip undergoes Firebase token authentication, Spring Security filter chains, authorization validation, and Cloud Firestore document creation.
  2. **Synchronous AI Wait:** The 9th call invokes `POST /agricultural-analyses`. The backend queries telemetry from Firestore, formats features, and synchronously calls the FastAPI Python AI service over HTTP (`POST /infer-tabular`).
  3. **No Batch Telemetry Endpoint:** `SoilTelemetryService` and `FieldMonitoringController` only exposed single-item `POST /telemetry`, forcing the frontend to loop.
  4. **UI Thread Impact:** Although JavaScript `await` does not block the OS thread, the button enters a prolonged `submittingData = true` state with no progress indicator, no cancellation mechanism, and no ability for the user to navigate away without losing context. If an error occurs on item 5, items 1–4 are committed while items 5–8 fail, leaving the system in an inconsistent state.

### 2.2 Backend Asynchronous AI Decoupling Architecture
- **File:** `backend/src/main/java/com/agroai/service/AgriculturalAnalysisService.java`
- **Bottlenecks:**
  1. `create(farmId, fieldId, uid)` performs immediate synchronous inference and directly writes status `COMPLETED` or `FAILED`.
  2. No `GET /agricultural-analyses/{analysisId}` or `GET /agricultural-analyses` endpoint exists in `FieldMonitoringController.java`. The frontend was forced to query `/disease-analyses` (which only returns image disease detection records or unstructured queries).
  3. Lack of an asynchronous state machine (`PENDING -> PROCESSING -> COMPLETED / FAILED`) prevents the client from receiving an instant response (<50ms) and polling progress in the background.

### 2.3 Monolithic Frontend Bundle & Un-split Routes
- **File:** `frontend/src/App.tsx`, `frontend/vite.config.ts`
- **Bottlenecks:**
  1. Static imports of 50+ route components in `App.tsx` bundle all owner, farmer, and public logic into `dist/assets/index-BgvcGWH7.js` (**1,419.88 kB**).
  2. A farmer visiting `/farmer/fields/:fieldId` is forced to download all owner payment ledgers, job management, review moderation, and landing page code upfront.
  3. Vite emits: `(!) Some chunks are larger than 500 kB after minification.`

### 2.4 Missing Route Transition & Component Loading Feedback
- **Bottlenecks:**
  1. Navigation between routes has zero visual feedback (no top progress bar, no skeleton screens).
  2. High latency or lazy imports cause the screen to appear completely frozen or stuck.
  3. No support for `prefers-reduced-motion` in CSS transitions.

---

## 3. Remediation Strategy & Implementation Plan

| Area | Solution |
|------|----------|
| **Telemetry Batching** | Add `POST /telemetry/batch` in `FieldMonitoringController` and `SoilTelemetryService.submitBatch`. Frontend submits all 8 readings in 1 atomic roundtrip. |
| **Async AI Lifecycle** | Refactor `AgriculturalAnalysisService` and controller to support instant analysis creation (`PENDING`), background processing (`PROCESSING -> COMPLETED/FAILED`), and expose `GET /agricultural-analyses/{analysisId}`. |
| **Non-Blocking UI** | In `FarmerFieldDetailsPage.tsx`, submit batch telemetry (<150ms), initiate async analysis, display live processing banner, and poll status non-blockingly with `AbortController` / unmount cleanup. |
| **Route Code Splitting** | Convert all 50+ static page imports in `App.tsx` to `React.lazy()` wrapped in `<Suspense fallback={<PageSkeletonLoader />}>`. |
| **Vite Bundle Optimization** | Configure manual chunking in `frontend/vite.config.ts` (`vendor-react`, `vendor-firebase`, `vendor-ui`) to reduce all chunks below 500 kB. |
| **Accessible Loading Feedback** | Add `TopProgressBar` component and comprehensive skeleton loaders respecting `prefers-reduced-motion`. |
| **Automated Testing** | Add unit and integration tests across backend and frontend verifying batch submission, async analysis polling, and fallback states. |
