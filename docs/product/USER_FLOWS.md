# User Flows

## Farm registration
1. Visitor opens landing page.
2. User registers/authenticates.
3. User submits farm details.
4. Backend validates request and creates farm.
5. Backend creates owner membership for the creator.
6. Owner opens the new farm dashboard.

## Recruitment
1. Owner creates and publishes a job post.
2. Public user browses the job.
3. Authenticated user submits application.
4. Owner reviews application.
5. Owner communicates privately if needed.
6. Owner approves or rejects.
7. Approval makes the applicant eligible for manual assignment; it does not assign every field automatically.

## Field assignment
1. Owner selects an approved/eligible farmer.
2. Owner selects one or more fields.
3. Backend validates farm membership and assignment rules.
4. Assignment records are created.
5. Farmer sees only assigned fields.
6. Owner may later release or reassign the farmer while preserving history.

## Crop disease analysis
1. Authorized user selects an assigned/owned field.
2. User uploads image through the approved storage workflow.
3. Backend creates a submission record with `PENDING` status.
4. AI processing changes status to `PROCESSING`.
5. Successful inference stores a result and changes status to `COMPLETED`; failure changes status to `FAILED`.
6. Result is linked to field, submission, submitter, and model version.
7. User sees result with limitations and confidence interpretation.

## Soil telemetry
1. Authorized user selects field.
2. User submits a reading with value, unit, timestamp, and source.
3. Backend validates range and field permission.
4. Reading is stored and shown in field history.
