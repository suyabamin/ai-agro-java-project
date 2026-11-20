package com.agroai.model;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Domain entity representing a farmer's application for a job posting.
 */
public class JobApplication {

    private String applicationId;
    private String jobId;
    private String farmId;
    private String applicantUid;
    private String applicantName;
    private String applicantEmail;
    private String applicantPhone;
    private String coverLetter;
    private String relevantExperience;
    private List<String> skills = new ArrayList<>();
    private String availability;
    private Double expectedSalary;
    private ApplicationStatus status = ApplicationStatus.SUBMITTED;
    private Instant submittedAt;
    private Instant updatedAt;
    private Instant reviewedAt;
    private String reviewedBy;
    private String decisionReason;
    private int version = 1;

    public JobApplication() {
        this.submittedAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public JobApplication(String applicationId, String jobId, String farmId,
                          String applicantUid, String applicantName, String coverLetter) {
        this();
        this.applicationId = applicationId;
        this.jobId = jobId;
        this.farmId = farmId;
        this.applicantUid = applicantUid;
        this.applicantName = applicantName;
        this.coverLetter = coverLetter;
        this.status = ApplicationStatus.SUBMITTED;
        this.version = 1;
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

    public String getApplicantName() {
        return applicantName;
    }

    public void setApplicantName(String applicantName) {
        this.applicantName = applicantName;
    }

    public String getApplicantEmail() {
        return applicantEmail;
    }

    public void setApplicantEmail(String applicantEmail) {
        this.applicantEmail = applicantEmail;
    }

    public String getApplicantPhone() {
        return applicantPhone;
    }

    public void setApplicantPhone(String applicantPhone) {
        this.applicantPhone = applicantPhone;
    }

    public String getCoverLetter() {
        return coverLetter;
    }

    public void setCoverLetter(String coverLetter) {
        this.coverLetter = coverLetter;
    }

    public String getRelevantExperience() {
        return relevantExperience;
    }

    public void setRelevantExperience(String relevantExperience) {
        this.relevantExperience = relevantExperience;
    }

    public List<String> getSkills() {
        return skills;
    }

    public void setSkills(List<String> skills) {
        this.skills = (skills != null) ? new ArrayList<>(skills) : new ArrayList<>();
    }

    public String getAvailability() {
        return availability;
    }

    public void setAvailability(String availability) {
        this.availability = availability;
    }

    public Double getExpectedSalary() {
        return expectedSalary;
    }

    public void setExpectedSalary(Double expectedSalary) {
        this.expectedSalary = expectedSalary;
    }

    public ApplicationStatus getStatus() {
        return status;
    }

    public void setStatus(ApplicationStatus status) {
        this.status = status;
    }

    public Instant getSubmittedAt() {
        return submittedAt;
    }

    public void setSubmittedAt(Instant submittedAt) {
        this.submittedAt = submittedAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Instant getReviewedAt() {
        return reviewedAt;
    }

    public void setReviewedAt(Instant reviewedAt) {
        this.reviewedAt = reviewedAt;
    }

    public String getReviewedBy() {
        return reviewedBy;
    }

    public void setReviewedBy(String reviewedBy) {
        this.reviewedBy = reviewedBy;
    }

    public String getDecisionReason() {
        return decisionReason;
    }

    public void setDecisionReason(String decisionReason) {
        this.decisionReason = decisionReason;
    }

    public int getVersion() {
        return version;
    }

    public void setVersion(int version) {
        this.version = version;
    }
}
