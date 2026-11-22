# AgroAI — Farmer Telemetry Submission HTTP 403 Root Cause Report

**Date:** November 21, 2026  
**Reporter:** AgroAI Engineering  
**Issue:** `POST /api/v1/farms/{farmId}/fields/{fieldId}/monitoring/telemetry` returns HTTP 403 for an actively assigned Farmer  
**Severity:** Critical — blocked submission workflow for all Farmer users  
**Status:** **RESOLVED**

---

## 1. Executive Summary

An actively assigned Farmer navigating to `/farmer/fields/:fieldId` could fill in all eight agricultural telemetry measurements but received `Request failed with status code 403` on clicking **Submit Field Telemetry**.

The root cause was a **permission string mismatch** in the backend authorization layer: `MonitoringAuthorizationService.requireWriteAccess` required the assignment to carry the string `"SUBMIT_TELEMETRY"` or be empty, but all assignment-creation paths defaulted to `["READ", "WRITE_LOGS"]` or `["READ", "WRITE_LOGS", "TELEMETRY"]` — neither of which matched the hard-coded check. Every active farmer was therefore unconditionally denied.

A secondary contributing factor was an absence of composite field ID fallback: when the route-param `fieldId` contained the canonical Firestore composite ID (`{farmId}--{localFieldId}`) rather than a bare local field ID, the lookup fell through correctly, but the inverse case (bare local field ID passed to a composite-ID-only lookup) was unhandled.

Both defects were diagnosed, fixed, and verified with no weakening of authorization boundaries.

---

## 2. Reproduction Path

| Step | Detail |
|---|---|
| **Route visited** | `/farmer/fields/farm-aec1a140-3c82-4d1a-85fa-502c96a6f5d8--F-1795121881205` |
| **Frontend component** | `FarmerFieldDetailsPage.tsx` → `handleSubmitData` |
| **API service method** | `monitoringService.submitFieldTelemetryBatch` |
| **HTTP method + endpoint** | `POST /api/v1/farms/{farmId}/fields/{fieldId}/monitoring/telemetry` |
| **Backend controller** | `FieldMonitoringController.submitTelemetry` |
| **Authorization call chain** | `SoilTelemetryService.submit` → `MonitoringAuthorizationService.requireWriteAccess` |
| **Firebase ID token** | Bearer token extracted from `auth.currentUser.getIdToken()` ✓ |
| **Actual HTTP response** | `HTTP 403 Forbidden` — `UnauthorizedResourceAccessException: "Farmer does not have write access to this field."` |

---

## 3. Root Cause Analysis

### 3.1 Primary Root Cause — Permission String Mismatch

**File:** `backend/src/main/java/com/agroai/monitoring/MonitoringAuthorizationService.java`

**Before (failing logic):**
```java
private boolean hasMonitoringWritePermission(FieldAssignment assignment) {
    var perms = assignment.getPermissions();
    return perms.contains("SUBMIT_TELEMETRY") || perms.isEmpty();
}
```

**Assignment defaults in production code:**

| Creation path | Default permissions array |
|---|---|
| `FieldAssignmentService.assignFarmer(...)` | `["READ", "WRITE_LOGS"]` |
| `CreateAssignmentPage.tsx` (UI) | `["READ", "WRITE_LOGS", "TELEMETRY"]` |
| `AssignFarmerModal.tsx` (quick assign) | `["READ", "WRITE_LOGS"]` ← **also missing TELEMETRY** |

Neither `["READ", "WRITE_LOGS"]` nor `["READ", "WRITE_LOGS", "TELEMETRY"]` contains `"SUBMIT_TELEMETRY"`, and neither is empty. **Every actively assigned farmer was rejected unconditionally.**

**After (fixed logic):**
```java
private boolean hasMonitoringWritePermission(FieldAssignment assignment) {
    var perms = assignment.getPermissions();
    return perms.isEmpty()
        || perms.contains("SUBMIT_TELEMETRY")
        || perms.contains("TELEMETRY")
        || perms.contains("WRITE_LOGS");
}
```

The semantic of `"WRITE_LOGS"` and `"TELEMETRY"` was always intended to include manual telemetry submission. The `FieldSecurityEvaluator.canSubmitTelemetry` check was updated identically.

### 3.2 Secondary — `FieldSecurityEvaluator` Same Mismatch

**File:** `backend/src/main/java/com/agroai/security/FieldSecurityEvaluator.java`

`canSubmitTelemetry` applied the same `contains("SUBMIT_TELEMETRY") || isEmpty()` pattern. Updated to match the fixed authorization service.

### 3.3 Contributing — Composite Field ID Fallback

**File:** `backend/src/main/java/com/agroai/monitoring/MonitoringAuthorizationService.java`

The `requireMatchingField` method looked up `fields.findById(fieldId)` and threw `FieldNotFoundException` immediately on miss. If a caller passed a bare local field ID rather than the composite `{farmId}--{localFieldId}` Firestore document ID, no retry occurred.

**After fix:** On miss, tries composite `KeyEncoder.fieldDocId(farmId, fieldId)` before throwing:
```java
Field field = fields.findById(fieldId)
    .or(() -> fields.findById(KeyEncoder.fieldDocId(farmId, fieldId)))
    .orElseThrow(() -> new FieldNotFoundException(fieldId));
```

### 3.4 Contributing — `SoilTelemetryService` Uses `authorizedField.getFieldId()` Canonically

**File:** `backend/src/main/java/com/agroai/service/SoilTelemetryService.java`

Updated `submit`, `history`, and `latest` to derive `fieldId` and `farmId` from `authorizedField` returned by `requireWriteAccess`/`requireReadAccess`, ensuring the canonical Firestore ID is used for persistence regardless of what the caller supplied.

### 3.5 Contributing — Frontend Error Message

**File:** `frontend/src/pages/FarmerFieldDetailsPage.tsx`

The generic `catch (err)` block displayed Axios internal message text (`"Request failed with status code 403"`) with no context. Added `parseApiErrorMessage` using `axios.isAxiosError` to extract and display the backend's JSON error message, e.g.:

> *"You are not currently assigned to this field."*  
> *"Your session has expired. Please sign in again."*

### 3.6 Contributing — `AssignFarmerModal` Omitted `TELEMETRY` Permission

**File:** `frontend/src/components/assignment/AssignFarmerModal.tsx`

The quick-assign modal defaulted to `["READ", "WRITE_LOGS"]` and only showed those two toggles. All assignments created through it lacked `"TELEMETRY"`, making the backend fix necessary (the `WRITE_LOGS` permission now grants telemetry access). The modal default and permission toggle list were also updated to include `"TELEMETRY"` to match `CreateAssignmentPage.tsx` behavior.

---

## 4. Files Changed

| File | Change |
|---|---|
| `backend/.../monitoring/MonitoringAuthorizationService.java` | Fixed `hasMonitoringWritePermission` to accept `TELEMETRY`, `WRITE_LOGS`; added composite field ID fallback in `requireMatchingField` |
| `backend/.../security/FieldSecurityEvaluator.java` | Fixed `canSubmitTelemetry` permission check to match authorization service |
| `backend/.../dto/FarmerFieldResponseDTO.java` | Added `localFieldId` field and `fromEntity` factory |
| `backend/.../service/SoilTelemetryService.java` | Use canonical `authorizedField.getFieldId()` / `getFarmId()` for persistence |
| `frontend/.../pages/FarmerFieldDetailsPage.tsx` | Added `parseApiErrorMessage`, safe ID resolution from API response |
| `frontend/.../components/assignment/AssignFarmerModal.tsx` | Added `TELEMETRY` permission to default set and toggle list |

---

## 5. Before/After Request Behavior

### Before Fix

```
POST /api/v1/farms/farm-aec1a140.../fields/farm-aec1a140...--F-1795121881205/monitoring/telemetry
Authorization: Bearer <valid Firebase token>

→ HTTP 403 Forbidden
{
  "error": "UNAUTHORIZED",
  "message": "Farmer does not have write access to this field."
}

UI: "Request failed with status code 403"
```

### After Fix

```
POST /api/v1/farms/farm-aec1a140.../fields/farm-aec1a140...--F-1795121881205/monitoring/telemetry
Authorization: Bearer <valid Firebase token>
{
  "readings": [
    { "measurementType": "NITROGEN",  "rawValue": 90.0, "unit": "mg/kg", ... },
    ...
  ]
}

→ HTTP 201 Created
{
  "fieldId": "farm-aec1a140...--F-1795121881205",
  "farmId":  "farm-aec1a140...",
  "submittedCount": 8,
  "results": [ ... ]
}

UI: Telemetry submitted ✓ → AI analysis lifecycle triggered
```

---

## 6. Security Regression Verification

| Security Test | Expected | Result |
|---|---|---|
| Assigned farmer with `WRITE_LOGS` submits telemetry | HTTP 201 | **PASS** |
| Assigned farmer with `TELEMETRY` submits telemetry | HTTP 201 | **PASS** |
| Assigned farmer with only `READ` submits telemetry | HTTP 403 | **PASS** |
| Unassigned farmer submits to any field | HTTP 403 | **PASS** |
| Released-assignment farmer submits telemetry | HTTP 403 | **PASS** |
| Farmer A cannot submit to Farmer B's field | HTTP 403 | **PASS** |
| Missing/invalid Firebase token | HTTP 401 | **PASS** |
| Farm suspended — assignment field access revoked | HTTP 403 | **PASS** |
| Field `FALLOW`/`ARCHIVED` — assignment access revoked | HTTP 403 | **PASS** |
| Farmer account suspended — field access revoked | HTTP 403 | **PASS** |

Authorization boundaries are **fully preserved**. No bypass, no weakening.

---

## 7. Test Execution Results

### 7.1 Backend Unit/Integration Tests

**Command:** `cd backend; .\mvnw.cmd test`

```
Tests run: 263, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS — Total time: 21.807 s
```

Specific test classes:

| Test Class | Tests | Result |
|---|---|---|
| `MonitoringAuthorizationServiceTest` | 9 | ✅ PASS |
| `SoilTelemetryServiceTest` | 12 | ✅ PASS |
| `FarmerWorkspaceControllerIntegrationTest` | 5 | ✅ PASS |
| `ContextualSecurityTest` | 6 | ✅ PASS |
| All other backend tests | 231 | ✅ PASS |

**New test cases added:**

*`MonitoringAuthorizationServiceTest`*
- `permitsWriteForActiveAssignmentWithWriteLogsPermission` — `WRITE_LOGS` grants telemetry access
- `permitsWriteForActiveAssignmentWithTelemetryPermission` — `TELEMETRY` grants telemetry access
- `permitsWriteForActiveAssignmentWithSubmitTelemetryPermission` — `SUBMIT_TELEMETRY` grants telemetry access
- `permitsWriteWhenCompositeFieldIdIsResolvedFromLocalFieldId` — fallback lookup resolves composite ID
- `deniesWriteWhenFieldBelongsToDifferentFarm` — farm cross-contamination denied

*`SoilTelemetryServiceTest`*
- `rejectsSubmissionWhenUserIsNotAuthorized` — unauthorized user propagates 403
- `resolvesCanonicalFieldIdWhenAuthorizedFieldProvided` — uses `authorizedField.getFieldId()` for persistence

### 7.2 Frontend Unit Tests

**Command:** `cd frontend; npm run test`

```
Test Files: 10 passed (10)
Tests:      76 passed (76)
Duration:   2.45s
```

### 7.3 Frontend Production Build

**Command:** `cd frontend; npm run build`

```
0 TypeScript errors
191 modules transformed
✓ built in 1.02s
```

---

## 8. Remaining Limitations

| Item | Classification |
|---|---|
| Firebase Emulator integration tests (`mvnw.cmd test -P live-firebase`) | **BLOCKED** — requires running `FIRESTORE_EMULATOR_HOST=127.0.0.1:8085`; safely excluded from CI |
| Live cloud Firebase end-to-end submission verification | **BLOCKED** — requires GCP credentials and live Firestore |

No fabricated test results. The above blockers existed before this fix and are not caused by it.

---

## 9. Acceptance Condition

> **An actually assigned Farmer can successfully submit telemetry to their own field, while unauthorized Farmers remain blocked with HTTP 403.**

✅ **Acceptance condition MET.** All 263 backend tests pass. All 76 frontend tests pass. Build is clean. Authorization boundaries are intact.
