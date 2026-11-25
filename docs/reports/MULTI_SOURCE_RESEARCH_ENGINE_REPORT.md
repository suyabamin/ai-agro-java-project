# AgroAI M1 — Multi-Source Agricultural Research Intelligence Engine Report

**Date:** 2026-11-26  
**Milestone:** M1 — Multi-Source Agricultural Research Intelligence Engine  
**Scope:** Extension of the Disease Research & Treatment Fetcher across Python FastAPI (`ai-service`), Spring Boot (`backend`), Firestore persistence, and React (`frontend`).

---

## 1. Final Architecture
- **Disease Detection vs. Disease Research Separation:** TFLite disease inference (`POST /api/v1/inference/disease`) and multi-source disease research (`POST /api/v1/research/disease`) remain completely decoupled lifecycles. Research provider failures or rate limits never invalidate a `COMPLETED` disease prediction.
- **Central Research Orchestrator (`ai-service/app/services/disease_research_service.py`):**
  - Executes two bounded-concurrency tracks in parallel (`ThreadPoolExecutor`, `max_workers` capped at `4`):
    1. **Web Search Track:** Selenium Google Search (`google_selenium`) → automatic Tavily fallback (`tavily`) when Google returns CAPTCHA/rate-block, timeout, or zero results.
    2. **Scholarly Track:** OpenAlex (`openalex`) + Semantic Scholar (`semantic_scholar`) in parallel, followed by Crossref (`crossref`) DOI metadata verification and enrichment on up to 4 unique DOIs.
  - Attaches attributed Bangladesh official portal references (`bangladesh_agri_official`) without scraping.
  - Deduplicates papers by canonical DOI (first) or normalized title, ranks evidence transparently, computes `evidenceQuality`, and builds a structured Bengali (`bn`) farmer-friendly report grounded only in retrieved sources.
  - Includes a short-lived in-memory TTL cache (`RESEARCH_CACHE_TTL_SEC`, default `300s`, max `64` entries) for `COMPLETED` responses.

---

## 2. Provider Responsibilities & Status
| Provider | File | Role | Auth / Config | Live Status |
|---|---|---|---|---|
| **Selenium Google Search** | `disease_research_service.py` | Primary web search with `/sorry/` CAPTCHA detection | Headless Chrome, `Semaphore(1)` | Blocked by Google `/sorry/index` CAPTCHA (`GOOGLE_CAPTCHA_BLOCKED`) |
| **Tavily Search API** | `tavily_search_provider.py` | Automatic web fallback when Google blocks/fails | `TAVILY_API_KEY` (backend `.env` only) | **LIVE PASS** (`200 OK`, real agricultural sources) |
| **OpenAlex API** | `providers/openalex_provider.py` | Scholarly works, inverted-index abstract reconstruction, OA/citation metadata | Optional `OPENALEX_EMAIL` (`mailto` polite pool) | **LIVE PASS** (`3` works returned with DOIs & abstracts) |
| **Crossref REST API** | `providers/crossref_provider.py` | DOI metadata verification (`VERIFIED_MATCH` / `METADATA_MISMATCH` / `DOI_NOT_FOUND`) & journal/author/year enrichment | No mandatory key; polite `User-Agent` | **LIVE PASS** (`VERIFIED_MATCH` on real OpenAlex DOI `10.5897/ajmr2017.8564`) |
| **Semantic Scholar API** | `providers/semantic_scholar_provider.py` | Paper search, abstract, DOI, venue, citation metadata | Optional `SEMANTIC_SCHOLAR_API_KEY` (`x-api-key`) | **LIVE RATE-LIMITED (`429`)** without API key; handled gracefully & unit-tested |
| **BAMIS / BD Official** | `providers/bangladesh_agri_provider.py` | Official Bangladesh agricultural portal attribution (`BAMIS`, `DAE`, `BARI`, `BRRI`) | None (no scraping) | `bamisApiAvailable: false` (`PORTAL_ONLY_NO_PUBLIC_API`) |

---

## 3. BAMIS Investigation Findings (Honest Audit)
- Probed `https://www.bamis.gov.bd/robots.txt`, `https://www.bamis.gov.bd/`, and `https://www.bamis.gov.bd/api/` via polite HTTP `GET`.
- **Observed Result:** All three endpoints returned `200 text/html` (the Bengali web portal HTML — `বাংলাদেশ কৃষি আবহাওয়া তথ্য সেবা (বামিস)`), **not** a structured JSON REST API or machine-readable `robots.txt`.
- **Implementation Decision:** No unauthorized scraping or HTML bypass was performed. `BangladeshAgriProvider` reports `bamisApiAvailable: false`, `scrapingPerformed: false`, and includes attributed official portal references (`bamis.gov.bd`, `dae.gov.bd`, `bari.gov.bd`, `brri.gov.bd`) without claiming empirical disease-specific proof.

---

## 4. Configuration & Environment Variables (Backend Only)
Added placeholders to `.env.example` and `ai-service/.env.example` (never committed to `.env` or exposed to Vite/React):
- `TAVILY_API_KEY` — Tavily Search API key
- `OPENALEX_EMAIL` — Optional polite-pool contact email for OpenAlex & Crossref `User-Agent`
- `SEMANTIC_SCHOLAR_API_KEY` — Optional Semantic Scholar `x-api-key` for dedicated rate limits
- `AGROAI_RESEARCH_PROVIDER_TIMEOUT_SEC` (default `12.0`)
- `AGROAI_RESEARCH_MAX_RESULTS_PER_PROVIDER` (default `5`)
- `AGROAI_RESEARCH_MAX_WORKERS` (default `4`)
- `AGROAI_RESEARCH_CACHE_TTL_SEC` (default `300`)

---

## 5. Source Validation & Evidence Ranking Rules
The system explicitly separates four verification stages on `ResearchPaper` (never collapsed into a single boolean):
1. `searchResultRetrieved` — API returned a candidate record.
2. `metadataValidated` — Required bibliographic fields + Crossref DOI check passed (`VERIFIED_MATCH`).
3. `sourceIdentityVerified` — Official/academic domain or recognized publisher.
4. `scientificEvidenceAssessed` — Remains `false` unless explicitly assessed; citation counts and API matches are **never** treated as proof of treatment efficacy.

`evidenceQuality` is computed as `HIGH`, `MODERATE`, `LIMITED`, or `INSUFFICIENT`. Portal-only links (`bangladesh_agri_official`) are never counted as empirical evidence on their own.

---

## 6. Data Contract & Persistence
- **FastAPI (`ai-service/app/schemas/research.py`):** Preserves all existing fields (`analysisId`, `researchStatus`, `bengaliReport`, `sources`, `searchProvidersAttempted`, `successfulProvider`, `fallbackUsed`, `fallbackReason`) and adds `providersAttempted`, `successfulProviders`, `failedProviders`, `providerFailureReasons`, `duplicateCount`, `researchPapers`, `sourceReferences`, `evidenceQuality`, `bamisStatus`, `retrievalTimestamp`.
- **Spring Boot (`DiseaseResearchService.java`):** Persists all M1 fields onto `disease_research_reports` and syncs the `researchReport` snapshot onto `ai_analysis_results/{analysisId}` while preserving existing retry limits (`max 3`), duplicate `PENDING`/`PROCESSING` guard, and Farmer/Owner authorization.
- **React UI (`DiseaseDetectionCard.tsx`):** Displays multi-provider badges, `evidenceQuality`, partial-failure notice, `Scholarly Research Papers` list with DOI & `doiVerificationStatus`, Bengali guidance sections, and verified source links.

---

## 7. Verification Evidence

### Automated Tests (PASS)
- **Python (`pytest -q`):** `47 passed` (`test_multi_source_research.py`, `test_disease_research.py`, `test_disease_detection.py`, `test_inference.py`, `test_health.py`), covering OpenAlex, Crossref match/mismatch/404, Semantic Scholar, 429/timeout/malformed JSON, deduplication, ranking, partial failure, BAMIS non-scraping, and Selenium/Tavily regressions.
- **Spring Boot (`mvnw.cmd test`):** `36 passed, 0 failures, 0 errors, 0 skipped` (`AgriculturalAnalysisServiceTest`, `DiseaseAnalysisServiceTest`, `DiseaseResearchServiceTest`, `MonitoringAuthorizationServiceTest`, `MonitoringStorageConfigurationTest`, `GcsImageStorageTest`).
- **Frontend (`npm test && npm run build`):** `112 passed` across `14` files; `vite build` `0` errors (`1.34s`).

### Live Provider Verification (Real Network Calls, Zero Mocking)
- **OpenAlex:** `OK` (`3` works returned for `Tomato Early Blight Alternaria solani management`, e.g. `doi: 10.5897/ajmr2017.8564`).
- **Crossref:** `OK` (`VERIFIED_MATCH` for `10.5897/ajmr2017.8564`, enriched journal `African Journal of Microbiology Research`).
- **Semantic Scholar:** `RATE_LIMITED (HTTP 429)` on unauthenticated shared pool; handled gracefully with `Retry-After` and reported in `failedProviders`.
- **Tavily:** `OK` (`200`, returned real agricultural extension/research results).
- **Google Selenium:** `BLOCKED` (`GOOGLE_CAPTCHA_BLOCKED`), automatically fell back to Tavily without bypassing CAPTCHA.
- **Unified Orchestrator:** `COMPLETED`, `evidenceQuality=HIGH`, `researchPapers=4`, `sources=6`, `bamisApiAvailable=false`.
- **Live Browser E2E:** `NOT TESTED` in this milestone run (requires interactive Firebase Farmer/Owner sign-in on `localhost:5173`).

---

## 8. Files Changed
- `.env.example`, `ai-service/.env.example`
- `ai-service/app/core/config.py`
- `ai-service/app/schemas/research.py`
- `ai-service/app/services/providers/__init__.py`
- `ai-service/app/services/providers/base.py`
- `ai-service/app/services/providers/openalex_provider.py`
- `ai-service/app/services/providers/crossref_provider.py`
- `ai-service/app/services/providers/semantic_scholar_provider.py`
- `ai-service/app/services/providers/bangladesh_agri_provider.py`
- `ai-service/app/services/disease_research_service.py`
- `ai-service/tests/test_disease_research.py`
- `ai-service/tests/test_multi_source_research.py`
- `backend/src/main/java/com/agroai/service/DiseaseResearchService.java`
- `backend/src/test/java/com/agroai/service/DiseaseResearchServiceTest.java`
- `frontend/src/components/monitoring/DiseaseDetectionCard.tsx`
- `docs/reports/MULTI_SOURCE_RESEARCH_ENGINE_REPORT.md`
