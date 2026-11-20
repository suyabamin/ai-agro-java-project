package com.agroai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateIrrigationPlanStatusRequest(@NotBlank String status, @Size(max = 500) String note) { }
