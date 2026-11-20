# AgroAI — Milestone 4 API & Data Model Documentation
## REST Endpoints, Payloads, Schemas, Identifier Formats & Persistence Mappings

**Project:** AgroAI Platform  
**Repository:** `D:\agro-ai-java-project`  
**Milestone:** 4 — Farmer Marketplace  
**Date:** November 17, 2026  

---

## 1. Domain Entities & Schemas

### 1.1. `Job` Entity
Firestore Collection: `/jobs/{jobId}`
```json
{
  "jobId": "job-4647e6eb-301b-40df-9614-404a4f59c5ae",
  "farmId": "farm-1111-2222-3333-4444",
  "title": "Seasonal Rice Harvester",
  "description": "Operate harvesting machinery during Aman harvest season.",
  "jobCategory": "HARVESTING",
  "employmentType": "SEASONAL",
  "requiredSkills": ["Harvester Operation", "Machine Maintenance"],
  "experienceRequirements": "2 years operating combine harvesters",
  "numberOfPositions": 3,
  "salaryType": "DAILY",
  "minimumSalary": 800.0,
  "maximumSalary": 1000.0,
  "currency": "BDT",
  "locationSummary": "Joydebpur, Gazipur",
  "status": "PUBLISHED",
  "applicationDeadline": "2026-12-01T00:00:00Z",
  "startDate": "2026-12-05T00:00:00Z",
  "endDate": "2026-12-25T00:00:00Z",
  "totalApplicationsCount": 1,
  "version": 1,
  "createdAt": "2026-11-17T14:00:00Z",
  "updatedAt": "2026-11-17T14:00:00Z",
  "publishedAt": "2026-11-17T14:05:00Z",
  "closedAt": null
}
```

### 1.2. `JobApplication` Entity
Firestore Collection: `/applications/{applicationId}`
Deterministic Key: `app_${jobId}::${safeUid}`
```json
{
  "applicationId": "app_job-4647e6eb-301b-40df-9614-404a4f59c5ae::uid_ZmFybWVyLTAwMQ",
  "jobId": "job-4647e6eb-301b-40df-9614-404a4f59c5ae",
  "farmId": "farm-1111-2222-3333-4444",
  "applicantUid": "farmer-uid-001",
  "applicantSafeUid": "uid_ZmFybWVyLTAwMQ",
  "applicantName": "Mohammad Kader",
  "applicantEmail": "kader@agroai.org",
  "coverLetter": "Extensive experience in Aman and Boro rice harvesting.",
  "experienceYears": 4,
  "relevantSkills": ["Harvester Operation", "Tractor Driving"],
  "expectedSalary": 900.0,
  "earliestStartDate": "2026-12-05T00:00:00Z",
  "status": "APPROVED",
  "reviewNotes": "Qualified machinery specialist.",
  "reviewedByUid": "owner-uid-001",
  "reviewedAt": "2026-11-17T14:30:00Z",
  "version": 3,
  "submittedAt": "2026-11-17T14:10:00Z",
  "updatedAt": "2026-11-17T14:30:00Z"
}
```

### 1.3. `ApplicationHistory` Entity
Firestore Collection: `/application_history/{historyId}`
Key: `hist_<UUID>`
```json
{
  "historyId": "hist-7a8b9c0d-1e2f-3a4b",
  "applicationId": "app_job-4647e6eb-301b-40df-9614-404a4f59c5ae::uid_ZmFybWVyLTAwMQ",
  "jobId": "job-4647e6eb-301b-40df-9614-404a4f59c5ae",
  "farmId": "farm-1111-2222-3333-4444",
  "applicantUid": "farmer-uid-001",
  "fromStatus": "SHORTLISTED",
  "toStatus": "APPROVED",
  "performedByUid": "owner-uid-001",
  "note": "Approved candidate",
  "timestamp": "2026-11-17T14:30:00Z"
}
```

### 1.4. `ApplicationMessage` Entity
Firestore Collection: `/application_messages/{messageId}`
Key: `msg_<UUID>`
```json
{
  "messageId": "msg-11223344-5566-7788",
  "applicationId": "app_job-4647e6eb-301b-40df-9614-404a4f59c5ae::uid_ZmFybWVyLTAwMQ",
  "jobId": "job-4647e6eb-301b-40df-9614-404a4f59c5ae",
  "farmId": "farm-1111-2222-3333-4444",
  "applicantUid": "farmer-uid-001",
  "senderUid": "farmer-uid-001",
  "senderName": "Mohammad Kader",
  "message": "I am ready to report on site on December 5th.",
  "sentAt": "2026-11-17T14:35:00Z"
}
```

---

## 2. REST Endpoints Specification

### Phase 4A: Farm Job Management
- `POST /api/v1/farms/{farmId}/jobs`
  - Auth: Bearer Token (OWNER, MANAGER)
  - Payload: `CreateJobRequest`
  - Response: 201 Created (`JobResponseDTO`)
- `GET /api/v1/farms/{farmId}/jobs?includeUnpublished=true`
  - Auth: Bearer Token (OWNER, MANAGER, OBSERVER)
  - Response: 200 OK (`List<JobResponseDTO>`)
- `GET /api/v1/farms/{farmId}/jobs/{jobId}`
  - Auth: Bearer Token (OWNER, MANAGER, OBSERVER)
  - Response: 200 OK (`JobResponseDTO`)
- `PUT /api/v1/farms/{farmId}/jobs/{jobId}`
  - Auth: Bearer Token (OWNER, MANAGER)
  - Payload: `UpdateJobRequest` (includes `version` for OCC check)
  - Response: 200 OK (`JobResponseDTO`)
- `POST /api/v1/farms/{farmId}/jobs/{jobId}/publish`
  - Auth: Bearer Token (OWNER, MANAGER)
  - Response: 200 OK (`JobResponseDTO`)
- `POST /api/v1/farms/{farmId}/jobs/{jobId}/pause`
  - Auth: Bearer Token (OWNER, MANAGER)
  - Response: 200 OK (`JobResponseDTO`)
- `POST /api/v1/farms/{farmId}/jobs/{jobId}/close`
  - Auth: Bearer Token (OWNER, MANAGER)
  - Response: 200 OK (`JobResponseDTO`)
- `POST /api/v1/farms/{farmId}/jobs/{jobId}/archive`
  - Auth: Bearer Token (OWNER ONLY)
  - Response: 200 OK (`ApiResponse<Void>`)

### Phase 4B: Public Job Marketplace
- `GET /api/v1/public/jobs`
  - Auth: None (Public)
  - Query Params: `category`, `employmentType`, `district`, `division`, `minSalary`, `maxSalary`, `keyword`, `page`, `size`
  - Response: 200 OK (`List<PublicJobResponseDTO>`)
- `GET /api/v1/public/jobs/{jobId}`
  - Auth: None (Public)
  - Response: 200 OK (`PublicJobResponseDTO`)

### Phase 4C: Farmer Application Management
- `POST /api/v1/jobs/{jobId}/applications`
  - Auth: Bearer Token (Candidate)
  - Payload: `CreateApplicationRequest`
  - Response: 201 Created (`JobApplicationResponseDTO`)
- `GET /api/v1/users/me/applications?page=0&size=20`
  - Auth: Bearer Token (Candidate)
  - Response: 200 OK (`List<JobApplicationResponseDTO>`)
- `GET /api/v1/applications/{applicationId}`
  - Auth: Bearer Token (Candidate or Farm Manager)
  - Response: 200 OK (`JobApplicationResponseDTO`)
- `POST /api/v1/applications/{applicationId}/withdraw`
  - Auth: Bearer Token (Candidate)
  - Response: 200 OK (`JobApplicationResponseDTO`)
- `GET /api/v1/applications/{applicationId}/history`
  - Auth: Bearer Token (Candidate or Farm Manager)
  - Response: 200 OK (`List<ApplicationHistoryResponseDTO>`)
- `GET /api/v1/applications/{applicationId}/messages`
  - Auth: Bearer Token (Candidate or Farm Manager)
  - Response: 200 OK (`List<ApplicationMessageResponseDTO>`)
- `POST /api/v1/applications/{applicationId}/messages`
  - Auth: Bearer Token (Candidate or Farm Manager)
  - Payload: `SendMessageRequest`
  - Response: 200 OK (`ApplicationMessageResponseDTO`)

### Phase 4D: Farm Recruitment Management
- `GET /api/v1/farms/{farmId}/applications`
  - Auth: Bearer Token (OWNER, MANAGER)
  - Query Params: `jobId`, `status`, `page`, `size`
  - Response: 200 OK (`List<JobApplicationResponseDTO>`)
- `POST /api/v1/farms/{farmId}/applications/{applicationId}/review`
  - Auth: Bearer Token (OWNER, MANAGER)
  - Response: 200 OK (`JobApplicationResponseDTO`)
- `POST /api/v1/farms/{farmId}/applications/{applicationId}/shortlist`
  - Auth: Bearer Token (OWNER, MANAGER)
  - Response: 200 OK (`JobApplicationResponseDTO`)
- `POST /api/v1/farms/{farmId}/applications/{applicationId}/approve`
  - Auth: Bearer Token (OWNER, MANAGER)
  - Payload: `ApplicationDecisionRequest` (includes `version`)
  - Response: 200 OK (`JobApplicationResponseDTO`)
- `POST /api/v1/farms/{farmId}/applications/{applicationId}/reject`
  - Auth: Bearer Token (OWNER, MANAGER)
  - Payload: `ApplicationDecisionRequest` (includes `version`)
  - Response: 200 OK (`JobApplicationResponseDTO`)
