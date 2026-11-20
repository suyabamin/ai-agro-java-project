package com.agroai.model;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Sanitized public farm projection stored in 'public_farms/{farmId}'.
 * Excludes private owner PII, safe UID, detailed address, and internal notes.
 */
public class PublicFarmProjection {

    private String farmId;
    private String name;
    private String description;
    private String district;
    private String division;
    private Double totalAreaHectares;
    private Integer activeFieldCount = 0;
    private List<String> activeCropTypes = new ArrayList<>();
    private String status = "ACTIVE";
    private String visibility = "PUBLIC";
    private Integer farmVersion = 1;
    private Integer projectionVersion = 1;
    private Instant registeredAt;
    private Instant updatedAt;

    public PublicFarmProjection() {
        Instant now = Instant.now();
        this.registeredAt = now;
        this.updatedAt = now;
    }

    public static PublicFarmProjection fromPrivate(Farm farm) {
        if (farm == null) {
            return null;
        }
        PublicFarmProjection projection = new PublicFarmProjection();
        projection.setFarmId(farm.getFarmId());
        projection.setName(farm.getName());
        projection.setDescription(farm.getDescription());
        projection.setDistrict(farm.getDistrict());
        projection.setDivision(farm.getDivision());
        projection.setTotalAreaHectares(farm.getTotalAreaHectares());
        projection.setActiveFieldCount(farm.getActiveFieldCount());
        projection.setActiveCropTypes(farm.getActiveCropTypes());
        projection.setStatus(farm.getStatus() != null ? farm.getStatus().name() : "ACTIVE");
        projection.setVisibility(farm.getVisibility() != null ? farm.getVisibility().name() : "PUBLIC");
        projection.setFarmVersion(farm.getVersion());
        projection.setProjectionVersion(farm.getVersion());
        projection.setRegisteredAt(farm.getRegisteredAt());
        projection.setUpdatedAt(farm.getUpdatedAt());
        return projection;
    }

    public String getFarmId() {
        return farmId;
    }

    public void setFarmId(String farmId) {
        this.farmId = farmId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getDistrict() {
        return district;
    }

    public void setDistrict(String district) {
        this.district = district;
    }

    public String getDivision() {
        return division;
    }

    public void setDivision(String division) {
        this.division = division;
    }

    public Double getTotalAreaHectares() {
        return totalAreaHectares;
    }

    public void setTotalAreaHectares(Double totalAreaHectares) {
        this.totalAreaHectares = totalAreaHectares;
    }

    public Integer getActiveFieldCount() {
        return activeFieldCount;
    }

    public void setActiveFieldCount(Integer activeFieldCount) {
        this.activeFieldCount = activeFieldCount;
    }

    public List<String> getActiveCropTypes() {
        return activeCropTypes;
    }

    public void setActiveCropTypes(List<String> activeCropTypes) {
        this.activeCropTypes = activeCropTypes != null ? activeCropTypes : new ArrayList<>();
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getVisibility() {
        return visibility;
    }

    public void setVisibility(String visibility) {
        this.visibility = visibility;
    }

    public Integer getFarmVersion() {
        return farmVersion;
    }

    public void setFarmVersion(Integer farmVersion) {
        this.farmVersion = farmVersion;
    }

    public Integer getProjectionVersion() {
        return projectionVersion;
    }

    public void setProjectionVersion(Integer projectionVersion) {
        this.projectionVersion = projectionVersion;
    }

    public Instant getRegisteredAt() {
        return registeredAt;
    }

    public void setRegisteredAt(Instant registeredAt) {
        this.registeredAt = registeredAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
