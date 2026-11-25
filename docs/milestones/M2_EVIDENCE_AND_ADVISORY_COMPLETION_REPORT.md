# AgroAI M2 — Evidence Validation & Advisory Completion Report

**Date:** 2026-11-26  
**Milestone:** M2 — Evidence Validation and Agricultural Advisory  
**Baseline Commits:** `bd0ed00`, `84de0ac`

---

## 1. Four-Stage Independent Validation
Every `ResearchPaper` keeps four flags independent (never collapsed):
1. `searchResultRetrieved`
2. `metadataValidated` (Crossref match + bibliographic completeness)
3. `sourceIdentityVerified` (official/academic domain or publisher)
4. `scientificEvidenceAssessed` (`false` unless explicitly assessed)

`evidenceQuality` (`HIGH`, `MODERATE`, `LIMITED`, `INSUFFICIENT`) is computed independently from `confidenceBand` (`HIGH`, `MODERATE`, `LOW`, `UNKNOWN`). Portal-only links (`bangladesh_agri_official`) and failed providers never inflate `evidenceQuality`.

---

## 2. Claim-Level Citations & Safety
- `advisory_synthesizer.py` uses `_eligible_evidence_candidates` (requires `abstract >= 25` chars; excludes `bangladesh_agri_official` portal-only entries) and `_match_citations_for_claim` (whole-word `\b...\b` regex per step).
- Unsupported steps receive `citationIds=[]`. Zero pesticide brands, chemical dosages, or spray schedules are generated.
- All four advisory statuses (`READY`, `LOW_CONFIDENCE_CAUTION`, `INSUFFICIENT_EVIDENCE`, `HEALTHY_MONITORING`) and telemetry-aware cache re-synthesis (`R1_ESC=False -> R2_ESC=True` on `2.79 ms` cache hit) are verified.
