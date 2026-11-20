# Milestone 8 Readiness Audit

**Date:** 2026-11-18  
**Status: BLOCKED**  
**Scope:** Dependency and production-readiness audit only. No Milestone 8 architecture implementation, provider selection, infrastructure creation, deployment, Firebase operation, or later milestone work was performed.

## Executive decision

Milestone 8 must not begin. Milestone 7 is not completed or owner-accepted, and M6 is not owner-accepted and remains technically NOT READY. M5 was explicitly accepted by the owner, but its technical audit still records unresolved NOT READY findings; acceptance does not close those findings. M2 was also accepted by the owner. Do not conflate owner decisions with technical readiness.

This report does not accept a milestone or authorize deployment or paid resources.

## Owner acceptance and technical readiness

| Milestone | Owner acceptance | Technical status / evidence |
|---|---|---|
| M1 | Accepted | Historical project foundation status; no new technical audit performed here. |
| M2 | Accepted | Acceptance report records implementation and verification; its owner-acceptance wording was corrected based on owner-confirmed history. |
| M3 | Accepted | As recorded in TASKS.md. |
| M4 | Accepted | As recorded in TASKS.md. |
| M5 | Accepted | The final technical audit remains NOT READY. Open findings are retained below and in the audit; owner acceptance does not resolve them. |
| M6 | Pending; not accepted | NOT READY. Local suites pass, but real Firebase Auth/token verification, Firebase Admin persistence and full authenticated integration remain unverified. Production storage is unconfigured. |
| M7 | Not completed; not accepted | Blocked pending M6 owner acceptance; M7 checklist remains incomplete and no M7 final acceptance report exists. |
| M8 | Not started; blocked | Requires completed and explicitly owner-accepted M7. |

## M5 technical findings retained

The M5 final technical audit reports unresolved lifecycle batch/recovery and race verification, realistic pagination/load and performance evidence, browser E2E, and live transaction verification. TASKS.md also leaves payment records, reviews/ratings, farm/field lifecycle integration, cursor pagination/performance, live concurrency checks and repeat-tenure handling open. M5 owner acceptance is recorded separately; none of these findings have been removed or represented as fixed.

## M6 blocker-resolution checklist

The evidence-based checklist is maintained in docs/reports/MILESTONE_6_BLOCKER_RESOLUTION_PLAN.md. Main gates:

1. Revoke the Firebase CLI OAuth session material exposed in earlier tool output; clear local CLI state and reauthenticate securely before future authorized operations.
2. Move the ignored Admin key out of the frontend source tree; do not use it until the owner confirms agroai-dev is an authorized isolated non-production target. Do not reuse exposed credentials.
3. Harden the current live-auth test before running it: remove ID-token file persistence, assert direct-write denial, avoid unapproved email, and clean up test user/data on both success and failure.
4. After explicit authorization and isolated setup, execute real Auth/token verification, Firestore persistence and full authenticated cross-service tests using disposable identities/data only.
5. Resolve whether approved production storage is required for M6. Keep it unavailable without an approved provider.
6. Rerun impacted suites, document current results and obtain explicit owner acceptance of M6.

No Firebase credentials were used and no live Firebase access occurred while preparing this audit or checklist.

## Existing deployment and infrastructure

Inspected planning documents:

- docs/deployment/PRODUCTION_CONFIGURATION.md
- docs/deployment/DEPLOYMENT_GUIDE.md
- docs/deployment/BACKUP_RECOVERY.md

They say deployment providers are not selected. Repository inventory found no Dockerfile/Compose, Terraform, hosting manifests, CI workflow or provider-specific deployment configuration. firebase.json configures Firestore Rules/indexes and a local emulator; it does not configure Firebase Hosting or production deployment. No existing deployment or live production infrastructure was established.

No evidence exists here of a selected production host, domain/HTTPS, staging environment, configured CI/CD, active backup, operational monitoring or deployed release.

## Architecture and provider readiness

The existing architecture remains React/Vite frontend, Spring Boot backend, FastAPI AI service, Firebase Authentication, Cloud Firestore and a provider-neutral image-storage port.

Unresolved provider decisions include frontend/backend/AI hosting and regions, DNS/HTTPS, production Firebase project, private image storage, secrets management, logging/monitoring/alerting, backup, budgets and free-tier/resource limits. No provider comparison or cost estimate was prepared because upstream M7 is incomplete and these owner decisions are open. No paid service or external account was created.

## Security blockers and prohibited operations

- Real Firebase Authentication, real token verification, Firebase Admin persistence and full authenticated flow remain NOT TESTED.
- The earlier Firebase CLI identity listing printed credential-bearing OAuth material. The owner must revoke that grant/session and clear local CLI state before reauthentication. No value is repeated here.
- An ignored Admin credential for agroai-dev exists under the frontend source tree; its isolation/authorization is unconfirmed and it was not used. The private key must remain secret and should be moved outside the repository.
- The existing live-auth test creates a user, sends a verification-email request, attempts a Firestore write, does not delete the user, and writes an ID token to a report artifact. Its direct-write denial result is logged but not asserted. Do not run it until reviewed and hardened.
- No production configuration validation, staging integration, deployment smoke test, restore test, rollback exercise, or production monitoring verification was performed.
- No Firebase credential use, live Firebase access, user creation, data write, Rules deployment, deployment, or production change is authorized or performed by this audit.

## Next authorized sequence

1. Resolve M6 blockers using docs/reports/MILESTONE_6_BLOCKER_RESOLUTION_PLAN.md and obtain explicit M6 owner acceptance.
2. Only after that gate, complete the owner-approved M7 scope and obtain explicit M7 owner acceptance.
3. Only after M7 acceptance, request/authorize a new M8 readiness/design phase and owner decisions for providers, region/domain, budget and operations.

## Final disposition

**BLOCKED — stop before M7/M8 implementation and before any deployment.** M5 remains owner-accepted with technical findings open. M6 is technically NOT READY and owner acceptance is pending. M7 is incomplete and not accepted. M8 is blocked.
