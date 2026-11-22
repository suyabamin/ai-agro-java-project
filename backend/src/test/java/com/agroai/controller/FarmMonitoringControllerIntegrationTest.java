package com.agroai.controller;

import com.agroai.dto.InitializeProfileRequest;
import com.agroai.dto.SubmitTelemetryRequest;
import com.agroai.model.*;
import com.agroai.repository.*;
import com.agroai.security.FirebaseTokenVerifier;
import com.agroai.security.FirebaseUserDetails;
import com.agroai.service.AgriculturalAnalysisService;
import com.agroai.service.SoilTelemetryService;
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
import java.util.Map;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Farm Monitoring Controller Batch Integration Tests")
class FarmMonitoringControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private FarmRepository farmRepository;

    @Autowired
    private FieldRepository fieldRepository;

    @Autowired
    private FarmMembershipRepository membershipRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AgriculturalAnalysisService agriculturalAnalysisService;

    @Autowired
    private SoilTelemetryService soilTelemetryService;

    @MockBean
    private FirebaseTokenVerifier tokenVerifier;

    private static final String OWNER_UID = "owner-uid-farm-m6";
    private static final String OTHER_UID = "intruder-uid-farm-m6";
    private static final String FARM_ID = "farm-batch-ai-test";
    private static final String FIELD_1_ID = "farm-batch-ai-test--F-001";
    private static final String FIELD_2_ID = "farm-batch-ai-test--F-002";

    @BeforeEach
    void setup() {
        FirebaseUserDetails ownerUser = new FirebaseUserDetails(OWNER_UID, "owner@agroai.com", "Farm Owner", true, Map.of());
        when(tokenVerifier.verifyToken(eq("owner-token"))).thenReturn(ownerUser);
        when(tokenVerifier.verifyToken(eq("owner-token"), eq(false))).thenReturn(ownerUser);
        when(tokenVerifier.verifyToken(eq("owner-token"), eq(true))).thenReturn(ownerUser);

        FirebaseUserDetails otherUser = new FirebaseUserDetails(OTHER_UID, "other@agroai.com", "Other User", true, Map.of());
        when(tokenVerifier.verifyToken(eq("other-token"))).thenReturn(otherUser);
        when(tokenVerifier.verifyToken(eq("other-token"), eq(false))).thenReturn(otherUser);
        when(tokenVerifier.verifyToken(eq("other-token"), eq(true))).thenReturn(otherUser);

        userRepository.initializeProfile(OWNER_UID, "owner@agroai.com",
                new InitializeProfileRequest("Farm Owner", null, null, "en"));
        userRepository.initializeProfile(OTHER_UID, "other@agroai.com",
                new InitializeProfileRequest("Other User", null, null, "en"));

        Farm farm = new Farm();
        farm.setFarmId(FARM_ID);
        farm.setName("Batch Decision Farm");
        farm.setStatus(FarmStatus.ACTIVE);
        farm.setOwnerUid(OWNER_UID);
        farmRepository.save(farm);

        membershipRepository.saveMembership(new FarmMembership("mem-" + FARM_ID + "-" + OWNER_UID,
                FARM_ID, OWNER_UID, FarmRole.OWNER, MembershipStatus.ACTIVE));

        Field f1 = new Field(FIELD_1_ID, "F-001", FARM_ID, "Potato Field", 3.0);
        f1.setCropType(CropType.POTATO);
        f1.setStatus(FieldStatus.ACTIVE);
        fieldRepository.save(f1);

        Field f2 = new Field(FIELD_2_ID, "F-002", FARM_ID, "Rice Field", 5.0);
        f2.setCropType(CropType.RICE);
        f2.setStatus(FieldStatus.ACTIVE);
        fieldRepository.save(f2);
    }

    @Test
    @DisplayName("Owner retrieves farm-wide latest agricultural analyses via batch endpoint")
    void ownerRetrievesLatestAgriculturalAnalysesForFarm() throws Exception {
        // Farmer submits telemetry to Field 1
        soilTelemetryService.submit(FARM_ID, FIELD_1_ID, OWNER_UID,
                new SubmitTelemetryRequest("NITROGEN", 90.0, "mg/kg", Instant.now(), "MANUAL", null, "test-client-n"));

        // Create analysis for Field 1
        var analysis1 = agriculturalAnalysisService.create(FARM_ID, FIELD_1_ID, OWNER_UID, false);
        String createdAnalysisId = String.valueOf(analysis1.get("analysisId"));

        mockMvc.perform(get("/api/v1/farms/{farmId}/monitoring/agricultural-analyses/latest", FARM_ID)
                        .header("Authorization", "Bearer owner-token")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data['" + FIELD_1_ID + "']").exists())
                .andExpect(jsonPath("$.data['" + FIELD_1_ID + "'].analysisId").value(createdAnalysisId))
                .andExpect(jsonPath("$.data['F-001']").exists())
                .andExpect(jsonPath("$.data['F-001'].analysisId").value(createdAnalysisId))
                .andExpect(jsonPath("$.data['" + FIELD_2_ID + "']").doesNotExist()); // Field 2 has no analysis
    }

    @Test
    @DisplayName("Owner retrieves farm-wide latest telemetry via batch endpoint")
    void ownerRetrievesLatestFarmTelemetry() throws Exception {
        soilTelemetryService.submit(FARM_ID, FIELD_1_ID, OWNER_UID,
                new SubmitTelemetryRequest("SOIL_MOISTURE", 45.0, "%", Instant.now(), "MANUAL", null, "test-client-sm"));

        mockMvc.perform(get("/api/v1/farms/{farmId}/monitoring/telemetry/latest", FARM_ID)
                        .header("Authorization", "Bearer owner-token")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data['" + FIELD_1_ID + "']").isArray())
                .andExpect(jsonPath("$.data['" + FIELD_1_ID + "'][0].measurementType").value("SOIL_MOISTURE"))
                .andExpect(jsonPath("$.data['" + FIELD_1_ID + "'][0].value").value(45.0));
    }

    @Test
    @DisplayName("Cross-farm or non-member access to batch monitoring is rejected with 403")
    void crossFarmAccessIsDenied() throws Exception {
        mockMvc.perform(get("/api/v1/farms/{farmId}/monitoring/agricultural-analyses/latest", FARM_ID)
                        .header("Authorization", "Bearer other-token")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }
}
