package com.agroai.controller;

import com.agroai.dto.CreateFarmRequest;
import com.agroai.dto.CreateFieldRequest;
import com.agroai.dto.UpdateFieldRequest;
import com.agroai.model.CropType;
import com.agroai.model.FarmMembership;
import com.agroai.model.FarmRole;
import com.agroai.model.FarmVisibility;
import com.agroai.model.FieldStatus;
import com.agroai.model.IrrigationType;
import com.agroai.model.MembershipStatus;
import com.agroai.model.SoilType;
import com.agroai.repository.FarmMembershipRepository;
import com.agroai.repository.FarmRepository;
import com.agroai.repository.FieldRepository;
import com.agroai.repository.UserRepository;
import com.agroai.security.FirebaseTokenVerifier;
import com.agroai.security.FirebaseUserDetails;
import com.agroai.service.FarmService;
import com.agroai.service.FieldService;
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

import java.util.Map;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Field Controller Integration Tests")
class FieldControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private FarmRepository farmRepository;

    @Autowired
    private FarmMembershipRepository membershipRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private FieldRepository fieldRepository;

    @Autowired
    private FarmService farmService;

    @Autowired
    private FieldService fieldService;

    @MockBean
    private FirebaseTokenVerifier tokenVerifier;

    private static final String OWNER_TOKEN = "field.owner.token";
    private static final String OWNER_UID = "field-owner-101";

    private static final String MANAGER_TOKEN = "field.manager.token";
    private static final String MANAGER_UID = "field-manager-202";

    private static final String OBSERVER_TOKEN = "field.observer.token";
    private static final String OBSERVER_UID = "field-observer-303";

    private static final String NON_MEMBER_TOKEN = "field.stranger.token";
    private static final String NON_MEMBER_UID = "field-stranger-404";

    private String farmId;

    @BeforeEach
    void setUp() {
        FirebaseUserDetails ownerDetails = new FirebaseUserDetails(
                OWNER_UID, "owner@agroai.org", "Field Owner", true, Map.of()
        );
        FirebaseUserDetails managerDetails = new FirebaseUserDetails(
                MANAGER_UID, "manager@agroai.org", "Field Manager", true, Map.of()
        );
        FirebaseUserDetails observerDetails = new FirebaseUserDetails(
                OBSERVER_UID, "observer@agroai.org", "Field Observer", true, Map.of()
        );
        FirebaseUserDetails strangerDetails = new FirebaseUserDetails(
                NON_MEMBER_UID, "stranger@agroai.org", "Stranger", true, Map.of()
        );

        when(tokenVerifier.verifyToken(eq(OWNER_TOKEN))).thenReturn(ownerDetails);
        when(tokenVerifier.verifyToken(eq(OWNER_TOKEN), eq(false))).thenReturn(ownerDetails);
        when(tokenVerifier.verifyToken(eq(OWNER_TOKEN), eq(true))).thenReturn(ownerDetails);

        when(tokenVerifier.verifyToken(eq(MANAGER_TOKEN))).thenReturn(managerDetails);
        when(tokenVerifier.verifyToken(eq(MANAGER_TOKEN), eq(false))).thenReturn(managerDetails);
        when(tokenVerifier.verifyToken(eq(MANAGER_TOKEN), eq(true))).thenReturn(managerDetails);

        when(tokenVerifier.verifyToken(eq(OBSERVER_TOKEN))).thenReturn(observerDetails);
        when(tokenVerifier.verifyToken(eq(OBSERVER_TOKEN), eq(false))).thenReturn(observerDetails);
        when(tokenVerifier.verifyToken(eq(OBSERVER_TOKEN), eq(true))).thenReturn(observerDetails);

        when(tokenVerifier.verifyToken(eq(NON_MEMBER_TOKEN))).thenReturn(strangerDetails);
        when(tokenVerifier.verifyToken(eq(NON_MEMBER_TOKEN), eq(false))).thenReturn(strangerDetails);
        when(tokenVerifier.verifyToken(eq(NON_MEMBER_TOKEN), eq(true))).thenReturn(strangerDetails);

        userRepository.initializeProfile(OWNER_UID, "owner@agroai.org", new com.agroai.dto.InitializeProfileRequest("Owner", null, null, "en"));
        userRepository.initializeProfile(MANAGER_UID, "manager@agroai.org", new com.agroai.dto.InitializeProfileRequest("Manager", null, null, "en"));
        userRepository.initializeProfile(OBSERVER_UID, "observer@agroai.org", new com.agroai.dto.InitializeProfileRequest("Observer", null, null, "en"));
        userRepository.initializeProfile(NON_MEMBER_UID, "stranger@agroai.org", new com.agroai.dto.InitializeProfileRequest("Stranger", null, null, "en"));

        // Register a farm under OWNER
        CreateFarmRequest farmReq = new CreateFarmRequest(
                null, "Controller Test Farm", "Paddy & Maize", "Bogura", "Rajshahi", "Sherpur", 30.0, FarmVisibility.PUBLIC
        );
        var created = farmService.registerFarm(ownerDetails, farmReq);
        farmId = created.farmId();

        // Add MANAGER and OBSERVER memberships
        membershipRepository.saveMembership(new FarmMembership(
                "mbr_" + farmId + "::safe_" + MANAGER_UID, farmId, MANAGER_UID, FarmRole.MANAGER, MembershipStatus.ACTIVE
        ));
        membershipRepository.saveMembership(new FarmMembership(
                "mbr_" + farmId + "::safe_" + OBSERVER_UID, farmId, OBSERVER_UID, FarmRole.OBSERVER, MembershipStatus.ACTIVE
        ));
    }

    @Test
    @DisplayName("Unauthenticated request to /api/v1/farms/{farmId}/fields returns 401 Unauthorized")
    void testUnauthenticatedAccessRejected() throws Exception {
        mockMvc.perform(get("/api/v1/farms/" + farmId + "/fields")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("POST /api/v1/farms/{farmId}/fields creates field and returns 201 Created for OWNER")
    void testCreateFieldOwnerSuccess() throws Exception {
        CreateFieldRequest request = new CreateFieldRequest(
                "plot-north", "North Plot", CropType.RICE, SoilType.CLAY, IrrigationType.CANAL, 6.0, "Rainy season plot"
        );

        mockMvc.perform(post("/api/v1/farms/" + farmId + "/fields")
                        .header("Authorization", "Bearer " + OWNER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.fieldId").value(farmId + "--plot-north"))
                .andExpect(jsonPath("$.data.name").value("North Plot"))
                .andExpect(jsonPath("$.data.cropType").value("RICE"))
                .andExpect(jsonPath("$.data.areaHectares").value(6.0))
                .andExpect(jsonPath("$.data.version").value(1));
    }

    @Test
    @DisplayName("POST /api/v1/farms/{farmId}/fields creates field for MANAGER")
    void testCreateFieldManagerSuccess() throws Exception {
        CreateFieldRequest request = new CreateFieldRequest(
                "plot-mgr", "Manager Field", CropType.MAIZE, SoilType.LOAMY, IrrigationType.SPRINKLER, 3.5, null
        );

        mockMvc.perform(post("/api/v1/farms/" + farmId + "/fields")
                        .header("Authorization", "Bearer " + MANAGER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.localFieldId").value("plot-mgr"));
    }

    @Test
    @DisplayName("POST /api/v1/farms/{farmId}/fields denied for OBSERVER (403 Forbidden)")
    void testCreateFieldObserverForbidden() throws Exception {
        CreateFieldRequest request = new CreateFieldRequest(
                "plot-obs", "Observer Field", CropType.TEA, SoilType.CLAY, IrrigationType.RAIN_FED, 1.0, null
        );

        mockMvc.perform(post("/api/v1/farms/" + farmId + "/fields")
                        .header("Authorization", "Bearer " + OBSERVER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("POST /api/v1/farms/{farmId}/fields denied for non-member (403 Forbidden)")
    void testCreateFieldNonMemberForbidden() throws Exception {
        CreateFieldRequest request = new CreateFieldRequest(
                "plot-stranger", "Stranger Field", CropType.TEA, SoilType.CLAY, IrrigationType.RAIN_FED, 1.0, null
        );

        mockMvc.perform(post("/api/v1/farms/" + farmId + "/fields")
                        .header("Authorization", "Bearer " + NON_MEMBER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("POST /api/v1/farms/{farmId}/fields with invalid body returns 400 Bad Request")
    void testCreateFieldInvalidPayloadBadRequest() throws Exception {
        CreateFieldRequest invalidReq = new CreateFieldRequest(
                "invalid_slug_with_underscore", "", null, null, null, -5.0, null
        );

        mockMvc.perform(post("/api/v1/farms/" + farmId + "/fields")
                        .header("Authorization", "Bearer " + OWNER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidReq)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("GET /api/v1/farms/{farmId}/fields returns list of active fields for members")
    void testListFieldsActiveMemberSuccess() throws Exception {
        CreateFieldRequest req1 = new CreateFieldRequest("fld-1", "Field One", CropType.RICE, SoilType.CLAY, IrrigationType.CANAL, 2.0, null);
        CreateFieldRequest req2 = new CreateFieldRequest("fld-2", "Field Two", CropType.WHEAT, SoilType.SANDY, IrrigationType.DRIP, 3.0, null);

        fieldService.createField(farmId, req1, new FirebaseUserDetails(OWNER_UID, "owner@agroai.org", "Owner", true, Map.of()));
        fieldService.createField(farmId, req2, new FirebaseUserDetails(OWNER_UID, "owner@agroai.org", "Owner", true, Map.of()));

        mockMvc.perform(get("/api/v1/farms/" + farmId + "/fields")
                        .header("Authorization", "Bearer " + OBSERVER_TOKEN)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.length()").value(2));
    }

    @Test
    @DisplayName("GET /api/v1/farms/{farmId}/fields/{fieldId} returns 200 OK for member")
    void testGetFieldByIdSuccess() throws Exception {
        CreateFieldRequest req = new CreateFieldRequest("plot-detail", "Detail Plot", CropType.POTATO, SoilType.LOAMY, IrrigationType.GROUNDWATER_TUBEWELL, 1.8, null);
        var created = fieldService.createField(farmId, req, new FirebaseUserDetails(OWNER_UID, "owner@agroai.org", "Owner", true, Map.of()));

        mockMvc.perform(get("/api/v1/farms/" + farmId + "/fields/" + created.fieldId())
                        .header("Authorization", "Bearer " + MANAGER_TOKEN)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Detail Plot"))
                .andExpect(jsonPath("$.data.cropType").value("POTATO"));
    }

    @Test
    @DisplayName("GET /api/v1/farms/{farmId}/fields/{fieldId} non-existent field returns 404 Not Found")
    void testGetFieldNotFoundReturns404() throws Exception {
        mockMvc.perform(get("/api/v1/farms/" + farmId + "/fields/" + farmId + "--nonexistent")
                        .header("Authorization", "Bearer " + OWNER_TOKEN)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("PUT /api/v1/farms/{farmId}/fields/{fieldId} updates field metadata for MANAGER")
    void testUpdateFieldManagerSuccess() throws Exception {
        CreateFieldRequest req = new CreateFieldRequest("plot-upd", "Original Name", CropType.RICE, SoilType.CLAY, IrrigationType.CANAL, 4.0, null);
        var created = fieldService.createField(farmId, req, new FirebaseUserDetails(OWNER_UID, "owner@agroai.org", "Owner", true, Map.of()));

        UpdateFieldRequest updateReq = new UpdateFieldRequest(
                "Updated Name", CropType.WHEAT, SoilType.LOAMY, IrrigationType.DRIP, 4.5, FieldStatus.ACTIVE, "New notes", 1
        );

        mockMvc.perform(put("/api/v1/farms/" + farmId + "/fields/" + created.fieldId())
                        .header("Authorization", "Bearer " + MANAGER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Updated Name"))
                .andExpect(jsonPath("$.data.cropType").value("WHEAT"))
                .andExpect(jsonPath("$.data.version").value(2));
    }

    @Test
    @DisplayName("PUT /api/v1/farms/{farmId}/fields/{fieldId} with stale expectedVersion returns 409 Conflict")
    void testUpdateFieldStaleVersionConflict() throws Exception {
        CreateFieldRequest req = new CreateFieldRequest("plot-conflict", "Conflict Plot", CropType.RICE, SoilType.CLAY, IrrigationType.CANAL, 4.0, null);
        var created = fieldService.createField(farmId, req, new FirebaseUserDetails(OWNER_UID, "owner@agroai.org", "Owner", true, Map.of()));

        UpdateFieldRequest staleReq = new UpdateFieldRequest(
                "Stale Update", CropType.RICE, SoilType.CLAY, IrrigationType.CANAL, 4.0, FieldStatus.ACTIVE, null, 99
        );

        mockMvc.perform(put("/api/v1/farms/" + farmId + "/fields/" + created.fieldId())
                        .header("Authorization", "Bearer " + OWNER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(staleReq)))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("PUT /api/v1/farms/{farmId}/fields/{fieldId} denied for OBSERVER (403 Forbidden)")
    void testUpdateFieldObserverForbidden() throws Exception {
        CreateFieldRequest req = new CreateFieldRequest("plot-obs-upd", "Plot", CropType.RICE, SoilType.CLAY, IrrigationType.CANAL, 2.0, null);
        var created = fieldService.createField(farmId, req, new FirebaseUserDetails(OWNER_UID, "owner@agroai.org", "Owner", true, Map.of()));

        UpdateFieldRequest updateReq = new UpdateFieldRequest(
                "Hacked", CropType.RICE, SoilType.CLAY, IrrigationType.CANAL, 2.0, FieldStatus.ACTIVE, null, 1
        );

        mockMvc.perform(put("/api/v1/farms/" + farmId + "/fields/" + created.fieldId())
                        .header("Authorization", "Bearer " + OBSERVER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("POST /api/v1/farms/{farmId}/fields/{fieldId}/archive succeeds for OWNER")
    void testArchiveFieldOwnerSuccess() throws Exception {
        CreateFieldRequest req = new CreateFieldRequest("plot-arch", "Archival Plot", CropType.RICE, SoilType.CLAY, IrrigationType.CANAL, 5.0, null);
        var created = fieldService.createField(farmId, req, new FirebaseUserDetails(OWNER_UID, "owner@agroai.org", "Owner", true, Map.of()));

        mockMvc.perform(post("/api/v1/farms/" + farmId + "/fields/" + created.fieldId() + "/archive")
                        .header("Authorization", "Bearer " + OWNER_TOKEN)
                        .param("expectedVersion", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    @DisplayName("POST /api/v1/farms/{farmId}/fields/{fieldId}/archive denied for MANAGER (403 Forbidden)")
    void testArchiveFieldManagerForbidden() throws Exception {
        CreateFieldRequest req = new CreateFieldRequest("plot-mgr-arch", "Plot", CropType.RICE, SoilType.CLAY, IrrigationType.CANAL, 5.0, null);
        var created = fieldService.createField(farmId, req, new FirebaseUserDetails(OWNER_UID, "owner@agroai.org", "Owner", true, Map.of()));

        mockMvc.perform(post("/api/v1/farms/" + farmId + "/fields/" + created.fieldId() + "/archive")
                        .header("Authorization", "Bearer " + MANAGER_TOKEN)
                        .param("expectedVersion", "1"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("POST /api/v1/farms/{farmId}/fields/{fieldId}/archive denied for OBSERVER (403 Forbidden)")
    void testArchiveFieldObserverForbidden() throws Exception {
        CreateFieldRequest req = new CreateFieldRequest("plot-obs-arch", "Plot", CropType.RICE, SoilType.CLAY, IrrigationType.CANAL, 5.0, null);
        var created = fieldService.createField(farmId, req, new FirebaseUserDetails(OWNER_UID, "owner@agroai.org", "Owner", true, Map.of()));

        mockMvc.perform(post("/api/v1/farms/" + farmId + "/fields/" + created.fieldId() + "/archive")
                        .header("Authorization", "Bearer " + OBSERVER_TOKEN)
                        .param("expectedVersion", "1"))
                .andExpect(status().isForbidden());
    }
}
