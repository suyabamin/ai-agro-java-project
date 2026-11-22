package com.agroai.controller;

import com.agroai.dto.InitializeProfileRequest;
import com.agroai.dto.SubmitTelemetryBatchRequest;
import com.agroai.dto.SubmitTelemetryRequest;
import com.agroai.model.*;
import com.agroai.repository.*;
import com.agroai.security.FirebaseTokenVerifier;
import com.agroai.security.FirebaseUserDetails;
import com.agroai.service.AiInferenceClient;
import com.agroai.util.KeyEncoder;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Field Monitoring & Telemetry Controller Integration Tests")
class FieldMonitoringControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private FarmRepository farmRepository;

    @Autowired
    private FieldRepository fieldRepository;

    @Autowired
    private FieldAssignmentRepository assignmentRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private FieldMonitoringRepository monitoringRepository;

    @MockBean
    private FirebaseTokenVerifier tokenVerifier;

    @MockBean
    private AiInferenceClient aiInferenceClient;

    private static final String ASSIGNED_FARMER_TOKEN = "farmer.assigned.telemetry.token";
    private static final String ASSIGNED_FARMER_UID = "uid-farmer-assigned-telemetry";

    private static final String UNASSIGNED_FARMER_TOKEN = "farmer.unassigned.token";
    private static final String UNASSIGNED_FARMER_UID = "uid-farmer-unassigned";

    private static final String READONLY_FARMER_TOKEN = "farmer.readonly.token";
    private static final String READONLY_FARMER_UID = "uid-farmer-readonly";

    private static final String FARM_ID = "farm-aec1a140-3c82-4d1a-85fa-502c96a6f5d8";
    private static final String LOCAL_FIELD_ID = "F-1795121881205";
    private static final String COMPOSITE_FIELD_ID = FARM_ID + "--" + LOCAL_FIELD_ID;

    private static final String OTHER_FARM_ID = "farm-other-9999-8888";
    private static final String OTHER_FIELD_ID = OTHER_FARM_ID + "--plot-foreign";

    @BeforeEach
    void setUp() {
        FirebaseUserDetails assignedFarmer = new FirebaseUserDetails(
                ASSIGNED_FARMER_UID, "assigned.farmer@agroai.test", "Assigned Farmer", true, Map.of()
        );
        FirebaseUserDetails unassignedFarmer = new FirebaseUserDetails(
                UNASSIGNED_FARMER_UID, "unassigned@agroai.test", "Unassigned Farmer", true, Map.of()
        );
        FirebaseUserDetails readOnlyFarmer = new FirebaseUserDetails(
                READONLY_FARMER_UID, "readonly@agroai.test", "ReadOnly Farmer", true, Map.of()
        );

        when(tokenVerifier.verifyToken(eq(ASSIGNED_FARMER_TOKEN))).thenReturn(assignedFarmer);
        when(tokenVerifier.verifyToken(eq(ASSIGNED_FARMER_TOKEN), eq(false))).thenReturn(assignedFarmer);
        when(tokenVerifier.verifyToken(eq(ASSIGNED_FARMER_TOKEN), eq(true))).thenReturn(assignedFarmer);

        when(tokenVerifier.verifyToken(eq(UNASSIGNED_FARMER_TOKEN))).thenReturn(unassignedFarmer);
        when(tokenVerifier.verifyToken(eq(UNASSIGNED_FARMER_TOKEN), eq(false))).thenReturn(unassignedFarmer);
        when(tokenVerifier.verifyToken(eq(UNASSIGNED_FARMER_TOKEN), eq(true))).thenReturn(unassignedFarmer);

        when(tokenVerifier.verifyToken(eq(READONLY_FARMER_TOKEN))).thenReturn(readOnlyFarmer);
        when(tokenVerifier.verifyToken(eq(READONLY_FARMER_TOKEN), eq(false))).thenReturn(readOnlyFarmer);
        when(tokenVerifier.verifyToken(eq(READONLY_FARMER_TOKEN), eq(true))).thenReturn(readOnlyFarmer);

        assignmentRepository.clearAllForTesting();
        userRepository.clearAllForTesting();

        userRepository.initializeProfile(ASSIGNED_FARMER_UID, "assigned.farmer@agroai.test",
                new InitializeProfileRequest("Assigned Farmer", null, null, "en"));
        userRepository.initializeProfile(UNASSIGNED_FARMER_UID, "unassigned@agroai.test",
                new InitializeProfileRequest("Unassigned Farmer", null, null, "en"));
        userRepository.initializeProfile(READONLY_FARMER_UID, "readonly@agroai.test",
                new InitializeProfileRequest("ReadOnly Farmer", null, null, "en"));

        Farm farm = new Farm();
        farm.setFarmId(FARM_ID);
        farm.setName("Demo Delta Farm");
        farm.setOwnerUid("owner-uid-001");
        farm.setOwnerSafeUid(KeyEncoder.encodeUid("owner-uid-001"));
        farm.setDistrict("Mymensingh");
        farm.setDivision("Dhaka");
        farm.setTotalAreaHectares(25.0);
        farm.setStatus(FarmStatus.ACTIVE);
        farm.setVisibility(FarmVisibility.PUBLIC);
        farmRepository.save(farm);

        Field field = new Field(COMPOSITE_FIELD_ID, LOCAL_FIELD_ID, FARM_ID, "Field Sector 4", 5.0);
        field.setStatus(FieldStatus.ACTIVE);
        field.setCropType(CropType.RICE);
        field.setSoilType(SoilType.CLAY);
        field.setIrrigationType(IrrigationType.CANAL);
        fieldRepository.save(field);

        // Assign farmer to COMPOSITE_FIELD_ID with WRITE_LOGS (the standard assignment default)
        FieldAssignment assignment = new FieldAssignment(COMPOSITE_FIELD_ID, ASSIGNED_FARMER_UID, List.of("READ", "WRITE_LOGS"));
        assignment.setAssignmentId(KeyEncoder.assignmentDocId(COMPOSITE_FIELD_ID, ASSIGNED_FARMER_UID));
        assignment.setFarmId(FARM_ID);
        assignment.setStatus(AssignmentStatus.ACTIVE);
        assignmentRepository.save(assignment);

        // Readonly farmer assignment with only READ
        FieldAssignment readOnlyAssignment = new FieldAssignment(COMPOSITE_FIELD_ID, READONLY_FARMER_UID, List.of("READ"));
        readOnlyAssignment.setAssignmentId(KeyEncoder.assignmentDocId(COMPOSITE_FIELD_ID, READONLY_FARMER_UID));
        readOnlyAssignment.setFarmId(FARM_ID);
        readOnlyAssignment.setStatus(AssignmentStatus.ACTIVE);
        assignmentRepository.save(readOnlyAssignment);

        // Foreign farm and field
        Farm otherFarm = new Farm();
        otherFarm.setFarmId(OTHER_FARM_ID);
        otherFarm.setName("Foreign Farm");
        otherFarm.setStatus(FarmStatus.ACTIVE);
        farmRepository.save(otherFarm);

        Field otherField = new Field(OTHER_FIELD_ID, "plot-foreign", OTHER_FARM_ID, "Foreign Field", 3.0);
        otherField.setStatus(FieldStatus.ACTIVE);
        fieldRepository.save(otherField);

        // Mock AI inference response
        when(aiInferenceClient.inferTabular(anyMap())).thenReturn(Map.of(
                "water_need", "Low",
                "field_status", "Healthy",
                "water_need_confidence", 0.98,
                "field_status_confidence", 0.95,
                "recommended_crop", "rice",
                "crop_confidence", 0.99,
                "model_version", "tabular-pipeline-v2.0",
                "disclaimer", "Agronomic rule-derived model notice"
        ));
    }

    @Test
    @DisplayName("[TELEMETRY-01] Assigned Farmer submits all 8 measurements using canonical composite fieldId (201 Created)")
    void testAssignedFarmerSubmitAllEightMeasurementsCompositeId() throws Exception {
        Instant now = Instant.now().minusSeconds(10);

        List<SubmitTelemetryRequest> readings = List.of(
                new SubmitTelemetryRequest("NITROGEN", 90.0, "mg/kg", now, "MANUAL", null, "evt-n-1"),
                new SubmitTelemetryRequest("PHOSPHORUS", 42.0, "mg/kg", now, "MANUAL", null, "evt-p-1"),
                new SubmitTelemetryRequest("POTASSIUM", 43.0, "mg/kg", now, "MANUAL", null, "evt-k-1"),
                new SubmitTelemetryRequest("AIR_TEMPERATURE", 24.5, "C", now, "MANUAL", null, "evt-temp-1"),
                new SubmitTelemetryRequest("RELATIVE_HUMIDITY", 78.0, "%", now, "MANUAL", null, "evt-hum-1"),
                new SubmitTelemetryRequest("SOIL_PH", 6.5, "pH", now, "MANUAL", null, "evt-ph-1"),
                new SubmitTelemetryRequest("RAINFALL", 150.0, "mm", now, "MANUAL", null, "evt-rain-1"),
                new SubmitTelemetryRequest("SOIL_MOISTURE", 45.0, "%", now, "MANUAL", null, "evt-sm-1")
        );

        for (SubmitTelemetryRequest reading : readings) {
            mockMvc.perform(post("/api/v1/farms/{farmId}/fields/{fieldId}/monitoring/telemetry", FARM_ID, COMPOSITE_FIELD_ID)
                            .header("Authorization", "Bearer " + ASSIGNED_FARMER_TOKEN)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(reading)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.success").value(true))
                    .andExpect(jsonPath("$.data.fieldId").value(COMPOSITE_FIELD_ID))
                    .andExpect(jsonPath("$.data.farmId").value(FARM_ID))
                    .andExpect(jsonPath("$.data.submittedByUid").value(ASSIGNED_FARMER_UID))
                    .andExpect(jsonPath("$.data.measurementType").value(reading.measurementType()))
                    .andExpect(jsonPath("$.data.rawValue").value(reading.value()))
                    .andExpect(jsonPath("$.data.unit").value(reading.unit()))
                    .andExpect(jsonPath("$.data.validationStatus").value("VALID"));
        }
    }

    @Test
    @DisplayName("[TELEMETRY-02] Assigned Farmer submits telemetry using localFieldId which resolves canonical composite ID (201 Created)")
    void testAssignedFarmerSubmitTelemetryUsingLocalFieldId() throws Exception {
        SubmitTelemetryRequest reading = new SubmitTelemetryRequest(
                "SOIL_MOISTURE", 42.0, "%", Instant.now().minusSeconds(5), "MANUAL", null, "evt-local-sm"
        );

        mockMvc.perform(post("/api/v1/farms/{farmId}/fields/{fieldId}/monitoring/telemetry", FARM_ID, LOCAL_FIELD_ID)
                        .header("Authorization", "Bearer " + ASSIGNED_FARMER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reading)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.fieldId").value(COMPOSITE_FIELD_ID))
                .andExpect(jsonPath("$.data.farmId").value(FARM_ID))
                .andExpect(jsonPath("$.data.validationStatus").value("VALID"));
    }

    @Test
    @DisplayName("[TELEMETRY-03] Assigned Farmer triggers agricultural analysis after telemetry submission (201 Created)")
    void testAssignedFarmerTriggerAgriculturalAnalysis() throws Exception {
        // First submit telemetry
        SubmitTelemetryRequest sm = new SubmitTelemetryRequest(
                "SOIL_MOISTURE", 45.0, "%", Instant.now().minusSeconds(10), "MANUAL", null, "evt-sm-ai"
        );
        mockMvc.perform(post("/api/v1/farms/{farmId}/fields/{fieldId}/monitoring/telemetry", FARM_ID, COMPOSITE_FIELD_ID)
                        .header("Authorization", "Bearer " + ASSIGNED_FARMER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(sm)))
                .andExpect(status().isCreated());

        // Then trigger AI agricultural analysis
        mockMvc.perform(post("/api/v1/farms/{farmId}/fields/{fieldId}/monitoring/agricultural-analyses", FARM_ID, COMPOSITE_FIELD_ID)
                        .header("Authorization", "Bearer " + ASSIGNED_FARMER_TOKEN))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("COMPLETED"))
                .andExpect(jsonPath("$.data.tabularStatus").value("COMPLETED"))
                .andExpect(jsonPath("$.data.predictedWaterNeed").value("Low"))
                .andExpect(jsonPath("$.data.predictedFieldStatus").value("Healthy"))
                .andExpect(jsonPath("$.data.recommendedCrop").value("rice"))
                .andExpect(jsonPath("$.data.waterNeedConfidence").value(0.98))
                .andExpect(jsonPath("$.data.tabularModelVersion").value("tabular-pipeline-v2.0"))
                .andExpect(jsonPath("$.data.labelProvenance").value("rule_derived"));
    }

    @Test
    @DisplayName("[TELEMETRY-04] Assigned Farmer retrieves latest telemetry (200 OK)")
    void testAssignedFarmerGetLatestTelemetry() throws Exception {
        SubmitTelemetryRequest reading = new SubmitTelemetryRequest(
                "NITROGEN", 85.0, "mg/kg", Instant.now().minusSeconds(5), "MANUAL", null, "evt-n-latest"
        );
        mockMvc.perform(post("/api/v1/farms/{farmId}/fields/{fieldId}/monitoring/telemetry", FARM_ID, COMPOSITE_FIELD_ID)
                        .header("Authorization", "Bearer " + ASSIGNED_FARMER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reading)))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/v1/farms/{farmId}/fields/{fieldId}/monitoring/telemetry/latest", FARM_ID, COMPOSITE_FIELD_ID)
                        .header("Authorization", "Bearer " + ASSIGNED_FARMER_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    @DisplayName("[TELEMETRY-05-NEG] Unassigned Farmer is rejected with HTTP 403 Forbidden")
    void testUnassignedFarmerRejectedWith403() throws Exception {
        SubmitTelemetryRequest reading = new SubmitTelemetryRequest(
                "SOIL_MOISTURE", 40.0, "%", Instant.now().minusSeconds(5), "MANUAL", null, "evt-unassigned"
        );

        mockMvc.perform(post("/api/v1/farms/{farmId}/fields/{fieldId}/monitoring/telemetry", FARM_ID, COMPOSITE_FIELD_ID)
                        .header("Authorization", "Bearer " + UNASSIGNED_FARMER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reading)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("[TELEMETRY-06-NEG] Farmer with only READ permission is rejected with HTTP 403 Forbidden")
    void testReadOnlyFarmerRejectedWith403() throws Exception {
        SubmitTelemetryRequest reading = new SubmitTelemetryRequest(
                "SOIL_MOISTURE", 40.0, "%", Instant.now().minusSeconds(5), "MANUAL", null, "evt-readonly"
        );

        mockMvc.perform(post("/api/v1/farms/{farmId}/fields/{fieldId}/monitoring/telemetry", FARM_ID, COMPOSITE_FIELD_ID)
                        .header("Authorization", "Bearer " + READONLY_FARMER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reading)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("[TELEMETRY-07-NEG] Farmer with released assignment is rejected with HTTP 403 Forbidden")
    void testReleasedFarmerRejectedWith403() throws Exception {
        assignmentRepository.releaseAssignment(COMPOSITE_FIELD_ID, ASSIGNED_FARMER_UID, "End of season");

        SubmitTelemetryRequest reading = new SubmitTelemetryRequest(
                "SOIL_MOISTURE", 40.0, "%", Instant.now().minusSeconds(5), "MANUAL", null, "evt-released"
        );

        mockMvc.perform(post("/api/v1/farms/{farmId}/fields/{fieldId}/monitoring/telemetry", FARM_ID, COMPOSITE_FIELD_ID)
                        .header("Authorization", "Bearer " + ASSIGNED_FARMER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reading)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("[TELEMETRY-08-NEG] Telemetry to a field of another farm is rejected (404/403)")
    void testFieldBelongingToOtherFarmRejected() throws Exception {
        SubmitTelemetryRequest reading = new SubmitTelemetryRequest(
                "SOIL_MOISTURE", 40.0, "%", Instant.now().minusSeconds(5), "MANUAL", null, "evt-cross-farm"
        );

        // FARM_ID attempting to write to OTHER_FIELD_ID (which belongs to OTHER_FARM_ID)
        mockMvc.perform(post("/api/v1/farms/{farmId}/fields/{fieldId}/monitoring/telemetry", FARM_ID, OTHER_FIELD_ID)
                        .header("Authorization", "Bearer " + ASSIGNED_FARMER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reading)))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("[TELEMETRY-09-NEG] Unauthenticated telemetry submission returns HTTP 401 Unauthorized")
    void testUnauthenticatedTelemetrySubmissionReturns401() throws Exception {
        SubmitTelemetryRequest reading = new SubmitTelemetryRequest(
                "SOIL_MOISTURE", 40.0, "%", Instant.now().minusSeconds(5), "MANUAL", null, "evt-no-auth"
        );

        mockMvc.perform(post("/api/v1/farms/{farmId}/fields/{fieldId}/monitoring/telemetry", FARM_ID, COMPOSITE_FIELD_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reading)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("[TELEMETRY-10] Out-of-range telemetry value is recorded with OUT_OF_RANGE validationStatus and warning")
    void testOutOfRangeTelemetryHandledSafely() throws Exception {
        // Soil moisture % range is 0-100. 150.0 is out of range.
        SubmitTelemetryRequest reading = new SubmitTelemetryRequest(
                "SOIL_MOISTURE", 150.0, "%", Instant.now().minusSeconds(5), "MANUAL", null, "evt-out-of-range"
        );

        mockMvc.perform(post("/api/v1/farms/{farmId}/fields/{fieldId}/monitoring/telemetry", FARM_ID, COMPOSITE_FIELD_ID)
                        .header("Authorization", "Bearer " + ASSIGNED_FARMER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reading)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.validationStatus").value("OUT_OF_RANGE"))
                .andExpect(jsonPath("$.data.warnings[0]").exists());
    }

    @Test
    @DisplayName("[TELEMETRY-11] Batch telemetry submission records all 8 measurements in a single atomic request")
    void testBatchTelemetrySubmissionSuccess() throws Exception {
        SubmitTelemetryBatchRequest batchRequest = new SubmitTelemetryBatchRequest(List.of(
                new SubmitTelemetryRequest("NITROGEN", 90.0, "mg/kg", Instant.now().minusSeconds(10), "MANUAL", null, "batch-n"),
                new SubmitTelemetryRequest("PHOSPHORUS", 42.0, "mg/kg", Instant.now().minusSeconds(10), "MANUAL", null, "batch-p"),
                new SubmitTelemetryRequest("POTASSIUM", 43.0, "mg/kg", Instant.now().minusSeconds(10), "MANUAL", null, "batch-k"),
                new SubmitTelemetryRequest("AIR_TEMPERATURE", 24.5, "C", Instant.now().minusSeconds(10), "MANUAL", null, "batch-t"),
                new SubmitTelemetryRequest("RELATIVE_HUMIDITY", 78.0, "%", Instant.now().minusSeconds(10), "MANUAL", null, "batch-h"),
                new SubmitTelemetryRequest("SOIL_PH", 6.5, "pH", Instant.now().minusSeconds(10), "MANUAL", null, "batch-ph"),
                new SubmitTelemetryRequest("RAINFALL", 150.0, "mm", Instant.now().minusSeconds(10), "MANUAL", null, "batch-r"),
                new SubmitTelemetryRequest("SOIL_MOISTURE", 45.0, "%", Instant.now().minusSeconds(10), "MANUAL", null, "batch-sm")
        ));

        mockMvc.perform(post("/api/v1/farms/{farmId}/fields/{fieldId}/monitoring/telemetry/batch", FARM_ID, COMPOSITE_FIELD_ID)
                        .header("Authorization", "Bearer " + ASSIGNED_FARMER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(batchRequest)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.length()").value(8))
                .andExpect(jsonPath("$.data[0].measurementType").value("NITROGEN"))
                .andExpect(jsonPath("$.data[7].measurementType").value("SOIL_MOISTURE"));
    }

    @Test
    @DisplayName("[TELEMETRY-12-NEG] Batch telemetry submission is rejected with HTTP 403 Forbidden for unassigned farmer")
    void testBatchTelemetryRejectedForUnassignedFarmer() throws Exception {
        SubmitTelemetryBatchRequest batchRequest = new SubmitTelemetryBatchRequest(List.of(
                new SubmitTelemetryRequest("NITROGEN", 90.0, "mg/kg", Instant.now().minusSeconds(10), "MANUAL", null, "batch-unauth")
        ));

        mockMvc.perform(post("/api/v1/farms/{farmId}/fields/{fieldId}/monitoring/telemetry/batch", FARM_ID, COMPOSITE_FIELD_ID)
                        .header("Authorization", "Bearer " + UNASSIGNED_FARMER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(batchRequest)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("[ANALYSIS-13] Agricultural analysis creation and retrieval by analysisId succeeds")
    void testAgriculturalAnalysisLifecycleAndRetrieval() throws Exception {
        when(aiInferenceClient.inferTabular(anyMap())).thenReturn(Map.of(
                "water_need", "Low",
                "field_status", "Healthy",
                "water_need_confidence", 0.98,
                "field_status_confidence", 0.95,
                "recommended_crop", "rice",
                "crop_confidence", 0.99,
                "model_version", "tabular-v2",
                "disclaimer", "Notice"
        ));

        String postResponse = mockMvc.perform(post("/api/v1/farms/{farmId}/fields/{fieldId}/monitoring/agricultural-analyses", FARM_ID, COMPOSITE_FIELD_ID)
                        .header("Authorization", "Bearer " + ASSIGNED_FARMER_TOKEN))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.analysisId").exists())
                .andReturn().getResponse().getContentAsString();

        String analysisId = objectMapper.readTree(postResponse).path("data").path("analysisId").asText();

        mockMvc.perform(get("/api/v1/farms/{farmId}/fields/{fieldId}/monitoring/agricultural-analyses/{analysisId}", FARM_ID, COMPOSITE_FIELD_ID, analysisId)
                        .header("Authorization", "Bearer " + ASSIGNED_FARMER_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.analysisId").value(analysisId));
    }

    @Test
    @DisplayName("[ANALYSIS-14] Agricultural analysis with async=true returns 201 with status PENDING immediately")
    void testAgriculturalAnalysisAsyncWorkflow() throws Exception {
        mockMvc.perform(post("/api/v1/farms/{farmId}/fields/{fieldId}/monitoring/agricultural-analyses?async=true", FARM_ID, COMPOSITE_FIELD_ID)
                        .header("Authorization", "Bearer " + ASSIGNED_FARMER_TOKEN))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.tabularStatus").value("PENDING"));
    }
}
