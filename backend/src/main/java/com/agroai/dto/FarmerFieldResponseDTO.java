package com.agroai.dto;

import com.agroai.model.CropType;
import com.agroai.model.Field;
import com.agroai.model.FieldStatus;
import com.agroai.model.IrrigationType;
import com.agroai.model.SoilType;

/** Field information intentionally limited to operational details available to an assigned farmer. */
public record FarmerFieldResponseDTO(
        String fieldId,
        String localFieldId,
        String farmId,
        String name,
        CropType cropType,
        SoilType soilType,
        IrrigationType irrigationType,
        Double areaHectares,
        FieldStatus status
) {
    public static FarmerFieldResponseDTO fromEntity(Field field) {
        return new FarmerFieldResponseDTO(field.getFieldId(), field.getLocalFieldId(), field.getFarmId(), field.getName(),
                field.getCropType(), field.getSoilType(), field.getIrrigationType(),
                field.getAreaHectares(), field.getStatus());
    }
}
