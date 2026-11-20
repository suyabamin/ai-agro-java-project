package com.agroai.model;

import java.time.Instant;

/**
 * Domain entity representing a private communication message within an application context.
 */
public class ApplicationMessage {

    private String messageId;
    private String applicationId;
    private String jobId;
    private String farmId;
    private String senderUid;
    private String senderRole; // "APPLICANT" or "FARM_MANAGEMENT"
    private String senderName;
    private String content;
    private Instant sentAt;

    public ApplicationMessage() {
        this.sentAt = Instant.now();
    }

    public ApplicationMessage(String messageId, String applicationId, String jobId,
                              String farmId, String senderUid, String senderRole,
                              String senderName, String content) {
        this.messageId = messageId;
        this.applicationId = applicationId;
        this.jobId = jobId;
        this.farmId = farmId;
        this.senderUid = senderUid;
        this.senderRole = senderRole;
        this.senderName = senderName;
        this.content = content;
        this.sentAt = Instant.now();
    }

    public String getMessageId() {
        return messageId;
    }

    public void setMessageId(String messageId) {
        this.messageId = messageId;
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

    public String getSenderUid() {
        return senderUid;
    }

    public void setSenderUid(String senderUid) {
        this.senderUid = senderUid;
    }

    public String getSenderRole() {
        return senderRole;
    }

    public void setSenderRole(String senderRole) {
        this.senderRole = senderRole;
    }

    public String getSenderName() {
        return senderName;
    }

    public void setSenderName(String senderName) {
        this.senderName = senderName;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public Instant getSentAt() {
        return sentAt;
    }

    public void setSentAt(Instant sentAt) {
        this.sentAt = sentAt;
    }
}
