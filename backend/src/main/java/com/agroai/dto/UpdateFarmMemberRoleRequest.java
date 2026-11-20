package com.agroai.dto;

import com.agroai.model.FarmRole;
import jakarta.validation.constraints.NotNull;

public record UpdateFarmMemberRoleRequest(
        @NotNull(message = "Role is required")
        FarmRole role
) {
}
