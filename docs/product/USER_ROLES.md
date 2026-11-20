# User Roles and Contextual Permissions

## Visitor
- View public landing page.
- Browse public farms and published jobs.
- Cannot view private farm data or submit authenticated actions.

## Authenticated general user
- Manage own profile.
- Apply to eligible public job posts.
- Register a farm.
- May later become an assigned farmer.

## Farm owner
- Access farms where the user has owner permission.
- Manage farm profile, fields, jobs, applications, and assignments.
- Review permitted field data and records.

## Farmer
- Access only fields with an active assignment and allowed permissions.
- Submit permitted crop images and soil telemetry.
- View relevant field history and AI results.
- Cannot access the complete owner dashboard unless independently authorized.

## Key model rule
A user can simultaneously own farms and work as a farmer. Do not store a single mutually exclusive global role as the sole authorization source.

## Authorization dimensions
- Identity: Firebase authenticated UID.
- Farm context: membership and permission.
- Field context: active assignment and permission.
- Resource context: ownership, scope, status, and operation.
- All privileged checks must be performed by trusted backend code.
