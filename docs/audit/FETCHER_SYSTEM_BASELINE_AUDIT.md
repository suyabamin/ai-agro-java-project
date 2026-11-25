# AgroAI — Fetcher System Baseline Audit (Phase 0)

**Date:** 2026-11-26  
**HEAD at Audit Start:** `dc6419d` (`fix m3 audit findings`)  
**Preserved Milestone Commits:** `e158948` (M1), `a8816b9` (M1 audit), `bd0ed00` (M2), `84de0ac` (M2 citation remediation), `956f9c0` (M3), `dc6419d` (M3 audit remediation)

---

## 1. Existing Implementation Inventory
- **Python FastAPI (`ai-service/`):**
  - `app/api/v1/endpoints/research.py` (`POST /api/v1/research/disease`, protected by `X-AI-Service-Key`)
  - `app/services/disease_research_service.py` (Central Research Orchestrator, TTL cache, Selenium Google Search, deduplication, ranking, evidence quality)
  - `app/services/providers/openalex_provider.py` (`OpenAlexProvider`)
  - `app/services/providers/crossref_provider.py` (`CrossrefProvider`)
  - `app/services/providers/semantic_scholar_provider.py` (`SemanticScholarProvider`)
  - `app/services/providers/bangladesh_agri_provider.py` (`BangladeshAgriProvider` — BAMIS/DAE/BARI/BRRI official portal attribution, no scraping)
  - `app/services/tavily_search_provider.py` (`TavilySearchProvider`)
  - `app/services/advisory_synthesizer.py` & `app/services/bengali_evidence_renderer.py` (claim-level citation matching, negation-aware Bengali evidence rendering, telemetry-aware `AdvisoryPayload`)
- **Spring Boot (`backend/`):**
  - `DiseaseResearchService.java` (async worker, bounded max 3 retries, `telemetryContext` enrichment, dual persistence to `disease_research_reports` and `ai_analysis_results/{analysisId}.researchReport`, paginated `listForField` with server-side `status` filter)
  - `AgriculturalAnalysisService.java` (`getFieldIntelligence` unified 4-part field snapshot)
  - `FieldMonitoringController.java` (`POST .../research`, `GET .../disease-analyses/{analysisId}/research`, `GET .../research`, `GET .../intelligence`)
  - `FirestoreFieldMonitoringRepository.java` & `firestore.indexes.json`
- **React (`frontend/`):**
  - `DiseaseDetectionCard.tsx` (research status, provider badges, papers + DOI status, Bengali report, advisory)
  - `UnifiedFieldIntelligencePanel.tsx` & `FieldHistoryTabs.tsx` (integrated into `FarmerFieldDetailsPage.tsx` and `FieldDetailsPage.tsx`)

---

## 2. Data-Flow Architecture
```text
React (Farmer/Owner)
  └─▶ Spring Boot (FieldMonitoringController + MonitoringAuthorizationService)
        ├─▶ DiseaseResearchService (Async Worker, max 3 retries, telemetryContext)
        │     └─▶ FastAPI POST /api/v1/research/disease (X-AI-Service-Key)
        │           ├─ Track 1: Selenium Google Search ─(CAPTCHA/fail)─▶ Tavily API
        │           ├─ Track 2: OpenAlex + Semantic Scholar ─▶ Crossref DOI verify
        │           ├─ Track 3: BangladeshAgriProvider (BAMIS/DAE/BARI/BRRI attribution)
        │           └─ Synthesis: Claim-level citations + Bengali renderer + AdvisoryPayload
        └─▶ Firestore (disease_research_reports + ai_analysis_results.researchReport)
```

---

## 3. Baseline Gaps Identified for Master Execution
1. **Canonical Provider Status Enum (Master §4.4):** `DiseaseResearchResponse` tracks `successfulProviders`, `failedProviders`, and `providerFailureReasons`, but lacks an explicit `providerStatuses` map using canonical states (`SUCCESS`, `PARTIAL`, `RATE_LIMITED`, `UNAVAILABLE`, `BLOCKED`, `TIMEOUT`, `NO_RESULTS`, `FAILED`).
2. **Firestore Security Rules Explicit Deny (`firestore.rules`):** `disease_research_reports` should be explicitly listed alongside `ai_analysis_results` (`allow read, write: if false;`) for clarity and defense-in-depth.
3. **Live Verification & Performance Evidence:** Run live API benchmarks (provider latency, cache hit vs miss latency), verify whether live Firestore is reachable via `secrets/firebase-service-account.json`, and produce the formal M1–M6 completion, security, regression, and final acceptance reports.
