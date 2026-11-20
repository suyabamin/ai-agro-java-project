package com.agroai.service;

import com.agroai.dto.SubmitTelemetryRequest;
import com.agroai.monitoring.MonitoringAuthorizationService;
import com.agroai.repository.FieldMonitoringRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SoilTelemetryServiceTest {
    private FieldMonitoringRepository repository;
    private MonitoringAuthorizationService authorization;
    private SoilTelemetryService service;

    @BeforeEach
    void setUp() {
        repository = mock(FieldMonitoringRepository.class);
        authorization = mock(MonitoringAuthorizationService.class);
        service = new SoilTelemetryService(repository, authorization);
    }

    @Test
    void submitsValidSoilMoistureReading() {
        SubmitTelemetryRequest request = new SubmitTelemetryRequest(
                "SOIL_MOISTURE", 35.5, "%", Instant.now().minusSeconds(60), "SENSOR", "sensor-001", null
        );
        when(repository.find(eq("soil_telemetry"), anyString())).thenReturn(Optional.empty());

        Map<String, Object> result = service.submit("farm-1", "field-1", "uid-1", request);

        assertNotNull(result);
        assertEquals("SOIL_MOISTURE", result.get("measurementType"));
        assertEquals(35.5, result.get("rawValue"));
        assertEquals("%", result.get("unit"));
        assertEquals("VALID", result.get("validationStatus"));
        verify(authorization).requireWriteAccess("farm-1", "field-1", "uid-1");
        verify(repository).createWithActivity(eq("soil_telemetry"), anyString(), anyMap(), anyMap());
    }

    @Test
    void readingOutsidePhysicalRangeGeneratesWarningAndInvalidValidationStatus() {
        // Soil moisture % range is 0 to 100. 150.0 is out of physical range.
        SubmitTelemetryRequest request = new SubmitTelemetryRequest(
                "SOIL_MOISTURE", 150.0, "%", Instant.now().minusSeconds(30), "MANUAL", null, null
        );
        when(repository.find(eq("soil_telemetry"), anyString())).thenReturn(Optional.empty());

        Map<String, Object> result = service.submit("farm-1", "field-1", "uid-1", request);

        assertEquals("OUT_OF_RANGE", result.get("validationStatus"));
        assertNotNull(result.get("warnings"));
        assertFalse(((List<?>) result.get("warnings")).isEmpty());
    }

    @Test
    void rejectsFutureObservationTimestamp() {
        SubmitTelemetryRequest request = new SubmitTelemetryRequest(
                "SOIL_MOISTURE", 40.0, "%", Instant.now().plusSeconds(600), "MANUAL", null, null
        );

        assertThrows(IllegalArgumentException.class, () ->
                service.submit("farm-1", "field-1", "uid-1", request)
        );
    }

    @Test
    void rejectsMismatchedUnitForMeasurementType() {
        SubmitTelemetryRequest request = new SubmitTelemetryRequest(
                "SOIL_MOISTURE", 40.0, "CELSIUS", Instant.now().minusSeconds(10), "MANUAL", null, null
        );

        assertThrows(IllegalArgumentException.class, () ->
                service.submit("farm-1", "field-1", "uid-1", request)
        );
    }

    @Test
    void idempotentSubmissionReturnsExistingRecordWhenIdentical() {
        String eventId = "evt-client-123";
        Instant time = Instant.now().minusSeconds(60);
        SubmitTelemetryRequest request = new SubmitTelemetryRequest(
                "SOIL_MOISTURE", 42.0, "%", time, "SENSOR", "sensor-1", eventId
        );

        Map<String, Object> existing = new LinkedHashMap<>();
        existing.put("telemetryId", "telemetry_prior");
        existing.put("submittedByUid", "uid-1");
        existing.put("rawValue", 42.0);
        existing.put("measurementType", "SOIL_MOISTURE");
        existing.put("observedAt", time.toString());
        existing.put("source", "SENSOR");
        existing.put("sensorId", "sensor-1");

        when(repository.find(eq("soil_telemetry"), anyString())).thenReturn(Optional.of(existing));

        Map<String, Object> result = service.submit("farm-1", "field-1", "uid-1", request);
        assertEquals("telemetry_prior", result.get("telemetryId"));
        verify(repository, never()).createWithActivity(anyString(), anyString(), anyMap(), anyMap());
    }

    @Test
    void rejectsConflictingPayloadForSameIdempotencyKey() {
        String eventId = "evt-client-123";
        Instant time = Instant.now().minusSeconds(60);
        SubmitTelemetryRequest request = new SubmitTelemetryRequest(
                "SOIL_MOISTURE", 50.0, "%", time, "SENSOR", "sensor-1", eventId
        );

        Map<String, Object> existing = new LinkedHashMap<>();
        existing.put("telemetryId", "telemetry_prior");
        existing.put("submittedByUid", "uid-1");
        existing.put("rawValue", 42.0); // Different value!
        existing.put("measurementType", "SOIL_MOISTURE");
        existing.put("observedAt", time.toString());
        existing.put("source", "SENSOR");
        existing.put("sensorId", "sensor-1");

        when(repository.find(eq("soil_telemetry"), anyString())).thenReturn(Optional.of(existing));

        assertThrows(IllegalArgumentException.class, () ->
                service.submit("farm-1", "field-1", "uid-1", request)
        );
    }

    @Test
    void submitsValidAirTemperatureReading() {
        SubmitTelemetryRequest request = new SubmitTelemetryRequest(
                "AIR_TEMPERATURE", 24.5, "C", Instant.now().minusSeconds(10), "MANUAL", null, null
        );
        when(repository.find(eq("soil_telemetry"), anyString())).thenReturn(Optional.empty());

        Map<String, Object> result = service.submit("farm-1", "field-1", "uid-1", request);
        assertNotNull(result);
        assertEquals("AIR_TEMPERATURE", result.get("measurementType"));
        assertEquals(24.5, result.get("rawValue"));
        assertEquals("C", result.get("unit"));
        assertEquals("VALID", result.get("validationStatus"));
    }

    @Test
    void submitsValidRelativeHumidityReading() {
        SubmitTelemetryRequest request = new SubmitTelemetryRequest(
                "RELATIVE_HUMIDITY", 78.0, "%", Instant.now().minusSeconds(10), "MANUAL", null, null
        );
        when(repository.find(eq("soil_telemetry"), anyString())).thenReturn(Optional.empty());

        Map<String, Object> result = service.submit("farm-1", "field-1", "uid-1", request);
        assertNotNull(result);
        assertEquals("RELATIVE_HUMIDITY", result.get("measurementType"));
        assertEquals(78.0, result.get("rawValue"));
        assertEquals("%", result.get("unit"));
        assertEquals("VALID", result.get("validationStatus"));
    }

    @Test
    void submitsValidRainfallReading() {
        SubmitTelemetryRequest request = new SubmitTelemetryRequest(
                "RAINFALL", 120.0, "mm", Instant.now().minusSeconds(10), "MANUAL", null, null
        );
        when(repository.find(eq("soil_telemetry"), anyString())).thenReturn(Optional.empty());

        Map<String, Object> result = service.submit("farm-1", "field-1", "uid-1", request);
        assertNotNull(result);
        assertEquals("RAINFALL", result.get("measurementType"));
        assertEquals(120.0, result.get("rawValue"));
        assertEquals("mm", result.get("unit"));
        assertEquals("VALID", result.get("validationStatus"));
    }

    @Test
    void submitsValidNitrogenReading() {
        SubmitTelemetryRequest request = new SubmitTelemetryRequest(
                "NITROGEN", 90.0, "mg/kg", Instant.now().minusSeconds(10), "MANUAL", null, null
        );
        when(repository.find(eq("soil_telemetry"), anyString())).thenReturn(Optional.empty());

        Map<String, Object> result = service.submit("farm-1", "field-1", "uid-1", request);
        assertNotNull(result);
        assertEquals("NITROGEN", result.get("measurementType"));
        assertEquals(90.0, result.get("rawValue"));
        assertEquals("mg/kg", result.get("unit"));
        assertEquals("VALID", result.get("validationStatus"));
    }
}
