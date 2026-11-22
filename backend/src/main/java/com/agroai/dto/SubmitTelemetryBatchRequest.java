package com.agroai.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record SubmitTelemetryBatchRequest(
        @NotEmpty(message = "Readings batch cannot be empty")
        @Size(max = 50, message = "Maximum 50 readings per batch")
        List<@Valid SubmitTelemetryRequest> readings
) {}
