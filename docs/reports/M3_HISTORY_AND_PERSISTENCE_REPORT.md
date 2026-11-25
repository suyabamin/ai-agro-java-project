# AgroAI M3 — History & Persistence Report

**Date:** 2026-11-26  
**Scope:** Unified Field History Explorer & Firestore/Backend Persistence Consistency

---

## 1. Unified Historical Records Architecture
- **Reused Existing Collections (No Redundant Collections Added):**
  - `disease_research_reports` (research & advisory attempts)
  - `ai_analysis_results` (tabular `AGRICULTURAL_EVIDENCE_SUMMARY` + `DISEASE_DETECTION` + `researchReport` snapshot)
  - `soil_telemetry` (sensor/manual readings)
  - `irrigation_plans` (irrigation recommendations)
  - `monitoring_activities` (audit trail)
- **New Paginated Field Research History Endpoint:**
  - `DiseaseResearchService.listForField(farmId, fieldId, uid, cursor, size)`
  - `GET /api/v1/farms/{farmId}/fields/{fieldId}/monitoring/research`
  - Uses `CursorPagination.validatePageSize(size)` and `MonitoringAuthorizationService.requireReadAccess`.
- **Frontend Explorer (`FieldHistoryTabs.tsx`):**
  - Integrated into both `FarmerFieldDetailsPage.tsx` and `FieldDetailsPage.tsx`.
  - Five chronological tabs: `Research & Advisory`, `Disease Detections`, `Telemetry`, `Agronomic Analyses`, `Irrigation Plans`.
  - Supports status filtering (`ALL`, `COMPLETED`, `VALID`, `BLOCKED`, `FAILED`, `INSUFFICIENT_EVIDENCE`), `Latest` badge on newest record, cursor pagination (`Load More History`), and safe handling of legacy/missing fields.

---

## 2. Backward Compatibility & Schema Notes
- Existing `disease_research_reports` and `ai_analysis_results` documents without M1/M2/M3 fields remain readable via `getOrDefault(...)` in Spring Boot and optional/null-safe rendering in React.
- Historical records are preserved append-only; retries on `disease_research_reports` increment `attemptNumber` (bounded at 3) and duplicate `PENDING`/`PROCESSING` requests are prevented.
