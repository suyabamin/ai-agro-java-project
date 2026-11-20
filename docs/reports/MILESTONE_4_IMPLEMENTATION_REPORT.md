# AgroAI — Milestone 4 Implementation Report
## Farmer Marketplace: Recruitment, Job Lifecycle, Application Workflows & Discussion Threads

**Project:** AgroAI Platform  
**Repository:** `D:\agro-ai-java-project`  
**Milestone:** 4 — Farmer Marketplace  
**Scope:** Phase 4A (Job Posting & Management), Phase 4B (Public Job Marketplace), Phase 4C (Farmer Application Management), Phase 4D (Farm Recruitment Management)  
**Implementation Status:** COMPLETE  
**Date:** November 17, 2026  
**Auditor / Engineer:** AgroAI Full-Stack Architecture & Security Team  

---

## 1. Executive Summary

Milestone 4 delivers the complete, production-grade **Farmer Marketplace** for the AgroAI platform. It connects farm owners/managers with agricultural laborers, machinery specialists, irrigation workers, and agronomists across Bangladesh.

### Core Architecture Highlights:
1. **Canonical Identifier Arithmetic:**
   - Jobs: `job-<UUID>` (e.g. `job-4647e6eb-301b-40df-9614-404a4f59c5ae`) validated with `^[a-zA-Z0-9-]{1,64}$`.
   - Applications: Deterministic document ID `app_${jobId}::${safeUid}` (e.g. `app_job-1111-2222-3333::uid_ZmFybWVyLWFwcGxpY2FudC0wMDE`) validated with `^[a-zA-Z0-9:_=-]{1,128}$`. This formulation makes duplicate applications mathematically impossible even under highly concurrent parallel requests.
2. **Dual-Layer Authorization Symmetry:**
   - Spring Security declarative method security (`@farmSecurity.isOwnerOrManager`, `@farmSecurity.isMember`) verified at controller entry points.
   - Fail-closed programmatic verification at service layer (`JobService`, `JobApplicationService`) against verified membership documents and token claims.
   - Mutating endpoints enforce `@RequiresRevocationCheck` preventing revoked or stale tokens from modifying state.
3. **Application Approval Boundary Invariant:**
   - **CRITICAL INVARIANT:** Approving an application (`APPROVED`) updates recruitment status and creates an audit history record, but **DOES NOT** create any field assignments. Field assignments remain strictly isolated in Milestone 5.
4. **Optimistic Concurrency Control (OCC):**
   - Both `Job` and `JobApplication` maintain strict entity versioning (`version`), preventing concurrent overwrite anomalies.
5. **Private Discussion & Immutable Audit History:**
   - Every status transition generates an immutable `ApplicationHistory` event.
   - Private communication between candidates and hiring managers is persisted in `ApplicationMessage` threads with symmetrical access control.

---

## 2. Subsystem Breakdown

### Phase 4A — Job Posting & Farm Management
- **Domain Models & Enums:**
  - `Job.java`: Complete job representation (`jobId`, `farmId`, `title`, `description`, `jobCategory`, `employmentType`, `requiredSkills`, `experienceRequirements`, `numberOfPositions`, `salaryType`, `minimumSalary`, `maximumSalary`, `currency`, `locationSummary`, `status`, `applicationDeadline`, `startDate`, `endDate`, `totalApplicationsCount`, `version`, `createdAt`, `updatedAt`, `publishedAt`, `closedAt`).
  - Enums: `JobStatus` (`DRAFT`, `PUBLISHED`, `PAUSED`, `CLOSED`, `ARCHIVED`), `JobCategory` (7 categories), `EmploymentType` (5 types), `SalaryType` (6 types).
- **Service Layer (`JobService.java`):**
  - `createJob`: Initializes job in `DRAFT` (or immediately `PUBLISHED` if requested).
  - `updateJob`: Performs OCC version checks, updates details, increments version.
  - `publishJob`: Validates minimum requirements and transitions `DRAFT`/`PAUSED` → `PUBLISHED`.
  - `pauseJob`: Transitions `PUBLISHED` → `PAUSED`.
  - `closeJob`: Transitions `PUBLISHED`/`PAUSED` → `CLOSED`.
  - `archiveJob`: Restricted strictly to `OWNER` role; marks status as `ARCHIVED`.
- **REST Controller (`JobController.java`):**
  - Path: `/api/v1/farms/{farmId}/jobs`
  - Endpoints: `POST` (create), `GET` (list), `GET /{jobId}` (detail), `PUT /{jobId}` (update), `POST /{jobId}/publish`, `POST /{jobId}/pause`, `POST /{jobId}/close`, `POST /{jobId}/archive`.

### Phase 4B — Public Job Marketplace
- **Public Service Discovery (`JobService.getPublicJobs`):**
  - Multi-attribute query filtering on `status == PUBLISHED` with filters for `category`, `employmentType`, `district`, `division`, `minSalary`, `maxSalary`, `keyword`, with pagination.
  - Public farm profile enrichment (`farmName`, `farmDistrict`, `farmDivision`) attached to `PublicJobResponseDTO`.
- **Public REST Controller (`PublicJobController.java`):**
  - Path: `/api/v1/public/jobs`
  - Unauthenticated endpoints: `GET /api/v1/public/jobs` and `GET /api/v1/public/jobs/{jobId}`.

### Phase 4C — Farmer Application Management
- **Domain Models:**
  - `JobApplication.java`: Application entity with candidate profile linkage, cover letter, skills, salary, status, version.
  - `ApplicationStatus`: `SUBMITTED`, `UNDER_REVIEW`, `SHORTLISTED`, `APPROVED`, `REJECTED`, `WITHDRAWN`.
- **Deterministic Application ID:**
  - `KeyEncoder.applicationDocId(jobId, applicantUid)` calculates `app_${jobId}::${safeUid}`.
  - Prevents race conditions and guarantees duplicate prevention at storage layer.
- **Conflict & Validation Controls:**
  - Farm members are prohibited from applying to jobs posted by their own farm (`IllegalArgumentException`).
  - Active candidate can withdraw (`WITHDRAWN`) at any stage prior to final resolution.
- **REST Controller (`ApplicationController.java`):**
  - `POST /api/v1/jobs/{jobId}/applications`: Candidate submission.
  - `GET /api/v1/users/me/applications`: Candidate personal workspace.
  - `GET /api/v1/applications/{applicationId}`: Single application fetch.
  - `POST /api/v1/applications/{applicationId}/withdraw`: Candidate withdrawal.
  - `GET /api/v1/applications/{applicationId}/history`: Audit trail.
  - `GET /api/v1/applications/{applicationId}/messages`: Discussion thread.
  - `POST /api/v1/applications/{applicationId}/messages`: Send message.

### Phase 4D — Farm Recruitment Management
- **Recruitment Controller (`RecruitmentController.java`):**
  - Path: `/api/v1/farms/{farmId}/applications`
  - `GET /api/v1/farms/{farmId}/applications`: Farm managers browse received applications with status and job filters.
  - `POST /api/v1/farms/{farmId}/applications/{applicationId}/review`: Marks candidate `UNDER_REVIEW`.
  - `POST /api/v1/farms/{farmId}/applications/{applicationId}/shortlist`: Marks candidate `SHORTLISTED`.
  - `POST /api/v1/farms/{farmId}/applications/{applicationId}/approve`: Marks candidate `APPROVED` with decision note and version check.
  - `POST /api/v1/farms/{farmId}/applications/{applicationId}/reject`: Marks candidate `REJECTED` with decision note and version check.

---

## 3. Persistence Architecture

### Collections & Storage
| Collection Name | Key Pattern | Multi-Tenancy Boundary | Write Permission |
| :--- | :--- | :--- | :--- |
| `jobs` | `job-<UUID>` | Partitioned by `farmId` | Admin SDK Only (`allow write: if false`) |
| `applications` | `app_${jobId}::${safeUid}` | Scoped to `jobId` & `farmId` | Admin SDK Only (`allow write: if false`) |
| `application_history` | `hist_<UUID>` | Scoped to `applicationId` | Admin SDK Only (`allow write: if false`) |
| `application_messages`| `msg_<UUID>` | Scoped to `applicationId` | Admin SDK Only (`allow write: if false`) |

---

## 4. Source Files Created / Modified

### Backend:
- `backend/src/main/java/com/agroai/model/JobStatus.java`
- `backend/src/main/java/com/agroai/model/JobCategory.java`
- `backend/src/main/java/com/agroai/model/EmploymentType.java`
- `backend/src/main/java/com/agroai/model/SalaryType.java`
- `backend/src/main/java/com/agroai/model/ApplicationStatus.java`
- `backend/src/main/java/com/agroai/model/Job.java`
- `backend/src/main/java/com/agroai/model/JobApplication.java`
- `backend/src/main/java/com/agroai/model/ApplicationHistory.java`
- `backend/src/main/java/com/agroai/model/ApplicationMessage.java`
- `backend/src/main/java/com/agroai/util/KeyEncoder.java` (added patterns & applicationDocId)
- `backend/src/main/java/com/agroai/exception/JobNotFoundException.java`
- `backend/src/main/java/com/agroai/exception/ApplicationNotFoundException.java`
- `backend/src/main/java/com/agroai/exception/DuplicateApplicationException.java`
- `backend/src/main/java/com/agroai/exception/GlobalExceptionHandler.java` (registered handlers)
- `backend/src/main/java/com/agroai/dto/CreateJobRequest.java`
- `backend/src/main/java/com/agroai/dto/UpdateJobRequest.java`
- `backend/src/main/java/com/agroai/dto/JobResponseDTO.java`
- `backend/src/main/java/com/agroai/dto/PublicJobResponseDTO.java`
- `backend/src/main/java/com/agroai/dto/CreateApplicationRequest.java`
- `backend/src/main/java/com/agroai/dto/ApplicationDecisionRequest.java`
- `backend/src/main/java/com/agroai/dto/JobApplicationResponseDTO.java`
- `backend/src/main/java/com/agroai/dto/ApplicationHistoryResponseDTO.java`
- `backend/src/main/java/com/agroai/dto/SendMessageRequest.java`
- `backend/src/main/java/com/agroai/dto/ApplicationMessageResponseDTO.java`
- `backend/src/main/java/com/agroai/repository/JobRepository.java`
- `backend/src/main/java/com/agroai/repository/FirestoreJobRepository.java`
- `backend/src/main/java/com/agroai/repository/JobApplicationRepository.java`
- `backend/src/main/java/com/agroai/repository/FirestoreJobApplicationRepository.java`
- `backend/src/main/java/com/agroai/repository/ApplicationHistoryRepository.java`
- `backend/src/main/java/com/agroai/repository/FirestoreApplicationHistoryRepository.java`
- `backend/src/main/java/com/agroai/repository/ApplicationMessageRepository.java`
- `backend/src/main/java/com/agroai/repository/FirestoreApplicationMessageRepository.java`
- `backend/src/main/java/com/agroai/service/JobService.java`
- `backend/src/main/java/com/agroai/service/JobApplicationService.java`
- `backend/src/main/java/com/agroai/controller/JobController.java`
- `backend/src/main/java/com/agroai/controller/PublicJobController.java`
- `backend/src/main/java/com/agroai/controller/ApplicationController.java`
- `backend/src/main/java/com/agroai/controller/RecruitmentController.java`

### Security Rules:
- `firestore.rules` (added read rules for jobs, applications, history, messages; writes locked to false)

### Frontend:
- `frontend/src/types/job.ts`
- `frontend/src/services/jobService.ts`
- `frontend/src/services/applicationService.ts`
- `frontend/src/components/recruitment/CreateJobModal.tsx`
- `frontend/src/components/recruitment/ApplyJobModal.tsx`
- `frontend/src/components/recruitment/ApplicationDetailModal.tsx`
- `frontend/src/components/recruitment/JobManagementSection.tsx`
- `frontend/src/pages/JobsPage.tsx`
- `frontend/src/pages/MyApplicationsPage.tsx`
- `frontend/src/pages/DashboardPage.tsx` (embedded JobManagementSection)
- `frontend/src/components/layout/DashboardLayout.tsx` (added navigation items)
- `frontend/src/App.tsx` (routed `/jobs` and `/dashboard/applications`)

---

## 5. Implementation Status
- Phase 4A (Job Posting & Management): COMPLETE
- Phase 4B (Public Job Marketplace): COMPLETE
- Phase 4C (Farmer Application Management): COMPLETE
- Phase 4D (Farm Recruitment Management): COMPLETE
- Verification & Compilation: PASS (Backend Maven clean compile, Frontend Vite clean build)
