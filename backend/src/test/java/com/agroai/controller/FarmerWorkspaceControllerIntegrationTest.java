package com.agroai.controller;

import com.agroai.model.AssignmentStatus;
import com.agroai.model.CropType;
import com.agroai.model.Farm;
import com.agroai.model.FarmStatus;
import com.agroai.model.FarmVisibility;
import com.agroai.model.Field;
import com.agroai.model.FieldAssignment;
import com.agroai.model.FieldStatus;
import com.agroai.model.IrrigationType;
import com.agroai.model.SoilType;
import com.agroai.repository.FarmRepository;
import com.agroai.repository.FieldAssignmentRepository;
import com.agroai.repository.FieldRepository;
import com.agroai.repository.UserRepository;
import com.agroai.dto.InitializeProfileRequest;
import com.agroai.security.FirebaseTokenVerifier;
import com.agroai.security.FirebaseUserDetails;
import com.agroai.util.KeyEncoder;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Milestone 5 — FarmerWorkspaceController Integration Tests")
class FarmerWorkspaceControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private FarmRepository farmRepository;

    @Autowired
    private FieldRepository fieldRepository;

    @Autowired
    private FieldAssignmentRepository assignmentRepository;

    @Autowired
    private UserRepository userRepository;

    @MockBean
    private FirebaseTokenVerifier tokenVerifier;

    private static final String ASSIGNED_FARMER_TOKEN = "farmer.assigned.token";
    private static final String ASSIGNED_FARMER_UID = "ws-farmer-assigned-001";

    private static final String UNASSIGNED_FARMER_TOKEN = "farmer.unassigned.token";
    private static final String UNASSIGNED_FARMER_UID = "ws-farmer-unassigned-002";

    private static final String FARM_ID = "farm-33333333-4444-5555-6666-777777777777";
    private static final String FIELD_ID_1 = FARM_ID + "--plot-active";
    private static final String FIELD_ID_2 = FARM_ID + "--plot-other";

    @BeforeEach
    void setUp() {
        FirebaseUserDetails assignedFarmer = new FirebaseUserDetails(
                ASSIGNED_FARMER_UID, "assigned@agroai.org", "Assigned Farmer", true, Map.of()
        );
        FirebaseUserDetails unassignedFarmer = new FirebaseUserDetails(
                UNASSIGNED_FARMER_UID, "unassigned@agroai.org", "Unassigned Farmer", true, Map.of()
        );

        when(tokenVerifier.verifyToken(eq(ASSIGNED_FARMER_TOKEN))).thenReturn(assignedFarmer);
        when(tokenVerifier.verifyToken(eq(ASSIGNED_FARMER_TOKEN), eq(false))).thenReturn(assignedFarmer);
        when(tokenVerifier.verifyToken(eq(ASSIGNED_FARMER_TOKEN), eq(true))).thenReturn(assignedFarmer);

        when(tokenVerifier.verifyToken(eq(UNASSIGNED_FARMER_TOKEN))).thenReturn(unassignedFarmer);
        when(tokenVerifier.verifyToken(eq(UNASSIGNED_FARMER_TOKEN), eq(false))).thenReturn(unassignedFarmer);
        when(tokenVerifier.verifyToken(eq(UNASSIGNED_FARMER_TOKEN), eq(true))).thenReturn(unassignedFarmer);

        assignmentRepository.clearAllForTesting();
        userRepository.clearAllForTesting();
        userRepository.initializeProfile(ASSIGNED_FARMER_UID, "assigned@example.test",
                new InitializeProfileRequest("Assigned Farmer", null, null, "en"));

        Farm farm = new Farm();
        farm.setFarmId(FARM_ID);
        farm.setName("Workspace Farm");
        farm.setOwnerUid("ws-owner");
        farm.setOwnerSafeUid(KeyEncoder.encodeUid("ws-owner"));
        farm.setDistrict("Mymensingh");
        farm.setDivision("Dhaka");
        farm.setDetailedAddress("Sector 4");
        farm.setTotalAreaHectares(18.0);
        farm.setStatus(FarmStatus.ACTIVE);
        farm.setVisibility(FarmVisibility.PUBLIC);
        farmRepository.save(farm);

        Field field1 = new Field(FIELD_ID_1, "plot-active", FARM_ID, "Paddy Field Alpha", 4.0);
        field1.setStatus(FieldStatus.ACTIVE);
        field1.setCropType(CropType.RICE);
        field1.setSoilType(SoilType.CLAY);
        field1.setIrrigationType(IrrigationType.CANAL);
        field1.setNotes("Private owner note that must not be exposed");
        fieldRepository.save(field1);

        Field field2 = new Field(FIELD_ID_2, "plot-other", FARM_ID, "Wheat Field Beta", 3.5);
        field2.setStatus(FieldStatus.ACTIVE);
        fieldRepository.save(field2);

        // Assign farmer to FIELD_ID_1 only
        FieldAssignment assignment = new FieldAssignment(FIELD_ID_1, ASSIGNED_FARMER_UID, List.of("READ", "WRITE_LOGS"));
        assignment.setAssignmentId(KeyEncoder.assignmentDocId(FIELD_ID_1, ASSIGNED_FARMER_UID));
        assignment.setFarmId(FARM_ID);
        assignment.setStatus(AssignmentStatus.ACTIVE);
        assignmentRepository.save(assignment);
    }

    @Test
    @DisplayName("[WS-INT-01] GET /api/v1/farmers/me/assignments returns active assigned fields (200)")
    void testFarmerGetActiveAssignments200() throws Exception {
        mockMvc.perform(get("/api/v1/farmers/me/assignments")
                        .header("Authorization", "Bearer " + ASSIGNED_FARMER_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items").isArray())
                .andExpect(jsonPath("$.data.items[0].fieldId").value(FIELD_ID_1))
                .andExpect(jsonPath("$.data.items[0].status").value("ACTIVE"));
    }

    @Test
    @DisplayName("[WS-INT-02] GET /api/v1/farmers/me/assignments/history returns full history (200)")
    void testFarmerGetAssignmentHistory200() throws Exception {
        mockMvc.perform(get("/api/v1/farmers/me/assignments/history")
                        .header("Authorization", "Bearer " + ASSIGNED_FARMER_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items").isArray())
                .andExpect(jsonPath("$.data.items[0].fieldId").value(FIELD_ID_1));
    }

    @Test
    @DisplayName("[WS-INT-03] Actively assigned farmer can view field details (200)")
    void testFarmerGetAssignedFieldSuccess200() throws Exception {
        mockMvc.perform(get("/api/v1/farmers/me/fields/{fieldId}", FIELD_ID_1)
                        .header("Authorization", "Bearer " + ASSIGNED_FARMER_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.fieldId").value(FIELD_ID_1))
                .andExpect(jsonPath("$.data.name").value("Paddy Field Alpha"))
                .andExpect(jsonPath("$.data.notes").doesNotExist());
    }

    @Test
    @DisplayName("[WS-INT-04] Farmer attempting to access unassigned field returns 403 Forbidden")
    void testFarmerUnassignedFieldForbidden403() throws Exception {
        // ASSIGNED_FARMER is not assigned to FIELD_ID_2
        mockMvc.perform(get("/api/v1/farmers/me/fields/{fieldId}", FIELD_ID_2)
                        .header("Authorization", "Bearer " + ASSIGNED_FARMER_TOKEN))
                .andExpect(status().isForbidden());

        // UNASSIGNED_FARMER is not assigned to FIELD_ID_1
        mockMvc.perform(get("/api/v1/farmers/me/fields/{fieldId}", FIELD_ID_1)
                        .header("Authorization", "Bearer " + UNASSIGNED_FARMER_TOKEN))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("[WS-INT-05] Releasing an assignment immediately denies farmer field access (403)")
    void testFarmerReleasedFieldForbidden403() throws Exception {
        // Access is allowed initially
        mockMvc.perform(get("/api/v1/farmers/me/fields/{fieldId}", FIELD_ID_1)
                        .header("Authorization", "Bearer " + ASSIGNED_FARMER_TOKEN))
                .andExpect(status().isOk());

        // Release assignment
        assignmentRepository.releaseAssignment(FIELD_ID_1, ASSIGNED_FARMER_UID, "End of season");

        // Access must be immediately revoked
        mockMvc.perform(get("/api/v1/farmers/me/fields/{fieldId}", FIELD_ID_1)
                        .header("Authorization", "Bearer " + ASSIGNED_FARMER_TOKEN))
                .andExpect(status().isForbidden());
    }
}
