package com.agroai.model;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Contextual field assignment stored in 'field_assignments/asgn_fld_${fieldId}::${safeUid}'.
 * Restricts farmer operational access strictly to actively assigned fields.
 */
public class FieldAssignment {

    private String assignmentId;
    private String farmId;
    private String fieldId;
    private String fieldDocumentId;
    private String farmerId;
    private String farmerUid;
    private String farmerSafeUid;
    private String farmerName;
    private AssignmentStatus status = AssignmentStatus.ACTIVE;
    private List<String> permissions = new ArrayList<>();
    private String assignedBy;
    private String assignedByUid;
    private String sourceApplicationId;
    private String sourceJobId;
    private Instant assignedAt;
    private Instant updatedAt;
    private Instant releasedAt;
    private String releasedByUid;
    private String releaseReason;
    private Integer version = 1;

    public FieldAssignment() {
        Instant now = Instant.now();
        this.assignedAt = now;
        this.updatedAt = now;
        this.version = 1;
    }

    public FieldAssignment(String assignmentId, String farmId, String fieldId, String farmerId, AssignmentStatus status) {
        this();
        this.assignmentId = assignmentId;
        this.farmId = farmId;
        this.fieldId = fieldId;
        this.fieldDocumentId = fieldId;
        this.farmerId = farmerId;
        this.farmerUid = farmerId;
        this.status = status;
    }

    public FieldAssignment(String fieldId, String farmerId, List<String> permissions) {
        this();
        this.fieldId = fieldId;
        this.fieldDocumentId = fieldId;
        this.farmerId = farmerId;
        this.farmerUid = farmerId;
        this.permissions = permissions != null ? new ArrayList<>(permissions) : new ArrayList<>();
    }

    public String getAssignmentId() {
        return assignmentId;
    }

    public void setAssignmentId(String assignmentId) {
        this.assignmentId = assignmentId;
    }

    public String getFarmId() {
        return farmId;
    }

    public void setFarmId(String farmId) {
        this.farmId = farmId;
    }

    public String getFieldId() {
        return fieldId;
    }

    public void setFieldId(String fieldId) {
        this.fieldId = fieldId;
        this.fieldDocumentId = fieldId;
    }

    public String getFieldDocumentId() {
        return fieldDocumentId != null ? fieldDocumentId : fieldId;
    }

    public void setFieldDocumentId(String fieldDocumentId) {
        this.fieldDocumentId = fieldDocumentId;
    }

    public String getFarmerId() {
        return farmerId != null ? farmerId : farmerUid;
    }

    public void setFarmerId(String farmerId) {
        this.farmerId = farmerId;
        this.farmerUid = farmerId;
    }

    public String getFarmerUid() {
        return farmerUid != null ? farmerUid : farmerId;
    }

    public void setFarmerUid(String farmerUid) {
        this.farmerUid = farmerUid;
        this.farmerId = farmerUid;
    }

    public String getFarmerSafeUid() {
        return farmerSafeUid;
    }

    public void setFarmerSafeUid(String farmerSafeUid) {
        this.farmerSafeUid = farmerSafeUid;
    }

    public String getFarmerName() {
        return farmerName;
    }

    public void setFarmerName(String farmerName) {
        this.farmerName = farmerName;
    }

    public AssignmentStatus getStatus() {
        return status;
    }

    public void setStatus(AssignmentStatus status) {
        this.status = status;
    }

    public List<String> getPermissions() {
        return permissions != null ? permissions : Collections.emptyList();
    }

    public void setPermissions(List<String> permissions) {
        this.permissions = permissions != null ? permissions : new ArrayList<>();
    }

    public String getAssignedBy() {
        return assignedBy != null ? assignedBy : assignedByUid;
    }

    public void setAssignedBy(String assignedBy) {
        this.assignedBy = assignedBy;
        this.assignedByUid = assignedBy;
    }

    public String getAssignedByUid() {
        return assignedByUid != null ? assignedByUid : assignedBy;
    }

    public void setAssignedByUid(String assignedByUid) {
        this.assignedByUid = assignedByUid;
        this.assignedBy = assignedByUid;
    }

    public String getSourceApplicationId() {
        return sourceApplicationId;
    }

    public void setSourceApplicationId(String sourceApplicationId) {
        this.sourceApplicationId = sourceApplicationId;
    }

    public String getSourceJobId() {
        return sourceJobId;
    }

    public void setSourceJobId(String sourceJobId) {
        this.sourceJobId = sourceJobId;
    }

    public Instant getAssignedAt() {
        return assignedAt;
    }

    public Instant getCreatedAt() {
        return assignedAt;
    }

    public void setAssignedAt(Instant assignedAt) {
        this.assignedAt = assignedAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Instant getReleasedAt() {
        return releasedAt;
    }

    public void setReleasedAt(Instant releasedAt) {
        this.releasedAt = releasedAt;
    }

    public String getReleasedByUid() {
        return releasedByUid;
    }

    public void setReleasedByUid(String releasedByUid) {
        this.releasedByUid = releasedByUid;
    }

    public String getReleaseReason() {
        return releaseReason;
    }

    public void setReleaseReason(String releaseReason) {
        this.releaseReason = releaseReason;
    }

    public Integer getVersion() {
        return version != null ? version : 1;
    }

    public void setVersion(Integer version) {
        this.version = version;
    }
}
