# Authorization Model

## Principle
Authentication answers "who is the user?" Authorization answers "may this user perform this action on this resource?"

## Contextual access
- Farm access is based on active membership and permissions.
- Field access for a farmer is based on active assignment and permitted actions.
- Owner operations require the relevant farm-level permission.
- Conversations require participant and context membership.
- Public reads are limited to explicitly published resources.

## Required checks
For each protected operation:
1. Verify Firebase token.
2. Derive UID from verified token.
3. Load relevant resource and parent context.
4. Verify membership/assignment and status.
5. Verify requested operation permission.
6. Validate resource state transition.
7. Record important activity where appropriate.

## Critical
Hiding a button or route is not authorization. Spring Boot must enforce every check. If Admin SDK accesses Firestore, Firestore Rules do not automatically protect those server operations.
