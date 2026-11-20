# Milestone 6 Security Report

## Implemented controls

- Verified Firebase principal UID is the only actor identity used.
- Monitoring service checks active account, matching farm/field, active lifecycle, active membership or active assignment, and permitted write role/permission.
- Cross-field record lookups verify both farm and field; missing and cross-scope IDs return not found.
- Private image bytes use opaque UUID keys and server-authorized retrieval; filenames are reduced to safe leaf metadata and images are re-encoded.
- FastAPI inference/availability require constant-time comparison of a backend service key. Browser never receives it.
- Model paths are containment-checked; hashes, evaluation declaration, labels, and output shape are validated.
- Firestore Rules explicitly deny client access to all five monitoring collections.
- Image limits, image signatures, MIME/extension match, dimensions and pixel caps are validated. Telemetry rejects non-finite/future values and retains out-of-range values as flagged records.

## Evidence and limits

Four targeted Java authorization cases and Rules emulator cases passed, including direct monitoring collection read/write denial. Existing contextual authorization checks are also reused. A full M6 matrix for every account/farm/assignment lifecycle combination, live Admin SDK persistence, service-key rotation, malware scanning, production object policy, rate limiting, and penetration testing was not run. No Rules deployment occurred.
