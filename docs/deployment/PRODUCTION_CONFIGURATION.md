# AgroAI – Production Configuration Reference

> [!CAUTION]
> Production values must **never** be stored in this repository.
> All secrets must be supplied at runtime via environment variables or a secrets manager.

---

## 1. Spring Boot Backend (`application-prod.yml`)

The production profile (`--spring.profiles.active=prod`) is activated automatically when running via Docker Compose.
All sensitive values are injected via environment variables; the YAML file contains only references.

### 1.1 Required Environment Variables

| Environment variable | Spring property | Description |
|---|---|---|
| `GOOGLE_APPLICATION_CREDENTIALS` | `agroai.firebase.credentials-path` | Absolute path to Firebase Admin SDK service-account JSON inside the container |
| `FIREBASE_PROJECT_ID` | `agroai.firebase.project-id` | Firebase project ID |
| `AGROAI_AI_SERVICE_BASE_URL` | `agroai.ai-service.base-url` | Internal URL of the AI service (e.g. `http://ai-service:8000`) |
| `AGROAI_AI_SERVICE_KEY` | `agroai.ai-service.service-key` | Shared secret for backend→AI-service authentication |
| `AGROAI_ALLOWED_ORIGINS` | `agroai.cors.allowed-origins` | Comma-separated list of CORS-allowed origins |
| `AGROAI_STORAGE_PROVIDER` | `agroai.storage.provider` | `gcs` / `local` / `none`. Use `gcs` in production |
| `AGROAI_GCS_BUCKET_NAME` | `agroai.storage.gcs.bucket-name` | GCS bucket name (required when provider is `gcs`) |

### 1.2 Optional Environment Variables

| Environment variable | Default | Description |
|---|---|---|
| `AGROAI_IRRIGATION_MOISTURE_THRESHOLD_PERCENT` | `40` | Soil-moisture % below which irrigation is recommended |
| `AGROAI_IRRIGATION_THRESHOLD_SOURCE` | `operator-manual` | Audit label for the threshold source |
| `AGROAI_IRRIGATION_THRESHOLD_VERSION` | `unconfigured` | Version tag for the threshold |

### 1.3 Storage Provider Behavior

| `AGROAI_STORAGE_PROVIDER` | Behavior |
|---|---|
| `gcs` | Images stored in Google Cloud Storage. Requires `AGROAI_GCS_BUCKET_NAME`. |
| `local` | Images stored on local filesystem. **Development only. Not suitable for containers.** |
| `none` (default) | Image upload endpoints return HTTP 503. All other features remain fully operational. |

---

## 2. AI Service (`ai-service/`)

| Environment variable | Description |
|---|---|
| `AI_SERVICE_SECRET_KEY` | Shared secret. Must match `AGROAI_AI_SERVICE_KEY` set in the backend. |

When no model is configured, every `/analyze` request returns `MODEL_UNAVAILABLE`. This is the correct and expected behavior. The application remains fully functional for all non-AI features.

---

## 3. Frontend (Vite build-time variables)

All `VITE_*` variables are embedded into the compiled JavaScript bundle at build time. They must be provided during `npm run build`, not at runtime.

| Variable | Description |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase web app ID |
| `VITE_API_BASE_URL` | Backend API base URL as seen by the browser |

> [!WARNING]
> `VITE_*` values are visible in the browser bundle. Do not embed server-side secrets here.
> Firebase web credentials are designed to be public — Firestore Security Rules enforce access control.

---

## 4. Security Hardening Checklist

- [ ] Firebase Admin SDK service-account key stored in a secrets manager, not in the repo or container image
- [ ] `AGROAI_AI_SERVICE_KEY` is ≥32 random bytes (generate: `python -c "import secrets; print(secrets.token_hex(32))"`)
- [ ] HTTPS termination at the load balancer / reverse proxy; backend and AI service not exposed on HTTP externally
- [ ] Firestore Security Rules deployed and verified with the emulator before each release
- [ ] Service-account has only the minimum required Firestore and GCS permissions (least-privilege)
- [ ] CORS `AGROAI_ALLOWED_ORIGINS` restricted to production domain(s); never `*`
- [ ] `management.endpoint.health.show-details` set to `when-authorized` or `never`
- [ ] No debug logging in production (`logging.level.root: WARN`)
- [ ] Container images built from pinned base image tags, not `:latest`
- [ ] Image file size limits enforced at the reverse proxy level (e.g., `client_max_body_size 10m`)

---

## 5. Firestore Security Rules

Security rules are defined in `firestore.rules`. Before production deployment:

```bash
# Validate rules
firebase firestore:rules firebase validate

# Deploy rules (requires owner authorization)
firebase deploy --only firestore:rules
```

Run the emulator-based rules tests to verify before deploying:

```bash
firebase emulators:exec --only firestore --project demo-agroai "npm --prefix frontend run test:rules"
```

---

## 6. Logging and Observability

| Component | Log level in production | Log format |
|---|---|---|
| Backend | `WARN` (root), `INFO` (com.agroai) | JSON structured (configure via Logback) |
| AI Service | `INFO` | stdout / uvicorn access log |
| Frontend | Browser console only | N/A |

Configure log aggregation (Cloud Logging, Datadog, etc.) at the infrastructure level.

---

> [!NOTE]
> This document describes configuration requirements. It does not constitute evidence that any
> production deployment has been performed or verified. Live production verification requires
> explicit owner authorization.
