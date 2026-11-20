# M5 Security Remediation Report

Date: 2026-11-18. Status: PARTIAL; owner actions remain.

The service-account JSON at `frontend/src/types/.secrets/agroai-firebase-adminsdk.json.json` exists (metadata only was inspected), is ignored by `.gitignore` pattern `*firebase-adminsdk*.json`, and is not in Git's index (the repository index contains zero tracked files). Its contents were not read or used. Source and build scans for service-account markers returned no paths; production build emitted no source maps or key-named distributable assets. No byte-level credential parsing/scan is claimed. The file remains inside `frontend/src`; moving/deleting the only copy needs an owner-approved secure destination and key rotation decision.

Live Auth safety gates were extracted into a pure helper with five unit cases: default disabled, missing approval, project mismatch, missing identity/configuration, valid isolated setup. `npm run test:live`: 5 passed, 1 live test skipped. Live tests require explicit opt-in, exact matching project, and pre-provisioned disposable identity; implementation does sign-out cleanup in `finally`. No live Firebase operation occurred.

Public Firebase client settings remain in Vite `VITE_FIREBASE_*` configuration. Admin SDK usages are backend-side. Historical Firebase CLI OAuth exposure remains unresolved until owner revokes the grant/session and runs `firebase logout`; no auth-state command was run here. Do not report credential revocation or key rotation as complete.

## Prompt 4 final verification addendum — 2026-11-19

**Finding:** M5-SEC-01 — privileged Firebase Admin credential placement and exposure. **Severity:** CRITICAL. **Status:** PARTIAL / owner remediation required.

- The known path still exists under `frontend/src/types/.secrets/`; metadata-only check confirmed presence (2,369 bytes). Contents were not opened, parsed, copied, or used. No move/delete was attempted because no owner-approved secure destination was supplied.
- `git check-ignore -v frontend/src/types/.secrets/agroai-firebase-adminsdk.json.json` confirms `.gitignore` line 8 pattern `*firebase-adminsdk*.json`. Git reports zero indexed paths; therefore this proves ignore configuration, not exclusion from a normal committed baseline.
- After the current production build, source/config marker scan returned no paths, built JavaScript marker count was 0, and `frontend/dist` contained 0 source maps. The scan checks known marker strings and filename references; it is not a byte-level secret-content scan.
- No frontend source/config reference to the known key filename was found. A generated bundle scan is evidence of this build only.
- No Firebase CLI auth-state command, `firebase logout`, OAuth grant revocation, key rotation, live Auth, or live Firestore operation was run. Owner actions remain NOT TESTED.
- No production Firebase endpoint or data was contacted/modified; no deployment or Rules deployment occurred.

Exact commands/evidence: `npm run build` from `frontend`; marker/reference scans and `git check-ignore` from project root; build artifacts in `frontend/dist/`; ignored credential path above. Live credential safety and revocation remain unresolved.
