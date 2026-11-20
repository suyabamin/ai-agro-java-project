package com.agroai.service;

import com.agroai.config.FirebaseConfig;
import com.agroai.dto.CreateAssignmentRequest;
import com.agroai.dto.InitializeProfileRequest;
import com.agroai.dto.FieldAssignmentResponseDTO;
import com.agroai.dto.ReassignFarmerRequest;
import com.agroai.dto.ReleaseAssignmentRequest;
import com.agroai.exception.DuplicateAssignmentException;
import com.agroai.exception.InvalidStateTransitionException;
import com.agroai.exception.StaleVersionException;
import com.agroai.exception.UnauthorizedResourceAccessException;
import com.agroai.model.ApplicationStatus;
import com.agroai.model.AssignmentHistory;
import com.agroai.model.AssignmentStatus;
import com.agroai.model.Farm;
import com.agroai.model.FarmMembership;
import com.agroai.model.FarmRole;
import com.agroai.model.FarmStatus;
import com.agroai.model.FarmVisibility;
import com.agroai.model.Field;
import com.agroai.model.FieldStatus;
import com.agroai.model.JobApplication;
import com.agroai.model.MembershipStatus;
import com.agroai.repository.AssignmentHistoryRepository;
import com.agroai.repository.FarmMembershipRepository;
import com.agroai.repository.FarmRepository;
import com.agroai.repository.FieldAssignmentRepository;
import com.agroai.repository.FieldRepository;
import com.agroai.repository.FirestoreAssignmentHistoryRepository;
import com.agroai.repository.FirestoreFarmRepository;
import com.agroai.repository.FirestoreFieldAssignmentRepository;
import com.agroai.repository.FirestoreFieldRepository;
import com.agroai.repository.FirestoreJobApplicationRepository;
import com.agroai.repository.FirestoreUserRepository;
import com.agroai.repository.JobApplicationRepository;
import com.agroai.repository.UserRepository;
import com.agroai.util.KeyEncoder;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.mock.env.MockEnvironment;

import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Milestone 5 — FieldAssignmentService Business Workflows & Invariant Tests")
class FieldAssignmentServiceTest {

    private FieldAssignmentRepository assignmentRepository;
    private AssignmentHistoryRepository historyRepository;
    private FarmRepository farmRepository;
    private FieldRepository fieldRepository;
    private FarmMembershipRepository membershipRepository;
    private UserRepository userRepository;
    private JobApplicationRepository applicationRepository;
    private FieldAssignmentService assignmentService;

    private static final String OWNER_UID = "user-owner-001";
    private static final String MANAGER_UID = "user-manager-002";
    private static final String OBSERVER_UID = "user-observer-003";
    private static final String FARMER_UID = "user-farmer-004";
    private static final String NEW_FARMER_UID = "user-farmer-005";
    private static final String STRANGER_UID = "user-stranger-999";

    private static final String FARM_ID = "farm-11111111-2222-3333-4444-555555555555";
    private static final String FIELD_ID = FARM_ID + "--plot-01";

    @BeforeEach
    void setUp() {
        FirebaseConfig firebaseConfig = Mockito.mock(FirebaseConfig.class);
        Mockito.when(firebaseConfig.isInitialized()).thenReturn(false);
        Mockito.when(firebaseConfig.isConfigured()).thenReturn(false);

        MockEnvironment env = new MockEnvironment();
        assignmentRepository = new FirestoreFieldAssignmentRepository(firebaseConfig, env);
        historyRepository = new FirestoreAssignmentHistoryRepository(firebaseConfig);
        farmRepository = new FirestoreFarmRepository(firebaseConfig, env);
        fieldRepository = new FirestoreFieldRepository(firebaseConfig, env);
        membershipRepository = new FarmMembershipRepository(firebaseConfig, env);
        userRepository = new FirestoreUserRepository(firebaseConfig, env);
        applicationRepository = new FirestoreJobApplicationRepository(firebaseConfig, env);

        assignmentService = new FieldAssignmentService(
                assignmentRepository,
                historyRepository,
                farmRepository,
                fieldRepository,
                membershipRepository,
                userRepository,
                applicationRepository,
                firebaseConfig
        );

        // Setup test farm
        Farm farm = new Farm();
        farm.setFarmId(FARM_ID);
        farm.setName("Golden Harvest Farm");
        farm.setOwnerUid(OWNER_UID);
        farm.setOwnerSafeUid(KeyEncoder.encodeUid(OWNER_UID));
        farm.setDistrict("Gazipur");
        farm.setDivision("Dhaka");
        farm.setDetailedAddress("Plot 12");
        farm.setTotalAreaHectares(25.0);
        farm.setStatus(FarmStatus.ACTIVE);
        farm.setVisibility(FarmVisibility.PUBLIC);
        farmRepository.save(farm);

        // Setup test field
        Field field = new Field(FIELD_ID, "plot-01", FARM_ID, "Paddy Plot 1", 5.0);
        field.setStatus(FieldStatus.ACTIVE);
        fieldRepository.save(field);

        // Setup memberships
        membershipRepository.saveMembership(new FarmMembership("mbr_owner", FARM_ID, OWNER_UID, FarmRole.OWNER, MembershipStatus.ACTIVE));
        membershipRepository.saveMembership(new FarmMembership("mbr_manager", FARM_ID, MANAGER_UID, FarmRole.MANAGER, MembershipStatus.ACTIVE));
        membershipRepository.saveMembership(new FarmMembership("mbr_observer", FARM_ID, OBSERVER_UID, FarmRole.OBSERVER, MembershipStatus.ACTIVE));
        userRepository.initializeProfile(FARMER_UID, "farmer@example.test", new InitializeProfileRequest("Test Farmer", null, null, "en"));
        userRepository.initializeProfile(NEW_FARMER_UID, "newfarmer@example.test", new InitializeProfileRequest("New Test Farmer", null, null, "en"));
        userRepository.initializeProfile(OWNER_UID, "owner@example.test", new InitializeProfileRequest("Test Owner", null, null, "en"));
        userRepository.initializeProfile(MANAGER_UID, "manager@example.test", new InitializeProfileRequest("Test Manager", null, null, "en"));
    }

    @Test
    @DisplayName("[ASGN-SRV-01] Owner successfully assigns farmer to field with audit record")
    void testCreateAssignmentSuccess() {
        CreateAssignmentRequest request = new CreateAssignmentRequest(
                FARMER_UID, List.of("READ", "WRITE_LOGS", "SUBMIT_TELEMETRY"), null, null
        );

        FieldAssignmentResponseDTO response = assignmentService.createAssignment(FARM_ID, FIELD_ID, request, OWNER_UID);

        assertNotNull(response);
        assertEquals(FIELD_ID, response.fieldId());
        assertEquals(FARM_ID, response.farmId());
        assertEquals(FARMER_UID, response.farmerUid());
        assertEquals(AssignmentStatus.ACTIVE, response.status());
        assertEquals(1, response.version());
        assertTrue(response.permissions().contains("SUBMIT_TELEMETRY"));

        // Verify audit history
        List<AssignmentHistory> history = historyRepository.findByAssignmentId(response.assignmentId());
        assertEquals(1, history.size());
        assertEquals("ASSIGNED", history.get(0).getEventType());
        assertEquals(OWNER_UID, history.get(0).getPerformedByUid());
    }

    @Test
    @DisplayName("[ASGN-SRV-01B] Multiple farmers share a field and one farmer can hold assignments on multiple fields")
    void testManyToManyAssignmentRelationship() {
        Field secondField = new Field(FARM_ID + "--plot-02", "plot-02", FARM_ID, "Paddy Plot 2", 2.0);
        fieldRepository.save(secondField);

        assignmentService.createAssignment(FARM_ID, FIELD_ID,
                new CreateAssignmentRequest(FARMER_UID, List.of("READ"), null, null), OWNER_UID);
        assignmentService.createAssignment(FARM_ID, FIELD_ID,
                new CreateAssignmentRequest(NEW_FARMER_UID, List.of("READ"), null, null), OWNER_UID);
        assignmentService.createAssignment(FARM_ID, secondField.getFieldId(),
                new CreateAssignmentRequest(FARMER_UID, List.of("READ"), null, null), OWNER_UID);

        assertEquals(2, assignmentRepository.findActiveAssignmentsByField(FIELD_ID).size());
        assertEquals(2, assignmentRepository.findActiveAssignmentsByFarmer(FARMER_UID).size());
    }

    @Test
    @DisplayName("[ASGN-SRV-02] Duplicate active assignment on same field throws 409 Conflict")
    void testCreateAssignmentDuplicateThrows409() {
        CreateAssignmentRequest request = new CreateAssignmentRequest(FARMER_UID, List.of("READ"), null, null);
        assignmentService.createAssignment(FARM_ID, FIELD_ID, request, OWNER_UID);

        // Second assignment for the same active farmer must fail
        assertThrows(DuplicateAssignmentException.class, () ->
                assignmentService.createAssignment(FARM_ID, FIELD_ID, request, OWNER_UID)
        );
    }

    @Test
    @DisplayName("[ASGN-SRV-02B] Concurrent duplicate requests yield one active tenure")
    void testConcurrentDuplicateAssignmentRequests() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        CreateAssignmentRequest req = new CreateAssignmentRequest(FARMER_UID, List.of("READ"), null, null);
        try {
            java.util.concurrent.Callable<Boolean> attempt = () -> {
                ready.countDown();
                start.await();
                try {
                    assignmentService.createAssignment(FARM_ID, FIELD_ID, req, OWNER_UID);
                    return true;
                } catch (DuplicateAssignmentException expected) {
                    return false;
                }
            };
            Future<Boolean> first = pool.submit(attempt);
            Future<Boolean> second = pool.submit(attempt);
            ready.await();
            start.countDown();
            int created = (first.get() ? 1 : 0) + (second.get() ? 1 : 0);
            assertEquals(1, created);
            assertEquals(1, assignmentRepository.findActiveAssignmentsByField(FIELD_ID).size());
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    @DisplayName("[ASGN-SRV-03] Repeat tenures use distinct immutable assignment IDs")
    void testCreateAssignmentStartsNewTenureAfterRelease() {
        CreateAssignmentRequest req = new CreateAssignmentRequest(FARMER_UID, List.of("READ"), null, null);
        FieldAssignmentResponseDTO created = assignmentService.createAssignment(FARM_ID, FIELD_ID, req, OWNER_UID);

        // Release farmer
        assignmentService.releaseAssignment(FARM_ID, FIELD_ID, created.assignmentId(),
                new ReleaseAssignmentRequest("End of contract", 1), OWNER_UID);

        FieldAssignmentResponseDTO second = assignmentService.createAssignment(FARM_ID, FIELD_ID, req, OWNER_UID);
        assertNotEquals(created.assignmentId(), second.assignmentId());
        assertEquals(AssignmentStatus.ACTIVE, second.status());
        assertEquals(AssignmentStatus.RELEASED,
                assignmentRepository.findById(created.assignmentId()).orElseThrow().getStatus());
        assertEquals("End of contract",
                assignmentRepository.findById(created.assignmentId()).orElseThrow().getReleaseReason());

        assignmentService.releaseAssignment(FARM_ID, FIELD_ID, second.assignmentId(),
                new ReleaseAssignmentRequest("Second end", 1), OWNER_UID);
        FieldAssignmentResponseDTO third = assignmentService.createAssignment(FARM_ID, FIELD_ID, req, OWNER_UID);
        assertNotEquals(second.assignmentId(), third.assignmentId());
        assertEquals(3, assignmentRepository.findAssignmentsByFarmer(FARMER_UID).size());
        assertEquals(2, historyRepository.findByAssignmentId(created.assignmentId()).size());
        assertEquals(2, historyRepository.findByAssignmentId(second.assignmentId()).size());
        assertEquals(1, historyRepository.findByAssignmentId(third.assignmentId()).size());
    }

    @Test
    @DisplayName("[ASGN-SRV-03B] Farmer without an active initialized account is rejected")
    void testCreateAssignmentRejectsMissingFarmerProfile() {
        CreateAssignmentRequest request = new CreateAssignmentRequest("missing-farmer", List.of("READ"), null, null);
        assertThrows(IllegalArgumentException.class,
                () -> assignmentService.createAssignment(FARM_ID, FIELD_ID, request, OWNER_UID));
    }

    @Test
    @DisplayName("[ASGN-SRV-04] Assigning on archived farm or field throws InvalidStateTransitionException")
    void testCreateAssignmentArchivedFarmOrFieldThrows() {
        Farm farm = farmRepository.findById(FARM_ID).orElseThrow();
        farm.setStatus(FarmStatus.ARCHIVED);
        farmRepository.save(farm);

        CreateAssignmentRequest request = new CreateAssignmentRequest(FARMER_UID, List.of("READ"), null, null);
        assertThrows(InvalidStateTransitionException.class, () ->
                assignmentService.createAssignment(FARM_ID, FIELD_ID, request, OWNER_UID)
        );
    }

    @Test
    @DisplayName("[ASGN-SRV-05] Linking an APPROVED application succeeds; unapproved throws InvalidStateTransitionException")
    void testCreateAssignmentWithApprovedApplication() {
        JobApplication approvedApp = new JobApplication();
        approvedApp.setApplicationId("app-approved-01");
        approvedApp.setFarmId(FARM_ID);
        approvedApp.setApplicantUid(FARMER_UID);
        approvedApp.setJobId("job-1");
        approvedApp.setStatus(ApplicationStatus.APPROVED);
        applicationRepository.save(approvedApp);

        JobApplication submittedApp = new JobApplication();
        submittedApp.setApplicationId("app-submitted-02");
        submittedApp.setFarmId(FARM_ID);
        submittedApp.setApplicantUid(NEW_FARMER_UID);
        submittedApp.setJobId("job-1");
        submittedApp.setStatus(ApplicationStatus.SUBMITTED);
        applicationRepository.save(submittedApp);

        // Approved application succeeds
        CreateAssignmentRequest validReq = new CreateAssignmentRequest(FARMER_UID, List.of("READ"), "app-approved-01", "job-1");
        FieldAssignmentResponseDTO resp = assignmentService.createAssignment(FARM_ID, FIELD_ID, validReq, MANAGER_UID);
        assertNotNull(resp);
        assertEquals("app-approved-01", resp.sourceApplicationId());

        // Unapproved application fails
        CreateAssignmentRequest invalidReq = new CreateAssignmentRequest(NEW_FARMER_UID, List.of("READ"), "app-submitted-02", "job-1");
        assertThrows(InvalidStateTransitionException.class, () ->
                assignmentService.createAssignment(FARM_ID, FIELD_ID, invalidReq, MANAGER_UID)
        );
    }

    @Test
    @DisplayName("[ASGN-SRV-06] Releasing an assignment transitions status to RELEASED and records audit metadata")
    void testReleaseAssignmentSuccess() {
        CreateAssignmentRequest req = new CreateAssignmentRequest(FARMER_UID, List.of("READ"), null, null);
        FieldAssignmentResponseDTO created = assignmentService.createAssignment(FARM_ID, FIELD_ID, req, OWNER_UID);

        ReleaseAssignmentRequest releaseReq = new ReleaseAssignmentRequest("Season completed", 1);
        FieldAssignmentResponseDTO released = assignmentService.releaseAssignment(FARM_ID, FIELD_ID, created.assignmentId(), releaseReq, MANAGER_UID);

        assertEquals(AssignmentStatus.RELEASED, released.status());
        assertEquals("Season completed", released.releaseReason());
        assertEquals(MANAGER_UID, released.releasedByUid());
        assertNotNull(released.releasedAt());
        assertEquals(2, released.version());

        // Verify history has RELEASED entry
        List<AssignmentHistory> history = historyRepository.findByAssignmentId(created.assignmentId());
        assertEquals(2, history.size());
        assertTrue(history.stream().anyMatch(h -> "ASSIGNED".equals(h.getEventType())));
        assertTrue(history.stream().anyMatch(h -> "RELEASED".equals(h.getEventType())));
    }

    @Test
    @DisplayName("[ASGN-SRV-06B] Release reason is optional")
    void testReleaseAssignmentWithoutReason() {
        FieldAssignmentResponseDTO created = assignmentService.createAssignment(FARM_ID, FIELD_ID,
                new CreateAssignmentRequest(FARMER_UID, List.of("READ"), null, null), OWNER_UID);
        FieldAssignmentResponseDTO released = assignmentService.releaseAssignment(FARM_ID, FIELD_ID,
                created.assignmentId(), new ReleaseAssignmentRequest(null, 1), OWNER_UID);
        assertEquals(AssignmentStatus.RELEASED, released.status());
        assertNull(released.releaseReason());
    }

    @Test
    @DisplayName("[ASGN-SRV-07B] Reassignment preserves the outgoing record and creates a distinct incoming record")
    void testReassignmentPreservesHistory() {
        FieldAssignmentResponseDTO outgoing = assignmentService.createAssignment(FARM_ID, FIELD_ID,
                new CreateAssignmentRequest(FARMER_UID, List.of("READ"), null, null), OWNER_UID);

        FieldAssignmentResponseDTO incoming = assignmentService.reassignFarmer(FARM_ID, FIELD_ID,
                outgoing.assignmentId(), new ReassignFarmerRequest(NEW_FARMER_UID, "Role transfer",
                        List.of("READ"), 1, null), OWNER_UID);

        assertNotEquals(outgoing.assignmentId(), incoming.assignmentId());
        assertEquals(NEW_FARMER_UID, incoming.farmerUid());
        assertEquals(AssignmentStatus.RELEASED,
                assignmentRepository.findById(outgoing.assignmentId()).orElseThrow().getStatus());
        assertEquals(AssignmentStatus.ACTIVE, incoming.status());
        assertEquals(1, assignmentRepository.findActiveAssignmentsByFarmer(NEW_FARMER_UID).size());
        assertEquals(2, historyRepository.findByAssignmentId(outgoing.assignmentId()).size());
        assertEquals(1, historyRepository.findByAssignmentId(incoming.assignmentId()).size());
    }

    @Test
    @DisplayName("[ASGN-SRV-07] Stale OCC version check on release throws StaleVersionException")
    void testReleaseAssignmentStaleVersionThrows() {
        CreateAssignmentRequest req = new CreateAssignmentRequest(FARMER_UID, List.of("READ"), null, null);
        FieldAssignmentResponseDTO created = assignmentService.createAssignment(FARM_ID, FIELD_ID, req, OWNER_UID);

        ReleaseAssignmentRequest staleReq = new ReleaseAssignmentRequest("Season completed", 99); // Wrong version
        assertThrows(StaleVersionException.class, () ->
                assignmentService.releaseAssignment(FARM_ID, FIELD_ID, created.assignmentId(), staleReq, OWNER_UID)
        );
    }

    @Test
    @DisplayName("[ASGN-SRV-08] Non-manager/outsider attempting assignment operations throws UnauthorizedResourceAccessException")
    void testUnauthorizedUserThrows403() {
        CreateAssignmentRequest req = new CreateAssignmentRequest(FARMER_UID, List.of("READ"), null, null);

        // Observer cannot assign
        assertThrows(UnauthorizedResourceAccessException.class, () ->
                assignmentService.createAssignment(FARM_ID, FIELD_ID, req, OBSERVER_UID)
        );

        // Stranger cannot assign
        assertThrows(UnauthorizedResourceAccessException.class, () ->
                assignmentService.createAssignment(FARM_ID, FIELD_ID, req, STRANGER_UID)
        );
    }
}
