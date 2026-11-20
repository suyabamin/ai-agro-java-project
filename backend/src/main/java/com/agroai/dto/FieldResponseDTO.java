package com.agroai.dto;

import com.agroai.model.CropType;
import com.agroai.model.Field;
import com.agroai.model.FieldStatus;
import com.agroai.model.IrrigationType;
import com.agroai.model.SoilType;

import java.time.Instant;

public record FieldResponseDTO(
        String fieldId,
        String localFieldId,
        String farmId,
        String name,
        CropType cropType,
        SoilType soilType,
        IrrigationType irrigationType,
        Double areaHectares,
        FieldStatus status,
        String notes,
        Integer version,
        Instant createdAt,
        Instant updatedAt,
        Instant archivedAt
) {
    public static FieldResponseDTO fromEntity(Field field) {
        if (field == null) {
            return null;
        }
        return new FieldResponseDTO(
                field.getFieldId(),
                field.getLocalFieldId(),
                field.getFarmId(),
                field.getName(),
                field.getCropType(),
                field.getSoilType(),
                field.getIrrigationType(),
                field.getAreaHectares(),
                field.getStatus(),
                field.getNotes(),
                field.getVersion(),
                field.getCreatedAt(),
                field.getUpdatedAt(),
                field.getArchivedAt()
        );
    }
}
