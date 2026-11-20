package com.agroai.service;

import com.agroai.config.FirebaseConfig;
import com.agroai.dto.CreateFarmRequest;
import com.agroai.dto.CreateFieldRequest;
import com.agroai.dto.FieldResponseDTO;
import com.agroai.dto.UpdateFieldRequest;
import com.agroai.exception.InvalidStateTransitionException;
import com.agroai.exception.StaleVersionException;
import com.agroai.exception.UnauthorizedResourceAccessException;
import com.agroai.model.CropType;
import com.agroai.model.Farm;
import com.agroai.model.FarmMembership;
import com.agroai.model.FarmRole;
import com.agroai.model.FarmStatus;
import com.agroai.model.FarmVisibility;
import com.agroai.model.Field;
import com.agroai.model.FieldStatus;
import com.agroai.model.IrrigationType;
import com.agroai.model.MembershipStatus;
import com.agroai.model.SoilType;
import com.agroai.repository.FarmMembershipRepository;
import com.agroai.repository.FarmRepository;
import com.agroai.repository.FieldRepository;
import com.agroai.repository.FirestoreFarmRepository;
import com.agroai.repository.FirestoreFieldRepository;
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

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("FieldService Business Logic, Invariants & Concurrency Tests")
class FieldServiceTest {

    private FarmRepository farmRepository;
    private FarmMembershipRepository membershipRepository;
    private UserRepository userRepository;
    private FieldRepository fieldRepository;
    private PublicFarmProjectionService projectionService;
    private FarmService farmService;
    private FieldService fieldService;

    private static final String OWNER_UID = "owner-uid-001";
    private static final String MANAGER_UID = "manager-uid-002";
    private static final String OBSERVER_UID = "observer-uid-003";
    private static final String NON_MEMBER_UID = "non-member-004";

    private FirebaseUserDetails ownerUser;
    private FirebaseUserDetails managerUser;
    private FirebaseUserDetails observerUser;
    private FirebaseUserDetails nonMemberUser;

    private String testFarmId;

    @BeforeEach
    void setUp() {
        FirebaseConfig firebaseConfig = Mockito.mock(FirebaseConfig.class);
        Mockito.when(firebaseConfig.isInitialized()).thenReturn(false);

        MockEnvironment env = new MockEnvironment();
        farmRepository = new FirestoreFarmRepository(firebaseConfig, env);
        membershipRepository = new FarmMembershipRepository(firebaseConfig, env);
        userRepository = new FirestoreUserRepository(firebaseConfig, env);
        fieldRepository = new FirestoreFieldRepository(firebaseConfig, env);
        projectionService = new PublicFarmProjectionService(farmRepository);

        farmService = new FarmService(farmRepository, membershipRepository, projectionService, firebaseConfig);
        fieldService = new FieldService(fieldRepository, farmRepository, membershipRepository, projectionService, firebaseConfig);

        ownerUser = new FirebaseUserDetails(OWNER_UID, "owner@agroai.org", "Owner User", true, Map.of());
        managerUser = new FirebaseUserDetails(MANAGER_UID, "manager@agroai.org", "Manager User", true, Map.of());
        observerUser = new FirebaseUserDetails(OBSERVER_UID, "observer@agroai.org", "Observer User", true, Map.of());
        nonMemberUser = new FirebaseUserDetails(NON_MEMBER_UID, "other@agroai.org", "Other User", true, Map.of());

        // Create a test farm
        CreateFarmRequest farmReq = new CreateFarmRequest(
                null, "Green Agro Farm", "Description", "Gazipur", "Dhaka", "Address", 12.0, FarmVisibility.PUBLIC
        );
        var createdFarm = farmService.registerFarm(ownerUser, farmReq);
        testFarmId = createdFarm.farmId();

        // Add MANAGER and OBSERVER memberships
        membershipRepository.saveMembership(new FarmMembership(
                "mbr_" + testFarmId + "::safe_" + MANAGER_UID, testFarmId, MANAGER_UID, FarmRole.MANAGER, MembershipStatus.ACTIVE
        ));
        membershipRepository.saveMembership(new FarmMembership(
                "mbr_" + testFarmId + "::safe_" + OBSERVER_UID, testFarmId, OBSERVER_UID, FarmRole.OBSERVER, MembershipStatus.ACTIVE
        ));
    }

    @Test
    @DisplayName("[FIELD-01] Creating a field atomically increments farm activeFieldCount and synchronizes projection")
    void testCreateFieldIncrementsActiveFieldCount() {
        CreateFieldRequest request = new CreateFieldRequest(
                "paddy-1", "North Paddy Plot", CropType.RICE, SoilType.CLAY, IrrigationType.CANAL, 4.5, "Monsoon crop"
        );

        FieldResponseDTO created = fieldService.createField(testFarmId, request, ownerUser);

        assertNotNull(created);
        assertEquals(testFarmId + "--paddy-1", created.fieldId());
        assertEquals("paddy-1", created.localFieldId());
        assertEquals("North Paddy Plot", created.name());
        assertEquals(FieldStatus.ACTIVE, created.status());
        assertEquals(1, created.version());

        // Verify farm activeFieldCount invariant
        Farm farm = farmRepository.findById(testFarmId).orElseThrow();
        assertEquals(1, farm.getActiveFieldCount());
        assertEquals(2, farm.getVersion()); // Farm version incremented from 1 to 2
        assertTrue(farm.getActiveCropTypes().contains("RICE"));

        // Verify public projection was synchronized
        var projection = farmRepository.findPublicProjection(testFarmId).orElseThrow();
        assertEquals(1, projection.getActiveFieldCount());
    }

    @Test
    @DisplayName("[FIELD-02] Duplicate field ID under the same farm throws IllegalArgumentException")
    void testDuplicateFieldIdThrows() {
        CreateFieldRequest request1 = new CreateFieldRequest(
                "plot-a", "Plot A1", CropType.WHEAT, SoilType.LOAMY, IrrigationType.DRIP, 2.0, null
        );
        fieldService.createField(testFarmId, request1, ownerUser);

        CreateFieldRequest request2 = new CreateFieldRequest(
                "plot-a", "Plot A2", CropType.JUTE, SoilType.SANDY, IrrigationType.RAIN_FED, 3.0, null
        );
        assertThrows(IllegalArgumentException.class, () ->
                fieldService.createField(testFarmId, request2, ownerUser)
        );
    }

    @Test
    @DisplayName("[FIELD-03] Manager can create and update fields; Observer cannot")
    void testRolePermissionsOnFieldOperations() {
        // Manager can create field
        CreateFieldRequest mgrReq = new CreateFieldRequest(
                "mgr-plot", "Manager Plot", CropType.MAIZE, SoilType.LOAMY, IrrigationType.SPRINKLER, 3.2, null
        );
        FieldResponseDTO created = fieldService.createField(testFarmId, mgrReq, managerUser);
        assertNotNull(created);

        // Observer cannot create field
        CreateFieldRequest obsReq = new CreateFieldRequest(
                "obs-plot", "Observer Plot", CropType.TEA, SoilType.CLAY, IrrigationType.RAIN_FED, 1.0, null
        );
        assertThrows(UnauthorizedResourceAccessException.class, () ->
                fieldService.createField(testFarmId, obsReq, observerUser)
        );

        // Manager can update field
        UpdateFieldRequest updateReq = new UpdateFieldRequest(
                "Manager Plot Updated", CropType.MAIZE, SoilType.LOAMY, IrrigationType.DRIP, 3.5, FieldStatus.ACTIVE, "Updated notes", 1
        );
        FieldResponseDTO updated = fieldService.updateField(testFarmId, created.fieldId(), updateReq, managerUser);
        assertEquals(2, updated.version());

        // Observer cannot update field
        UpdateFieldRequest obsUpdate = new UpdateFieldRequest(
                "Observer Hacked", CropType.MAIZE, SoilType.LOAMY, IrrigationType.DRIP, 3.5, FieldStatus.ACTIVE, null, 2
        );
        assertThrows(UnauthorizedResourceAccessException.class, () ->
                fieldService.updateField(testFarmId, created.fieldId(), obsUpdate, observerUser)
        );
    }

    @Test
    @DisplayName("[FIELD-04] Stale expectedVersion throws StaleVersionException (409 Conflict)")
    void testOptimisticConcurrencyUpdate() {
        CreateFieldRequest req = new CreateFieldRequest(
                "fld-ver", "Version Field", CropType.POTATO, SoilType.SILTY, IrrigationType.GROUNDWATER_TUBEWELL, 1.5, null
        );
        FieldResponseDTO created = fieldService.createField(testFarmId, req, ownerUser);

        // First update with valid version 1 succeeds
        UpdateFieldRequest update1 = new UpdateFieldRequest(
                "Version Field V2", CropType.POTATO, SoilType.SILTY, IrrigationType.GROUNDWATER_TUBEWELL, 1.8, FieldStatus.ACTIVE, null, 1
        );
        FieldResponseDTO updated1 = fieldService.updateField(testFarmId, created.fieldId(), update1, ownerUser);
        assertEquals(2, updated1.version());

        // Second update with stale expectedVersion 1 fails with StaleVersionException
        UpdateFieldRequest staleUpdate = new UpdateFieldRequest(
                "Stale Overwrite", CropType.POTATO, SoilType.SILTY, IrrigationType.GROUNDWATER_TUBEWELL, 2.0, FieldStatus.ACTIVE, null, 1
        );
        assertThrows(StaleVersionException.class, () ->
                fieldService.updateField(testFarmId, created.fieldId(), staleUpdate, ownerUser)
        );
    }

    @Test
    @DisplayName("[FIELD-05] Archiving a field soft-archives document, decrements activeFieldCount, and synchronizes projection")
    void testArchiveFieldDecrementsActiveFieldCount() {
        CreateFieldRequest req = new CreateFieldRequest(
                "arch-plot", "Archival Plot", CropType.VEGETABLES, SoilType.LOAMY, IrrigationType.DRIP, 2.5, null
        );
        FieldResponseDTO created = fieldService.createField(testFarmId, req, ownerUser);
        assertEquals(1, farmRepository.findById(testFarmId).orElseThrow().getActiveFieldCount());

        // Soft-archive field
        fieldService.archiveField(testFarmId, created.fieldId(), 1, ownerUser);

        Field archivedField = fieldRepository.findById(created.fieldId()).orElseThrow();
        assertEquals(FieldStatus.ARCHIVED, archivedField.getStatus());
        assertNotNull(archivedField.getArchivedAt());
        assertEquals(2, archivedField.getVersion());

        // Verify farm activeFieldCount decremented to 0
        Farm farm = farmRepository.findById(testFarmId).orElseThrow();
        assertEquals(0, farm.getActiveFieldCount());

        // Verify public projection activeFieldCount synchronized
        var projection = farmRepository.findPublicProjection(testFarmId).orElseThrow();
        assertEquals(0, projection.getActiveFieldCount());

        // Repeated archival is idempotent
        assertDoesNotThrow(() -> fieldService.archiveField(testFarmId, created.fieldId(), null, ownerUser));
        assertEquals(0, farmRepository.findById(testFarmId).orElseThrow().getActiveFieldCount());
    }

    @Test
    @DisplayName("Field deactivation and reactivation keep active field count consistent")
    void testFieldStatusChangesKeepActiveCountConsistent() {
        var created = fieldService.createField(testFarmId,
                new CreateFieldRequest("plot-status", "Status plot", CropType.RICE, SoilType.LOAMY,
                        IrrigationType.RAIN_FED, 1.0, null), ownerUser);
        UpdateFieldRequest fallow = new UpdateFieldRequest("Status plot", CropType.RICE, SoilType.LOAMY,
                IrrigationType.RAIN_FED, 1.0, FieldStatus.FALLOW, null, 1);
        fieldService.updateField(testFarmId, created.fieldId(), fallow, ownerUser);
        assertEquals(0, farmRepository.findById(testFarmId).orElseThrow().getActiveFieldCount());

        UpdateFieldRequest active = new UpdateFieldRequest("Status plot", CropType.RICE, SoilType.LOAMY,
                IrrigationType.RAIN_FED, 1.0, FieldStatus.ACTIVE, null, 2);
        fieldService.updateField(testFarmId, created.fieldId(), active, ownerUser);
        assertEquals(1, farmRepository.findById(testFarmId).orElseThrow().getActiveFieldCount());
    }

    @Test
    @DisplayName("[FIELD-06] Only OWNER can archive a field; Manager is denied")
    void testManagerCannotArchiveField() {
        CreateFieldRequest req = new CreateFieldRequest(
                "mgr-archive-denied", "Plot", CropType.RICE, SoilType.CLAY, IrrigationType.CANAL, 1.0, null
        );
        FieldResponseDTO created = fieldService.createField(testFarmId, req, ownerUser);

        // Manager attempt to archive must throw UnauthorizedResourceAccessException
        assertThrows(UnauthorizedResourceAccessException.class, () ->
                fieldService.archiveField(testFarmId, created.fieldId(), 1, managerUser)
        );
    }

    @Test
    @DisplayName("[FIELD-07] Operations on archived farms throw InvalidStateTransitionException")
    void testArchivedFarmBlocksFieldCreationAndArchival() {
        // Archive the farm
        farmService.archiveFarm(testFarmId, 1, ownerUser);

        CreateFieldRequest req = new CreateFieldRequest(
                "blocked-fld", "Blocked", CropType.RICE, SoilType.CLAY, IrrigationType.CANAL, 1.0, null
        );
        assertThrows(InvalidStateTransitionException.class, () ->
                fieldService.createField(testFarmId, req, ownerUser)
        );
    }

    @Test
    @DisplayName("[FIELD-08] Non-member cannot access farm fields")
    void testNonMemberCannotAccessFields() {
        assertThrows(UnauthorizedResourceAccessException.class, () ->
                fieldService.getFields(testFarmId, false, nonMemberUser)
        );
    }
}
