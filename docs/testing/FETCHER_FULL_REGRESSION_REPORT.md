# AgroAI — Fetcher Full Regression & Live Verification Report (Milestone 5)

**Date:** 2026-11-26  
**Scope:** Automated Suites, Live Multi-Source APIs, Performance Measurements, Live Firestore & Browser E2E Status

---

## 1. Automated Test Suites (Executed & Observed)
| Suite | Command | Result | Duration |
|---|---|---|---|
| **Python AI Service** | `.\.venv\Scripts\python.exe -m pytest -q` | **61 passed, 1 warning** (`0` failed, `0` skipped) | `9.87s` |
| **Spring Boot Backend** | `.\mvnw.cmd test` | **303 tests run, 0 failures, 0 errors, 0 skipped** (`BUILD SUCCESS`) | `58.93s` |
| **Frontend Unit Tests** | `npm test` | **14 files, 115 passed** (`vitest`) | `6.72s` |
| **Frontend Production Build** | `npm run build` | **PASS (`tsc -b && vite build`, 203 modules, 0 errors)** | `1.75s` |

---

## 2. Live API & Orchestration Verification (Real Network Calls, Zero Mocking)
Executed `run_disease_research` against `Tomato_Early_Blight` (`cropName=TOMATO`, `maxResults=4`):
- **Provider Statuses (`providerStatuses`):**
  - `google_selenium`: `BLOCKED` (`GOOGLE_CAPTCHA_BLOCKED`, no bypass)
  - `tavily`: `SUCCESS`
  - `openalex`: `SUCCESS`
  - `semantic_scholar`: `SUCCESS`
  - `crossref`: `SUCCESS` (`VERIFIED_MATCH` on real returned DOIs)
  - `bangladesh_agri_official`: `SUCCESS` (`bamisApiAvailable: false`, portal attribution only)
- **Outcome:** `researchStatus=COMPLETED`, `evidenceQuality=HIGH`, `advisoryStatus=READY`.
- **Telemetry Cache Re-Synthesis:** `r1` (`Healthy, humidity=55%`) -> `escalationRequired=False`; `r2` (`Critical, humidity=88%`, cache hit) -> `escalationRequired=True`.

---

## 3. Performance Measurements (Observed)
- **Live Cold Multi-Source Orchestration (Cache Miss):** `15,954.5 ms` (`15.95 s`)
- **Live Cached Orchestration with Fresh Telemetry Re-Synthesis (Cache Hit):** `2.79 ms`
- **Bengali Evidence Renderer (`4` edge-case sentences):** `0.370 ms`
- **Vite Production Build:** `1.75 s`

---

## 4. Live Firestore & Browser E2E Status
- **Live Firestore:** **NOT VERIFIED** (`mvnw.cmd test` ran in in-memory mode with `agroai.firebase.enabled=false`; Spring Boot `8080` was not running in this session).
- **Authenticated Farmer → Owner Browser E2E:** **NOT VERIFIED** (requires live Spring Boot + FastAPI + Vite + interactive Firebase Farmer/Owner sign-in on `http://localhost:5173/login`).
