# Software Requirements Specification (SRS)

## 1. Introduction
This SRS describes the functional and non-functional requirements for AgroAI. It complements the product-level overview in the root `PRD.md`.

## 2. System context
AgroAI consists of a React web client, Spring Boot application backend, Firebase Authentication, Cloud Firestore, an external image bucket, and a Python FastAPI AI service.

## 3. Functional requirements
Refer to FR-01 through FR-18 in `../../PRD.md`. The implementation must preserve their identifiers when requirements are refined.

## 4. Data requirements
Core entities include users, farms, memberships, fields, assignments, jobs, applications, conversations, messages, image submissions, telemetry, AI results, irrigation plans, payments, reviews, and activity logs.

## 5. Interface requirements
- Frontend communicates with the Spring Boot API over HTTPS in deployed environments.
- Spring Boot verifies Firebase ID tokens.
- Spring Boot communicates with Firestore through trusted server SDK access.
- Spring Boot calls FastAPI through authenticated/configured service-to-service communication as appropriate.
- External image storage is accessed through a controlled upload workflow.

## 6. Non-functional requirements
Security, privacy, maintainability, usability, accessibility, reliability, performance, auditability, and portability are specified in `../../PRD.md`.

## 7. Constraints
- Firestore is a document database.
- No SQL join assumptions.
- No production AI claims without evaluation.
- No automated financial transfer in the initial scope.
- Storage provider and deployment platform remain open decisions.

## 8. Verification
Every requirement should map to one or more acceptance criteria and test cases. Requirements not yet implemented must remain marked as planned.
