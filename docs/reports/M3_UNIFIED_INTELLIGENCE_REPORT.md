# AgroAI M3 — Unified Intelligence & Dashboard Report

**Date:** 2026-11-26  
**Milestone:** M3 — Unified Dashboard, History & Production-Grade Verification  
**Preserved Prior Commits:** `e158948`, `a8816b9`, `bd0ed00`, `84de0ac`

---

## 1. Unified Intelligence Architecture
- **Backend Aggregation Endpoint (`GET /api/v1/farms/{farmId}/fields/{fieldId}/monitoring/intelligence`):**
  - Implemented in `FieldMonitoringController.getFieldIntelligence(...)` and `AgriculturalAnalysisService.getFieldIntelligence(...)`.
  - Enforces `MonitoringAuthorizationService.requireReadAccess(farmId, fieldId, uid)`.
  - Returns a unified 4-part field snapshot without creating duplicate analyses:
    1. **Field Overview & Telemetry (`latestTelemetry`, `hasStaleTelemetry`):** Latest readings for `SOIL_MOISTURE`, `HUMIDITY`, `TEMPERATURE`, `PH`, `N`, `P`, `K`, and `RAINFALL` with `observedAt` timestamps and `isStale` flag (`true` when older than 24 hours).
    2. **Disease Intelligence (`latestDiseaseAnalysis`, `diseaseAvailability`, `advisory`):** Latest `DISEASE_DETECTION` result, live TFLite engine availability (fail-closed if unreachable), research status, evidence quality, and M2 advisory.
    3. **Irrigation & Agronomic Intelligence (`latestAgriculturalAnalysis`, `latestIrrigationPlan`):** Latest tabular Water Need / Field Status / Recommended Crop and latest irrigation plan rationale/status.
    4. **Intelligence Summary (`intelligenceSummary`):** Rule-based summary strictly from persisted records; never fabricates missing telemetry or predictions.
- **Frontend Unified Component (`UnifiedFieldIntelligencePanel.tsx`):**
  - Integrated into both Farmer (`FarmerFieldDetailsPage.tsx`) and Owner (`FieldDetailsPage.tsx`) field views.
  - Displays loading, empty, error, partial-data, and `STALE TELEMETRY (>24h)` states without duplicating the full `DiseaseDetectionCard` details.

---

## 2. Bengali Evidence-Based Advisory Improvement
- Implemented `ai-service/app/services/bengali_evidence_renderer.py` (`render_evidence_sentence_bn`) and wired it into `advisory_synthesizer.py`:
  - Renders matched evidence sentences into deterministic Bengali agricultural glosses (`symptomsBn`, `causesBn`, `spreadBn`, `managementBn`), preserving scientific names (e.g., `Alternaria solani`, `Trichoderma harzianum`) in English inside parentheses.
  - Appends `[মূল উৎস (EN): ...]` for full traceability.
  - When no deterministic gloss matches, preserves the original English sentence with `[ইংরেজি প্রমাণ / Evidence EN]` rather than generating misleading Bengali.
  - Preserves all M2 claim-level `citationIds` and never invents pesticide brands, dosages, or spray schedules.
