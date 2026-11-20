# Milestone 5 Security Audit

**Method:** source inspection of backend authorization, transaction reads/writes, DTO mapping and Firestore Rules; full backend suite and local Rules/assignment emulator checks. No production deployment or data access.

## Controls verified

- Assignment create/release/reassignment transaction-time reads revalidate active manager/owner membership and account profile, farmer account profile, farm/field state, assignment state and linked application state.
- Unique tenure IDs and transactionally managed active-pair lock preserve history and prevent duplicate active pairs. Lock writes are server-only under Rules.
- Farmer field access requires an active assignment tenure, active private account, ACTIVE farm and matching ACTIVE field in the backend evaluator and Rules.
- Farm suspend/archive and field deactivation/archive gate access before bounded cleanup; each release appends history. Field status changes keep active counts/projections synchronized.
- Assignment/history API pages are bounded, ordered and authorized per request; legacy Firestore list reads are capped at 100.
- Farmer response DTOs omit private field notes and assignment mappings omit farmer email.
- Local Rules emulator passed 25/25. Dedicated assignment transaction emulator passed 1/1. Full backend suite passed 202/202.

## Residual risks and limits

Firebase Auth revocation/disable is an external service and cannot be atomically read in a Firestore transaction. Protected request entry performs online revocation validation; transactionally authoritative Firestore profile and membership state is rechecked. A Firebase Auth change after request verification remains a cross-service race. Lifecycle batch failure recovery, lifecycle-vs-assignment race, concurrent membership revocation races, large page datasets/churn, and production index behavior were not tested. Rules emulator tests do not exercise Admin SDK writes, which bypass Rules.

No high-severity bypass was found in the reviewed scope. Full Milestone 5 remains NOT READY pending lifecycle race/recovery and scale evidence, browser E2E/performance evidence, and owner acceptance. No independent reviewer participated.
