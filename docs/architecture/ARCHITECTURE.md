# AgroAI System Architecture

## 1. Architectural style
A modular monorepo with three independently runnable applications:
- React frontend
- Spring Boot business backend
- FastAPI AI service

Firebase provides identity and document storage. Crop image bytes use a provider-neutral `ImageStorage` port; a private local adapter is available only in dev/test. Production image storage remains unconfigured until a provider is selected.

## 2. Request flow
1. User interacts with React.
2. React sends HTTPS requests to Spring Boot.
3. For authenticated requests, the client supplies a Firebase ID token.
4. Spring Boot verifies the token and derives the authenticated UID.
5. Backend authorization checks farm membership, field assignment, and resource scope.
6. Backend services read/write Firestore using trusted server credentials.
7. For AI processing, backend calls FastAPI using configured service-to-service communication.
8. AI result is returned to backend, validated, and persisted with source references. Until a user-supplied, evaluated model is registered, the service returns `MODEL_UNAVAILABLE` with no class or confidence.

## 3. Service responsibilities
### Frontend
Presentation, navigation, client-side validation for usability, API calls, and state management. Client-side checks are not security controls.

### Spring Boot
Authentication token verification, authorization, business rules, validation, orchestration, Firestore access, audit records, and API contract.

### FastAPI
Image preprocessing and model inference. It does not decide whether a user owns a farm or may access a field.

### Firebase
Authentication identity and Firestore document storage.

### Image storage
The `ImageStorage` interface stores/retrieves/deletes image bytes. Firestore stores opaque keys, metadata, checksums, and field relationships. Production provider selection is pending.

## 4. Security boundaries
- Admin SDK credentials remain server-side.
- Frontend never receives privileged credentials.
- Backend verifies tokens and authorizes every resource operation.
- AI service should not be publicly exposed without appropriate protection.
- Upload URLs and object access must follow a deliberate access policy.

## 5. Resilience
Use timeouts, bounded retries where safe, clear failure states, and idempotency for asynchronous submission workflows.

## 6. Open decisions
Production image storage provider, deployment platform, notification provider, and production observability stack remain undecided. AI service calls use a configured shared service key; model training/evaluation is user-owned future work.
