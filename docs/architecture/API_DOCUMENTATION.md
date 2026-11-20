# API Documentation — Initial Contract

Base path: `/api/v1` for Spring Boot. JSON unless stated otherwise.

## Health endpoints
### GET /api/v1/health
Returns application health/version without exposing infrastructure secrets.

### GET /api/v1/health/firebase
Performs a safe diagnostic. Distinguish configuration present, SDK initialization, and actual Firestore operation. Do not expose credential contents.

### GET /api/v1/health/ai
Calls the configured AI service health endpoint with a timeout and returns dependency status.

## AI service
- `GET /health`
- `GET /api/v1/health`

## Response conventions
Success and error bodies should be consistent. Suggested success shape:
```json
{
  "success": true,
  "data": {},
  "message": "Request completed",
  "requestId": "correlation-id"
}
```

Suggested error shape:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request could not be validated"
  },
  "requestId": "correlation-id"
}
```

Do not expose stack traces, secrets, internal paths, or sensitive data.

## Authentication
Protected endpoints require a Firebase ID token in the Authorization Bearer header. The backend verifies it and derives the UID. Never accept a caller-supplied UID as authentication proof.

## Future endpoint groups
- `/auth` and `/users`
- `/farms` and `/fields`
- `/jobs` and `/applications`
- `/assignments`
- `/conversations` and `/messages`
- `/telemetry`
- `/field-images` and `/analysis`
- `/irrigation-plans`
- `/payments` and `/reviews`

Detailed request schemas must be written alongside implementation and tests.
# Milestone 6: field monitoring API

All endpoints below are under `/api/v1/farms/{farmId}/fields/{fieldId}/monitoring` and require a Firebase bearer token. Reads require active account plus active farm membership or active field assignment. Writes require active owner/manager membership or an active assigned farmer with existing telemetry permission. Field/farm must be ACTIVE. Mutations also require a token revocation check. IDs in the body are never used as proof of authorization.

| Method and path | Request | Behavior |
|---|---|---|
| `POST /images` | multipart `file`, optional category (`CROP`, `LEAF`, `FRUIT`, `STEM`, `OTHER`) | Validates/decodes PNG or JPEG, re-encodes bytes, stores privately and returns metadata. Max 8 MiB, 64–10,000 px per side, 16 MP. |
| `GET /images?cursor=&size=` | cursor pagination, size 1–100 (default 25) | Field-scoped metadata page. |
| `GET /images/{imageId}` | — | Metadata only. |
| `GET /images/{imageId}/content` | — | Authorized bytes, attachment disposition and `nosniff`. |
| `DELETE /images/{imageId}` | — | Owner/manager only; tombstones metadata and removes stored bytes. |
| `POST /telemetry` | measurementType, value, unit, observedAt, source; optional sensorId/clientEventId | Validates units/time/ranges; preserves out-of-range value with warning; idempotent with event ID. |
| `GET /telemetry/latest` | — | Latest stored measurement per type. |
| `GET /telemetry?cursor=&size=&measurementType=&fromEpochMs=&toEpochMs=` | query filters | Newest-first bounded page. |
| `GET /disease-availability` | — | Authenticated backend proxy reports `MODEL_UNAVAILABLE`, service unavailable, or registered model name/version. |
| `POST /disease-analyses?imageId=` | optional `Idempotency-Key` header | Runs backend-only AI call; stores `MODEL_UNAVAILABLE`, `COMPLETED`, or `FAILED`. No fake result. |
| `GET /disease-analyses[/{analysisId}]` | — | Retrieves analysis records. |
| `POST /agricultural-analyses` | — | Persists evidence summary; no disease diagnosis. |
| `POST /irrigation-plans` | — | Creates sourced threshold comparison or `INSUFFICIENT_DATA`; no water volume without sufficient inputs. |
| `GET /irrigation-plans[/{planId}]` | — | Retrieves plans. |
| `PATCH /irrigation-plans/{planId}/status` | status and optional note | Owner/manager lifecycle transition. |
| `GET /history?cursor=&size=&eventType=&fromEpochMs=&toEpochMs=` / `GET /history/{activityId}` | — | Field-scoped filtered activity pages and detail. |

Responses are wrapped in the existing `ApiResponse`; pages include `items`, `nextCursor`, `hasNext`, and `pageSize`. Validation errors return 400, authorization errors 403, unknown resources 404, persistence/storage failures 5xx. The API has no independent rate limiter. Disease service errors do not produce predictions; missing model is a persisted explicit unavailable status. `ai model/README.md` defines model upload/registration and input contract.
