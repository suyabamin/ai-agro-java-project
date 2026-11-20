# Database Design

## Firestore design principles
- Model around access patterns and document boundaries.
- Avoid unbounded arrays and documents approaching Firestore size limits.
- Denormalize selectively for efficient reads; define how duplicated fields stay consistent.
- Use server timestamps for authoritative event times.
- Use stable document IDs and explicit status fields.
- Paginate large collections.
- Define indexes from real query requirements.
- Treat cross-document workflows as potentially partial; use transactions/batched writes where supported and appropriate.

## Proposed collections
`users`, `farms`, `farm_members`, `fields`, `field_assignments`, `job_posts`, `job_applications`, `conversations`, `messages`, `soil_telemetry`, `field_images`, `ai_analysis_results`, `irrigation_plans`, `payments`, `farmer_reviews`, `activity_logs`.

## Relationships
- User 1:N farms through ownership/membership records.
- Farm 1:N fields.
- User N:M farms through `farm_members`.
- Farmer N:M fields through `field_assignments`.
- Job post 1:N applications.
- Submission 1:0..N analysis attempts/results depending on retry policy.
- Conversation 1:N messages.

## Required metadata
For mutable business documents consider `createdAt`, `updatedAt`, `createdBy`, `status`, and relevant parent references. Avoid copying unnecessary personal data into every document.

## Decisions still required
Exact document fields, subcollection placement, retention, indexes, transaction boundaries, and rules must be finalized against query and security requirements before feature implementation.
