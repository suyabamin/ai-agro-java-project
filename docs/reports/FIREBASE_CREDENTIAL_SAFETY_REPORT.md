# Firebase Credential Safety Report

Date: 2026-11-19. Result: PARTIAL; owner action required.

- Admin key file exists under frontend source; only path/existence/size metadata was inspected. It is ignored by `.gitignore`, not indexed, and was not read, imported, moved, or deleted.
- Source/build marker searches excluding the key itself returned no matching paths. Production `dist` has no `.map` sourcemaps or key-named asset. The bundle markers checked were `agroai-firebase-adminsdk`, `BEGIN PRIVATE KEY`, `private_key`, and `client_email`; no paths matched. No byte-level parsing of the credential was performed.
- No Admin credential or Firebase OAuth session was used; no Firebase live request or production write occurred.
- Historical exposed CLI OAuth session: owner must revoke the grant/session in account security settings and run `firebase logout` in the relevant local account. Completion has not been confirmed.
- Owner must choose a secure destination outside the repository, verify a backup, then relocate the existing key and decide whether to rotate/revoke it. This run did not touch the sole copy.
- Repository placement risk: NOT RESOLVED (the key is still under `frontend/src`, though ignored and absent from the current index). Frontend build exposure: no matching marker/file detected. Local relocation: NOT TESTED / not performed. OAuth revocation: NOT TESTED. `firebase logout`: NOT TESTED. Credential rotation: NOT TESTED. Production credential safety: NOT TESTED.
- Live Auth guard tests are safe local unit tests; 5 passed and the real integration test remained skipped.

## Separate credential status

| Control | Status | Evidence / limitation |
|---|---|---|
| Repository placement risk | NOT RESOLVED | Admin JSON still resides beneath `frontend/src`; ignored and absent from current zero-entry index, but owner must relocate it to an approved secure destination. |
| Current frontend build exposure | PASS for checked artifacts | No key-named dist asset, source map, or marker path found; this is not a byte-level secret parser scan. |
| Local credential relocation | NOT TESTED / not performed | No owner-approved destination was known; key contents were not accessed. |
| Historical OAuth grant/session revocation | BLOCKED on owner | Owner must revoke through account security controls and confirm. |
| Local Firebase CLI logout | NOT TESTED | `firebase logout` was not run because the session is owner-controlled; owner should run after revocation. |
| Credential rotation | BLOCKED on owner | No credential was used or rotated. Owner/credential administrator decides after secure backup/relocation. |
| Production credential safety | NOT TESTED | No production Firebase access was attempted. |
