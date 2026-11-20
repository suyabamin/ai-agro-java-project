# FRONTEND AND BACKEND INTEGRATION MAP
**Project:** AgroAI
**Repository:** `D:\agro-ai-java-project`
**Audit Date:** 2026-11-19
**Status:** Baseline Audited & Endpoint Verified

---

## 1. Integration Matrix (89 Spring Boot Endpoints to Frontend Features)

| Feature | Existing API Endpoint | Method | Existing UI Location | Required Work | Status |
|---|---|---|---|---|---|
| User Sign In | `/api/v1/auth/me`, `/api/v1/users/me` | GET | `LoginPage.tsx` | Wire Stitch Sign In UI, Firebase Auth credentials, error banners | Connected |
| User Registration | `/api/v1/users/me/initialize` | POST | `RegistrationPage.tsx` | Wire Stitch Create Account UI, auto-provision user profile | Connected |
| Forgot Password | Firebase Auth Client (`sendPasswordResetEmail`) | SDK | (New Page) | Implement Stitch Forgot Password screen with reset email trigger | Ready |
| User Profile Management | `/api/v1/users/me`, `/api/v1/users/me/reconcile` | GET/PUT/POST | `ProfilePage.tsx` | Implement Stitch Profile & Account Security UI | Connected |
| User Public Profile | `/api/v1/users/{uid}/public` | GET | `ProfilePage.tsx` | Farmer public profile card in Directory | Connected |
| Farm List (Owner) | `/api/v1/farms` | GET | `DashboardPage.tsx` / `FarmSwitcher.tsx` | Implement Stitch My Farms screen with real farm cards | Connected |
| Farm Register (Owner) | `/api/v1/farms` | POST | `CreateFarmModal.tsx` | Implement Stitch Register Farm screen & full form validation | Connected |
| Farm Overview & Detail | `/api/v1/farms/{farmId}` | GET | `DashboardPage.tsx` | Implement Stitch Farm Overview screen with real counts | Connected |
| Farm Update | `/api/v1/farms/{farmId}` | PUT | `FarmMembersModal.tsx` | Implement Stitch Farm Settings screen for farm metadata | Connected |
| Farm Visibility / Archive | `/api/v1/farms/{farmId}/visibility`, `/archive` | PATCH/POST | `FarmMembersModal.tsx` | Wire toggles on Farm Settings screen | Connected |
| Farm Members & Roles | `/api/v1/farms/{farmId}/members` | GET/POST/PATCH/DELETE | `FarmMembersModal.tsx` | Embed into Farm Settings / Labor screen | Connected |
| Field List | `/api/v1/farms/{farmId}/fields` | GET | `FieldList.tsx` | Implement Stitch Field Management screen with status filters | Connected |
| Field Create | `/api/v1/farms/{farmId}/fields` | POST | `CreateFieldModal.tsx` | Implement Stitch Add Field screen with crop type & boundaries | Connected |
| Field Details Dashboard | `/api/v1/farms/{farmId}/fields/{fieldId}` | GET | `DashboardPage.tsx` | Implement Stitch Field Details Dashboard with telemetry | Connected |
| Field Edit | `/api/v1/farms/{farmId}/fields/{fieldId}` | PUT | `EditFieldModal.tsx` | Implement Stitch Edit Field screen | Connected |
| Field Archive | `/api/v1/farms/{farmId}/fields/{fieldId}/archive` | POST | `FieldList.tsx` | Archive confirmation dialog on Field Details / Edit | Connected |
| Farmer Directory | `/api/v1/public/farms` & user profiles | GET | (New Page) | Implement Stitch Farmer Directory screen with search & skill filters | Connected |
| Farmer Profile Details | `/api/v1/users/{uid}/public` | GET | (New Page) | Implement Stitch Farmer Profile screen with badges & ratings | Connected |
| Farm Job Postings (Owner) | `/api/v1/farms/{farmId}/jobs` | GET | `JobManagementSection.tsx` | Implement Stitch Job Vacancies screen | Connected |
| Create Job Posting | `/api/v1/farms/{farmId}/jobs` | POST | `CreateJobModal.tsx` | Implement Stitch Create Job screen with wage/crop inputs | Connected |
| Job Posting Details | `/api/v1/farms/{farmId}/jobs/{jobId}` | GET | (New Page) | Implement Stitch Job Details screen | Connected |
| Job Lifecycle (Publish/Pause/Close) | `/api/v1/farms/{farmId}/jobs/{jobId}/publish` | POST | `JobManagementSection.tsx` | Action buttons on Job Details screen | Connected |
| Public Job Marketplace | `/api/v1/public/jobs` | GET | `JobsPage.tsx` | Stitch styling on public job cards & search | Connected |
| Apply for Job (Farmer) | `/api/v1/jobs/{jobId}/applications` | POST | `ApplyJobModal.tsx` | Application modal / drawer with proposal & availability | Connected |
| My Applications (Farmer) | `/api/v1/users/me/applications` | GET | `MyApplicationsPage.tsx` | Farmer workspace application list | Connected |
| Application Detail & History | `/api/v1/applications/{applicationId}` | GET | `ApplicationDetailModal.tsx` | Application detail modal with timeline | Connected |
| Review Application (Owner) | `/api/v1/farms/{farmId}/applications/{id}/review` | POST | `ApplicationDetailModal.tsx` | Owner review, shortlist, approve, reject actions | Connected |
| Application Messaging | `/api/v1/applications/{id}/messages` | GET/POST | `ApplicationDetailModal.tsx` | In-app messaging thread | Connected |
| Field Assignments (Owner) | `/api/v1/farms/{farmId}/fields/{fieldId}/assignments` | GET/POST | `FieldAssignmentsSection.tsx` | Implement Stitch Assignment Management & Create Assignment | Connected |
| Assignment Details | `/api/v1/farms/{farmId}/fields/{fieldId}/assignments/{id}/history` | GET | `FieldAssignmentsSection.tsx` | Implement Stitch Assignment Details screen | Connected |
| Assignment Release / Reassign | `.../assignments/{id}/release`, `reassign` | POST | `FieldAssignmentsSection.tsx` | Action buttons with confirmation modal | Connected |
| Farmer Dashboard & Workdesk | `/api/v1/farmers/me/assignments` | GET | `FarmerWorkspacePage.tsx` | Implement Stitch Farmer Dashboard & Workdesk | Connected |
| Farmer Assigned Fields | `/api/v1/farmers/me/fields/{fieldId}` | GET | `FarmerWorkspacePage.tsx` | Implement Stitch My Assigned Fields screen | Connected |
| Farmer Field Details | `/api/v1/farmers/me/fields/{fieldId}` | GET | `FarmerWorkspacePage.tsx` | Implement Stitch Farmer Field Details screen | Connected |
| Farmer Payment History | `/api/v1/payments/my` | GET | (New Page) | Implement Stitch Farmer Payment History screen | Connected |
| Farmer Reviews | `/api/v1/assignments/{id}/review` | GET | `FarmerWorkspacePage.tsx` | Implement Stitch My Reviews screen | Connected |
| Monitoring Image Upload | `/api/v1/farms/{farmId}/fields/{fieldId}/monitoring/images` | POST | `FieldMonitoringPanel.tsx` | Implement Stitch Upload Crop Image screen with preview | Connected |
| Monitoring Image List | `.../monitoring/images` | GET | `FieldMonitoringPanel.tsx` | Image thumbnail grid on AI & Monitoring screens | Connected |
| Soil Telemetry Ingestion | `.../monitoring/telemetry` | POST | `FieldMonitoringPanel.tsx` | Sensor reading entry form | Connected |
| Soil Telemetry Dashboard | `.../monitoring/telemetry/latest`, `GET .../telemetry` | GET | `FieldMonitoringPanel.tsx` | Implement Stitch Soil Monitoring Dashboard & Telemetry History | Connected |
| Disease Availability Check | `.../monitoring/disease-availability` | GET | `FieldMonitoringPanel.tsx` | Check model availability banner (`MODEL_UNAVAILABLE`) | Connected |
| Disease Analysis Request | `.../monitoring/disease-analyses` | POST | `FieldMonitoringPanel.tsx` | Initiate AI analysis lifecycle | Connected |
| Disease Analysis Results | `.../monitoring/disease-analyses/{id}` | GET | `FieldMonitoringPanel.tsx` | Implement Stitch Analysis Processing & Result screens | Connected |
| Irrigation Dashboard & Plans | `.../monitoring/irrigation-plans` | GET/POST | `FieldMonitoringPanel.tsx` | Implement Stitch Irrigation Dashboard & Create Plan | Connected |
| Irrigation Status Update | `.../monitoring/irrigation-plans/{id}/status` | PATCH | `FieldMonitoringPanel.tsx` | Update plan lifecycle status (`ACTIVE`, `EXECUTED`) | Connected |
| Farm Payments (Owner) | `/api/v1/farms/{farmId}/payments` | GET | `FarmPaymentRecordsSection.tsx`| Implement Stitch Payment Dashboard & Payment Ledger | Connected |
| Record Manual Payment | `/api/v1/farms/{farmId}/payments` | POST | `RecordPaymentModal.tsx` | Implement Stitch Record Payment screen with BDT input | Connected |
| Payment Details & Reverse | `/api/v1/payments/{paymentId}`, `reverse` | GET/POST | `FarmPaymentRecordsSection.tsx`| Implement Stitch Payment Details & Reverse Payment | Connected |
| Farmer Performance Reviews | `/api/v1/assignments/{assignmentId}/review` | POST/PUT/GET | `AssignmentReviewModal.tsx` | Implement Stitch Review Management, Create Review & Details | Connected |
| Activity Log & Audit History | `.../monitoring/history`, `GET history/{id}` | GET | `FieldMonitoringPanel.tsx` | Implement Stitch Activity Dashboard, Activity Details & History | Connected |
| Notification Settings | Client preferences / Profile | Local/PUT | (New Page) | Implement Stitch Notification Settings screen | Connected |
| Account Security Settings | Firebase Auth SDK (`updatePassword`, etc.) | SDK | (New Page) | Implement Stitch Account Security screen | Connected |

---

## 2. API Contract Compliance Rules

1. **Authentication:** All private endpoints require the Firebase Bearer Token (`Authorization: Bearer <token>`).
2. **Contextual Role Enforcement:** Frontend requests pass active `farmId` and evaluate contextual permissions (`OWNER`, `MANAGER`, `FARMER`).
3. **No Fabricated Data:** Telemetry values, AI disease results, and irrigation water estimates must originate from backend API responses.
4. **Model Unavailability Contract:** When `GET /disease-availability` or `POST /disease-analyses` returns `MODEL_UNAVAILABLE`, frontend displays the honest status banner without generating fictitious disease names or accuracy percentages.
5. **Manual Payment Ledger:** Payment values are recorded in Bangladeshi Taka (BDT) as administrative manual records with confirmation for reversals.
