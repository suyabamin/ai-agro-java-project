# AgroAI — Selenium-Based Disease Research & Treatment Fetcher Report

**Date:** 2026-11-25  
**Scope:** Implementation and verification of the Python Selenium Google Search Disease Research & Bengali Treatment Fetcher, decoupled async Spring Boot worker, Firestore persistence, and Farmer/Owner UI.

---

## 1. Environment & Version Verification
- **Selenium Version:** `4.54.0` (`ai-service/requirements.txt`: `selenium>=4.25,<5`)
- **Browser:** Google Chrome `158.0.8127.37` (`C:\Program Files\Google\Chrome\Application\chrome.exe`)
- **WebDriver Mode:** Headless (`--headless=new`, `--no-sandbox`, `--disable-dev-shm-usage`, `--disable-gpu`), bounded `15s` page-load timeout, explicit `WebDriverWait`, single concurrent browser session (`threading.Semaphore(1)`), guaranteed `driver.quit()` in `finally`, no exposed debugging ports, no stealth/proxy rotation.

---

## 2. Live Google Search Probe Result (Honest Observation)
- **Probe Executed:** Headless Chrome via Selenium WebDriver navigated to `https://www.google.com/search?q=Tomato+Early+Blight+management+FAO+CABI+BARI&hl=en`.
- **Actual Result:** Google redirected to `https://www.google.com/sorry/index?continue=...` (`BLOCKED_OR_CAPTCHA: True`, `H3_COUNT: 0`).
- **Compliance & Fail-Closed Handling:**
  - Per policy, CAPTCHA was **NOT** bypassed.
  - `disease_research_service.py` detects `/sorry/` / `unusual traffic` / `recaptcha` / `captcha-form`, stops immediately, and returns `researchStatus: "BLOCKED"`, `errorCode: "GOOGLE_CAPTCHA_BLOCKED"`, `sources: []`, `bengaliReport: null`.
  - **Zero results were fabricated.**
  - **Actual sources collected in live probe:** `0` (blocked by Google CAPTCHA).
  - **Source extraction:** Skipped when blocked (`robots.txt` check via `urllib.robotparser` + `<p>`/`<article>` extraction implemented and unit-tested for permitted non-blocked runs).

---

## 3. Architecture & Separation from Disease Inference
- **FastAPI (`ai-service/app/services/disease_research_service.py`, `app/api/v1/endpoints/research.py`, `app/schemas/research.py`):**
  - Endpoint `POST /api/v1/research/disease` protected by `X-AI-Service-Key`.
  - Separate from `POST /api/v1/inference/disease`.
  - Healthy classes (`Tomato_healthy`, `Rice_normal`, etc.) skip Google Search and return `researchStatus: "SKIPPED_HEALTHY"` with a Bengali healthy-maintenance note.
  - Low-confidence predictions (`< 60%`) include a Bengali low-confidence verification warning (`lowConfidenceWarning: true`).
  - Never invents pesticide doses, chemical brands, or application schedules.
- **Spring Boot (`backend/src/main/java/com/agroai/service/DiseaseResearchService.java`, `FieldMonitoringController.java`, `DiseaseAnalysisService.java`):**
  - Asynchronous background worker (`Executors.newFixedThreadPool(2)`) triggered automatically after `COMPLETED` disease inference or manually via `POST /api/v1/farms/{farmId}/fields/{fieldId}/monitoring/disease-analyses/{analysisId}/research`.
  - Bounded retry limit (`max 3` attempts per `analysisId`), duplicate `PENDING`/`PROCESSING` guard.
  - Persists full research attempts in `disease_research_reports` (`FirestoreFieldMonitoringRepository`) and syncs `researchStatus`, `latestResearchId`, and `researchReport` snapshot onto `ai_analysis_results/{analysisId}` **without altering `status: "COMPLETED"`**.
  - History endpoint: `GET /api/v1/farms/{farmId}/fields/{fieldId}/monitoring/disease-analyses/{analysisId}/research` (enforcing `MonitoringAuthorizationService.requireReadAccess`).
- **React UI (`DiseaseDetectionCard.tsx`, `FarmerFieldDetailsPage.tsx`, `FieldDetailsPage.tsx`):**
  - Displays `researchStatus` badge, spinner when `PENDING`/`PROCESSING`, honest `BLOCKED`/`FAILED` notice + Retry button, structured Bengali guidance (`সারসংক্ষেপ`, `লক্ষণ ও তথ্য`, `ব্যবস্থাপনা`, `প্রতিরোধ`, `সতর্কতা`), low-confidence warning, verified source links, and attempt count.
  - Polls only while `researchStatus` is `PENDING` or `PROCESSING`, and stops on terminal states.

---

## 4. Test Results
- **Python AI Service (`pytest`):** **37 passed** (`test_disease_research.py`, `test_disease_detection.py`, `test_inference.py`, `test_health.py`, `test_tabular.py`), covering healthy skip, CAPTCHA `BLOCKED` fail-closed, low-confidence Bengali warning, domain tiering (`dae.gov.bd`, `bari.gov.bd`, `irri.org`), `X-AI-Service-Key` auth, and mocked Selenium extraction.
- **Spring Boot Backend (`mvnw.cmd test`):** **31 passed, 0 failures, 0 errors** (`DiseaseResearchServiceTest`, `DiseaseAnalysisServiceTest`, `AgriculturalAnalysisServiceTest`, `FieldMonitoringControllerIntegrationTest`), verifying Firestore persistence, `BLOCKED` isolation from `COMPLETED` disease status, and bounded retry limits.
- **Frontend Unit Tests & Build (`vitest` / `vite build`):** **112 passed** across `14` files; production build **PASS** (`0` errors, `744ms`).

---

## 5. Local Git Commits (Unpushed)
- `d42499f` — `add selenium disease research fetcher and bengali report api`
- `9e196f6` — `add async disease research worker and persistence`
- `32ab9cd` — `show disease research status and bengali report in ui`

---

## 6. Tavily Search API Fallback Implementation
- **Provider (`ai-service/app/services/tavily_search_provider.py`):**
  - Reads `TAVILY_API_KEY` exclusively from backend environment (`ai-service/.env` / `Settings.TAVILY_API_KEY`) with bounded timeout (`AGROAI_TAVILY_TIMEOUT_SEC`, default `15.0s`).
  - Never hardcodes credentials, never logs or exposes the key in exceptions or API responses, and never exposes it to Vite/React.
  - `.env` and `.env.*` remain gitignored; `.env.example` and `ai-service/.env.example` document `TAVILY_API_KEY=your_tavily_api_key_here`.
- **Fallback Orchestration (`ai-service/app/services/disease_research_service.py`):**
  - Always attempts `google_selenium` first.
  - When Selenium returns `BLOCKED`, `FAILED`, timeout, or zero usable results, automatically falls back to `tavily` (`POST https://api.tavily.com/search`).
  - Records `searchProvidersAttempted`, `successfulProvider`, `fallbackUsed`, `fallbackReason`, `sourceCount`, and `validatedSourceCount` in FastAPI response, Spring Boot `disease_research_reports`, and `ai_analysis_results.researchReport` snapshot.
  - Generates structured Bengali (`bn`) guidance covering: রোগের পরিচিতি, লক্ষণ, কারণ, রোগ ছড়ানোর উপায়, সম্ভাব্য ক্ষতি, তাৎক্ষণিক করণীয়, প্রতিরোধ, চিকিৎসা ও ব্যবস্থাপনা, কখন কৃষি কর্মকর্তার পরামর্শ প্রয়োজন, এবং তথ্যসূত্র — never inventing pesticide brands or dosages.
  - Returns `INSUFFICIENT_EVIDENCE` when neither provider yields usable sources.
- **Live Tavily Verification Status:**
  - `TAVILY_API_KEY` is **not set** in the current environment (`envVar=False`, `aiEnv=False`, `rootEnv=False`), so live Tavily API execution and live browser Tavily fallback remain **NOT TESTED** until a valid `TAVILY_API_KEY` is added to `ai-service/.env` and the FastAPI service is restarted.
  - Mocked end-to-end fallback tests (CAPTCHA -> Tavily success, 401 secret-leak guard, zero-results -> `INSUFFICIENT_EVIDENCE`, Spring Boot metadata persistence) **PASS** (`40 passed` in `ai-service`, `27 passed` in `backend`).
