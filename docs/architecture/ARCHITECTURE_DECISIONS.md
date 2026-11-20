# Architecture Decision Records (ADR)

Record material technical decisions here. Do not silently change an approved decision.

## ADR template
### ADR-XXX: Title
- Status: Proposed / Accepted / Superseded
- Date:
- Context:
- Decision:
- Alternatives:
- Consequences:
- Follow-up:

## ADR-001: Use Firestore as application database
- Status: Accepted
- Context: The project selected Firebase/Firestore rather than MySQL.
- Decision: Use Cloud Firestore as the primary application document database.
- Consequences: Design around collections/documents, query patterns, indexes, and denormalization. Do not assume relational joins.

## ADR-002: Separate AI service
- Status: Accepted
- Context: Main application backend is Java/Spring Boot; ML tooling is Python-oriented.
- Decision: Keep AI processing in a Python FastAPI service and call it from Spring Boot.
- Consequences: Define service contracts, timeouts, security, and failure handling.

## ADR-003: Image storage provider
- Status: Proposed
- Context: Crop images should use an external free/low-cost image bucket.
- Decision: Provider not selected.
- Consequences: Compare free-tier limits, access control, signed URLs, retention, and terms before selection.
