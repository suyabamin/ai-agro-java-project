# Environment Variables

## Rules
- Keep real values in local ignored environment files or a secret manager.
- Commit only placeholder templates.
- Never paste service-account private keys into source files.
- Validate required variables at startup.
- Do not print secret values in logs.

## Proposed frontend variables
- `VITE_API_BASE_URL`: Spring Boot API base URL.
- Firebase client configuration variables may be added after the Firebase project is created. These are client configuration values, but security still depends on Firebase rules and backend authorization.

## Proposed backend variables
- `SPRING_PROFILES_ACTIVE`
- `FIREBASE_PROJECT_ID`
- `GOOGLE_APPLICATION_CREDENTIALS` (path outside repository, where using a service-account file)
- `AI_SERVICE_BASE_URL`
- `AI_SERVICE_TIMEOUT_MS`
- `CORS_ALLOWED_ORIGINS`

## Proposed AI service variables
- `APP_ENV`
- `APP_HOST`
- `APP_PORT`
- `MODEL_PATH`
- `ALLOWED_BACKEND_ORIGINS` only if relevant to the chosen service communication model.

## Important
Exact names and required/optional status must match actual application configuration. Never include real secrets in this document.
