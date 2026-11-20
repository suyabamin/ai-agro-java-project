# M5 Assignment Review Implementation Report

**Finding:** M5-REV-01. **Technical status:** IMPLEMENTED (Create, Read, 24-Hour Edit with Revisions, Firestore Emulator Live, Frontend Components, Unit Tests). **Updated:** 2026-11-19.

## Approved policy & architectural contract

The assignment review and rating feature (PRD FR-16, §8.8) implements private performance feedback between farm owners and assigned farmers following assignment tenure completion:
- **Tenure Linkage:** Exactly one review document per completed assignment tenure (`asgn_tenure_<uuid>`), keyed deterministically at `assignment_reviews/{assignmentId}`.
- **Timing Gate:** Reviews are allowed only after the tenure ends (`RELEASED`, `COMPLETED`, or `TERMINATED`). Active assignments are rejected with HTTP 400.
- **Author & Audience:** Author is restricted to active Farm OWNER. Readers are strictly restricted to the authoring OWNER and the specific assigned Farmer. Third parties receive HTTP 403.
- **Rating & Comment:** Rating integer 1–5; optional comment up to 1,000 characters.
- **24-Hour Edit Window:** Author may edit the rating and comment within 24 hours of creation, validated server-side (`review.createdAt().plus(24, ChronoUnit.HOURS)`).
- **Audit Revision Trail:** Revisions are preserved in an immutable list `revisions: List<AssignmentReviewRevision>`, capturing previous rating, comment, edit timestamp, and editor UID.
- **Privacy:** Strict participant privacy. No public reviews or rating aggregate calculations exist.

## Implemented source files

### 1. Backend Domain Models (`com.agroai.model`)
- `AssignmentReview.java`: Model record containing `id`, `assignmentId`, `farmId`, `fieldId`, `farmerUid`, `authorUid`, `rating`, `comment`, `createdAt`, `updatedAt`, `revisions`.
- `AssignmentReviewRevision.java`: Model record capturing revision history: `revisionNumber`, `rating`, `comment`, `editedAt`, `editedBy`.

### 2. DTOs & Validation (`com.agroai.dto`)
- `CreateAssignmentReviewRequest.java`: Validates `@NotNull @Min(1) @Max(5) rating` and `@Size(max=1000) comment`.
- `UpdateAssignmentReviewRequest.java`: Validates `@NotNull @Min(1) @Max(5) rating` and `@Size(max=1000) comment`.

### 3. Repositories (`com.agroai.repository`)
- `AssignmentReviewRepository.java`: Interface and dual-mode implementation for `assignment_reviews/{assignmentId}` with atomic transactional creation and update support, plus in-memory fallback.

### 4. Authoritative Services & Controllers (`com.agroai.service`, `com.agroai.controller`)
- `AssignmentReviewService.java`:
  - `create()`: Transactional check of terminal tenure status, active owner membership, active farm status, and duplicate prevention.
  - `get()`: Enforces reader authorization (author owner or assigned farmer only).
  - `update()`: Transactional check of 24h edit window, author UID, active farm, rating/comment validation, and revision list appending.
- `AssignmentReviewController.java`:
  - `POST /api/v1/assignments/{assignmentId}/review`: Create review (`@RequiresRevocationCheck`).
  - `GET /api/v1/assignments/{assignmentId}/review`: Read review.
  - `PUT /api/v1/assignments/{assignmentId}/review`: Edit review within 24 hours (`@RequiresRevocationCheck`).

### 5. Frontend Services & UI Components (`frontend/src/`)
- `types/review.ts`: TypeScript interfaces for `AssignmentReview`, `AssignmentReviewRevision`, create request, and update request.
- `services/reviewService.ts`: Typed API client for `fetchReview`, `createReview`, `updateReview`.
- `components/review/AssignmentReviewModal.tsx`: Interactive modal supporting creation, viewing, and 24-hour editing with star rating selector, character counter, edit window countdown, and revision history viewer.
- `components/assignment/FieldAssignmentsSection.tsx`: Added "Review" action button for released/completed assignments opening `AssignmentReviewModal`.
- `pages/FarmerWorkspacePage.tsx`: Integrated review read modal for farmers to view reviews left by owners on their past assignments.

## Verification & evidence

| Tier | Test Suite | Results | Notes |
|---|---|---:|---|
| Backend Unit | `com.agroai.service.AssignmentReviewServiceTest` | 10 / 10 PASS | Create, terminal status check, active owner check, non-participant denial, duplicate rejection, 24h edit success, post-24h edit denial, non-author edit denial, inactive farm update denial. |
| Full Backend Suite | `mvnw.cmd -o test` | 239 / 239 PASS | Zero regressions across all backend components. |
| Firestore Emulator Live | `FirebaseReviewAndPaymentEmulatorLiveTest` | PASS (part of 2/2 suite) | Tested on isolated `demo-agroai-review-payment` emulator: atomic transaction create, duplicate prevention race, 24h edit with revision persistence, reader authorization. |
| Frontend Unit | `src/services/reviewService.test.ts` | 3 / 3 PASS | Verified API client request dispatching and response handling. |
| Frontend Build | `npm run build` | PASS | TypeScript strict compilation and Vite bundling completed with 0 errors (147 modules). |

## Security & operational limitations

- **Client Rules:** `assignment_reviews` is denied for direct client read/write by Firestore security rules catch-all. All operations route through the backend Admin SDK with service-layer authorization.
- **Local Isolation:** Tested exclusively against local Firestore emulator (`demo-` project prefix). No live Firebase credentials or production data were used.
