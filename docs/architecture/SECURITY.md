# Security Requirements

## Secrets
- Store secrets in local environment variables or an approved secret manager.
- Keep service-account JSON outside the repository.
- Commit only placeholder environment templates.
- Rotate exposed credentials immediately.

## Authentication and authorization
- Verify Firebase ID tokens server-side.
- Enforce farm and field access checks in Spring Boot.
- Restrict conversation access to participants.
- Do not trust frontend-only role flags.

## API security
- Validate payloads and file metadata.
- Apply request size limits and timeouts.
- Use rate limiting where appropriate.
- Configure CORS for known frontend origins.
- Avoid verbose production error responses.
- Use HTTPS in deployed environments.

## File uploads
- Validate content type and file size.
- Do not trust file extensions alone.
- Use generated object names.
- Avoid public bucket access by default.
- Consider malware scanning and image decoding safeguards.
- Use short-lived signed URLs or controlled access where supported.

## Data privacy
- Minimize personal data.
- Restrict public farm fields.
- Avoid logging private messages or sensitive telemetry.
- Define retention and deletion procedures.

## Review
Security controls must be tested. This document is a baseline, not a claim that the application is already secure.
