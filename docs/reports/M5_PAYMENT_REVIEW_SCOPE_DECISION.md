# M5 Payment and Assignment Review Scope Decision

**Finding:** M5-SCOPE-01. **Overall M5:** NOT READY. **Updated:** 2026-11-19.

## Policy authority

The owner-supplied policy approval draft resolves the approved decisions listed in `M5_OWNER_DECISION_REPORT.md`. Owner approval of policies is not technical acceptance of implementations; historical M5 owner acceptance remains accepted independently.

## Payment disposition

Payment policy is recorded: manual only, farm and assignment scopes, BDT, multiple installment entries, OWNER creation, relevant-farmer visibility, private data, audit-preserving corrections, no transfer-success claims, and no required receipts. No payment feature source exists. Implementation remains blocked on the payer/receiver identity contract, farm-level participant selection, correction-entry vs direct-edit shape, reversal and deletion policy, and status vocabulary/transitions. Do not invent those rules.

## Review disposition

An initial backend create/read slice now exists: exact terminal assignment tenure, active OWNER author, private OWNER/exact-farmer reads, 1–5 rating, optional 1,000-character comment, and uniqueness by tenure. Current focused backend tests are 6/6 and the full offline backend suite is 225/225. Those are local unit/default Maven results, not emulator/live Firebase integration.

The review feature remains partial: no frontend workflow, no 24-hour edits/audit revisions, moderation, withdrawal, or aggregates. Edit count and archived/deleted account behavior remain open. Firestore client Rules deny undeclared collection access by default; backend Admin SDK authorization requires its own live verification, not supplied by these tests.

No live Firebase, credentials, provider, transaction, or production data was used. M5 remains NOT READY.
