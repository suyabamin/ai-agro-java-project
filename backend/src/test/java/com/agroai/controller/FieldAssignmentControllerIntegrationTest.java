package com.agroai.controller;

import com.agroai.dto.CreateAssignmentRequest;
import com.agroai.dto.InitializeProfileRequest;
import com.agroai.dto.ReassignFarmerRequest;
import com.agroai.dto.ReleaseAssignmentRequest;
import com.agroai.model.Farm;
import com.agroai.model.FarmMembership;
import com.agroai.model.FarmRole;
import com.agroai.model.FarmStatus;
import com.agroai.model.FarmVisibility;
import com.agroai.model.Field;
import com.agroai.model.FieldStatus;
import com.agroai.model.MembershipStatus;
import com.agroai.repository.AssignmentHistoryRepository;
import com.agroai.repository.FarmMembershipRepository;
import com.agroai.repository.FarmRepository;
import com.agroai.repository.FieldAssignmentRepository;
import com.agroai.repository.FieldRepository;
import com.agroai.repository.UserRepository;
import com.agroai.security.FirebaseTokenVerifier;
import com.agroai.security.FirebaseUserDetails;
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

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Milestone 5 — FieldAssignmentController Integration Tests")
class FieldAssignmentControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private FarmRepository farmRepository;

    @Autowired
    private FieldRepository fieldRepository;

    @Autowired
    private FarmMembershipRepository membershipRepository;

    @Autowired
    private FieldAssignmentRepository assignmentRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AssignmentHistoryRepository historyRepository;

    @MockBean
    private FirebaseTokenVerifier tokenVerifier;

    private static final String OWNER_TOKEN = "asgn.owner.token";
    private static final String OWNER_UID = "asgn-owner-101";

    private static final String MANAGER_TOKEN = "asgn.manager.token";
    private static final String MANAGER_UID = "asgn-manager-202";

    private static final String OBSERVER_TOKEN = "asgn.observer.token";
    private static final String OBSERVER_UID = "asgn-observer-303";

    private static final String STRANGER_TOKEN = "asgn.stranger.token";
    private static final String STRANGER_UID = "asgn-stranger-404";

    private static final String FARMER_UID = "asgn-farmer-505";
    private static final String NEW_FARMER_UID = "asgn-farmer-606";

    private static final String FARM_ID = "farm-22222222-3333-4444-5555-666666666666";
    private static final String FIELD_ID = FARM_ID + "--plot-01";

    @BeforeEach
    void setUp() {
        FirebaseUserDetails ownerDetails = new FirebaseUserDetails(OWNER_UID, "owner@agroai.org", "Owner", true, Map.of());
        FirebaseUserDetails managerDetails = new FirebaseUserDetails(MANAGER_UID, "manager@agroai.org", "Manager", true, Map.of());
        FirebaseUserDetails observerDetails = new FirebaseUserDetails(OBSERVER_UID, "observer@agroai.org", "Observer", true, Map.of());
        FirebaseUserDetails strangerDetails = new FirebaseUserDetails(STRANGER_UID, "stranger@agroai.org", "Stranger", true, Map.of());

        when(tokenVerifier.verifyToken(eq(OWNER_TOKEN))).thenReturn(ownerDetails);
        when(tokenVerifier.verifyToken(eq(OWNER_TOKEN), eq(false))).thenReturn(ownerDetails);
        when(tokenVerifier.verifyToken(eq(OWNER_TOKEN), eq(true))).thenReturn(ownerDetails);

        when(tokenVerifier.verifyToken(eq(MANAGER_TOKEN))).thenReturn(managerDetails);
        when(tokenVerifier.verifyToken(eq(MANAGER_TOKEN), eq(false))).thenReturn(managerDetails);
        when(tokenVerifier.verifyToken(eq(MANAGER_TOKEN), eq(true))).thenReturn(managerDetails);

        when(tokenVerifier.verifyToken(eq(OBSERVER_TOKEN))).thenReturn(observerDetails);
        when(tokenVerifier.verifyToken(eq(OBSERVER_TOKEN), eq(false))).thenReturn(observerDetails);
        when(tokenVerifier.verifyToken(eq(OBSERVER_TOKEN), eq(true))).thenReturn(observerDetails);

        when(tokenVerifier.verifyToken(eq(STRANGER_TOKEN))).thenReturn(strangerDetails);
        when(tokenVerifier.verifyToken(eq(STRANGER_TOKEN), eq(false))).thenReturn(strangerDetails);
        when(tokenVerifier.verifyToken(eq(STRANGER_TOKEN), eq(true))).thenReturn(strangerDetails);

        // Reset repositories
        assignmentRepository.clearAllForTesting();
        historyRepository.clearAllForTesting();

        Farm farm = new Farm();
        farm.setFarmId(FARM_ID);
        farm.setName("Delta Farm");
        farm.setOwnerUid(OWNER_UID);
        farm.setOwnerSafeUid(KeyEncoder.encodeUid(OWNER_UID));
        farm.setDistrict("Bogra");
        farm.setDivision("Rajshahi");
        farm.setDetailedAddress("Road 5");
        farm.setTotalAreaHectares(30.0);
        farm.setStatus(FarmStatus.ACTIVE);
        farm.setVisibility(FarmVisibility.PUBLIC);
        farmRepository.save(farm);

        Field field = new Field(FIELD_ID, "plot-01", FARM_ID, "Corn Plot 1", 6.0);
        field.setStatus(FieldStatus.ACTIVE);
        fieldRepository.save(field);

        membershipRepository.saveMembership(new FarmMembership("mbr_owner", FARM_ID, OWNER_UID, FarmRole.OWNER, MembershipStatus.ACTIVE));
        membershipRepository.saveMembership(new FarmMembership("mbr_manager", FARM_ID, MANAGER_UID, FarmRole.MANAGER, MembershipStatus.ACTIVE));
        membershipRepository.saveMembership(new FarmMembership("mbr_observer", FARM_ID, OBSERVER_UID, FarmRole.OBSERVER, MembershipStatus.ACTIVE));
        userRepository.initializeProfile(FARMER_UID, "farmer@example.test", new InitializeProfileRequest("Test Farmer", null, null, "en"));
        userRepository.initializeProfile(NEW_FARMER_UID, "newfarmer@example.test", new InitializeProfileRequest("New Test Farmer", null, null, "en"));
        userRepository.initializeProfile(OWNER_UID, "owner@example.test", new InitializeProfileRequest("Test Owner", null, null, "en"));
        userRepository.initializeProfile(MANAGER_UID, "manager@example.test", new InitializeProfileRequest("Test Manager", null, null, "en"));
    }

    @Test
    @DisplayName("[ASGN-INT-01] POST /api/v1/farms/{farmId}/fields/{fieldId}/assignments creates assignment (201)")
    void testCreateAssignmentEndpoint201() throws Exception {
        CreateAssignmentRequest req = new CreateAssignmentRequest(FARMER_UID, List.of("READ", "WRITE_LOGS"), null, null);

        mockMvc.perform(post("/api/v1/farms/{farmId}/fields/{fieldId}/assignments", FARM_ID, FIELD_ID)
                        .header("Authorization", "Bearer " + OWNER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.farmerUid").value(FARMER_UID))
                .andExpect(jsonPath("$.data.farmerEmail").doesNotExist())
                .andExpect(jsonPath("$.data.fieldId").value(FIELD_ID))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));
    }

    @Test
    @DisplayName("[ASGN-INT-02] Duplicate active assignment returns 409 Conflict")
    void testCreateAssignmentDuplicate409() throws Exception {
        CreateAssignmentRequest req = new CreateAssignmentRequest(FARMER_UID, List.of("READ"), null, null);

        mockMvc.perform(post("/api/v1/farms/{farmId}/fields/{fieldId}/assignments", FARM_ID, FIELD_ID)
                        .header("Authorization", "Bearer " + OWNER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/farms/{farmId}/fields/{fieldId}/assignments", FARM_ID, FIELD_ID)
                        .header("Authorization", "Bearer " + OWNER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    @DisplayName("[ASGN-INT-03] GET /api/v1/farms/{farmId}/fields/{fieldId}/assignments returns assignments list (200)")
    void testGetFieldAssignmentsEndpoint200() throws Exception {
        CreateAssignmentRequest req = new CreateAssignmentRequest(FARMER_UID, List.of("READ"), null, null);
        mockMvc.perform(post("/api/v1/farms/{farmId}/fields/{fieldId}/assignments", FARM_ID, FIELD_ID)
                        .header("Authorization", "Bearer " + MANAGER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/v1/farms/{farmId}/fields/{fieldId}/assignments", FARM_ID, FIELD_ID)
                        .header("Authorization", "Bearer " + OBSERVER_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items").isArray())
                .andExpect(jsonPath("$.data.items[0].farmerUid").value(FARMER_UID));
    }

    @Test
    @DisplayName("[ASGN-PAGE-01] Assignment pages advance with a stable cursor and no duplicates")
    void testAssignmentPaginationBoundaries() throws Exception {
        for (String uid : List.of(FARMER_UID, NEW_FARMER_UID)) {
            CreateAssignmentRequest req = new CreateAssignmentRequest(uid, List.of("READ"), null, null);
            mockMvc.perform(post("/api/v1/farms/{farmId}/fields/{fieldId}/assignments", FARM_ID, FIELD_ID)
                            .header("Authorization", "Bearer " + OWNER_TOKEN)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(req)))
                    .andExpect(status().isCreated());
        }

        String firstBody = mockMvc.perform(get("/api/v1/farms/{farmId}/fields/{fieldId}/assignments", FARM_ID, FIELD_ID)
                        .param("size", "1")
                        .header("Authorization", "Bearer " + OBSERVER_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.hasNext").value(true))
                .andReturn().getResponse().getContentAsString();
        String cursor = objectMapper.readTree(firstBody).path("data").path("nextCursor").asText();
        String firstId = objectMapper.readTree(firstBody).path("data").path("items").get(0).path("assignmentId").asText();
        String secondBody = mockMvc.perform(get("/api/v1/farms/{farmId}/fields/{fieldId}/assignments", FARM_ID, FIELD_ID)
                        .param("size", "1").param("cursor", cursor)
                        .header("Authorization", "Bearer " + OBSERVER_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.hasNext").value(false))
                .andReturn().getResponse().getContentAsString();
        String secondId = objectMapper.readTree(secondBody).path("data").path("items").get(0).path("assignmentId").asText();
        assertNotEquals(firstId, secondId);
    }

    @Test
    @DisplayName("[ASGN-PAGE-02] Invalid pagination size and cursor are rejected")
    void testInvalidPaginationInputRejected() throws Exception {
        mockMvc.perform(get("/api/v1/farms/{farmId}/assignments", FARM_ID)
                        .param("size", "101")
                        .header("Authorization", "Bearer " + OBSERVER_TOKEN))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/v1/farms/{farmId}/assignments", FARM_ID)
                        .param("cursor", "not-a-valid-cursor!")
                        .header("Authorization", "Bearer " + OBSERVER_TOKEN))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/v1/farms/{farmId}/assignments", FARM_ID)
                        .header("Authorization", "Bearer " + STRANGER_TOKEN))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("[ASGN-INT-04] GET /api/v1/farms/{farmId}/assignments returns farm assignments list (200)")
    void testGetFarmAssignmentsEndpoint200() throws Exception {
        mockMvc.perform(get("/api/v1/farms/{farmId}/assignments", FARM_ID)
                        .header("Authorization", "Bearer " + OBSERVER_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items").isArray())
                .andExpect(jsonPath("$.data.pageSize").value(25));
    }

    @Test
    @DisplayName("[ASGN-INT-05] POST .../release releases assignment successfully (200)")
    void testReleaseAssignmentEndpoint200() throws Exception {
        CreateAssignmentRequest req = new CreateAssignmentRequest(FARMER_UID, List.of("READ"), null, null);
        String createResp = mockMvc.perform(post("/api/v1/farms/{farmId}/fields/{fieldId}/assignments", FARM_ID, FIELD_ID)
                        .header("Authorization", "Bearer " + OWNER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        String assignmentId = objectMapper.readTree(createResp).path("data").path("assignmentId").asText();

        ReleaseAssignmentRequest relReq = new ReleaseAssignmentRequest("Contract finished", 1);
        mockMvc.perform(post("/api/v1/farms/{farmId}/fields/{fieldId}/assignments/{assignmentId}/release",
                        FARM_ID, FIELD_ID, assignmentId)
                        .header("Authorization", "Bearer " + MANAGER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(relReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("RELEASED"))
                .andExpect(jsonPath("$.data.releaseReason").value("Contract finished"));
    }

    @Test
    @DisplayName("[ASGN-INT-06] POST .../reassign replaces farmer atomically (200)")
    void testReassignFarmerEndpoint200() throws Exception {
        CreateAssignmentRequest req = new CreateAssignmentRequest(FARMER_UID, List.of("READ"), null, null);
        String createResp = mockMvc.perform(post("/api/v1/farms/{farmId}/fields/{fieldId}/assignments", FARM_ID, FIELD_ID)
                        .header("Authorization", "Bearer " + OWNER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        String assignmentId = objectMapper.readTree(createResp).path("data").path("assignmentId").asText();

        ReassignFarmerRequest reassignReq = new ReassignFarmerRequest(
                NEW_FARMER_UID, "Replacing with skilled operator", List.of("READ", "WRITE_LOGS"), 1, null
        );

        mockMvc.perform(post("/api/v1/farms/{farmId}/fields/{fieldId}/assignments/{assignmentId}/reassign",
                        FARM_ID, FIELD_ID, assignmentId)
                        .header("Authorization", "Bearer " + OWNER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reassignReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.farmerUid").value(NEW_FARMER_UID))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));
    }

    @Test
    @DisplayName("[ASGN-INT-07] GET .../history returns assignment audit records (200)")
    void testGetAssignmentHistoryEndpoint200() throws Exception {
        CreateAssignmentRequest req = new CreateAssignmentRequest(FARMER_UID, List.of("READ"), null, null);
        String createResp = mockMvc.perform(post("/api/v1/farms/{farmId}/fields/{fieldId}/assignments", FARM_ID, FIELD_ID)
                        .header("Authorization", "Bearer " + OWNER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();

        String assignmentId = objectMapper.readTree(createResp).path("data").path("assignmentId").asText();

        mockMvc.perform(get("/api/v1/farms/{farmId}/fields/{fieldId}/assignments/{assignmentId}/history",
                        FARM_ID, FIELD_ID, assignmentId)
                        .header("Authorization", "Bearer " + OBSERVER_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items").isArray())
                .andExpect(jsonPath("$.data.items[0].eventType").value("ASSIGNED"));
    }

    @Test
    @DisplayName("[ASGN-INT-08] Non-manager or stranger attempting assignment operations returns 403 Forbidden")
    void testNonManagerForbidden403() throws Exception {
        CreateAssignmentRequest req = new CreateAssignmentRequest(FARMER_UID, List.of("READ"), null, null);

        // Observer cannot assign
        mockMvc.perform(post("/api/v1/farms/{farmId}/fields/{fieldId}/assignments", FARM_ID, FIELD_ID)
                        .header("Authorization", "Bearer " + OBSERVER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isForbidden());

        // Stranger cannot assign
        mockMvc.perform(post("/api/v1/farms/{farmId}/fields/{fieldId}/assignments", FARM_ID, FIELD_ID)
                        .header("Authorization", "Bearer " + STRANGER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isForbidden());
    }
}
