# Master Security Audit — Local Scope

Date: 2026-11-18. This is not a production penetration test or certification.

## Findings / evidence

- **CRITICAL, corrected locally:** unconfigured production frontend previously exposed development mock login/session/token paths. Guards now require Vite DEV across LoginPage, RegistrationPage, LandingPage, AuthContext and `services/firebase.ts`. Production preview test seeds old mock user/token and passes protected-route and UI checks (1/1).
- **CRITICAL, source hazards corrected:** `frontend/src/live-test/liveAuthClient.test.ts` no longer creates users, emails, writes Firestore, stores tokens or logs identity; it is default skipped and requires explicit isolation/project/identity guards. Default live test invocation reported 1 skipped, 0 executed. Live Firebase remains NOT TESTED.
- **HIGH, owner action:** ignored Admin service-account JSON exists under `frontend/src/types/.secrets/`. Metadata only inspected; `.gitignore` matches it; not in index; no source imports found. Contents were not opened or used. Move it securely outside repository and rotate only if exposure/commit is confirmed.
- **HIGH, owner action:** prior CLI identity-list command exposed credential-bearing session material. Owner must revoke its grant/session and use `firebase logout`; this agent did not use or revoke it.
- **Rules:** 26 emulator tests passed on `demo-agroai`; no Rules deployment/live project access. Emulator explicitly fails access to non-emulated services for demo project.
- **Authorization:** Maven/backend tests and Rules emulator pass locally; real Firebase claims/Admin path NOT TESTED.
- **Storage:** production provider absent; source has no local prod fallback and explicit unavailable exception. Runtime integration NOT TESTED.
- **Other security testing:** no dependency audit, SCA, pen test, production CORS/runtime assessment or live Auth test in this continuation.

No secret, ID token, OAuth value or service-account content was written to reports. See `MILESTONE_6_SECURITY_FINAL_REPORT.md` for the prior exposure account and owner actions.
