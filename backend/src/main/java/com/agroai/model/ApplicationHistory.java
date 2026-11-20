package com.agroai.model;

import java.time.Instant;

/**
 * Immutable audit record tracking an application status transition.
 */
public class ApplicationHistory {

    private String historyId;
    private String applicationId;
    private String jobId;
    private String farmId;
    private String applicantUid;
    private ApplicationStatus previousStatus;
    private ApplicationStatus newStatus;
    private String actorUid;
    private String actorRole;
    private Instant timestamp;
    private String reason;

    public ApplicationHistory() {
        this.timestamp = Instant.now();
    }

    public ApplicationHistory(String historyId, String applicationId, String jobId,
                              String farmId, String applicantUid, ApplicationStatus previousStatus,
                              ApplicationStatus newStatus, String actorUid, String actorRole, String reason) {
        this.historyId = historyId;
        this.applicationId = applicationId;
        this.jobId = jobId;
        this.farmId = farmId;
        this.applicantUid = applicantUid;
        this.previousStatus = previousStatus;
        this.newStatus = newStatus;
        this.actorUid = actorUid;
        this.actorRole = actorRole;
        this.timestamp = Instant.now();
        this.reason = reason;
    }

    public String getHistoryId() {
        return historyId;
    }

    public void setHistoryId(String historyId) {
        this.historyId = historyId;
    }

    public String getApplicationId() {
        return applicationId;
    }

    public void setApplicationId(String applicationId) {
        this.applicationId = applicationId;
    }

    public String getJobId() {
        return jobId;
    }

    public void setJobId(String jobId) {
        this.jobId = jobId;
    }

    public String getFarmId() {
        return farmId;
    }

    public void setFarmId(String farmId) {
        this.farmId = farmId;
    }

    public String getApplicantUid() {
        return applicantUid;
    }

    public void setApplicantUid(String applicantUid) {
        this.applicantUid = applicantUid;
    }

    public ApplicationStatus getPreviousStatus() {
        return previousStatus;
    }

    public void setPreviousStatus(ApplicationStatus previousStatus) {
        this.previousStatus = previousStatus;
    }

    public ApplicationStatus getNewStatus() {
        return newStatus;
    }

    public void setNewStatus(ApplicationStatus newStatus) {
        this.newStatus = newStatus;
    }

    public String getActorUid() {
        return actorUid;
    }

    public void setActorUid(String actorUid) {
        this.actorUid = actorUid;
    }

    public String getActorRole() {
        return actorRole;
    }

    public void setActorRole(String actorRole) {
        this.actorRole = actorRole;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
