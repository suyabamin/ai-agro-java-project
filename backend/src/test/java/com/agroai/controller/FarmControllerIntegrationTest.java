package com.agroai.controller;

import com.agroai.dto.AddFarmMemberRequest;
import com.agroai.dto.CreateFarmRequest;
import com.agroai.dto.UpdateFarmMemberRoleRequest;
import com.agroai.dto.UpdateFarmRequest;
import com.agroai.dto.UpdateFarmVisibilityRequest;
import com.agroai.model.FarmRole;
import com.agroai.model.FarmVisibility;
import com.agroai.model.UserProfile;
import com.agroai.repository.FarmMembershipRepository;
import com.agroai.repository.FarmRepository;
import com.agroai.repository.UserRepository;
import com.agroai.security.FirebaseTokenVerifier;
import com.agroai.security.FirebaseUserDetails;
import com.agroai.service.FarmService;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Farm, Membership & Public Discovery Controller Integration Tests")
class FarmControllerIntegrationTest {

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
    private FarmService farmService;

    @MockBean
    private FirebaseTokenVerifier tokenVerifier;

    private static final String OWNER_TOKEN = "owner.jwt.token";
    private static final String OWNER_UID = "owner-uid-101";

    private static final String OTHER_TOKEN = "other.jwt.token";
    private static final String OTHER_UID = "other-uid-102";

    private static final String MANAGER_TOKEN = "manager.jwt.token";
    private static final String MANAGER_UID = "manager-uid-303";

    private static final String OBSERVER_TOKEN = "observer.jwt.token";
    private static final String OBSERVER_UID = "observer-uid-404";

    private static final String SECOND_USER_UID = "target-user-202";

    @BeforeEach
    void setUp() {
        FirebaseUserDetails ownerDetails = new FirebaseUserDetails(
                OWNER_UID, "owner@agroai.org", "Farm Owner", true, Map.of()
        );
        FirebaseUserDetails otherDetails = new FirebaseUserDetails(
                OTHER_UID, "other@agroai.org", "Stranger User", true, Map.of()
        );
        FirebaseUserDetails managerDetails = new FirebaseUserDetails(
                MANAGER_UID, "manager@agroai.org", "Manager User", true, Map.of()
        );
        FirebaseUserDetails observerDetails = new FirebaseUserDetails(
                OBSERVER_UID, "observer@agroai.org", "Observer User", true, Map.of()
        );

        when(tokenVerifier.verifyToken(eq(OWNER_TOKEN))).thenReturn(ownerDetails);
        when(tokenVerifier.verifyToken(eq(OWNER_TOKEN), eq(false))).thenReturn(ownerDetails);
        when(tokenVerifier.verifyToken(eq(OWNER_TOKEN), eq(true))).thenReturn(ownerDetails);

        when(tokenVerifier.verifyToken(eq(OTHER_TOKEN))).thenReturn(otherDetails);
        when(tokenVerifier.verifyToken(eq(OTHER_TOKEN), eq(false))).thenReturn(otherDetails);
        when(tokenVerifier.verifyToken(eq(OTHER_TOKEN), eq(true))).thenReturn(otherDetails);

        when(tokenVerifier.verifyToken(eq(MANAGER_TOKEN))).thenReturn(managerDetails);
        when(tokenVerifier.verifyToken(eq(MANAGER_TOKEN), eq(false))).thenReturn(managerDetails);
        when(tokenVerifier.verifyToken(eq(MANAGER_TOKEN), eq(true))).thenReturn(managerDetails);

        when(tokenVerifier.verifyToken(eq(OBSERVER_TOKEN))).thenReturn(observerDetails);
        when(tokenVerifier.verifyToken(eq(OBSERVER_TOKEN), eq(false))).thenReturn(observerDetails);
        when(tokenVerifier.verifyToken(eq(OBSERVER_TOKEN), eq(true))).thenReturn(observerDetails);

        userRepository.initializeProfile(OWNER_UID, "owner@agroai.org", new com.agroai.dto.InitializeProfileRequest("Owner", null, null, "en"));
        userRepository.initializeProfile(OTHER_UID, "other@agroai.org", new com.agroai.dto.InitializeProfileRequest("Other", null, null, "en"));
        userRepository.initializeProfile(MANAGER_UID, "manager@agroai.org", new com.agroai.dto.InitializeProfileRequest("Manager", null, null, "en"));
        userRepository.initializeProfile(OBSERVER_UID, "observer@agroai.org", new com.agroai.dto.InitializeProfileRequest("Observer", null, null, "en"));
        userRepository.initializeProfile(SECOND_USER_UID, "second@agroai.org", new com.agroai.dto.InitializeProfileRequest("Second", null, null, "en"));
    }

    @Test
    @DisplayName("Unauthenticated request to /api/v1/farms returns 401 Unauthorized")
    void testUnauthenticatedAccessRejected() throws Exception {
        mockMvc.perform(get("/api/v1/farms")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("POST /api/v1/farms creates farm and returns 201 Created")
    void testCreateFarmEndpoint() throws Exception {
        CreateFarmRequest request = new CreateFarmRequest(
                null,
                "Delta Green Agricultural Project",
                "Rice paddies and seasonal legumes",
                "Mymensingh",
                "Mymensingh",
                "Trishal",
                22.0,
                FarmVisibility.PUBLIC
        );

        mockMvc.perform(post("/api/v1/farms")
                        .header("Authorization", "Bearer " + OWNER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.farmId").isNotEmpty())
                .andExpect(jsonPath("$.data.name").value("Delta Green Agricultural Project"))
                .andExpect(jsonPath("$.data.userRole").value("OWNER"))
                .andExpect(jsonPath("$.data.visibility").value("PUBLIC"));
    }

    @Test
    @DisplayName("GET /api/v1/farms lists only user-associated farms")
    void testListMyFarmsEndpoint() throws Exception {
        CreateFarmRequest req = new CreateFarmRequest(
                null, "Listed Farm", null, "Dhaka", "Dhaka", null, 10.0, FarmVisibility.PRIVATE
        );
        farmService.registerFarm(new FirebaseUserDetails(OWNER_UID, "owner@agroai.org", "Owner", true, Map.of()), req);

        mockMvc.perform(get("/api/v1/farms")
                        .header("Authorization", "Bearer " + OWNER_TOKEN)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    @DisplayName("PUT /api/v1/farms/{farmId} returns 409 Conflict when expectedVersion is stale")
    void testStaleUpdateReturnsConflict() throws Exception {
        CreateFarmRequest req = new CreateFarmRequest(
                null, "Concurrency Farm", null, "Dhaka", "Dhaka", null, 10.0, FarmVisibility.PRIVATE
        );
        var created = farmService.registerFarm(new FirebaseUserDetails(OWNER_UID, "owner@agroai.org", "Owner", true, Map.of()), req);

        UpdateFarmRequest staleRequest = new UpdateFarmRequest(
                "Updated Name", null, "Dhaka", "Dhaka", null, 15.0, 999
        );

        mockMvc.perform(put("/api/v1/farms/" + created.farmId())
                        .header("Authorization", "Bearer " + OWNER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(staleRequest)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    @DisplayName("Non-member accessing /api/v1/farms/{farmId} is denied (403 Forbidden)")
    void testNonMemberForbidden() throws Exception {
        CreateFarmRequest req = new CreateFarmRequest(
                null, "Isolated Farm", null, "Dhaka", "Dhaka", null, 5.0, FarmVisibility.PRIVATE
        );
        var created = farmService.registerFarm(new FirebaseUserDetails(OWNER_UID, "owner@agroai.org", "Owner", true, Map.of()), req);

        mockMvc.perform(get("/api/v1/farms/" + created.farmId())
                        .header("Authorization", "Bearer " + OTHER_TOKEN)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("PATCH /api/v1/farms/{farmId}/visibility toggles visibility and updates projection")
    void testToggleVisibilityEndpoint() throws Exception {
        CreateFarmRequest req = new CreateFarmRequest(
                null, "Visibility Farm", null, "Dhaka", "Dhaka", null, 5.0, FarmVisibility.PRIVATE
        );
        var created = farmService.registerFarm(new FirebaseUserDetails(OWNER_UID, "owner@agroai.org", "Owner", true, Map.of()), req);

        UpdateFarmVisibilityRequest patchReq = new UpdateFarmVisibilityRequest(FarmVisibility.PUBLIC, 1);

        mockMvc.perform(patch("/api/v1/farms/" + created.farmId() + "/visibility")
                        .header("Authorization", "Bearer " + OWNER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(patchReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.visibility").value("PUBLIC"))
                .andExpect(jsonPath("$.data.version").value(2));
    }

    @Test
    @DisplayName("POST /api/v1/farms/{farmId}/archive soft-archives farm")
    void testArchiveFarmEndpoint() throws Exception {
        CreateFarmRequest req = new CreateFarmRequest(
                null, "Archive Target", null, "Dhaka", "Dhaka", null, 5.0, FarmVisibility.PUBLIC
        );
        var created = farmService.registerFarm(new FirebaseUserDetails(OWNER_UID, "owner@agroai.org", "Owner", true, Map.of()), req);

        mockMvc.perform(post("/api/v1/farms/" + created.farmId() + "/archive")
                        .header("Authorization", "Bearer " + OWNER_TOKEN)
                        .param("expectedVersion", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    @DisplayName("POST /api/v1/farms/{farmId}/members adds member with MANAGER role")
    void testAddMemberEndpoint() throws Exception {
        CreateFarmRequest req = new CreateFarmRequest(
                null, "Roster Farm", null, "Dhaka", "Dhaka", null, 5.0, FarmVisibility.PRIVATE
        );
        var created = farmService.registerFarm(new FirebaseUserDetails(OWNER_UID, "owner@agroai.org", "Owner", true, Map.of()), req);

        AddFarmMemberRequest addReq = new AddFarmMemberRequest(SECOND_USER_UID, FarmRole.MANAGER);

        mockMvc.perform(post("/api/v1/farms/" + created.farmId() + "/members")
                        .header("Authorization", "Bearer " + OWNER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(addReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.userId").value(SECOND_USER_UID))
                .andExpect(jsonPath("$.data.role").value("MANAGER"))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));
    }

    @Test
    @DisplayName("PATCH /api/v1/farms/{farmId}/members/{userId} updates member role")
    void testUpdateMemberRoleEndpoint() throws Exception {
        CreateFarmRequest req = new CreateFarmRequest(
                null, "Role Farm", null, "Dhaka", "Dhaka", null, 5.0, FarmVisibility.PRIVATE
        );
        var created = farmService.registerFarm(new FirebaseUserDetails(OWNER_UID, "owner@agroai.org", "Owner", true, Map.of()), req);
        farmService.registerFarm(new FirebaseUserDetails(OWNER_UID, "owner@agroai.org", "Owner", true, Map.of()), req);

        AddFarmMemberRequest addReq = new AddFarmMemberRequest(SECOND_USER_UID, FarmRole.MANAGER);
        mockMvc.perform(post("/api/v1/farms/" + created.farmId() + "/members")
                        .header("Authorization", "Bearer " + OWNER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(addReq)))
                .andExpect(status().isCreated());

        UpdateFarmMemberRoleRequest updateRoleReq = new UpdateFarmMemberRoleRequest(FarmRole.OBSERVER);

        mockMvc.perform(patch("/api/v1/farms/" + created.farmId() + "/members/" + SECOND_USER_UID)
                        .header("Authorization", "Bearer " + OWNER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateRoleReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.role").value("OBSERVER"));
    }

    @Test
    @DisplayName("DELETE /api/v1/farms/{farmId}/members/{userId} revokes member")
    void testRevokeMemberEndpoint() throws Exception {
        CreateFarmRequest req = new CreateFarmRequest(
                null, "Revoke Farm", null, "Dhaka", "Dhaka", null, 5.0, FarmVisibility.PRIVATE
        );
        var created = farmService.registerFarm(new FirebaseUserDetails(OWNER_UID, "owner@agroai.org", "Owner", true, Map.of()), req);

        AddFarmMemberRequest addReq = new AddFarmMemberRequest(SECOND_USER_UID, FarmRole.MANAGER);
        mockMvc.perform(post("/api/v1/farms/" + created.farmId() + "/members")
                        .header("Authorization", "Bearer " + OWNER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(addReq)))
                .andExpect(status().isCreated());

        mockMvc.perform(delete("/api/v1/farms/" + created.farmId() + "/members/" + SECOND_USER_UID)
                        .header("Authorization", "Bearer " + OWNER_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    @DisplayName("Public directory endpoints are accessible unauthenticated (200 OK)")
    void testPublicDiscoveryEndpointsUnauthenticated() throws Exception {
        CreateFarmRequest req = new CreateFarmRequest(
                null, "Public Discovery Farm", null, "Khulna", "Khulna", null, 15.0, FarmVisibility.PUBLIC
        );
        var created = farmService.registerFarm(new FirebaseUserDetails(OWNER_UID, "owner@agroai.org", "Owner", true, Map.of()), req);

        // GET /api/v1/public/farms with no Authorization header
        mockMvc.perform(get("/api/v1/public/farms")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray());

        // GET /api/v1/public/farms/{farmId} with no Authorization header
        mockMvc.perform(get("/api/v1/public/farms/" + created.farmId())
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.farmId").value(created.farmId()))
                .andExpect(jsonPath("$.data.name").value("Public Discovery Farm"));
    }

    @Test
    @DisplayName("Public detail endpoint returns 404 for private farm")
    void testPublicDetail404ForPrivateFarm() throws Exception {
        CreateFarmRequest req = new CreateFarmRequest(
                null, "Private Secret Farm", null, "Dhaka", "Dhaka", null, 5.0, FarmVisibility.PRIVATE
        );
        var created = farmService.registerFarm(new FirebaseUserDetails(OWNER_UID, "owner@agroai.org", "Owner", true, Map.of()), req);

        mockMvc.perform(get("/api/v1/public/farms/" + created.farmId())
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("MANAGER cannot update visibility (403 Forbidden)")
    void testManagerCannotUpdateVisibility() throws Exception {
        CreateFarmRequest req = new CreateFarmRequest(
                null, "Manager Boundary Farm", null, "Dhaka", "Dhaka", null, 5.0, FarmVisibility.PRIVATE
        );
        var created = farmService.registerFarm(new FirebaseUserDetails(OWNER_UID, "owner@agroai.org", "Owner", true, Map.of()), req);

        // Grant MANAGER role to MANAGER_UID
        AddFarmMemberRequest addReq = new AddFarmMemberRequest(MANAGER_UID, FarmRole.MANAGER);
        mockMvc.perform(post("/api/v1/farms/" + created.farmId() + "/members")
                        .header("Authorization", "Bearer " + OWNER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(addReq)))
                .andExpect(status().isCreated());

        // MANAGER attempts to PATCH visibility -> Expect 403 Forbidden
        UpdateFarmVisibilityRequest patchReq = new UpdateFarmVisibilityRequest(FarmVisibility.PUBLIC, 1);
        mockMvc.perform(patch("/api/v1/farms/" + created.farmId() + "/visibility")
                        .header("Authorization", "Bearer " + MANAGER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(patchReq)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("MANAGER cannot add members (403 Forbidden)")
    void testManagerCannotAddMembers() throws Exception {
        CreateFarmRequest req = new CreateFarmRequest(
                null, "Manager Member Add Boundary", null, "Dhaka", "Dhaka", null, 5.0, FarmVisibility.PRIVATE
        );
        var created = farmService.registerFarm(new FirebaseUserDetails(OWNER_UID, "owner@agroai.org", "Owner", true, Map.of()), req);

        AddFarmMemberRequest addMgr = new AddFarmMemberRequest(MANAGER_UID, FarmRole.MANAGER);
        mockMvc.perform(post("/api/v1/farms/" + created.farmId() + "/members")
                        .header("Authorization", "Bearer " + OWNER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(addMgr)))
                .andExpect(status().isCreated());

        // MANAGER attempts to add another member -> Expect 403 Forbidden
        AddFarmMemberRequest addObserver = new AddFarmMemberRequest(OBSERVER_UID, FarmRole.OBSERVER);
        mockMvc.perform(post("/api/v1/farms/" + created.farmId() + "/members")
                        .header("Authorization", "Bearer " + MANAGER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(addObserver)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("OBSERVER cannot update farm metadata (403 Forbidden)")
    void testObserverCannotUpdateFarm() throws Exception {
        CreateFarmRequest req = new CreateFarmRequest(
                null, "Observer Boundary Farm", null, "Dhaka", "Dhaka", null, 5.0, FarmVisibility.PRIVATE
        );
        var created = farmService.registerFarm(new FirebaseUserDetails(OWNER_UID, "owner@agroai.org", "Owner", true, Map.of()), req);

        AddFarmMemberRequest addObs = new AddFarmMemberRequest(OBSERVER_UID, FarmRole.OBSERVER);
        mockMvc.perform(post("/api/v1/farms/" + created.farmId() + "/members")
                        .header("Authorization", "Bearer " + OWNER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(addObs)))
                .andExpect(status().isCreated());

        // OBSERVER attempts to PUT update -> Expect 403 Forbidden
        UpdateFarmRequest updateReq = new UpdateFarmRequest("Hacked Name", null, "Dhaka", "Dhaka", null, 10.0, 1);
        mockMvc.perform(put("/api/v1/farms/" + created.farmId())
                        .header("Authorization", "Bearer " + OBSERVER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("REVOKED member loses access to farm details (403 Forbidden)")
    void testRevokedMemberLosesAccess() throws Exception {
        CreateFarmRequest req = new CreateFarmRequest(
                null, "Revocation Test Farm", null, "Dhaka", "Dhaka", null, 5.0, FarmVisibility.PRIVATE
        );
        var created = farmService.registerFarm(new FirebaseUserDetails(OWNER_UID, "owner@agroai.org", "Owner", true, Map.of()), req);

        // Add MANAGER
        AddFarmMemberRequest addMgr = new AddFarmMemberRequest(MANAGER_UID, FarmRole.MANAGER);
        mockMvc.perform(post("/api/v1/farms/" + created.farmId() + "/members")
                        .header("Authorization", "Bearer " + OWNER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(addMgr)))
                .andExpect(status().isCreated());

        // Verify active manager can access farm details
        mockMvc.perform(get("/api/v1/farms/" + created.farmId())
                        .header("Authorization", "Bearer " + MANAGER_TOKEN))
                .andExpect(status().isOk());

        // Revoke MANAGER membership
        mockMvc.perform(delete("/api/v1/farms/" + created.farmId() + "/members/" + MANAGER_UID)
                        .header("Authorization", "Bearer " + OWNER_TOKEN))
                .andExpect(status().isOk());

        // Verify revoked manager now receives 403 Forbidden
        mockMvc.perform(get("/api/v1/farms/" + created.farmId())
                        .header("Authorization", "Bearer " + MANAGER_TOKEN))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Cannot grant OWNER role through member management (400 Bad Request)")
    void testCannotGrantOwnerRole() throws Exception {
        CreateFarmRequest req = new CreateFarmRequest(
                null, "Owner Privilege Farm", null, "Dhaka", "Dhaka", null, 5.0, FarmVisibility.PRIVATE
        );
        var created = farmService.registerFarm(new FirebaseUserDetails(OWNER_UID, "owner@agroai.org", "Owner", true, Map.of()), req);

        AddFarmMemberRequest addOwner = new AddFarmMemberRequest(SECOND_USER_UID, FarmRole.OWNER);
        mockMvc.perform(post("/api/v1/farms/" + created.farmId() + "/members")
                        .header("Authorization", "Bearer " + OWNER_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(addOwner)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    @DisplayName("Sole active owner cannot be revoked (400 Bad Request)")
    void testSoleActiveOwnerCannotBeRevoked() throws Exception {
        CreateFarmRequest req = new CreateFarmRequest(
                null, "Sole Owner Farm", null, "Dhaka", "Dhaka", null, 5.0, FarmVisibility.PRIVATE
        );
        var created = farmService.registerFarm(new FirebaseUserDetails(OWNER_UID, "owner@agroai.org", "Owner", true, Map.of()), req);

        mockMvc.perform(delete("/api/v1/farms/" + created.farmId() + "/members/" + OWNER_UID)
                        .header("Authorization", "Bearer " + OWNER_TOKEN))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }
}
