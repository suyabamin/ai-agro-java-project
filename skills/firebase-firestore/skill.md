# Skill: Firebase and Firestore

## Trigger
Use for Firebase Authentication, Admin SDK, Firestore documents, queries, indexes, and security rules.

## Workflow
1. Read database, authentication, authorization, and security documents.
2. Confirm project ID and environment configuration without exposing credentials.
3. Keep Admin SDK credentials server-side.
4. Verify Firebase ID tokens in Spring Boot.
5. Design document paths and queries around access patterns.
6. Avoid unbounded arrays and oversized documents.
7. Plan indexes and pagination.
8. Remember Admin SDK bypasses Firestore Security Rules.
9. Enforce authorization in backend code.
10. Test both allowed and denied access paths.
11. Record actual connectivity level: configured, initialized, read verified, write verified.

## Restrictions
Never fabricate successful connectivity. Never print private key material or tokens.
