package com.agroai.model;

import java.time.Instant;
import java.util.Objects;

/**
 * Domain entity representing an operational agricultural Field within a parent Farm.
 * Identified by canonical composite document ID: {farmId}--{localFieldId} <= 64 chars.
 * Belongs strictly to exactly one parent Farm.
 */
public class Field {

    private String fieldId;
    private String localFieldId;
    private String farmId;
    private String name;
    private CropType cropType;
    private SoilType soilType;
    private IrrigationType irrigationType;
    private Double areaHectares;
    private FieldStatus status;
    private String notes;
    private int version;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant archivedAt;

    public Field() {
        this.status = FieldStatus.ACTIVE;
        this.version = 1;
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public Field(String fieldId, String localFieldId, String farmId, String name, Double areaHectares) {
        this.fieldId = fieldId;
        this.localFieldId = localFieldId;
        this.farmId = farmId;
        this.name = name;
        this.areaHectares = areaHectares;
        this.status = FieldStatus.ACTIVE;
        this.version = 1;
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public String getFieldId() {
        return fieldId;
    }

    public void setFieldId(String fieldId) {
        this.fieldId = fieldId;
    }

    public String getLocalFieldId() {
        return localFieldId;
    }

    public void setLocalFieldId(String localFieldId) {
        this.localFieldId = localFieldId;
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

    public CropType getCropType() {
        return cropType;
    }

    public void setCropType(CropType cropType) {
        this.cropType = cropType;
    }

    public SoilType getSoilType() {
        return soilType;
    }

    public void setSoilType(SoilType soilType) {
        this.soilType = soilType;
    }

    public IrrigationType getIrrigationType() {
        return irrigationType;
    }

    public void setIrrigationType(IrrigationType irrigationType) {
        this.irrigationType = irrigationType;
    }

    public Double getAreaHectares() {
        return areaHectares;
    }

    public void setAreaHectares(Double areaHectares) {
        this.areaHectares = areaHectares;
    }

    public FieldStatus getStatus() {
        return status;
    }

    public void setStatus(FieldStatus status) {
        this.status = status;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public int getVersion() {
        return version;
    }

    public void setVersion(int version) {
        this.version = version;
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

    public Instant getArchivedAt() {
        return archivedAt;
    }

    public void setArchivedAt(Instant archivedAt) {
        this.archivedAt = archivedAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Field field)) return false;
        return Objects.equals(fieldId, field.fieldId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(fieldId);
    }

    @Override
    public String toString() {
        return "Field{" +
                "fieldId='" + fieldId + '\'' +
                ", localFieldId='" + localFieldId + '\'' +
                ", farmId='" + farmId + '\'' +
                ", name='" + name + '\'' +
                ", status=" + status +
                ", version=" + version +
                '}';
    }
}
