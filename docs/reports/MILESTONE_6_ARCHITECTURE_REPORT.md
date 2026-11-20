# Milestone 6 Architecture Report

## Decision

Milestone 6 extends the current React → Spring Boot → Firestore flow and Spring Boot → FastAPI inference flow. Firebase ID tokens remain the user identity mechanism; the backend remains the authorization and persistence authority. The AI service accepts only backend-key-authenticated requests and does not access Firestore.

## Boundaries

- Frontend: authenticated field monitoring panel in owner/manager dashboard and farmer field inspection; no privileged data access.
- Spring Boot: image checks/storage orchestration, farm/field authorization, telemetry/analysis/irrigation rules, AI proxy, audit history, Firestore writes.
- FastAPI: preprocessing, model registry/adapter, inference response validation, model readiness.
- Firestore: metadata and bounded field-scoped records only; direct client read/write is denied for monitoring collections.
- Image bytes: `ImageStorage` interface, with private local development/test implementation only. Production adapter is not selected.

## Resilience and security choices

Images are capped at 8 MiB and decoded/re-encoded; telemetry/history use bounded cursor queries; service calls have a timeout and shared secret; idempotency keys are supported for telemetry and disease requests. Missing model returns explicit `MODEL_UNAVAILABLE`; invalid AI responses and transport failures persist `FAILED` without prediction data.

No background job system was introduced. Disease requests are synchronous, bounded by the AI timeout. Production storage, malware scanning, retention, service-key rotation, rate limiting, deployment, and operational observability remain future decisions.
