# Milestone 6 Integration Verification

## Current local verification

| Layer | Evidence | Boundary |
|---|---|---|
| Frontend auth/UI | Production-preview E2E 1/1 and dev mock UI E2E 3/3; frontend unit tests 70/70 | Dev workflow uses mock identity and intercepted API fixtures. Production check proves mock storage is ignored in a production build; neither verifies Firebase Auth. |
| Spring Boot | Offline Maven suite 216/216 under Temurin JDK 21.0.13 | Does not validate a live Firebase ID token or real Admin persistence. |
| Firestore Rules | 26/26 against emulator `demo-agroai`, explicitly selected on CLI and in test source | Emulator only. No Rules deployment. |
| FastAPI | Python 17/17; deterministic local benchmark hits in-process ASGI | Missing model correctly remains MODEL_UNAVAILABLE; no trained inference. |
| Storage | Source/config audit and local adapter tests within Maven suite | Production profile has no local bean; missing provider raises explicit unavailable exception. No production storage runtime integration. |

**Verified local component behavior** includes responsive monitoring UI, mock session rejection in production build, telemetry/image/analysis/irrigation fixture rendering, Firestore Rules in emulator, backend domain/API tests, and FastAPI model-unavailable behavior.

**NOT TESTED:** Firebase Authentication sign-in/ID-token verification against an authorized isolated project; Spring authorization with real claims; Firebase Admin Firestore persistence; full authenticated frontend → Spring Boot → FastAPI → Firestore → UI workflow; production image storage; actual model inference/evaluation; production performance and deployment.

The `.firebaserc` default is `agroai-dev`, which is not proof of isolation or authorization. The Rules test avoids this default with `--project demo-agroai`; no credentials were used. The owner must supply a confirmed isolated Firebase project, disposable pre-provisioned identity, approved operations, and safe credential handling before real integration may be tested. Do not use the ignored Admin key in the frontend tree.
