# Local Firebase Connectivity Debug Report

**Project:** AgroAI  
**Repository:** `D:\agro-ai-java-project`  
**Date:** 2026-11-19  
**Author:** Debugging session — automated investigation  
**Status:** ✅ RESOLVED — All root causes identified and fixed  

---

## 1. Executive Summary

The frontend displayed "Network Error" during user registration. Investigation revealed **two independent root causes**:

1. **Firebase Admin SDK operated in unconfigured mode** — the backend could not verify Firebase ID tokens, causing all authenticated API calls to return `401 FIREBASE_UNINITIALIZED`. The service-account credentials file existed but was stored in the wrong location and not discovered by the backend.
2. **CORS blocked the `127.0.0.1:5173` origin** — Vite sometimes serves on `127.0.0.1` instead of `localhost`. The backend CORS configuration only permitted `http://localhost:5173`, so preflight requests from `127.0.0.1:5173` received `403 Invalid CORS request`.

Both issues were fixed. A live end-to-end registration test confirmed the full flow: Firebase Auth → backend profile creation → Firestore persistence → read-back verification.

---

## 2. Environment

| Component | Value |
|---|---|
| Firebase Project | `agroai-dev` (live Cloud Firestore + Firebase Auth) |
| Backend | Spring Boot 3.x, Java 21 (Eclipse Adoptium JDK 21.0.13) |
| Frontend | React + Vite (TypeScript), served at `http://localhost:5173` |
| Backend URL | `http://localhost:8080` |
| Firestore Mode | Live Cloud Firestore (not Emulator) |
| Auth Mode | Live Firebase Authentication (not Emulator) |

---

## 3. Root Cause Analysis

### 3.1 — Firebase Admin SDK Unconfigured (PRIMARY)

**Component:** `backend/src/main/java/com/agroai/config/FirebaseConfig.java`

**Symptom:** Every authenticated backend API call returned:
```json
{"error": "FIREBASE_UNINITIALIZED", "message": "Firebase Admin SDK is not initialized"}
```

**Root Cause:**  
`FirebaseConfig.initializeFirebase()` relied solely on the `GOOGLE_APPLICATION_CREDENTIALS` environment variable (the standard ADC mechanism). This variable was not set in the local dev environment. As a result, the Firebase Admin SDK was not initialized, and `FirebaseTokenVerifier` could not validate any ID token. All requests to protected endpoints returned `401 Unauthorized`.

The service account JSON file **did exist** at:
```
frontend/src/types/.secrets/agroai-firebase-adminsdk.json.json
```
…but this location is inside the frontend source tree, is not referenced by the backend, and is a **security risk** (service account private key inside a directory that could be bundled or version-controlled).

**Fix:**  
1. Moved the service account key to `secrets/firebase-service-account.json` (project root, gitignored).  
2. Added auto-discovery logic to `FirebaseConfig.initializeFirebase()` that checks three relative paths before falling back to ADC:
   ```java
   List<String> candidates = List.of(
       "secrets/firebase-service-account.json",
       "../secrets/firebase-service-account.json",
       "./secrets/firebase-service-account.json"
   );
   ```
   The first readable file found is used. When started from `backend/`, the path `../secrets/` resolves correctly to the project root.

---

### 3.2 — CORS Blocked `127.0.0.1:5173` Origin (SECONDARY)

**Component:** `backend/src/main/resources/application.yml`, `backend/src/main/java/com/agroai/config/SecurityConfig.java`

**Symptom:** Browser console showed:
```
Access to XMLHttpRequest at 'http://localhost:8080/api/v1/...' from origin 'http://127.0.0.1:5173' 
has been blocked by CORS policy
```
Backend log:
```
2026-11-18 ... Invalid CORS request  (HTTP 403)
```

**Root Cause:**  
`application.yml` contained:
```yaml
cors:
  allowed-origins: "http://localhost:5173"
```
Vite's dev server sometimes binds to `127.0.0.1` instead of `localhost` (depending on OS resolver). These are treated as different origins by browsers. The backend rejected the `Origin: http://127.0.0.1:5173` preflight with `403`.

**Fix:**  
Expanded `allowed-origins` to cover all local dev variants:
```yaml
cors:
  allowed-origins: "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"
```
Updated the `@Value` default annotation in `SecurityConfig.java` to match.

---

### 3.3 — Orphaned Firebase Auth Account on Backend Failure (SECONDARY)

**Component:** `frontend/src/pages/RegistrationPage.tsx`

**Symptom:** When the backend profile creation call failed (due to root cause 3.1), a Firebase Auth account was created but no Firestore profile existed. Subsequent re-registration attempts returned `auth/email-already-in-use`.

**Fix:**  
Added cleanup logic — if `userService.initializeProfile()` throws, the newly created Firebase Auth user is deleted:
```typescript
try {
  await userService.initializeProfile({ ... });
} catch (profileErr) {
  try {
    await fbUser.delete(); // clean up orphaned Auth account
  } catch (cleanupErr) {
    console.error('Failed to clean up orphaned Firebase Auth account:', cleanupErr);
  }
  throw profileErr;
}
```

---

### 3.4 — Poor Error Messages (TERTIARY)

**Components:** `frontend/src/pages/RegistrationPage.tsx`, `frontend/src/pages/LoginPage.tsx`

**Symptom:** "Network Error" shown to the user with no actionable information.

**Fix:** Added specific handling for:
- `ERR_NETWORK` / `"Network Error"` → "Cannot reach the server. Check that the backend is running on port 8080."
- `auth/email-already-in-use` → Specific re-registration message.
- `auth/network-request-failed` → Firebase connectivity message.
- Backend error messages extracted from `response.data.message`.

---

## 4. Files Changed

| File | Change Type | Description |
|---|---|---|
| `backend/src/main/java/com/agroai/config/FirebaseConfig.java` | Modified | Added local service-account auto-discovery + `agroai.firebase.enabled` toggle |
| `backend/src/main/resources/application.yml` | Modified | Expanded CORS `allowed-origins` |
| `backend/src/main/java/com/agroai/config/SecurityConfig.java` | Modified | Updated `@Value` default for CORS origins |
| `backend/pom.xml` | Modified | Added `agroai.firebase.enabled=false` to Maven Surefire system properties for test isolation |
| `firestore.indexes.json` | Modified | Added `public_farms` composite indexes (status, visibility, division, district, registeredAt) |
| `frontend/vite.config.ts` | Modified | Added `/api` proxy → `localhost:8080`, pinned port 5173 |
| `frontend/src/services/firebase.ts` | Modified | Added optional Firebase Emulator support |
| `frontend/src/pages/RegistrationPage.tsx` | Modified | Added orphan cleanup + detailed error messages |
| `frontend/src/pages/LoginPage.tsx` | Modified | Added detailed error message handling |
| `.gitignore` | Modified | Added `secrets/` to prevent credential tracking |
| `secrets/firebase-service-account.json` | Created | Service account key moved from dangerous location |
| `frontend/src/types/.secrets/` | Deleted | Dangerous credential location removed |

---

## 5. End-to-End Verification

A live registration test was executed against the running backend and live Firebase (`agroai-dev`) project.

### Test Sequence

| Step | Expected | Actual | Result |
|---|---|---|---|
| 1. Create Firebase Auth user | UID returned | UID: `0pNDyZcOM8TXuVwsi2X6BTnawbJ3` | ✅ PASS |
| 2. POST `/api/v1/users/me/initialize` | HTTP 201 | HTTP 201 | ✅ PASS |
| 3. GET `/api/v1/users/me` | HTTP 200 + profile | HTTP 200 | ✅ PASS |
| 4. Verify profile fields | fullName, email, phoneNumber | All present and correct | ✅ PASS |
| 5. Firebase Auth cleanup | User deleted | User deleted (no orphan) | ✅ PASS |

### Profile Read-back (GET `/api/v1/users/me`)
```json
{
  "uid": "0pNDyZcOM8TXuVwsi2X6BTnawbJ3",
  "email": "verify_1795041400641@agroai-test.com",
  "fullName": "Dr. Karim Ahmed",
  "phoneNumber": "+8801712345678",
  "accountStatus": "ACTIVE",
  "profileVersion": 1
}
```

### CORS Verification

| Origin Tested | Pre-fix | Post-fix |
|---|---|---|
| `http://localhost:5173` | ✅ 200 OK | ✅ 200 OK |
| `http://127.0.0.1:5173` | ❌ 403 Invalid CORS | ✅ 200 OK |

### Firebase Admin SDK Health Check (GET `/actuator/health/firebase`)
```json
{
  "configured": true,
  "sdkInitialized": true,
  "projectId": "agroai-dev",
  "message": "FirebaseApp initialized successfully for project: agroai-dev",
  "firestoreStatus": "INITIALIZED"
}
```

---

## 6. Backend Regression Tests

**Command:**
```powershell
$env:JAVA_HOME='C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
cd d:\agro-ai-java-project\backend
.\mvnw.cmd test
```

> **Execution Result:**
> - `[INFO] Tests run: 250, Failures: 0, Errors: 0, Skipped: 0`
> - `[INFO] BUILD SUCCESS`
> - `[INFO] Total time: 25.742 s`

---

## 7. Test Results Summary

| Suite | Tests | Pass | Fail | Skip | Status |
|---|---|---|---|---|---|
| Backend unit + integration | 250 | 250 | 0 | 0 | ✅ PASS (25.7s) |
| Frontend unit (Vitest) | 76 | 76 | 0 | 0 | ✅ PASS (1.3s) |
| Frontend build (Vite + TS) | — | — | — | — | ✅ 147 modules, 0 errors |
| AI Service (pytest) | 17 | 17 | 0 | 0 | ✅ PASS (1.3s) |
| E2E (Playwright - Desktop + Mobile) | 15 | 15 | 0 | 0 | ✅ PASS (52.5s) |
| Live E2E registration | 5 steps | 5 | 0 | 0 | ✅ PASS |

---

## 8. Security Notes

| Risk | Mitigation |
|---|---|
| Service account key was in frontend source tree | Moved to `secrets/` (project root), added to `.gitignore` |
| Service account key could be committed | `secrets/` is gitignored; key is not in any tracked file |
| CORS expansion | Only local dev origins added (`localhost`, `127.0.0.1`, ports 3000/5173); no wildcard `*` |
| Emulator support | Opt-in via `VITE_USE_FIREBASE_EMULATOR=true`; disabled by default |
| Secret values | No secret values printed or logged in this report |

---

## 9. How to Run the Application Locally

### Backend
```powershell
# From project root (d:\agro-ai-java-project)
cd backend
$env:JAVA_HOME='C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
# Option A: Run pre-built JAR (faster)
java -jar target\agroai-backend-0.0.1-SNAPSHOT.jar
# Option B: Run via Maven
.\mvnw.cmd spring-boot:run
```

Credentials are auto-discovered from `d:\agro-ai-java-project\secrets\firebase-service-account.json`.

### Frontend
```powershell
# From project root
cd frontend
npm run dev
# App available at http://localhost:5173
```

The `/api` proxy in `vite.config.ts` forwards all `/api` requests to `http://localhost:8080` automatically.

---

## 10. Remaining Blockers

| Blocker | Severity | Notes |
|---|---|---|
| Docker not installed on this machine | Medium | Prevents container-based deployment; local dev works without Docker |
| Staging Firebase project not configured | Medium | Live `agroai-dev` used for local dev; separate staging project needed for CI/CD |
| Production deployment | High | Requires explicit owner authorization + proper env var injection |
| AI model | N/A | `MODEL_UNAVAILABLE` behavior preserved; no model training required |

---

## 11. References

- `backend/src/main/java/com/agroai/config/FirebaseConfig.java`
- `backend/src/main/resources/application.yml`
- `backend/src/main/java/com/agroai/config/SecurityConfig.java`
- `frontend/vite.config.ts`
- `frontend/src/services/firebase.ts`
- `frontend/src/pages/RegistrationPage.tsx`
- `frontend/src/pages/LoginPage.tsx`
- `.gitignore`
- `secrets/firebase-service-account.json` _(gitignored, not in source control)_
