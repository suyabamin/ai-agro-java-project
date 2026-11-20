package com.agroai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public record SubmitTelemetryRequest(
        @NotBlank String measurementType,
        @NotNull Double value,
        @NotBlank String unit,
        @NotNull Instant observedAt,
        @NotBlank String source,
        @Size(max = 100) String sensorId,
        @Size(max = 100) String clientEventId
) { }
