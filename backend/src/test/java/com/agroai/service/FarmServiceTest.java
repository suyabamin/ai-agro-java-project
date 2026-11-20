package com.agroai.service;

import com.agroai.config.FirebaseConfig;
import com.agroai.dto.AddFarmMemberRequest;
import com.agroai.dto.CreateFarmRequest;
import com.agroai.dto.FarmMemberResponseDTO;
import com.agroai.dto.FarmResponseDTO;
import com.agroai.dto.UpdateFarmMemberRoleRequest;
import com.agroai.dto.UpdateFarmRequest;
import com.agroai.dto.UpdateFarmVisibilityRequest;
import com.agroai.exception.StaleVersionException;
import com.agroai.exception.UnauthorizedResourceAccessException;
import com.agroai.model.Farm;
import com.agroai.model.FarmMembership;
import com.agroai.model.FarmRole;
import com.agroai.model.FarmStatus;
import com.agroai.model.FarmVisibility;
import com.agroai.model.MembershipStatus;
import com.agroai.model.UserProfile;
import com.agroai.repository.FarmMembershipRepository;
import com.agroai.repository.FarmRepository;
import com.agroai.repository.FirestoreFarmRepository;
import com.agroai.repository.FirestoreUserRepository;
import com.agroai.repository.UserRepository;
import com.agroai.security.FirebaseUserDetails;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.mock.env.MockEnvironment;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("FarmService & FarmMembershipService Business Logic Tests")
class FarmServiceTest {

    private FarmRepository farmRepository;
    private FarmMembershipRepository membershipRepository;
    private UserRepository userRepository;
    private PublicFarmProjectionService projectionService;
    private FarmService farmService;
    private FarmMembershipService membershipService;

    private static final String OWNER_UID = "owner-uid-001";
    private static final String MANAGER_UID = "manager-uid-002";
    private static final String OTHER_UID = "other-uid-003";

    private FirebaseUserDetails ownerUser;
    private FirebaseUserDetails managerUser;
    private FirebaseUserDetails otherUser;

    @BeforeEach
    void setUp() {
        FirebaseConfig firebaseConfig = Mockito.mock(FirebaseConfig.class);
        Mockito.when(firebaseConfig.isInitialized()).thenReturn(false);

        MockEnvironment env = new MockEnvironment();
        farmRepository = new FirestoreFarmRepository(firebaseConfig, env);
        membershipRepository = new FarmMembershipRepository(firebaseConfig, env);
        userRepository = new FirestoreUserRepository(firebaseConfig, env);
        projectionService = new PublicFarmProjectionService(farmRepository);

        farmService = new FarmService(farmRepository, membershipRepository, projectionService, firebaseConfig);
        membershipService = new FarmMembershipService(membershipRepository, farmRepository, userRepository);

        ownerUser = new FirebaseUserDetails(OWNER_UID, "owner@agroai.org", "Owner User", true, Map.of());
        managerUser = new FirebaseUserDetails(MANAGER_UID, "manager@agroai.org", "Manager User", true, Map.of());
        otherUser = new FirebaseUserDetails(OTHER_UID, "other@agroai.org", "Other User", true, Map.of());

        // Seed users in user repository for membership validation
        userRepository.initializeProfile(OWNER_UID, "owner@agroai.org", new com.agroai.dto.InitializeProfileRequest("Owner User", null, null, "en"));
        userRepository.initializeProfile(MANAGER_UID, "manager@agroai.org", new com.agroai.dto.InitializeProfileRequest("Manager User", null, null, "en"));
        userRepository.initializeProfile(OTHER_UID, "other@agroai.org", new com.agroai.dto.InitializeProfileRequest("Other User", null, null, "en"));
    }

    @Test
    @DisplayName("Register farm creates farm entity, OWNER membership, and projection if PUBLIC")
    void testRegisterPublicFarm() {
        CreateFarmRequest request = new CreateFarmRequest(
                null,
                "Green Delta Farm",
                "Organic rice and vegetables",
                "Bogura",
                "Rajshahi",
                "Shibganj",
                18.5,
                FarmVisibility.PUBLIC
        );

        FarmResponseDTO response = farmService.registerFarm(ownerUser, request);
        assertNotNull(response.farmId());
        assertTrue(response.farmId().startsWith("farm-"));
        assertEquals("Green Delta Farm", response.name());
        assertEquals(FarmRole.OWNER, response.userRole());
        assertEquals(1, response.version());
        assertEquals(FarmVisibility.PUBLIC, response.visibility());

        // Verify membership created
        Optional<FarmMembership> membership = membershipRepository.findMembership(response.farmId(), OWNER_UID);
        assertTrue(membership.isPresent());
        assertEquals(FarmRole.OWNER, membership.get().getRole());
        assertEquals(MembershipStatus.ACTIVE, membership.get().getStatus());

        // Verify public projection created
        assertTrue(farmRepository.findPublicProjection(response.farmId()).isPresent());
    }

    @Test
    @DisplayName("Register private farm does NOT create public projection")
    void testRegisterPrivateFarm() {
        CreateFarmRequest request = new CreateFarmRequest(
                null,
                "Private Agro Holdings",
                "Private research plots",
                "Gazipur",
                "Dhaka",
                "Joydebpur",
                5.0,
                FarmVisibility.PRIVATE
        );

        FarmResponseDTO response = farmService.registerFarm(ownerUser, request);
        assertEquals(FarmVisibility.PRIVATE, response.visibility());

        // Verify public projection was NOT created
        assertTrue(farmRepository.findPublicProjection(response.farmId()).isEmpty());
    }

    @Test
    @DisplayName("Optimistic concurrency: stale version update throws StaleVersionException (409)")
    void testOptimisticConcurrencyUpdate() {
        CreateFarmRequest createReq = new CreateFarmRequest(
                null, "Concurrent Farm", null, "Dhaka", "Dhaka", null, 10.0, FarmVisibility.PRIVATE
        );
        FarmResponseDTO created = farmService.registerFarm(ownerUser, createReq);

        // First update with valid version 1 succeeds
        UpdateFarmRequest update1 = new UpdateFarmRequest(
                "Concurrent Farm Updated", null, "Dhaka", "Dhaka", null, 12.0, 1
        );
        FarmResponseDTO updated1 = farmService.updateFarm(created.farmId(), update1, ownerUser);
        assertEquals(2, updated1.version());

        // Second update with stale version 1 must throw StaleVersionException
        UpdateFarmRequest staleUpdate = new UpdateFarmRequest(
                "Stale Overwrite", null, "Dhaka", "Dhaka", null, 15.0, 1
        );
        assertThrows(StaleVersionException.class, () ->
                farmService.updateFarm(created.farmId(), staleUpdate, ownerUser)
        );
    }

    @Test
    @DisplayName("Visibility transition synchronizes public projection atomically")
    void testVisibilityTransitionLifecycle() {
        CreateFarmRequest createReq = new CreateFarmRequest(
                null, "Dynamic Farm", null, "Sylhet", "Sylhet", null, 8.0, FarmVisibility.PRIVATE
        );
        FarmResponseDTO created = farmService.registerFarm(ownerUser, createReq);
        assertTrue(farmRepository.findPublicProjection(created.farmId()).isEmpty());

        // Toggle to PUBLIC
        UpdateFarmVisibilityRequest toPublic = new UpdateFarmVisibilityRequest(FarmVisibility.PUBLIC, 1);
        farmService.updateVisibility(created.farmId(), toPublic, ownerUser);
        assertTrue(farmRepository.findPublicProjection(created.farmId()).isPresent());

        // Toggle back to PRIVATE
        UpdateFarmVisibilityRequest toPrivate = new UpdateFarmVisibilityRequest(FarmVisibility.PRIVATE, 2);
        farmService.updateVisibility(created.farmId(), toPrivate, ownerUser);
        assertTrue(farmRepository.findPublicProjection(created.farmId()).isEmpty());
    }

    @Test
    @DisplayName("Archive farm soft-archives entity and removes public projection")
    void testArchiveFarm() {
        CreateFarmRequest createReq = new CreateFarmRequest(
                null, "Archival Farm", null, "Khulna", "Khulna", null, 14.0, FarmVisibility.PUBLIC
        );
        FarmResponseDTO created = farmService.registerFarm(ownerUser, createReq);
        assertTrue(farmRepository.findPublicProjection(created.farmId()).isPresent());

        // Soft-archive farm
        farmService.archiveFarm(created.farmId(), 1, ownerUser);

        Farm archived = farmRepository.findById(created.farmId()).orElseThrow();
        assertEquals(FarmStatus.ARCHIVED, archived.getStatus());
        assertNotNull(archived.getArchivedAt());
        assertTrue(farmRepository.findPublicProjection(created.farmId()).isEmpty());

        // Verifying archived farm cannot be updated
        UpdateFarmRequest updateReq = new UpdateFarmRequest("New Name", null, "Khulna", "Khulna", null, 20.0, 2);
        assertThrows(com.agroai.exception.InvalidStateTransitionException.class, () ->
                farmService.updateFarm(created.farmId(), updateReq, ownerUser));

        // Verifying archived farm visibility cannot be updated
        UpdateFarmVisibilityRequest visReq = new UpdateFarmVisibilityRequest(FarmVisibility.PUBLIC, 2);
        assertThrows(com.agroai.exception.InvalidStateTransitionException.class, () ->
                farmService.updateVisibility(created.farmId(), visReq, ownerUser));
    }

    @Test
    @DisplayName("Farm suspension blocks access and reactivation restores active status")
    void testSuspendAndReactivateFarm() {
        var created = farmService.registerFarm(ownerUser, new CreateFarmRequest(
                null, "Lifecycle Farm", null, "Bogura", "Rajshahi", null, 3.0, FarmVisibility.PUBLIC));
        farmService.suspendFarm(created.farmId(), 1, ownerUser);
        assertEquals(FarmStatus.SUSPENDED, farmRepository.findById(created.farmId()).orElseThrow().getStatus());
        assertTrue(farmRepository.findPublicProjection(created.farmId()).isEmpty());

        farmService.reactivateFarm(created.farmId(), 2, ownerUser);
        assertEquals(FarmStatus.ACTIVE, farmRepository.findById(created.farmId()).orElseThrow().getStatus());
        assertTrue(farmRepository.findPublicProjection(created.farmId()).isPresent());
    }

    @Test
    @DisplayName("Sole owner protections: cannot demote or revoke the sole active owner")
    void testSoleOwnerProtection() {
        CreateFarmRequest createReq = new CreateFarmRequest(
                null, "Sole Farm", null, "Rangpur", "Rangpur", null, 6.0, FarmVisibility.PRIVATE
        );
        FarmResponseDTO created = farmService.registerFarm(ownerUser, createReq);

        // Attempting to demote sole owner throws IllegalArgumentException
        UpdateFarmMemberRoleRequest demoteReq = new UpdateFarmMemberRoleRequest(FarmRole.MANAGER);
        assertThrows(IllegalArgumentException.class, () ->
                membershipService.updateMemberRole(created.farmId(), OWNER_UID, demoteReq, ownerUser)
        );

        // Attempting to revoke sole owner throws IllegalArgumentException
        assertThrows(IllegalArgumentException.class, () ->
                membershipService.revokeMember(created.farmId(), OWNER_UID, ownerUser)
        );
    }

    @Test
    @DisplayName("Member management: OWNER can add, update, and revoke MANAGER")
    void testMemberManagementLifecycle() {
        CreateFarmRequest createReq = new CreateFarmRequest(
                null, "Team Farm", null, "Dhaka", "Dhaka", null, 10.0, FarmVisibility.PRIVATE
        );
        FarmResponseDTO created = farmService.registerFarm(ownerUser, createReq);

        // Add manager
        AddFarmMemberRequest addReq = new AddFarmMemberRequest(MANAGER_UID, FarmRole.MANAGER);
        FarmMemberResponseDTO member = membershipService.addMember(created.farmId(), addReq, ownerUser);
        assertEquals(FarmRole.MANAGER, member.role());
        assertEquals(MembershipStatus.ACTIVE, member.status());

        // Update role to OBSERVER
        UpdateFarmMemberRoleRequest roleReq = new UpdateFarmMemberRoleRequest(FarmRole.OBSERVER);
        FarmMemberResponseDTO updated = membershipService.updateMemberRole(created.farmId(), MANAGER_UID, roleReq, ownerUser);
        assertEquals(FarmRole.OBSERVER, updated.role());

        // Revoke member
        membershipService.revokeMember(created.farmId(), MANAGER_UID, ownerUser);
        Optional<FarmMembership> revoked = membershipRepository.findMembership(created.farmId(), MANAGER_UID);
        assertTrue(revoked.isPresent());
        assertEquals(MembershipStatus.REVOKED, revoked.get().getStatus());
    }
}
