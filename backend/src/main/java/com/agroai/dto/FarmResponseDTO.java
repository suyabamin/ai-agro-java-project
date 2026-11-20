package com.agroai.dto;

import com.agroai.model.Farm;
import com.agroai.model.FarmRole;
import com.agroai.model.FarmStatus;
import com.agroai.model.FarmVisibility;

import java.time.Instant;
import java.util.List;

public record FarmResponseDTO(
        String farmId,
        String name,
        String description,
        String ownerUid,
        String district,
        String division,
        String detailedAddress,
        Double totalAreaHectares,
        FarmVisibility visibility,
        FarmStatus status,
        Integer activeFieldCount,
        List<String> activeCropTypes,
        FarmRole userRole,
        Integer version,
        Instant registeredAt,
        Instant updatedAt
) {
    public static FarmResponseDTO fromEntity(Farm farm, FarmRole role) {
        if (farm == null) {
            return null;
        }
        return new FarmResponseDTO(
                farm.getFarmId(),
                farm.getName(),
                farm.getDescription(),
                farm.getOwnerUid(),
                farm.getDistrict(),
                farm.getDivision(),
                farm.getDetailedAddress(),
                farm.getTotalAreaHectares(),
                farm.getVisibility(),
                farm.getStatus(),
                farm.getActiveFieldCount(),
                farm.getActiveCropTypes(),
                role,
                farm.getVersion(),
                farm.getRegisteredAt(),
                farm.getUpdatedAt()
        );
    }
}
