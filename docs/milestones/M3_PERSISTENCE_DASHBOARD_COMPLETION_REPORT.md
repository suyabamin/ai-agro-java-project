# AgroAI M3 — Persistence, Dashboards & History Completion Report

**Date:** 2026-11-26  
**Milestone:** M3 — Persistence, Dashboards and History  
**Baseline Commits:** `956f9c0`, `dc6419d`

---

## 1. Backend Persistence & Indexes
- `DiseaseResearchService.java` persists full M1/M2/M3 metadata (`providerStatuses`, `researchPapers`, `sourceReferences`, `evidenceQuality`, `advisory`, `bamisStatus`) onto `disease_research_reports` and `ai_analysis_results/{analysisId}.researchReport`.
- `DiseaseResearchService.listForField` (`GET .../monitoring/research`) supports server-side `status` filtering before cursor pagination.
- `FirestoreFieldMonitoringRepository.firestorePage` validates cursor ownership (`farmId`, `fieldId`) and active filter match.
- `firestore.indexes.json` includes both `disease_research_reports` composite indexes (`VALID_JSON=True, TOTAL_INDEXES=18, DISEASE_RESEARCH_INDEXES=2`).

---

## 2. Farmer/Owner Dashboards, History & Bengali Renderer
- `UnifiedFieldIntelligencePanel.tsx` and `FieldHistoryTabs.tsx` are integrated into both `FarmerFieldDetailsPage.tsx` and `FieldDetailsPage.tsx`, backed by `GET .../monitoring/intelligence` and `GET .../monitoring/research`.
- `FieldHistoryTabs.tsx` displays `Latest` on `idx === 0 && statusFilter === 'ALL'`, resets cursor on filter/tab change, guards against rapid-switch races, and labels client-filtered tabs honestly (`Filtered loaded pages (N)`).
- `bengali_evidence_renderer.py` enforces per-sentence negation/ambiguity fallback (`[ইংরেজি প্রমাণ / Evidence EN]`) while preserving scientific names, numbers, units, and `[মূল উৎস (EN): ...]`.
