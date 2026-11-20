package com.agroai.model;

import java.time.Instant;

/**
 * Immutable audit log record for field assignment events (ASSIGNED, RELEASED, REASSIGNED).
 * Persisted in Cloud Firestore collection 'assignment_history'.
 */
public class AssignmentHistory {

    public enum EventType {
        ASSIGNED, RELEASED, REASSIGNED
    }

    private String historyId;
    private String assignmentId;
    private String farmId;
    private String fieldId;
    private String farmerUid;
    private String farmerName;
    private String eventType; // ASSIGNED, RELEASED, REASSIGNED
    private String performedByUid;
    private String performedByRole; // OWNER, MANAGER
    private String reason;
    private String sourceApplicationId;
    private Instant timestamp;

    public AssignmentHistory() {
        this.timestamp = Instant.now();
    }

    public AssignmentHistory(String historyId, String assignmentId, String farmId, String fieldId,
                             String farmerUid, String farmerName, String eventType, String performedByUid,
                             String performedByRole, String reason, String sourceApplicationId) {
        this.historyId = historyId;
        this.assignmentId = assignmentId;
        this.farmId = farmId;
        this.fieldId = fieldId;
        this.farmerUid = farmerUid;
        this.farmerName = farmerName;
        this.eventType = eventType;
        this.performedByUid = performedByUid;
        this.performedByRole = performedByRole;
        this.reason = reason;
        this.sourceApplicationId = sourceApplicationId;
        this.timestamp = Instant.now();
    }

    public String getHistoryId() {
        return historyId;
    }

    public void setHistoryId(String historyId) {
        this.historyId = historyId;
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
    }

    public String getFarmerUid() {
        return farmerUid;
    }

    public void setFarmerUid(String farmerUid) {
        this.farmerUid = farmerUid;
    }

    public String getFarmerName() {
        return farmerName;
    }

    public void setFarmerName(String farmerName) {
        this.farmerName = farmerName;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public void setEventType(EventType eventType) {
        this.eventType = eventType != null ? eventType.name() : null;
    }

    public String getPerformedByUid() {
        return performedByUid;
    }

    public void setPerformedByUid(String performedByUid) {
        this.performedByUid = performedByUid;
    }

    public String getPerformedByRole() {
        return performedByRole;
    }

    public void setPerformedByRole(String performedByRole) {
        this.performedByRole = performedByRole;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public String getSourceApplicationId() {
        return sourceApplicationId;
    }

    public void setSourceApplicationId(String sourceApplicationId) {
        this.sourceApplicationId = sourceApplicationId;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }
}
