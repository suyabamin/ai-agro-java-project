# Product Acceptance Criteria

## General
- Every protected operation requires a valid authenticated identity.
- Every resource operation validates the user's permission for that resource.
- Public endpoints expose only explicitly public information.
- Validation errors are understandable and do not leak internal details.

## Farm and field
- A user can own more than one farm.
- A farm owner can create multiple fields.
- A user without farm permission cannot modify that farm.
- A farmer cannot read an unassigned field's private data.

## Marketplace and assignment
- Job application is linked to a user and job post.
- Only authorized owners can decide applications.
- Approval does not automatically create field assignments.
- Multiple farmers per field and multiple fields per farmer are supported.
- Released assignments remain in history.

## AI
- Every submission has a traceable lifecycle.
- Results reference the source submission and field.
- Failed inference is represented as failure, not a fabricated result.
- Model name/version and evaluation status are visible where relevant.
- Unvalidated predictions are clearly labelled.

## Evidence
Acceptance requires test output, manual verification notes where needed, and known limitations. A checkbox alone is not evidence.
