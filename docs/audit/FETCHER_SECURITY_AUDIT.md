# AgroAI — Fetcher Security & Production Hardening Audit (Milestone 4)

**Date:** 2026-11-26  
**Scope:** Authentication, Authorization, Cross-Farm Isolation, Firestore Rules, Secrets, Input Validation

---

## 1. Security Controls Verified
1. **API-Level Authorization (`FieldMonitoringController.java` + `MonitoringAuthorizationService.java`):**
   - All monitoring, research, and intelligence endpoints (`POST .../research`, `GET .../disease-analyses/{analysisId}/research`, `GET .../research`, `GET .../intelligence`) enforce `requireWriteAccess` or `requireReadAccess(farmId, fieldId, uid)`.
   - `FieldMonitoringControllerIntegrationTest` (`14/14` passed) and `MonitoringAuthorizationServiceTest` (`9/9` passed) confirm assigned-farmer scoping, owner access, unauthorized user denial (`403`), and cross-farm isolation.
2. **Cursor & IDOR Protection (`FirestoreFieldMonitoringRepository.java`):**
   - `firestorePage` and `memoryPage` enforce `.whereEqualTo("farmId", farmId).whereEqualTo("fieldId", fieldId)`.
   - `afterId` cursor documents are verified to belong to the exact `(farmId, fieldId)` AND match all active `filters`; mismatched cursors throw `IllegalArgumentException`.
3. **Firestore Security Rules (`firestore.rules`):**
   - Direct client reads/writes are explicitly denied (`allow read, write: if false;`) for `field_images`, `soil_telemetry`, `ai_analysis_results`, `disease_research_reports`, `irrigation_plans`, and `field_activity`, plus default-deny catch-all.
4. **Secrets & Environment Hygiene:**
   - `TAVILY_API_KEY`, `OPENALEX_EMAIL`, `SEMANTIC_SCHOLAR_API_KEY`, and `AGROAI_AI_SERVICE_KEY` are backend-only (never exposed to Vite/React `VITE_*`, logs, exceptions, or Firestore).
   - `git grep -I -n "tvly-\|BEGIN PRIVATE KEY"` confirmed zero real secrets in tracked files; `.env` and `secrets/` are gitignored.
5. **FastAPI Service Auth (`inference.py` / `research.py`):**
   - `require_backend_key` uses constant-time `hmac.compare_digest` on `X-AI-Service-Key` and fails closed (`503` if unconfigured, `401` if invalid).
