# AgroAI — Staging Deployment Audit Report

**Date:** 2026-11-19  
**Auditor:** Lead DevOps & Quality Engineer  
**Repository:** `D:\agro-ai-java-project`  
**Purpose:** Pre-deployment environment audit and container readiness verification.

---

## 1. Executive Summary

This environment audit evaluates the readiness of the host environment and configuration artifacts for staging deployment. 
Key findings:
- **Core language toolchains (Java 21, Node.js 26, Python 3.12, Firebase CLI 15.24.0)** are present and operational.
- **Docker Engine and Docker Compose** are **NOT INSTALLED** on this Windows host. This is a **local host environment tooling limitation**, not a repository or defect issue.
- **Dockerfiles and Compose configuration** are syntactically and structurally sound, following multi-stage best practices, unprivileged user execution, and secure secrets mounting.
- **Fail-closed security controls** are verified: Spring Boot rejects startup in production profile without live Cloud Firestore credentials; unconfigured storage returns HTTP 503 rather than corrupting state.

---

## 2. Environment Tooling Verification

| Component | Required Version | Observed Version / Status | Assessment | Classification |
|---|---|---|---|---|
| **Docker Engine** | 24.x+ | Not installed (`CommandNotFoundException`) | ❌ BLOCKED | Local Host Tooling Gap |
| **Docker Compose** | 2.x+ | Not installed (`CommandNotFoundException`) | ❌ BLOCKED | Local Host Tooling Gap |
| **Java Development Kit** | 21+ | OpenJDK 21.0.13 (Eclipse Temurin-21.0.13+9) | ✅ PASS | Operational |
| **Node.js** | 20+ | v26.4.0 | ✅ PASS | Operational |
| **npm** | 10+ | 11.17.0 | ✅ PASS | Operational |
| **Python (AI Service)** | 3.11+ / 3.12 | Python 3.12.13 (in `ai-service\.venv`) | ✅ PASS | Operational |
| **Firebase CLI** | 13.x+ | 15.24.0 (global npm package) | ✅ PASS | Operational |
| **Disk Space (C:\)** | > 5 GB recommended | 1.3 GB free | ⚠️ WARNING | Insufficient for Docker Desktop |
| **Disk Space (D:\)** | > 10 GB | 19.8 GB free | ✅ PASS | Operational for builds |

> [!IMPORTANT]
> **Tooling Gap Distinction:** Docker Engine / Docker Compose absence prevents containerized `docker compose up` orchestration on this specific machine. However, the application services, container build definitions, security rules, and full integration test suites have been verified directly via native toolchains and emulators.

---

## 3. Configuration & Artifact Audit

### 3.1 Docker & Orchestration Files
- **`backend/Dockerfile`**:
  - Multi-stage build (`eclipse-temurin:21-jdk-alpine` -> `eclipse-temurin:21-jre-alpine`).
  - Runs as non-root user `agroai:agroai` (UID 1001).
  - Health check defined targeting `/actuator/health`.
  - Secrets directory `/secrets` mounted read-only at runtime; no baked secrets in layers.
- **`frontend/Dockerfile`**:
  - Multi-stage build (`node:20-alpine` build -> `nginx:alpine` runtime).
  - Copies compiled SPA assets to `/usr/share/nginx/html`.
  - Integrates hardened `nginx.conf` with security headers and reverse proxy.
- **`frontend/nginx.conf`**:
  - Reverse proxy `/api/` -> `http://backend:8080`.
  - SPA routing: `try_files $uri $uri/ /index.html`.
  - Security headers enforced: `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
  - Gzip compression enabled for web assets.
- **`ai-service/Dockerfile`**:
  - Python 3.12-slim base image.
  - Native runtime libraries installed (`libgl1`, `libglib2.0-0`).
  - Runs as non-root user `agroai` (UID 1001).
  - Health check defined with Python urllib targeting `/health`.
- **`docker-compose.yml`**:
  - Declarative orchestration across `frontend`, `backend`, and `ai-service`.
  - Secure volume mapping `./secrets:/secrets:ro`.
  - Health-check dependencies: frontend waits for backend to be healthy; backend waits for ai-service.

### 3.2 Environment Templates
- **`.env.example`** defines:
  - `FIREBASE_PROJECT_ID`
  - `GOOGLE_APPLICATION_CREDENTIALS`
  - `AGROAI_AI_SERVICE_KEY`
  - `AGROAI_ALLOWED_ORIGINS`
  - `AGROAI_STORAGE_PROVIDER` (defaults to `none`)
  - `AGROAI_GCS_BUCKET_NAME`
  - `AGROAI_IRRIGATION_MOISTURE_THRESHOLD_PERCENT`
  - Frontend Firebase SDK credentials (`VITE_FIREBASE_*`)
- **`frontend/.env.example`** defines Vite client variables matching backend expectations.

### 3.3 Production Configuration Audit (`application-prod.yml`)
- Cloud Firestore is strictly required: `FirestoreUserRepository.validateEnvironmentSafety()` throws `IllegalStateException` on startup if Firebase is uninitialized under the `prod` profile.
- In-memory repository fallback is forbidden in `application-prod.yml`.
- `AGROAI_STORAGE_PROVIDER=none` returns HTTP 503 (`IMAGE_STORAGE_UNAVAILABLE`) gracefully when cloud object storage is unconfigured.

---

## 4. Docker Verification Execution Log

The following commands were run on the host:

```powershell
PS D:\agro-ai-java-project> docker --version
docker : The term 'docker' is not recognized as the name of a cmdlet, function, script file, or operable program.
At line:1 char:1
+ docker --version
+ ~~~~~~
    + CategoryInfo          : ObjectNotFound: (docker:String) [], CommandNotFoundException
    + FullyQualifiedErrorId : CommandNotFoundException

PS D:\agro-ai-java-project> docker compose version
docker : The term 'docker' is not recognized as the name of a cmdlet, function, script file, or operable program.

PS D:\agro-ai-java-project> Get-Service -Name "*docker*"
(No services returned)
```

**Root Cause:** Docker Desktop is not installed on the current host. Additionally, drive C:\ has only 1.3 GB free disk space, which is below Docker Desktop's installer threshold.

---

## 5. Remediation Plan for Containerized Staging / Production Host

To execute containerized staging on a target server or developer workstation:
1. Ensure at least 15 GB free disk space.
2. Install Docker Desktop for Windows (or Docker Engine on Linux) with Docker Compose v2.
3. Copy `.env.example` to `.env` and populate environment secrets.
4. Mount Firebase Admin service account key to `secrets/firebase-service-account.json`.
5. Execute:
   ```bash
   docker compose build
   docker compose up -d
   ```
6. Check service health:
   ```bash
   docker compose ps
   curl http://localhost/actuator/health
   curl http://localhost:8000/health
   ```
