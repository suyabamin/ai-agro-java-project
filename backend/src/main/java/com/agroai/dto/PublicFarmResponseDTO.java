package com.agroai.dto;

import com.agroai.model.PublicFarmProjection;

import java.time.Instant;
import java.util.List;

public record PublicFarmResponseDTO(
        String farmId,
        String name,
        String description,
        String district,
        String division,
        Double totalAreaHectares,
        Integer activeFieldCount,
        List<String> activeCropTypes,
        Integer farmVersion,
        Instant registeredAt,
        Instant updatedAt
) {
    public static PublicFarmResponseDTO fromProjection(PublicFarmProjection proj) {
        if (proj == null) {
            return null;
        }
        return new PublicFarmResponseDTO(
                proj.getFarmId(),
                proj.getName(),
                proj.getDescription(),
                proj.getDistrict(),
                proj.getDivision(),
                proj.getTotalAreaHectares(),
                proj.getActiveFieldCount(),
                proj.getActiveCropTypes(),
                proj.getFarmVersion(),
                proj.getRegisteredAt(),
                proj.getUpdatedAt()
        );
    }
}
