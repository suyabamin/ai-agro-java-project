# M5 Assignment History Pagination Verification

**Finding:** M5-PAG-01 — stable and complete cursor traversal under static data and concurrent insertion.
**Severity:** HIGH. **Status:** PARTIAL.

## Existing implementation

Assignment history queries filter by `assignmentId`, order by Firestore document ID, and use `startAfter(documentId)` with `limit + 1`. Document IDs are unique, so the ordering tuple is one unique field and is a deterministic tie-breaker even when all history timestamps are identical. The API cursor is base64url encoding of the last document ID; backend validates page size and cursor canonical form. Owner history service verifies active membership and assignment-to-farm/field ownership before querying. Farmer assignment history derives UID from the authenticated principal and never accepts a caller-supplied farmer UID.

## Emulator evidence

Exact command: `firebase emulators:exec --only firestore --project demo-agroai-assignment 'cd backend && mvnw.cmd -o -Plive-firebase -Dtest=FirebaseAssignmentEmulatorLiveTest test'` with Java 21 set in the parent PowerShell process.

The test seeded synthetic histories with identical timestamps at 100, 1,000, and 5,000 records; page size 100; one warm-up traversal, then three measured traversals. It checked total and unique counts, sorted ID order, and missing/duplicate counts. All three sizes discovered every record with zero duplicates and zero missing. Query counts exclude the warm-up: 3, 30, and 150. Measurements are local Firestore Emulator round trips; they are not production latency.

| Dataset | Pages/traversal | Measured page queries | Median ms | P95 ms | P99 ms | Max ms | Duplicates | Missing |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 100 | 1 | 3 | 109.700 | 129.058 | 129.058 | 129.058 | 0 | 0 |
| 1,000 | 10 | 30 | 45.173 | 73.633 | 76.732 | 76.732 | 0 | 0 |
| 5,000 | 50 | 150 | 65.927 | 79.326 | 86.089 | 89.249 | 0 | 0 |

Environment: Windows 11; Java 21.0.13; Intel Core i7-8650U; 15.85 GiB RAM; local Firestore Emulator standard edition. Percentiles are per-page query samples, not end-to-end traversal latency. For n=3 at dataset 100, P95/P99 equal the maximum and are not statistically meaningful. Reported JVM heap deltas were -13,292,520, -25,969,304, and +16,533,896 bytes. Negative deltas show garbage collection contaminates this before/after measure; memory consumption is therefore NOT MEASURED reliably.

Concurrent-insert test: after the first 100 records of a 101-record set, an ID sorting before the last cursor and an ID sorting after it were added. The next page excluded the insert before the cursor and included the insert after the cursor, with no duplicate across adjacent pages. **Contract:** forward cursor pagination over a changing dataset, not snapshot-consistent pagination. A record inserted before the current cursor is outside that traversal; clients needing a fresh complete view must restart from page one. This limitation is explicit and no snapshot promise is made.

## Remaining limitation

The API controller/MockMvc tests cover authorization enforcement, but E2E/API negative matrix for changing farm, field, assignment, cursor and size is incomplete. The browser tests use development mock auth and mocked API responses. No owner/production Firestore performance or authorization result is claimed. M5 technical readiness remains NOT READY.

Creation, release, reassignment, and farmer field-visibility latency distributions were not measured. The completed history query measurements do not represent those operations.

Evidence XML: `backend/target/surefire-reports/TEST-com.agroai.config.FirebaseAssignmentEmulatorLiveTest.xml` (system output includes measurements; 2 tests, no failures/errors/skips).

## Current Prompt 4 rerun — 2026-11-19

The final post-edit emulator execution used the same dataset sizes, page size, warm-up and measured traversal counts. These current measurements supersede the earlier table above; all are local emulator page-query round trips with zero duplicates, missing records, or failed queries.

| Dataset | Pages/traversal | Measured page queries | Median ms | P95 ms | P99 ms | Max ms | Failures |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 100 | 1 | 3 | 85.875 | 115.529 | 115.529 | 115.529 | 0 |
| 1,000 | 10 | 30 | 47.366 | 77.164 | 84.554 | 84.554 | 0 |
| 5,000 | 50 | 150 | 66.564 | 79.346 | 87.956 | 97.608 | 0 |

Environment: Windows 11 Pro 10.0.26300, Temurin Java 21.0.13, Intel Core i7-8650U @ 1.90 GHz, 16,616,664 KiB visible memory (about 15.85 GiB), Firestore Emulator standard edition. Percentiles are per-page, not traversal measurements. The n=3 100-record tail values are not statistically meaningful. P99 at n=30/150 is descriptive only. Heap deltas in the final run were -17,240,088; +12,064,632; and +11,668,928 bytes; garbage collection makes heap delta unreliable, so memory remains NOT MEASURED. No production threshold or performance claim is inferred.
