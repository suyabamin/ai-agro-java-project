# Firestore Schema Proposal

This is a conceptual proposal, not a finalized deployed schema.

## users/{uid}
Profile display data, contact preferences, account status, created/updated timestamps. Do not store passwords.

## farms/{farmId}
Farm name, description, location at an appropriate precision, owner/member references or summary fields, visibility (`PUBLIC`/`PRIVATE`), status, timestamps.

## farm_members/{membershipId}
`farmId`, `userId`, contextual permissions, status, invited/created timestamps. Enforce uniqueness logically or through deterministic IDs.

## fields/{fieldId}
`farmId`, name, area and unit, crop metadata, status, timestamps.

## field_assignments/{assignmentId}
`farmId`, `fieldId`, `farmerId`, status, start/end dates, assignedBy, release reason. Preserve historical records; do not overwrite old assignment history.

## job_posts/{jobId}
`farmId`, owner UID, title, description, requirements, status, publication window.

## job_applications/{applicationId}
`jobId`, `farmId`, applicant UID, status, submittedAt, decision metadata.

## field_images/{submissionId}
`farmId`, `fieldId`, `submittedBy`, object key or controlled URL, content type, size, checksum if available, status, timestamps.

## ai_analysis_results/{resultId}
`submissionId`, `farmId`, `fieldId`, model name/version, predicted class, confidence data, evaluation/limitations metadata, createdAt.

## soil_telemetry/{readingId}
`farmId`, `fieldId`, submittedBy, metric, value, unit, observedAt, source, validation metadata.

## irrigation_plans/{planId}
`farmId`, `fieldId`, input references, recommendation, assumptions, status, model/rule version, createdAt.

## conversations/{conversationId} and messages
Conversation scope (application/farm/assignment), participants, status, timestamps. Messages reference conversation and sender. Enforce participant access server-side.

## payments/{paymentId}
Assignment/farm references, amount, currency, recorded status, recordedBy, recordedAt, note. A record is not proof of a transfer.

## farmer_reviews/{reviewId}
Assignment, reviewer, reviewed user, rating, text, timestamps, moderation status.

## activity_logs/{logId}
Actor, action, resource type/id, timestamp, safe metadata. Avoid secrets and message contents.

## Security warning
Firestore rules and backend authorization must be designed together. Admin SDK operations bypass Firestore Security Rules, so Spring Boot must enforce permissions itself.
# Milestone 6 monitoring collections

`field_images`, `soil_telemetry`, `ai_analysis_results`, `irrigation_plans`, and `field_activity` are backend-only collections. Firebase Rules explicitly deny client reads and writes. Each record carries `farmId`, `fieldId`, actor/reference identifiers, and epoch milliseconds for bounded newest-first cursor queries. Image bytes are not stored in Firestore. `firestore.indexes.json` defines required farm/field/time composites and the measurement-type telemetry query.

Image deletion tombstones the metadata before attempting private byte cleanup; cleanup failure is surfaced and may require storage reconciliation. Analysis history is append/create plus status updates; field activity records each transition. Retention and production storage lifecycle remain undecided. See `docs/reports/MILESTONE_6_DATA_MODEL_REPORT.md`.
