# M5 Requirement Traceability — Payments and Assignment Reviews

Date: 2026-11-19. Historical M5 owner acceptance remains ACCEPTED; current technical readiness remains NOT READY (local/emulator implementation complete; live production verification and owner credential relocation actions pending).

| Requirement | Owner policy | Current implementation/evidence | Status |
|---|---|---|---|
| Manual payment records; a record is not proof of transfer (PRD FR-16, §8.8) | Farm/assignment scopes, BDT, multiple installments, OWNER create, relevant farmer read, private, audit-preserving corrections/reversals | `PaymentService`, `PaymentController`, `FirestorePaymentRepository`. `PaymentServiceTest` (10/10 PASS), `paymentService.test.ts` (3/3 PASS), `FirebaseReviewAndPaymentEmulatorLiveTest` (PASS). UI modals with transfer disclaimer in `DashboardPage` and `FarmerWorkspacePage`. | **IMPLEMENTED** (Unit, Emulator Live, Frontend verified) |
| Review after ended assignment, exact tenure (PRD FR-16, §8.8) | Ended exact tenure only; one review per tenure; new tenure separate | `AssignmentReviewService.create()`, `AssignmentReviewRepository`. Enforces terminal tenure status (`RELEASED`, `COMPLETED`, `TERMINATED`). Deterministic doc ID `assignment_reviews/{assignmentId}` prevents duplicate. `AssignmentReviewServiceTest` (10/10 PASS), `FirebaseReviewAndPaymentEmulatorLiveTest` (PASS). | **IMPLEMENTED** (Unit, Emulator Live, Frontend verified) |
| Review author and viewers | Active Farm OWNER author; assigned farmer and OWNER read only | `AssignmentReviewService.create()` validates active owner; `get()` validates author or assigned farmer UID. Tested in unit and emulator suites. Non-participants denied (HTTP 403). | **IMPLEMENTED** (Unit, Emulator Live, Frontend verified) |
| Rating/comment | 1–5; optional <=1,000 characters | `CreateAssignmentReviewRequest` and `UpdateAssignmentReviewRequest` Bean Validation; service-level checks; UI star picker and 1000-char limiter with live count. | **IMPLEMENTED** (Unit, Emulator Live, Frontend verified) |
| Review edits/history | 24 hours, server-side timestamp, preserve change history | `AssignmentReviewService.update()` validates `createdAt.plus(24h) > Instant.now()`. Appends `AssignmentReviewRevision` with prior rating, comment, edit time, and editor. Tested in unit and emulator. | **IMPLEMENTED** (Unit, Emulator Live, Frontend verified) |
| Privacy and aggregates | Private to exact participants; no public reviews/aggregates | No public reviews or rating aggregate APIs. Firestore client rules default-deny access. Readers strictly validated in Spring Boot service layer. | **IMPLEMENTED** (Unit, Emulator Live verified) |

## Explicit implementation boundaries

- **No live Firebase Auth or production Cloud Firestore:** All testing performed on local Firestore emulator with `demo-` project prefix (`demo-agroai`, `demo-agroai-assignment`, `demo-agroai-review-payment`).
- **No external payment gateway:** Payments are strictly manual internal bookkeeping records in BDT.
- **Admin credentials and OAuth sessions:** Relocation and rotation of development service account keys remain owner actions.
