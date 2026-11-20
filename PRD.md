# Product Requirements Document (PRD)

## 1. Product summary
AgroAI is a dynamic agricultural management platform with a farmer marketplace and AI-assisted decision support. It supports multiple farms per user, multiple fields per farm, recruitment, flexible farmer assignments, field-specific monitoring, and historical records.

## 2. Problem
Farm owners may manage fields, workers, recruitment, crop observations, soil readings, and irrigation decisions through disconnected manual processes. Farmers may lack a clear digital workspace for the fields they are assigned to. AgroAI aims to centralize these workflows and provide carefully qualified AI assistance.

## 3. Goals
- Let users register and manage one or more farms.
- Organize each farm into independently managed fields.
- Connect farm owners with prospective workers through public job posts.
- Support many-to-many farmer/field assignments.
- Give farmers access only to their assigned workspaces and permitted functions.
- Record crop images, soil telemetry, AI analyses, irrigation plans, payments, reviews, and activity history.
- Provide an extensible architecture suitable for a university OOP Lab project.

## 4. Non-goals for initial release
- Guaranteed disease diagnosis or guaranteed yield predictions.
- Automated financial transfers.
- Autonomous irrigation hardware control.
- Government-grade land ownership verification.
- A full accounting/payroll platform.
- Training a production ML model as part of the initial foundation milestone.

## 5. User types and permissions
### Visitor
Can view public landing-page content, public farms, and published job posts subject to visibility settings.

### General user
Can register, authenticate, maintain a profile, explore public farms/jobs, and apply to jobs.

### Farm owner
Any authenticated user may register a farm. The creator becomes an owner of that farm and can manage that farm's resources according to permissions.

### Farmer
A user approved for work and assigned to one or more fields. A farmer may also own farms; these roles are not mutually exclusive.

Roles must be contextual. Do not use one mutually exclusive global role to represent all ownership and work relationships.

## 6. Functional requirements
### FR-01 Public landing page
Provide project information, registration/login entry points, public farm discovery, and job discovery.

### FR-02 User registration and authentication
Allow account registration and login using Firebase Authentication. Backend requests must verify Firebase ID tokens.

### FR-03 Farm registration
An authenticated user can register multiple farms. The creator receives owner membership for the new farm.

### FR-04 Farm dashboard
Each farm has a distinct dashboard showing its overview and authorized management functions.

### FR-05 Field management
Farm owners can create, update, view, and archive fields within their farms. A farm can contain multiple fields.

### FR-06 Farmer marketplace
Owners can publish, edit, close, and view job posts. Public users can browse and apply.

### FR-07 Application workflow
Owners can review applications and approve or reject them. Approval alone does not automatically assign a farmer to every field.

### FR-08 Private communication
Provide conversations scoped to a relevant application, farm, or assignment. Access must be checked server-side.

### FR-09 Field assignments
An owner can manually assign an approved farmer to one or more fields. Multiple farmers may work on one field, and one farmer may work on multiple fields. Preserve assignment history.

### FR-10 Farmer workspace
A farmer sees only assigned fields and permitted information, not the entire farm-owner dashboard.

### FR-11 Crop image submission
Authorized farmers/owners can submit crop images for analysis. Store the image in an external image bucket and store its URL, metadata, field reference, submitter, and status in Firestore.

### FR-12 Disease detection
The AI service may preprocess images and run a trained model. Results must include model/version metadata, prediction, confidence information, and limitations. Do not present demo or unvalidated results as reliable diagnosis.

### FR-13 Soil telemetry
Authorized users can submit field-specific soil readings with units, timestamp, source, and validation metadata.

### FR-14 AI analysis
Provide field-specific analysis records linked to their source submissions and model/rule versions.

### FR-15 Irrigation planning
Provide recommendations based on available field/soil/weather inputs. Recommendations must state their assumptions and must not directly control hardware in the initial release.

### FR-16 Payments and reviews
Allow authorized owners to record payment entries and reviews associated with an assignment. A manual payment record is not proof that money was transferred.

### FR-17 History and logs
Preserve important changes and work history. Logs must not expose secrets or unnecessary personal data.

### FR-18 Public farm discovery
A farm may opt into public listing. Private farms must not appear in public discovery.

## 7. Non-functional requirements
- Security: enforce authentication and authorization on trusted server-side operations.
- Privacy: expose only information necessary for each user and workflow.
- Reliability: validate input and handle external service failures.
- Maintainability: modular services, clear naming, tests, and documentation.
- Usability: responsive layouts and clear loading/error/empty states.
- Accessibility: keyboard support, labels, contrast, and semantic structure.
- Performance: paginate potentially large lists and avoid unbounded Firestore reads.
- Auditability: preserve important state transitions and actor/timestamp metadata.
- Portability: configure environments without hard-coded secrets.

## 8. Key business rules
1. A user may own multiple farms.
2. A user may be both a farm owner and a farmer.
3. Farm membership and field assignment are different relationships.
4. Job approval does not create field assignments automatically.
5. Assignment changes must preserve history.
6. Farmers must not access unassigned fields.
7. AI results must link to the originating submission and field.
8. Payment records are manual records unless a verified payment provider integration is later approved.
9. Public listing is opt-in.
10. All privileged actions require server-side authorization.

## 9. Success criteria
- A user can register a farm and access its dashboard.
- An owner can create fields and publish a job.
- A user can apply and the owner can review the application.
- An approved farmer can be manually assigned to selected fields.
- Farmer access is limited to assigned fields.
- Field submissions and AI result records are traceable.
- Critical workflows have automated tests and documented acceptance evidence.

## 10. Open decisions
- Final image storage provider and free-tier suitability.
- Exact crop types and supported disease classes.
- Whether weather data will be integrated and from which provider.
- Final notification mechanism.
- Deployment providers and production budget.
- Final retention policy for images, telemetry, and logs.
