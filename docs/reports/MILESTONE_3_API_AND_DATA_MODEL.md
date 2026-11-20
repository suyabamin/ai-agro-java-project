# AgroAI — Milestone 3: API and Data Model Specification
## Comprehensive REST API & Cloud Firestore Schema Specification

**Project:** AgroAI Platform  
**Target Milestone:** Milestone 3 — Farm and Field Management  
**Revision:** Revision 2  
**Date:** 2026-11-17  
**Author:** Lead Software Architect & Security Engineer  
**Status:** PLANNING ONLY — PENDING USER APPROVAL (Strictly Documentation-Only — Zero Application Code Modified)  
**Implementation Authorization:** NOT GRANTED  
**Firebase Deployment Authorization:** NOT GRANTED  

---

## Revision History

| Revision | Date | Description | Status |
|---|---|---|---|
| **Revision 1** | 2026-11-17 | Initial API and data model draft. Included `assignedFarmerUids`, direct public reads on `farms/{farmId}`, underscoring in proposed IDs, missing membership endpoints, and `@Version` annotations. | Superceded |
| **Revision 2** | 2026-11-17 | Comprehensive schema and API consistency correction: (1) Added top-level `public_farms/{farmId}` collection with strict projection specification; (2) Adopted `farm-<uuid>` and composite `{farmId}--{localFieldId}` identifiers satisfying `^[a-zA-Z0-9-]{1,64}$`; (3) Added full membership management endpoint suite (`/api/v1/farms/{farmId}/members`); (4) Standardized on `activeFieldCount` across schema and DTOs; (5) Added `expectedVersion` to mutating DTOs for transactional optimistic concurrency; (6) Stripped all assignment properties (`assignedFarmerUids`) and endpoints; (7) Standardized public discovery routes on `/api/v1/public/farms`; (8) Specified field archival as `POST .../archive` restricted to `OWNER`. | **CURRENT AUTHORITATIVE BASELINE** |

---

## 1. Authoritative Cloud Firestore Data Model Specification

All documents reside in top-level collections in Cloud Firestore. No nested subcollections are used for operational entities.

```
+---------------------------------------------------------------------------------------------------+
|                               FIRESTORE TOP-LEVEL COLLECTIONS OVERVIEW                            |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  1. /farms/{farmId}                              --> Strictly Private Farm Documents               |
|  2. /public_farms/{farmId}                       --> Sanitized Public Farm Projections             |
|  3. /farm_members/{membershipId}                 --> Contextual Roster & Permissions               |
|  4. /fields/{fieldDocumentId}                    --> Operational Field Units                       |
|  5. /field_assignments/{assignmentId}            --> DEFERRED (M4/M5 Compatibility Schema Only)    |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
```

---

### 1.1 Collection: `farms` (Private Farm Entity)
- **Path:** `/farms/{farmId}`
- **Document ID Format:** Deterministic identifier matching `^[a-zA-Z0-9-]{1,64}$` validated via `KeyEncoder.validateFarmId(farmId)`. Standard: `farm-` + UUIDv4 (lowercase hyphens, 41 characters).
- **Access Rule:** Strictly private. Readable **only** by authenticated active members (`isFarmMember(farmId)`). **Never readable publicly.**

| Field Name | Type | Constraints / Validation | Description |
|---|---|---|---|
| `farmId` | String | Required, 1–64 alphanumeric/hyphen chars | Canonical farm identifier |
| `name` | String | Required, 3–100 chars | Display name of the farm |
| `description` | String | Optional, max 500 chars | Overview of the farm initiative |
| `ownerUid` | String | Required, valid Firebase UID | Raw Firebase UID of the farm creator |
| `ownerSafeUid` | String | Required, `uid_...` format | Deterministic safe UID via `KeyEncoder.encodeUid` |
| `district` | String | Required, 2–50 chars | Administrative district (e.g. "Dinajpur") |
| `division` | String | Required, 2–50 chars | Administrative division (e.g. "Rangpur") |
| `detailedAddress`| String | Optional, max 200 chars | Private physical street / village address |
| `totalAreaHectares`| Double | Required, min 0.1, max 100000.0 | Total land area in hectares |
| `visibility` | String | Enum: `PUBLIC`, `PRIVATE` | Public discovery visibility flag |
| `status` | String | Enum: `ACTIVE`, `SUSPENDED`, `ARCHIVED` | Operational status of the farm |
| `activeFieldCount` | Integer | Min 0, default 0 | Number of non-archived fields |
| `activeCropTypes`| Array<String> | Optional list of crop types | Denormalized active crops for quick reference |
| `version` | Integer | Min 1, default 1 | Transaction-based optimistic concurrency counter |
| `registeredAt` | Timestamp | Required | Creation timestamp (UTC) |
| `updatedAt` | Timestamp | Required | Last update timestamp (UTC) |
| `archivedAt` | Timestamp | Nullable | Archival timestamp (UTC) if soft-archived |

---

### 1.2 Collection: `public_farms` (Sanitized Public Projection)
- **Path:** `/public_farms/{farmId}`
- **Document ID Format:** Exactly matches parent `farmId`.
- **Access Rule:** Readable by unauthenticated visitors when `status == ACTIVE`. Managed exclusively by backend `PublicFarmProjectionService`. Direct client writes strictly denied.

| Field Name | Type | Constraints / Validation | Description |
|---|---|---|---|
| `farmId` | String | Required, matches parent `farmId` | Public farm identifier |
| `name` | String | Required, 3–100 chars | Public display name |
| `description` | String | Optional, max 500 chars | Public description |
| `district` | String | Required, 2–50 chars | Administrative district for regional search |
| `division` | String | Required, 2–50 chars | Administrative division for regional filtering |
| `totalAreaHectares`| Double | Required, min 0.1 | Total land area in hectares |
| `activeFieldCount` | Integer | Min 0, default 0 | Total active fields |
| `activeCropTypes`| Array<String> | Array of strings | Active crops cultivated |
| `status` | String | Value: `ACTIVE` | Explicit operational status for security rule predicates |
| `visibility` | String | Value: `PUBLIC` | Explicit discovery flag for security rule predicates |
| `farmVersion` | Integer | Min 1 | Version of the parent private farm document |
| `projectionVersion`| Integer | Min 1 | Generation counter for projection update |
| `registeredAt` | Timestamp | Required | Original platform registration timestamp |
| `updatedAt` | Timestamp | Required | Last projection update timestamp |

*Prohibited Fields (Never Copied to `public_farms`):* `ownerUid`, `ownerSafeUid`, `detailedAddress`, contact phone, internal notes, financial records, tenant data.

---

### 1.3 Collection: `farm_members` (Contextual Permissions Roster)
- **Path:** `/farm_members/{membershipId}`
- **Document ID Format:** Deterministic composite key: `mbr_${farmId}::${safeUid}` via `KeyEncoder.membershipDocId(farmId, userId)`.
- **Access Rule:** Readable only by authenticated members of the same farm. Direct client writes strictly denied.

| Field Name | Type | Constraints / Validation | Description |
|---|---|---|---|
| `membershipId` | String | Required, `mbr_${farmId}::${safeUid}` | Deterministic composite identifier |
| `farmId` | String | Required, matches `^[a-zA-Z0-9-]{1,64}$` | Foreign reference to parent farm |
| `userId` | String | Required, raw Firebase UID | Reference to member user UID |
| `safeUid` | String | Required, `uid_...` format | Deterministic safe UID |
| `role` | String | Enum: `OWNER`, `MANAGER`, `OBSERVER` | Contextual farm authority role |
| `status` | String | Enum: `ACTIVE`, `REVOKED` | Operational membership status in Milestone 3 (see note below) |
| `joinedAt` | Timestamp | Required | Date joined farm organization |
| `updatedAt` | Timestamp | Required | Last role update timestamp |
| `revokedAt` | Timestamp | Nullable | Date revoked (if applicable) |
| `createdByUid` | String | Required | UID of the user who granted membership |
| `updatedByUid` | String | Nullable | UID of the user who last updated role |

*Milestone 3 Membership Status Scope Notice:* Because prospective recruitment, farmer applications, and email invitations are strictly excluded from Milestone 3, all farm memberships created in Milestone 3 represent existing authenticated Firebase users directly assigned by the farm owner. Therefore, only **`ACTIVE`** and **`REVOKED`** are valid operational statuses in Milestone 3. The historical statuses `INVITED` and `DECLINED` present in the backend `MembershipStatus.java` enum are strictly deferred to future invitation workflows in Milestone 4.

---

### 1.4 Collection: `fields` (Operational Field Unit)
- **Path:** `/fields/{fieldDocumentId}`
- **Document ID Format:** Globally unique composite key: `{farmId}--{localFieldId}` validated via `KeyEncoder.validateFieldId(fieldDocumentId)`. Length <= 64 characters.
- **Identifier Arithmetic Breakdown:**
  - Parent `farmId` maximum length: Standard UUID format is 41 characters (`farm-` + 36-char UUIDv4). Any parent farm containing fields must have `farmId` length <= 41 characters.
  - Separator: Exactly 2 characters (`--`).
  - `localFieldId` length range: 1 to 21 characters (`^[a-zA-Z0-9-]{1,21}$`).
  - **Maximum Composite ID Length:** 41 (`farmId`) + 2 (`--`) + 21 (`localFieldId`) = **64 characters**, adhering strictly to `KeyEncoder.validateFieldId` regex `^[a-zA-Z0-9-]{1,64}$`.
  - **Instance Example Arithmetic:** `farm-550e8400-e29b-41d4-a716-446655440000--field-01` has length 41 (`farmId`) + 2 (`--`) + 8 (`field-01`) = 51 characters. Note that 51 characters is the length of this specific 8-character slug instance, whereas 64 characters is the maximum allowable length.
- **Access Rule:** Readable only by authenticated active members of the parent farm. Direct client writes strictly denied.

| Field Name | Type | Constraints / Validation | Description |
|---|---|---|---|
| `fieldId` | String | Required, `{farmId}--{localFieldId}` | Globally unique field document ID |
| `localFieldId` | String | Required, 1–21 chars (`^[a-zA-Z0-9-]{1,21}$`) | Local human-meaningful slug within farm |
| `farmId` | String | Required, foreign key to parent farm | Reference to parent farm |
| `name` | String | Required, 2–80 chars | Field designation (e.g. "North Paddy Plot") |
| `cropType` | String | Enum: `RICE`, `WHEAT`, `JUTE`, `MAIZE`, `POTATO`, `TEA`, `VEGETABLES`, `OTHER` | Primary crop planted |
| `soilType` | String | Enum: `CLAY`, `SANDY`, `LOAMY`, `SILTY`, `PEATY`, `CHALKY` | Soil classification baseline |
| `areaHectares` | Double | Required, min 0.01, max 10000.0 | Size of the field in hectares |
| `irrigationType` | String | Enum: `RAIN_FED`, `CANAL`, `DRIP`, `SPRINKLER`, `GROUNDWATER_TUBEWELL` | Primary irrigation method |
| `status` | String | Enum: `ACTIVE`, `FALLOW`, `PREPARATION`, `ARCHIVED` | Field operational lifecycle status |
| `notes` | String | Optional, max 500 chars | Operational notes |
| `version` | Integer | Min 1, default 1 | Transaction-based optimistic concurrency counter |
| `createdAt` | Timestamp | Required | Field creation timestamp |
| `updatedAt` | Timestamp | Required | Last modification timestamp |
| `archivedAt` | Timestamp | Nullable | Archival timestamp (if soft-archived) |

*Scope Enforcement Notice:* `assignedFarmerUids` is **completely removed** from the field schema in Milestone 3.

---

### 1.5 Collection: `field_assignments` (Deferred Schema — Future Compatibility Only)
- **Path:** `/field_assignments/{assignmentId}`
- **Document ID Format:** `asgn_fld_${fieldDocumentId}::${safeUid}` via `KeyEncoder.assignmentDocId(fieldDocumentId, rawFarmerId)`.
- **Purpose:** Prepared data architecture for Milestone 4 (Farmer Marketplace). **Zero read, write, or query operations are implemented in Milestone 3.**

---

## 2. Java Domain Models, Enums & Records

### 2.1 Enums (`com.agroai.model`)

```java
package com.agroai.model;

public enum FarmVisibility {
    PUBLIC,
    PRIVATE
}

public enum FarmStatus {
    ACTIVE,
    SUSPENDED,
    ARCHIVED
}

public enum FarmRole {
    OWNER,
    MANAGER,
    OBSERVER
}

public enum MembershipStatus {
    ACTIVE,
    REVOKED
    // Note: INVITED and DECLINED exist in the pre-existing Java enum but are deferred from Milestone 3 operational use.
}

public enum FieldStatus {
    ACTIVE,
    FALLOW,
    PREPARATION,
    ARCHIVED
}

public enum SoilType {
    CLAY,
    SANDY,
    LOAMY,
    SILTY,
    PEATY,
    CHALKY
}

public enum CropType {
    RICE,
    WHEAT,
    JUTE,
    MAIZE,
    POTATO,
    TEA,
    VEGETABLES,
    OTHER
}

public enum IrrigationType {
    RAIN_FED,
    CANAL,
    DRIP,
    SPRINKLER,
    GROUNDWATER_TUBEWELL
}
```

---

### 2.2 Farm DTO Records (`com.agroai.dto`)

```java
package com.agroai.dto;

import com.agroai.model.FarmRole;
import com.agroai.model.FarmStatus;
import com.agroai.model.FarmVisibility;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;

public record CreateFarmRequest(
    @NotBlank(message = "Farm ID is required")
    @Pattern(regexp = "^[a-zA-Z0-9-]{1,64}$", message = "Farm ID must be 1-64 alphanumeric or hyphen characters")
    String farmId,

    @NotBlank(message = "Farm name is required")
    @Size(min = 3, max = 100, message = "Farm name must be between 3 and 100 characters")
    String name,

    @Size(max = 500, message = "Description cannot exceed 500 characters")
    String description,

    @NotBlank(message = "District is required")
    @Size(min = 2, max = 50)
    String district,

    @NotBlank(message = "Division is required")
    @Size(min = 2, max = 50)
    String division,

    @Size(max = 200, message = "Detailed address cannot exceed 200 characters")
    String detailedAddress,

    @NotNull(message = "Total area is required")
    @DecimalMin(value = "0.1", message = "Total area must be at least 0.1 hectares")
    @DecimalMax(value = "100000.0", message = "Total area cannot exceed 100,000 hectares")
    Double totalAreaHectares,

    @NotNull(message = "Visibility is required")
    FarmVisibility visibility
) {}

public record UpdateFarmRequest(
    @NotBlank(message = "Farm name is required")
    @Size(min = 3, max = 100)
    String name,

    @Size(max = 500)
    String description,

    @NotBlank(message = "District is required")
    String district,

    @NotBlank(message = "Division is required")
    String division,

    @Size(max = 200)
    String detailedAddress,

    @NotNull
    @DecimalMin("0.1")
    Double totalAreaHectares,

    @NotNull(message = "Expected version is required for optimistic concurrency")
    Integer expectedVersion
) {}

public record UpdateFarmVisibilityRequest(
    @NotNull(message = "Visibility is required")
    FarmVisibility visibility,

    @NotNull(message = "Expected version is required for optimistic concurrency")
    Integer expectedVersion
) {}

public record FarmResponseDTO(
    String farmId,
    String name,
    String description,
    String ownerUid,
    String district,
    String division,
    String detailedAddress,
    Double totalAreaHectares,
    FarmVisibility visibility,
    FarmStatus status,
    Integer activeFieldCount,
    List<String> activeCropTypes,
    FarmRole userRole,
    Integer version,
    Instant registeredAt,
    Instant updatedAt
) {}

public record PublicFarmResponseDTO(
    String farmId,
    String name,
    String description,
    String district,
    String division,
    Double totalAreaHectares,
    Integer activeFieldCount,
    List<String> activeCropTypes,
    Integer farmVersion,
    Instant registeredAt,
    Instant updatedAt
) {}
```

---

### 2.3 Membership DTO Records (`com.agroai.dto`)

```java
package com.agroai.dto;

import com.agroai.model.FarmRole;
import com.agroai.model.MembershipStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;

public record AddFarmMemberRequest(
    @NotBlank(message = "User ID is required")
    String userId,

    @NotNull(message = "Role is required")
    FarmRole role // Must be MANAGER or OBSERVER
) {}

public record UpdateFarmMemberRoleRequest(
    @NotNull(message = "Role is required")
    FarmRole role // Must be MANAGER or OBSERVER
) {}

public record FarmMemberResponseDTO(
    String membershipId,
    String farmId,
    String userId,
    FarmRole role,
    MembershipStatus status,
    Instant joinedAt,
    Instant updatedAt
) {}
```

---

### 2.4 Field DTO Records (`com.agroai.dto`)

```java
package com.agroai.dto;

import com.agroai.model.CropType;
import com.agroai.model.FieldStatus;
import com.agroai.model.IrrigationType;
import com.agroai.model.SoilType;
import jakarta.validation.constraints.*;
import java.time.Instant;

public record CreateFieldRequest(
    @NotBlank(message = "Local field ID is required")
    @Pattern(regexp = "^[a-zA-Z0-9-]{1,21}$", message = "Local field ID must be 1-21 alphanumeric or hyphen characters")
    String localFieldId,

    @NotBlank(message = "Field name is required")
    @Size(min = 2, max = 80, message = "Field name must be between 2 and 80 characters")
    String name,

    @NotNull(message = "Crop type is required")
    CropType cropType,

    @NotNull(message = "Soil type is required")
    SoilType soilType,

    @NotNull(message = "Area is required")
    @DecimalMin(value = "0.01", message = "Field area must be at least 0.01 hectares")
    Double areaHectares,

    @NotNull(message = "Irrigation type is required")
    IrrigationType irrigationType,

    @Size(max = 500)
    String notes
) {}

public record UpdateFieldRequest(
    @NotBlank
    @Size(min = 2, max = 80)
    String name,

    @NotNull
    CropType cropType,

    @NotNull
    SoilType soilType,

    @NotNull
    @DecimalMin("0.01")
    Double areaHectares,

    @NotNull
    IrrigationType irrigationType,

    @NotNull
    FieldStatus status,

    @Size(max = 500)
    String notes,

    @NotNull(message = "Expected version is required for optimistic concurrency")
    Integer expectedVersion
) {}

public record FieldResponseDTO(
    String fieldId,
    String localFieldId,
    String farmId,
    String name,
    CropType cropType,
    SoilType soilType,
    Double areaHectares,
    IrrigationType irrigationType,
    FieldStatus status,
    String notes,
    Integer version,
    Instant createdAt,
    Instant updatedAt
) {}
```

---

## 3. Authoritative REST API Route Catalog

All authenticated routes require `Authorization: Bearer <Firebase_ID_Token>`.
All routes are prefixed with `/api/v1`.

### 3.1 Farm APIs (`/api/v1/farms`)

| Method | Path | Required Security & Role | Verified Email | Revocation Check | Request Body | Response Body | Status Codes | Description |
|---|---|---|:---:|:---:|---|---|---|---|
| `POST` | `/api/v1/farms` | Authenticated User | Yes | Yes | `CreateFarmRequest` | `ApiResponse<FarmResponseDTO>` | 201, 400, 401, 403, 409, 503 | Registers new farm; caller atomically assigned `OWNER`. |
| `GET` | `/api/v1/farms` | Authenticated User | No | No | None | `ApiResponse<List<FarmResponseDTO>>` | 200, 401, 503 | Lists all farms where caller is active member. |
| `GET` | `/api/v1/farms/{farmId}` | `@farmSecurity.isFarmMember(#farmId)` | No | No | None | `ApiResponse<FarmResponseDTO>` | 200, 401, 403, 404, 503 | Retrieves private farm details for active member. |
| `PUT` | `/api/v1/farms/{farmId}` | `@farmSecurity.isFarmOwner(#farmId)` | Yes | Yes | `UpdateFarmRequest` | `ApiResponse<FarmResponseDTO>` | 200, 400, 401, 403, 404, 409, 503 | Updates farm details; verifies `expectedVersion`. |
| `PATCH`| `/api/v1/farms/{farmId}/visibility` | `@farmSecurity.isFarmOwner(#farmId)` | Yes | Yes | `UpdateFarmVisibilityRequest` | `ApiResponse<FarmResponseDTO>` | 200, 400, 401, 403, 404, 409, 503 | Toggles visibility (`PUBLIC`/`PRIVATE`); updates projection. |
| `POST` | `/api/v1/farms/{farmId}/archive` | `@farmSecurity.isFarmOwner(#farmId)` | Yes | Yes | `expectedVersion` query param | `ApiResponse<Void>` | 200, 400, 401, 403, 404, 409, 503 | Soft-archives farm; deletes public projection. |

---

### 3.2 Farm Membership APIs (`/api/v1/farms/{farmId}/members`)

| Method | Path | Required Security & Role | Verified Email | Revocation Check | Request Body | Response Body | Status Codes | Description |
|---|---|---|:---:|:---:|---|---|---|---|
| `GET` | `/api/v1/farms/{farmId}/members` | `@farmSecurity.isFarmManager(#farmId)` | No | No | None | `ApiResponse<List<FarmMemberResponseDTO>>` | 200, 401, 403, 404, 503 | Lists active member roster of the farm. |
| `POST` | `/api/v1/farms/{farmId}/members` | `@farmSecurity.isFarmOwner(#farmId)` | Yes | Yes | `AddFarmMemberRequest` | `ApiResponse<FarmMemberResponseDTO>` | 201, 400, 401, 403, 404, 409, 503 | Grants `MANAGER` or `OBSERVER` to an existing user. |
| `PATCH`| `/api/v1/farms/{farmId}/members/{userId}` | `@farmSecurity.isFarmOwner(#farmId)` | Yes | Yes | `UpdateFarmMemberRoleRequest`| `ApiResponse<FarmMemberResponseDTO>` | 200, 400, 401, 403, 404, 503 | Changes role between `MANAGER` and `OBSERVER`. |
| `DELETE`| `/api/v1/farms/{farmId}/members/{userId}`| `@farmSecurity.isFarmOwner(#farmId)` | Yes | Yes | None | `ApiResponse<Void>` | 200, 400, 401, 403, 404, 503 | Soft-revokes membership (`status = REVOKED`). Sole owner cannot be removed. |

---

### 3.3 Field APIs (`/api/v1/farms/{farmId}/fields`)

| Method | Path | Required Security & Role | Verified Email | Revocation Check | Request Body | Response Body | Status Codes | Description |
|---|---|---|:---:|:---:|---|---|---|---|
| `POST` | `/api/v1/farms/{farmId}/fields` | `@farmSecurity.isFarmManager(#farmId)` | Yes | Yes | `CreateFieldRequest` | `ApiResponse<FieldResponseDTO>` | 201, 400, 401, 403, 404, 409, 503 | Creates field; increments farm `activeFieldCount`. |
| `GET` | `/api/v1/farms/{farmId}/fields` | `@farmSecurity.isFarmMember(#farmId)` | No | No | None | `ApiResponse<List<FieldResponseDTO>>` | 200, 401, 403, 404, 503 | Lists non-archived fields under specified farm. |
| `GET` | `/api/v1/farms/{farmId}/fields/{fieldId}` | `@farmSecurity.isFarmMember(#farmId)` | No | No | None | `ApiResponse<FieldResponseDTO>` | 200, 401, 403, 404, 503 | Retrieves detailed field overview & dashboard data. |
| `PUT` | `/api/v1/farms/{farmId}/fields/{fieldId}` | `@farmSecurity.isFarmManager(#farmId)` | Yes | Yes | `UpdateFieldRequest` | `ApiResponse<FieldResponseDTO>` | 200, 400, 401, 403, 404, 409, 503 | Updates crop, soil, status; checks `expectedVersion`. |
| `POST` | `/api/v1/farms/{farmId}/fields/{fieldId}/archive` | `@farmSecurity.isFarmOwner(#farmId)` | Yes | Yes | `expectedVersion` query param | `ApiResponse<Void>` | 200, 400, 401, 403, 404, 409, 503 | Soft-archives field; decrements farm `activeFieldCount`. |

---

### 3.4 Public Discovery APIs (`/api/v1/public/farms`)

| Method | Path | Authentication | Description | Response Body | Status Codes |
|---|---|---|---|---|---|
| `GET` | `/api/v1/public/farms` | `permitAll()` (Unauthenticated) | Lists public farms from `public_farms` collection. Supports `district`, `division`, `cropType`, `page`, `size`. | `ApiResponse<List<PublicFarmResponseDTO>>` | 200, 503 |
| `GET` | `/api/v1/public/farms/{farmId}` | `permitAll()` (Unauthenticated) | Retrieves single public farm projection. | `ApiResponse<PublicFarmResponseDTO>` | 200, 404, 503 |

---

## 4. Excluded Endpoints (Deferred Functionality)

The following routes are **strictly excluded** from Milestone 3:
- ❌ `/api/v1/farms/{farmId}/fields/{fieldId}/assignments` (Deferred to Milestone 4)
- ❌ `/api/v1/farmer/*` (Farmer workspace routes deferred to Milestone 4)
- ❌ `/api/v1/jobs/*` (Marketplace job postings deferred to Milestone 4)
- ❌ `/api/v1/applications/*` (Worker applications deferred to Milestone 4)
- ❌ Email invitation endpoints (Membership is restricted to existing authenticated UIDs)
