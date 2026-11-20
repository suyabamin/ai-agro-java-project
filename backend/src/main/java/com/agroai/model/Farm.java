package com.agroai.model;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Primary domain entity for an agricultural farm.
 * Stored in private Cloud Firestore collection 'farms/{farmId}'.
 */
public class Farm {

    private String farmId;
    private String name;
    private String description;
    private String ownerUid;
    private String ownerSafeUid;
    private String district;
    private String division;
    private String detailedAddress;
    private Double totalAreaHectares;
    private FarmVisibility visibility = FarmVisibility.PRIVATE;
    private FarmStatus status = FarmStatus.ACTIVE;
    private Integer activeFieldCount = 0;
    private List<String> activeCropTypes = new ArrayList<>();
    private Integer version = 1;
    private Instant registeredAt;
    private Instant updatedAt;
    private Instant archivedAt;

    public Farm() {
        Instant now = Instant.now();
        this.registeredAt = now;
        this.updatedAt = now;
    }

    public Farm(String farmId, String name, String ownerUid, String ownerSafeUid,
                String district, String division, Double totalAreaHectares, FarmVisibility visibility) {
        this();
        this.farmId = farmId;
        this.name = name;
        this.ownerUid = ownerUid;
        this.ownerSafeUid = ownerSafeUid;
        this.district = district;
        this.division = division;
        this.totalAreaHectares = totalAreaHectares;
        this.visibility = visibility != null ? visibility : FarmVisibility.PRIVATE;
        this.status = FarmStatus.ACTIVE;
        this.activeFieldCount = 0;
        this.version = 1;
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

    public String getOwnerUid() {
        return ownerUid;
    }

    public void setOwnerUid(String ownerUid) {
        this.ownerUid = ownerUid;
    }

    public String getOwnerSafeUid() {
        return ownerSafeUid;
    }

    public void setOwnerSafeUid(String ownerSafeUid) {
        this.ownerSafeUid = ownerSafeUid;
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

    public String getDetailedAddress() {
        return detailedAddress;
    }

    public void setDetailedAddress(String detailedAddress) {
        this.detailedAddress = detailedAddress;
    }

    public Double getTotalAreaHectares() {
        return totalAreaHectares;
    }

    public void setTotalAreaHectares(Double totalAreaHectares) {
        this.totalAreaHectares = totalAreaHectares;
    }

    public FarmVisibility getVisibility() {
        return visibility;
    }

    public void setVisibility(FarmVisibility visibility) {
        this.visibility = visibility;
    }

    public FarmStatus getStatus() {
        return status;
    }

    public void setStatus(FarmStatus status) {
        this.status = status;
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

    public Integer getVersion() {
        return version;
    }

    public void setVersion(Integer version) {
        this.version = version;
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

    public Instant getArchivedAt() {
        return archivedAt;
    }

    public void setArchivedAt(Instant archivedAt) {
        this.archivedAt = archivedAt;
    }
}
