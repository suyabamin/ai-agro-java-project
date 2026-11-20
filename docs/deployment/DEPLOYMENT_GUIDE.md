# AgroAI – Deployment Guide

> [!IMPORTANT]
> **Do not deploy to production or create paid resources without explicit owner authorization.**
> Live production verification is NOT authorized within this repository's automated workflows.

---

## 1. Architecture Overview

```
Browser → Nginx (Frontend, port 80)
              ↓ /api/*
         Spring Boot (Backend, port 8080)
              ↓ AI analysis requests
         FastAPI AI Service (port 8000)
              ↓
         (Future: Real ML model)

Both Backend and AI Service connect to:
  - Firebase Authentication (identity verification)
  - Cloud Firestore (all application state)
  - Google Cloud Storage (crop images — optional, 503 when not configured)
```

---

## 2. Prerequisites

| Tool | Minimum version |
|---|---|
| Docker | 24.x |
| Docker Compose | 2.x (`docker compose` v2 syntax) |
| Firebase project | With Authentication and Firestore enabled |
| Firebase Admin SDK service account | JSON key file |
| (Optional) GCS bucket | For production image storage |

---

## 3. Quick Start (Docker Compose)

### 3.1 Clone the repository

```bash
git clone <repo-url>
cd agro-ai-java-project
```

### 3.2 Configure secrets

```bash
# 1. Copy and fill in the environment template
cp .env.example .env
nano .env   # fill in all required values

# 2. Create the secrets directory and place the Firebase service-account key
mkdir -p secrets
cp /path/to/your-firebase-service-account.json secrets/firebase-service-account.json
chmod 600 secrets/firebase-service-account.json

# IMPORTANT: secrets/ is git-ignored. Never commit service-account files.
```

> [!CAUTION]
> Never commit `.env` or any file inside `secrets/` to version control.
> Both are listed in `.gitignore`.

### 3.3 Build and run

```bash
docker compose up --build
```

After startup:
- Frontend: http://localhost
- Backend health: http://localhost:8080/actuator/health
- AI service health: http://localhost:8000/health

### 3.4 Stop

```bash
docker compose down
```

---

## 4. Required Environment Variables

See `.env.example` for the full list with descriptions. The table below marks which are required vs optional:

| Variable | Required | Description |
|---|---|---|
| `FIREBASE_PROJECT_ID` | ✅ | Firebase project ID |
| `GOOGLE_APPLICATION_CREDENTIALS` | ✅ | Path to service-account JSON inside container |
| `AGROAI_AI_SERVICE_KEY` | ✅ | Shared secret for backend↔AI-service auth |
| `AGROAI_ALLOWED_ORIGINS` | ✅ | Comma-separated CORS origins |
| `AGROAI_STORAGE_PROVIDER` | Optional | `gcs` / `local` / `none` (default: `none`) |
| `AGROAI_GCS_BUCKET_NAME` | If GCS | GCS bucket name for image storage |
| `VITE_FIREBASE_API_KEY` | ✅ (frontend) | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | ✅ (frontend) | Firebase Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | ✅ (frontend) | Firebase project ID (web) |
| `VITE_FIREBASE_STORAGE_BUCKET` | ✅ (frontend) | Firebase Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | ✅ (frontend) | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | ✅ (frontend) | Firebase web app ID |
| `VITE_API_BASE_URL` | ✅ (frontend) | Backend API base URL as seen by browser |

---

## 5. Building Individual Services

### Backend (Spring Boot JAR)

```bash
cd backend
# Requires JDK 21+
./mvnw package -DskipTests -P prod
# Output: target/agroai-backend-*.jar
java -jar target/agroai-backend-*.jar --spring.profiles.active=prod
```

### Frontend (React SPA)

```bash
cd frontend
# Provide VITE_* vars in .env.production or as shell env vars
npm ci
npm run build
# Output: dist/  (serve with any static host or nginx)
```

### AI Service (Python FastAPI)

```bash
cd ai-service
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
AI_SERVICE_SECRET_KEY=<key> uvicorn app.main:app --host 0.0.0.0 --port 8000
```

---

## 6. Health Checks

| Service | Endpoint | Expected response |
|---|---|---|
| Backend | `GET /actuator/health` | `{"status":"UP"}` |
| AI Service | `GET /health` | `{"status":"ok"}` |
| AI availability | `GET /api/v1/monitoring/disease-availability` | `{"status":"MODEL_UNAVAILABLE",...}` when no model is loaded |

---

## 7. AI Model Integration

The AI service is deployed in `MODEL_UNAVAILABLE` state by default. All non-AI features remain fully functional. See [`AI_MODEL_INTEGRATION_GUIDE.md`](AI_MODEL_INTEGRATION_GUIDE.md) for instructions on supplying a real model.

---

## 8. Production Checklist

- [ ] All `VITE_*` environment variables injected at build time or via CI
- [ ] Firebase service-account key placed in `secrets/` and NOT committed
- [ ] CORS `AGROAI_ALLOWED_ORIGINS` set to production domain(s) only
- [ ] `AGROAI_AI_SERVICE_KEY` is a randomly generated secret (≥32 hex chars)
- [ ] HTTPS configured at the reverse proxy / load balancer level
- [ ] Firestore security rules reviewed and deployed
- [ ] `AGROAI_STORAGE_PROVIDER=gcs` configured if image upload is required
- [ ] Backend health check passing before frontend receives traffic
- [ ] Log aggregation and alerting configured
- [ ] Firestore automated backups scheduled (see [`BACKUP_RECOVERY.md`](BACKUP_RECOVERY.md))

---

> [!NOTE]
> Production values must never be stored in this repository.
> All secrets must be provided via environment variables or a secrets manager at runtime.
