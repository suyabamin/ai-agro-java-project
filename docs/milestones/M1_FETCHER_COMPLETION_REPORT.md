# AgroAI M1 — Fetcher Engine Completion Report

**Date:** 2026-11-26  
**Milestone:** M1 — Complete Multi-Source Fetcher Engine  
**Baseline Commits:** `e158948`, `a8816b9` + Master Hardening (`providerStatuses`)

---

## 1. Provider Capability Register
| Provider | File | Auth / Config | Live Status Observed | Capabilities & Limitations |
|---|---|---|---|---|
| **OpenAlex** | `ai-service/app/services/providers/openalex_provider.py` | Optional `OPENALEX_EMAIL` (`mailto`) | `SUCCESS` (live works, DOIs, inverted-index abstracts) | Retrieves title, authors, year, DOI, journal, OA flag, citations; reconstructs abstracts up to 900 chars. |
| **Crossref** | `ai-service/app/services/providers/crossref_provider.py` | No mandatory key | `SUCCESS` (`VERIFIED_MATCH` on live DOIs) | Validates DOI metadata (`VERIFIED_MATCH`, `METADATA_MISMATCH`, `DOI_NOT_FOUND`, `UNAVAILABLE`); enriches missing journal/authors/year. Never treated as scientific proof. |
| **Semantic Scholar** | `ai-service/app/services/providers/semantic_scholar_provider.py` | Optional `SEMANTIC_SCHOLAR_API_KEY` | `SUCCESS` in latest live run (occasional `RATE_LIMITED` 429 on shared pool) | Retrieves paper metadata, abstract, DOI, venue, citations; respects `Retry-After` & backoff. |
| **Bangladesh Agri Official (BAMIS/DAE/BARI/BRRI)** | `ai-service/app/services/providers/bangladesh_agri_provider.py` | None (no scraping) | `SUCCESS` (`official_portal_attribution`) | Verified `bamis.gov.bd` & `/api/` return `200 text/html` (no public JSON API). Provides attributed portal links without scraping; excluded from empirical evidence quality. |
| **Tavily** | `ai-service/app/services/tavily_search_provider.py` | `TAVILY_API_KEY` (backend `.env` only) | `SUCCESS` (`200 OK`, real extension sources) | Bounded timeout, validates http/https URLs, deduplicates, handles 401/402/403/429 without leaking keys. |
| **Selenium Google Search** | `ai-service/app/services/disease_research_service.py` | Headless Chrome, `Semaphore(1)` | `BLOCKED` (`GOOGLE_CAPTCHA_BLOCKED`) | Detects `/sorry/` & CAPTCHA; fails closed without bypass; triggers Tavily fallback. |

---

## 2. Orchestration & Canonical Provider Statuses
- `DiseaseResearchResponse` exposes `providerStatuses: dict[str, str]` mapping each attempted provider to canonical states: `SUCCESS`, `RATE_LIMITED`, `TIMEOUT`, `NO_RESULTS`, `BLOCKED`, `UNAVAILABLE`, `FAILED`.
- Bounded `ThreadPoolExecutor` (`max_workers <= 4`), per-provider timeouts (`12.0s` / `15.0s`), short-lived TTL cache (`300s`), and DOI/title deduplication (`duplicateCount`).
