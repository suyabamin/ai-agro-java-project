# M5 Owner Policy Decisions

Date recorded: 2026-11-19. Source: owner-supplied `M5_OWNER_POLICY_DECISIONS.md` approval draft and subsequent technical implementation. This records policy authorization and technical resolution; it is not final milestone acceptance on the owner's behalf.

## Owner acceptance and technical state

- Historical M5 owner acceptance: **ACCEPTED**.
- Current M5 technical readiness: **NOT READY** (gated on live Firebase verification and owner credential actions; local/emulator implementation complete).
- This policy approval and technical verification does not accept the milestone on the owner's behalf.

## Approved payment policies & technical implementation

- **Scope:** Farm-level and assignment-level manual payment records are implemented. A record associated with both scopes is stored with exact `farmId` and optional `assignmentId`, indexed for both retrieval paths.
- **Currency:** BDT exclusively. Enforced in backend domain validation (`PaymentService`) and locked in the UI (`RecordPaymentModal.tsx`). No currency conversion or external provider is used.
- **Creator & Permissions:** Active Farm OWNER only may create payment records. Non-owners attempting creation receive HTTP 403 `FORBIDDEN`.
- **Visibility:** Private to the farm owner and relevant assigned farmer. Farm owner can query all farm payments; assigned farmers can query only payments where their UID matches `farmerUid`.
- **Multiplicity:** Multiple records and installments are permitted, each with a unique ID (`pay-<uuid>`).
- **Correction & Reversal:** Implemented with audit immutability. Records cannot be silently updated or deleted. Reversals transition `status` from `RECORDED` to `REVERSED` with `reversedAt`, `reversedByUid`, and mandatory `reversalReason`.
- **No Proof of Transfer:** Manual ledger entry only. The UI renders an explicit disclaimer: *"This is a manual record for internal bookkeeping only and does not constitute proof of actual bank or mobile money transfer."*
- **Data Model:** `id`, `farmId`, `assignmentId`, `amount`, `currency` (BDT), `payerUid`, `payerName`, `farmerUid`, `farmerName`, `purpose`, `notes`, `status` (`RECORDED` / `REVERSED`), `createdAt`, `createdByUid`, `reversedAt`, `reversedByUid`, `reversalReason`.

## Approved assignment-review policies & technical implementation

- **Tenure Linkage:** One owner-authored review per exact assignment tenure (`asgn_tenure_<uuid>`), strictly after the tenure reaches terminal status (`RELEASED`, `COMPLETED`, or `TERMINATED`). Active assignments are rejected.
- **Author & Read Permissions:** Active Farm OWNER creates and updates; assigned farmer and owner read. Non-participants receive HTTP 403 `FORBIDDEN`. Unauthenticated requests receive HTTP 401.
- **Rating & Comment:** Rating is an integer 1–5; comment is optional with a maximum length of 1,000 characters. Validated at DTO and service layers.
- **24-Hour Edit Window:** Author may edit the review within 24 hours of creation, enforced via server-side `Instant.now()`. Post-24-hour edits are rejected with HTTP 400.
- **Audit Revision History:** Every edit records a new `AssignmentReviewRevision` entry (`revisionNumber`, `rating`, `comment`, `editedAt`, `editedBy`) preserved in the review document.
- **Privacy & Aggregates:** Reviews remain strictly private between the owner and assigned farmer. No public reviews or rating aggregates are published or calculated.

## Technical resolutions adopted

1. **Review edit cardinality within 24h:** Multiple edits within the 24-hour window are supported, with every edit generating an immutable audit revision in `revisions: List<AssignmentReviewRevision>`.
2. **Payer/Receiver identities:** `payerUid` is bound to the authenticated Farm OWNER; `payerName` is looked up from their active `UserProfile`. `farmerUid` is verified against active `UserProfile` and assigned tenure.
3. **Farm-level farmer visibility:** For farm-level payments (without assignment tenure), an explicit `farmerUid` is selected by the owner from registered farmers, ensuring precise recipient visibility.
4. **Payment reversals:** Soft reversal transitions status to `REVERSED` with required reason, preserving audit history. Hard deletions are prohibited.

## Test & verification disposition

- Backend unit suites: `AssignmentReviewServiceTest` (10/10 PASS), `PaymentServiceTest` (10/10 PASS).
- Full offline backend suite: 239/239 PASS.
- Emulator integration: `FirebaseReviewAndPaymentEmulatorLiveTest` (2/2 PASS in isolated `demo-agroai-review-payment`).
- Frontend unit suites: `reviewService.test.ts` (3/3 PASS), `paymentService.test.ts` (3/3 PASS). Overall frontend unit: 76/76 PASS.
- Frontend production build: `tsc -b && vite build` (147 modules, 0 errors).
- UI workflows: `AssignmentReviewModal`, `RecordPaymentModal`, `FarmPaymentRecordsSection` integrated in Owner Dashboard and Farmer Workspace.
