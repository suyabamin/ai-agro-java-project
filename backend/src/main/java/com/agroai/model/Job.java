package com.agroai.model;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Domain entity representing an agricultural job posting under a farm.
 */
public class Job {

    private String jobId;
    private String farmId;
    private String title;
    private String description;
    private JobCategory jobCategory;
    private EmploymentType employmentType;
    private List<String> requiredSkills = new ArrayList<>();
    private String experienceRequirements;
    private int numberOfPositions = 1;
    private SalaryType salaryType = SalaryType.NEGOTIABLE;
    private Double minimumSalary;
    private Double maximumSalary;
    private String currency = "BDT";
    private String locationSummary;
    private Instant applicationDeadline;
    private Instant startDate;
    private Instant endDate;
    private JobStatus status = JobStatus.DRAFT;
    private String createdBy;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant publishedAt;
    private Instant closedAt;
    private Instant archivedAt;
    private int version = 1;
    private int totalApplicationsCount = 0;

    public Job() {
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public Job(String jobId, String farmId, String title, String description,
               JobCategory jobCategory, EmploymentType employmentType,
               int numberOfPositions, Instant applicationDeadline, String createdBy) {
        this();
        this.jobId = jobId;
        this.farmId = farmId;
        this.title = title;
        this.description = description;
        this.jobCategory = jobCategory;
        this.employmentType = employmentType;
        this.numberOfPositions = numberOfPositions;
        this.applicationDeadline = applicationDeadline;
        this.createdBy = createdBy;
        this.status = JobStatus.DRAFT;
        this.version = 1;
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

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public JobCategory getJobCategory() {
        return jobCategory;
    }

    public void setJobCategory(JobCategory jobCategory) {
        this.jobCategory = jobCategory;
    }

    public EmploymentType getEmploymentType() {
        return employmentType;
    }

    public void setEmploymentType(EmploymentType employmentType) {
        this.employmentType = employmentType;
    }

    public List<String> getRequiredSkills() {
        return requiredSkills;
    }

    public void setRequiredSkills(List<String> requiredSkills) {
        this.requiredSkills = (requiredSkills != null) ? new ArrayList<>(requiredSkills) : new ArrayList<>();
    }

    public String getExperienceRequirements() {
        return experienceRequirements;
    }

    public void setExperienceRequirements(String experienceRequirements) {
        this.experienceRequirements = experienceRequirements;
    }

    public int getNumberOfPositions() {
        return numberOfPositions;
    }

    public void setNumberOfPositions(int numberOfPositions) {
        this.numberOfPositions = numberOfPositions;
    }

    public SalaryType getSalaryType() {
        return salaryType;
    }

    public void setSalaryType(SalaryType salaryType) {
        this.salaryType = salaryType;
    }

    public Double getMinimumSalary() {
        return minimumSalary;
    }

    public void setMinimumSalary(Double minimumSalary) {
        this.minimumSalary = minimumSalary;
    }

    public Double getMaximumSalary() {
        return maximumSalary;
    }

    public void setMaximumSalary(Double maximumSalary) {
        this.maximumSalary = maximumSalary;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public String getLocationSummary() {
        return locationSummary;
    }

    public void setLocationSummary(String locationSummary) {
        this.locationSummary = locationSummary;
    }

    public Instant getApplicationDeadline() {
        return applicationDeadline;
    }

    public void setApplicationDeadline(Instant applicationDeadline) {
        this.applicationDeadline = applicationDeadline;
    }

    public Instant getStartDate() {
        return startDate;
    }

    public void setStartDate(Instant startDate) {
        this.startDate = startDate;
    }

    public Instant getEndDate() {
        return endDate;
    }

    public void setEndDate(Instant endDate) {
        this.endDate = endDate;
    }

    public JobStatus getStatus() {
        return status;
    }

    public void setStatus(JobStatus status) {
        this.status = status;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Instant getPublishedAt() {
        return publishedAt;
    }

    public void setPublishedAt(Instant publishedAt) {
        this.publishedAt = publishedAt;
    }

    public Instant getClosedAt() {
        return closedAt;
    }

    public void setClosedAt(Instant closedAt) {
        this.closedAt = closedAt;
    }

    public Instant getArchivedAt() {
        return archivedAt;
    }

    public void setArchivedAt(Instant archivedAt) {
        this.archivedAt = archivedAt;
    }

    public int getVersion() {
        return version;
    }

    public void setVersion(int version) {
        this.version = version;
    }

    public int getTotalApplicationsCount() {
        return totalApplicationsCount;
    }

    public void setTotalApplicationsCount(int totalApplicationsCount) {
        this.totalApplicationsCount = totalApplicationsCount;
    }
}
