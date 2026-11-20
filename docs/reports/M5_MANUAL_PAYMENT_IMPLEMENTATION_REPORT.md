# M5 Manual Payment Implementation Report

**Finding:** M5-PAY-01. **Status:** IMPLEMENTED (Backend, Firestore Emulator Live, Frontend Components, Unit Tests). **Updated:** 2026-11-19.

## Approved policy & architectural contract

The manual payment feature (PRD FR-16, §8.8) implements an internal bookkeeping ledger for agricultural compensation. It adheres to all owner-approved policies:
- **Scope:** Supports both farm-level payments (general farm labor) and assignment-level payments (specific field tenure).
- **Currency:** Locked strictly to Bangladeshi Taka (`BDT`). Fractional monetary values are handled using `BigDecimal` and stored as exact `.toPlainString()` to eliminate floating-point imprecision.
- **Role Permissions:** Active Farm OWNER creates payment entries. Assigned farmer and owner can view payment records.
- **Multiplicity:** Multiple payments/installments are permitted per farm and assignment.
- **Audit Preservation & Immutability:** Records cannot be deleted or modified in place. Reversals preserve original entry metadata, recording `reversedAt`, `reversedByUid`, and `reversalReason`.
- **Disclaimer:** UI explicitly clarifies that entries are manual records and do not prove banking or mobile money transfer.

## Implemented source files

### 1. Backend Domain Models (`com.agroai.model`)
- `PaymentRecord.java`: Immutable Java record containing `id`, `farmId`, `assignmentId`, `amount`, `currency`, `payerUid`, `payerName`, `farmerUid`, `farmerName`, `purpose`, `notes`, `status`, `createdAt`, `createdByUid`, `reversedAt`, `reversedByUid`, `reversalReason`.
- `PaymentStatus.java`: Enum with `RECORDED` and `REVERSED`.
- `PaymentScope.java`: Enum with `FARM` and `ASSIGNMENT`.

### 2. DTOs & Validation (`com.agroai.dto`)
- `RecordPaymentRequest.java`: Validates `@NotNull` positive amount, `@NotBlank` BDT currency, `@NotBlank` purpose, optional `assignmentId`, `@NotBlank` farmerUid, optional notes (max 1000 chars).
- `ReversePaymentRequest.java`: Validates `@NotBlank` reversalReason (max 500 chars).

### 3. Repositories (`com.agroai.repository`)
- `PaymentRepository.java`: Interface defining persistence contracts.
- `FirestorePaymentRepository.java`: Dual-mode repository supporting Cloud Firestore collections `payment_records/{paymentId}` with in-memory fallback for offline test suites. Supports transactions and multi-indexed querying by `farmId`, `assignmentId`, and `farmerUid`.

### 4. Authoritative Services & Controllers (`com.agroai.service`, `com.agroai.controller`)
- `PaymentService.java`: Enforces OWNER membership, active farm status, BDT currency, recipient validation, reversal immutability, and actor visibility filtering (farmers only see their own payments).
- `PaymentController.java`:
  - `POST /api/v1/farms/{farmId}/payments`: Record payment (OWNER only, with `@RequiresRevocationCheck`).
  - `GET /api/v1/farms/{farmId}/payments`: List farm payments (owner sees all; farmer sees own).
  - `GET /api/v1/assignments/{assignmentId}/payments`: List tenure payments.
  - `GET /api/v1/payments/my`: List payments received by authenticated farmer.
  - `GET /api/v1/payments/{paymentId}`: Get single payment record.
  - `POST /api/v1/payments/{paymentId}/reverse`: Reverse payment (OWNER only, with `@RequiresRevocationCheck`).
- `PaymentNotFoundException.java` & `GlobalExceptionHandler.java`: Centralized error envelope handling.

### 5. Frontend Services & UI Components (`frontend/src/`)
- `types/payment.ts`: TypeScript contracts matching backend records.
- `services/paymentService.ts`: Typed API client for all payment endpoints.
- `components/payment/RecordPaymentModal.tsx`: Owner modal for recording manual payments with BDT lock, scope selector, farmer selector, and transfer disclaimer.
- `components/payment/FarmPaymentRecordsSection.tsx`: Ledger table rendering payment status badges, BDT amounts, audit timestamps, and reversal trigger modal.
- `pages/DashboardPage.tsx`: Integrated `FarmPaymentRecordsSection` in owner dashboard.
- `pages/FarmerWorkspacePage.tsx`: Added dedicated tab *"💰 Payments Received"* displaying farmer's payments with reversal notices.

## Verification & evidence

| Tier | Test Suite | Results | Notes |
|---|---|---:|---|
| Backend Unit | `com.agroai.service.PaymentServiceTest` | 10 / 10 PASS | Farm/assignment scopes, BDT enforcement, non-owner denial, negative amount, inactive farm, reversal, double-reversal denial, reader filtering. |
| Full Backend Suite | `mvnw.cmd -o test` | 239 / 239 PASS | Zero regressions across all backend components. |
| Firestore Emulator Live | `FirebaseReviewAndPaymentEmulatorLiveTest` | PASS (part of 2/2 suite) | Tested on isolated `demo-agroai-review-payment` emulator: persistence, querying, reversals, participant authorization. |
| Frontend Unit | `src/services/paymentService.test.ts` | 3 / 3 PASS | Verified API client request dispatching and parameter mapping. |
| Frontend Build | `npm run build` | PASS | TypeScript strict compilation and Vite bundling completed with 0 errors (147 modules). |

## Security & operational limitations

- **Firestore Rules:** `payment_records` is secured on Firestore client-side via catch-all deny rule. All access is mediated through backend Spring Boot Admin SDK with contextual authorization checks.
- **Production Integration:** Live Cloud Firestore and live Firebase Auth were NOT accessed. All tests executed locally on isolated emulators (`demo-` project prefix).
