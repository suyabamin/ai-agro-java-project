# Master Integration Audit

Date: 2026-11-18.

| Capability | Frontend | Backend | AI/Data/Security | Current proof and gap |
|---|---|---|---|---|
| Authentication/profile | Firebase client auth UI; DEV-only mock auth; API client token attach | Firebase token verifier/profile domain | Firestore users and Rules | Frontend/backend tests; Rules emulator. Real Firebase Auth/token verification and Admin persistence NOT TESTED. |
| Farms/fields/marketplace | React flows and API services | Spring domain/controller services | Firestore repositories/Rules | Maven and frontend suites. No per-milestone test counts. |
| Assignment/farmer workspace | Assignment and workspace UI | Assignment services and contextual auth | Assignment documents, locks/history, Rules | Local suites; M5 technical findings remain open (live transactions, recovery/races, scale, repeat tenure and TASKS follow-ups). |
| Field monitoring | Upload/telemetry/analysis/irrigation/history UI | Spring monitoring API/services | FastAPI model-unavailable; Rules deny direct monitoring client access | Mock UI E2E + unit/API tests + emulator. Complete real authenticated lifecycle NOT TESTED. |
| Disease inference | Status/results UI | Authenticated AI proxy | FastAPI validates/preprocesses; returns MODEL_UNAVAILABLE without supplied model | Python suite and local benchmark; no real model/inference/evaluation. |
| Image storage | Upload UI | `ImageStorage` abstraction, private local dev/test adapter | No selected production provider | Source/config audit, local storage tests. Production storage NOT TESTED. |

The browser E2E with mock identity and intercepted fixtures demonstrates UI workflows only; it is not Firebase or full-stack integration. Live integration requires owner-confirmed isolated project, disposable pre-provisioned identity, local Web settings, safe credential location, and reviewed allowed operations. No live Firebase activity occurred.
