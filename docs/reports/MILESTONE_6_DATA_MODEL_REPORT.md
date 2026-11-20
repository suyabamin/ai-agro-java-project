# Milestone 6 Data Model Report

| Collection | Purpose | Core references/state |
|---|---|---|
| `field_images` | Image metadata, opaque private storage key, checksum, dimensions, category, processing state | `farmId`, `fieldId`, uploader, `analysisId`, `deleted`, creation epoch |
| `soil_telemetry` | Raw numeric field measurements and validation result | farm/field, measurement/unit, observation time, source/sensor, idempotency event |
| `ai_analysis_results` | Disease inference and agricultural evidence summaries | farm/field, image/actor, type/status, nullable prediction/model fields, limitations |
| `irrigation_plans` | Transparent moisture-threshold assessment and lifecycle | farm/field, telemetry references/snapshot, threshold source/version, status/rationale |
| `field_activity` | Field-scoped upload, telemetry, analysis and plan events | farm/field, actor, event/record type, record ID, creation epoch |

Firestore indexes in `firestore.indexes.json` support newest-first field pages and measurement/event filters. Cursor tokens encode a document ID; the repository validates that the cursor belongs to the requested farm and field. Page reads are capped at 100. Measurement types/units and physical bounds are enumerated; out-of-range values are preserved with warnings. Readings more than 24 hours old or out of range are excluded from positive irrigation recommendations.

No image data is embedded in Firestore. Image removal tombstones metadata before deleting private bytes; if byte cleanup fails, the tombstone remains and an operator may need cleanup. Activity events are created with corresponding record changes in a Firestore batch. Retention, archival, and production storage lifecycle are not defined.
