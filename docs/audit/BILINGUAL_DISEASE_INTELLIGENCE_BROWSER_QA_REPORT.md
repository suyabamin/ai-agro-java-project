# AgroAI — Bilingual Disease Intelligence Browser QA Report

**Date:** 2026-11-26  
**Audited Commit:** `bc61280` (`redesign bilingual disease intelligence ui`)  
**Previous Checkpoint:** `132e885`  
**Repository:** `D:\agro-ai-java-project`

---

## 1. Browser & Environment

- **Frontend:** Vite dev server on `http://127.0.0.1:5173/` (React 19, TypeScript, Tailwind CSS)
- **Backend:** Spring Boot on `http://127.0.0.1:8080/` (`dev` profile, Firebase Admin SDK initialized for `agroai-dev`)
- **AI Service:** FastAPI on `http://127.0.0.1:8000/` (`uvicorn app.main:app`)
- **Browser:** Built-in Playwright/Webview browser subagent (`http://127.0.0.1:5173`)
- **Automated Test Runner:** Vitest v5.1.0 + `tsc -b && vite build` (Vite v8.3.8)

---

## 2. Test Matrix & Actual Results

| Area | Test Case | Classification | Actual Observed Result |
|---|---|---|---|
| **Live Servers** | FastAPI (`8000`), Spring Boot (`8080`), Vite (`5173`) startup | **PASS** | All three servers booted cleanly; Spring Boot initialized `agroai-dev` Admin SDK. |
| **Unauthenticated Browser** | Landing page (`/`) and Login page (`/login`) render without app errors | **PASS** | `http://127.0.0.1:5173/` rendered landing page (HTTP 200); `/login` rendered `Sign In to Your Workspace` cleanly. No HTTP `>= 400` app errors or console errors. |
| **Language Switching (Code + Unit)** | Bangla (`bn`) default, switch to `en`, persist in `localStorage` (`agroai_disease_ui_lang`), client-side only | **PASS** | Verified in `diseaseIntelligenceI18n.ts` and `DiseaseDetectionCard.test.ts`; switching updates `useState` + `localStorage` without API calls. |
| **Language Switching (Live Browser)** | Authenticated Bangla/English toggle, reload persistence, no inference re-run | **BLOCKED** | Blocked by `AUTH_REQUIRED` at `/login` (no real Farmer/Owner credentials provided; mock login prohibited). |
| **Disease Information (Code + Unit)** | Crop/disease label, scientific name preservation, *Phytophthora infestans* as Oomycete, confidence vs. evidence quality separation | **PASS** | Verified in `extractDiseaseClassification` and `DiseaseDetectionCard.tsx`; *Phytophthora infestans* (`Potato_Late_Blight`) classified as `ওমাইসিট (Oomycete — সত্যিকারের ছত্রাক নয়)` / `Oomycete (water mold, not a true fungus)`. |
| **Evidence Parser** | Multiple `\|` blocks, leading/trailing `[cite]`, `[মূল উৎস (EN): ...]`, `[ইংরেজি প্রমাণ / Evidence EN]`, missing citations, empty evidence, nested `[1]`/`[Fig 1]` brackets, DOIs, malformed unclosed brackets | **PASS** | Defect found and fixed in `parseEvidenceBlocks` (see Section 3); 9/9 tests in `DiseaseDetectionCard.test.ts` pass. |
| **Research & Advisory (Live Browser)** | Expand/collapse papers & original evidence, DOI/Open Access/Portal badges, unavailable providers, priority groups | **BLOCKED** | Component logic verified by inspection & build; live authenticated DOM interaction blocked by `AUTH_REQUIRED`. |
| **Farmer & Owner Dashboards** | Both dashboards, persisted research history, farm/field authorization boundaries | **BLOCKED** | Blocked by `AUTH_REQUIRED` at `/login` (requires real Farmer and Owner Firebase accounts). |
| **Responsive Layout** | Desktop, Tablet, Mobile (`min-w-0`, `break-words`, `max-w-full`) | **PARTIAL** | Mobile overflow risk fixed in `DiseaseDetectionCard.tsx` (see Section 3) and verified via build; live authenticated multi-viewport measurement blocked by `AUTH_REQUIRED`. |
| **Frontend Suite & Build** | `npm test && npm run build` | **PASS** | Vitest: `14` files, `120` tests passed; `tsc -b && vite build`: `204` modules, `0` errors (`947ms`). |

---

## 3. Defects Found & Fixed

### Defect 1 — Trailing Citation Regex Corrupted Nested Brackets in `[মূল উৎস (EN): ...]`
- **File:** `frontend/src/components/monitoring/diseaseIntelligenceI18n.ts` (`parseEvidenceBlocks`)
- **Reproduction:** Input containing nested brackets inside `[মূল উৎস (EN): ...]` without an outer trailing citation, e.g. `পাতায় দাগ [মূল উৎস (EN): Dark brown lesions [Fig 1]]`, caused `citeEndMatch` to strip `[Fig 1]` from inside the English block, breaking `[মূল উৎস (EN): ...]` matching.
- **Fix:** Added bracket-balance verification (`openCount === closeCount` on the prefix before `[id]`) before extracting a trailing `citationId`, ensuring nested brackets inside `[মূল উৎস (EN): ...]` are preserved intact.
- **Regression Test:** Added test case in `frontend/src/components/monitoring/DiseaseDetectionCard.test.ts` covering nested `[Fig 1]`, DOI values, leading/trailing citations, missing citations, empty delimiters, and unclosed brackets.

### Defect 2 — Mobile Horizontal Overflow Risk on Long DOIs, Evidence Blocks & Source Links
- **File:** `frontend/src/components/monitoring/DiseaseDetectionCard.tsx`
- **Reproduction:** `min-w-[180px]` / `min-w-[200px]` inside flex rows and `max-w-[320px]` on source links, plus unbreakable DOI strings (`paper.doi`), risked horizontal overflow on narrow mobile screens (`<= 375px`).
- **Fix:** Replaced fixed `min-w-[180px]`/`min-w-[200px]` with `min-w-0 break-words`, added `break-all` on `paper.doi` and citation badges, added `break-words` on abstracts/authors/journals, and changed source link width to `max-w-full sm:max-w-[320px]`.

---

## 4. Remaining Limitations

- Live authenticated browser QA for both **Farmer** and **Owner** accounts remains **BLOCKED (`AUTH_REQUIRED`)** because no real Firebase account credentials are available in this non-interactive environment and mock authentication is prohibited.
- `npm test` verifies unit logic (`diseaseIntelligenceI18n.ts`, `DiseaseDetectionCard.test.ts`) rather than full live DOM interactions on authenticated pages.

---

## 5. Final Decision

**Decision: PARTIAL (NOT FULLY ACCEPTED)**

Unit/integration tests (`14` files, `120` tests), production build (`tsc -b && vite build`), live server startup, unauthenticated route rendering, and two verified defect fixes **PASS**. However, because authenticated **Farmer** and **Owner** browser testing could not be completed without real Firebase sign-in (`AUTH_REQUIRED`), this audit cannot be marked `FULLY ACCEPTED`.
