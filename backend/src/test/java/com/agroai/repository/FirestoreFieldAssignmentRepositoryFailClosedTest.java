package com.agroai.repository;

import com.agroai.config.FirebaseConfig;
import com.agroai.exception.DatabaseUnavailableException;
import com.agroai.model.AssignmentStatus;
import com.agroai.model.FieldAssignment;
import com.agroai.util.KeyEncoder;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@DisplayName("Milestone 5 — FirestoreFieldAssignmentRepository Fail-Closed & Dev Mode Tests")
class FirestoreFieldAssignmentRepositoryFailClosedTest {

    private FirebaseConfig mockFirebaseConfig;
    private MockEnvironment mockEnvironment;
    private FirestoreFieldAssignmentRepository repository;

    @BeforeEach
    void setUp() {
        mockFirebaseConfig = mock(FirebaseConfig.class);
        mockEnvironment = new MockEnvironment();
        when(mockFirebaseConfig.isInitialized()).thenReturn(false);
        when(mockFirebaseConfig.isConfigured()).thenReturn(false);
        repository = new FirestoreFieldAssignmentRepository(mockFirebaseConfig, mockEnvironment);
        repository.clearAllForTesting();
    }

    @Test
    @DisplayName("[FAIL-CLOSED-ASGN-01] Dev/Offline Mode Operates In-Memory Without Exceptions")
    void testDevOfflineInMemoryOperation() {
        String fieldId = "farm-1--field-1";
        String farmerUid = "farmer-uid-01";
        String docId = KeyEncoder.assignmentDocId(fieldId, farmerUid);

        FieldAssignment assignment = new FieldAssignment(fieldId, farmerUid, List.of("READ", "WRITE_LOGS"));
        assignment.setAssignmentId(docId);
        assignment.setFarmId("farm-1");
        assignment.setStatus(AssignmentStatus.ACTIVE);

        FieldAssignment saved = repository.save(assignment);
        assertNotNull(saved);
        assertEquals(docId, saved.getAssignmentId());

        Optional<FieldAssignment> foundById = repository.findById(docId);
        assertTrue(foundById.isPresent());
        assertEquals(AssignmentStatus.ACTIVE, foundById.get().getStatus());

        Optional<FieldAssignment> foundByCompound = repository.findAssignment(fieldId, farmerUid);
        assertTrue(foundByCompound.isPresent());
        assertEquals(docId, foundByCompound.get().getAssignmentId());

        List<FieldAssignment> farmerActive = repository.findActiveAssignmentsByFarmer(farmerUid);
        assertEquals(1, farmerActive.size());

        List<FieldAssignment> fieldActive = repository.findActiveAssignmentsByField(fieldId);
        assertEquals(1, fieldActive.size());

        List<FieldAssignment> farmAssignments = repository.findAssignmentsByFarm("farm-1");
        assertEquals(1, farmAssignments.size());
    }

    @Test
    @DisplayName("[FAIL-CLOSED-ASGN-02] In-Memory Release Updates Status to RELEASED and Revokes Active Queries")
    void testReleaseAssignmentInMemory() {
        String fieldId = "farm-1--field-2";
        String farmerUid = "farmer-uid-02";

        FieldAssignment assignment = new FieldAssignment(fieldId, farmerUid, List.of("READ"));
        assignment.setFarmId("farm-1");
        repository.save(assignment);

        List<FieldAssignment> before = repository.findActiveAssignmentsByFarmer(farmerUid);
        assertEquals(1, before.size());

        repository.releaseAssignment(fieldId, farmerUid, "Shift completed");

        List<FieldAssignment> after = repository.findActiveAssignmentsByFarmer(farmerUid);
        assertEquals(0, after.size(), "Active assignments query must return empty after release");

        List<FieldAssignment> allForFarmer = repository.findAssignmentsByFarmer(farmerUid);
        assertEquals(1, allForFarmer.size(), "Farmer total assignment history should retain released doc");
        assertEquals(AssignmentStatus.RELEASED, allForFarmer.get(0).getStatus());
        assertEquals("Shift completed", allForFarmer.get(0).getReleaseReason());
    }

    @Test
    @DisplayName("[FAIL-CLOSED-ASGN-03] Live Firestore Read Failure Throws DatabaseUnavailableException")
    void testLiveFirestoreReadFailure() {
        when(mockFirebaseConfig.isInitialized()).thenReturn(true);

        assertThrows(DatabaseUnavailableException.class, () -> repository.findById("asgn_fld_f1::u1"));
        assertThrows(DatabaseUnavailableException.class, () -> repository.findActiveAssignmentsByFarmer("u1"));
        assertThrows(DatabaseUnavailableException.class, () -> repository.findAssignmentsByField("f1"));
    }

    @Test
    @DisplayName("[PAGE-ASGN-01] Assignment cursor pages have stable boundaries and empty final pages")
    void testCursorPages() {
        for (int i = 1; i <= 5; i++) {
            FieldAssignment assignment = new FieldAssignment("farm-1--field-1", "farmer-page", List.of("READ"));
            assignment.setAssignmentId("asgn_tenure_" + i);
            assignment.setFarmId("farm-1");
            assignment.setStatus(AssignmentStatus.ACTIVE);
            repository.save(assignment);
        }

        CursorPage<FieldAssignment> first = repository.findAssignmentsByFarmPage("farm-1", null, 2);
        CursorPage<FieldAssignment> middle = repository.findAssignmentsByFarmPage("farm-1", first.nextCursor(), 2);
        CursorPage<FieldAssignment> last = repository.findAssignmentsByFarmPage("farm-1", middle.nextCursor(), 2);
        CursorPage<FieldAssignment> empty = repository.findAssignmentsByFarmPage("farm-empty", null, 2);

        assertEquals(2, first.items().size());
        assertTrue(first.hasNext());
        assertEquals(2, middle.items().size());
        assertTrue(middle.hasNext());
        assertEquals(1, last.items().size());
        assertFalse(last.hasNext());
        assertTrue(empty.items().isEmpty());
        assertFalse(empty.hasNext());
        assertEquals(5, java.util.stream.Stream.of(first, middle, last).flatMap(p -> p.items().stream())
                .map(FieldAssignment::getAssignmentId).distinct().count());
    }
}
