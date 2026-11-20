package com.agroai.model;

import com.agroai.util.KeyEncoder;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Milestone 5 — FieldAssignment Domain Model & Key Arithmetic Tests")
class FieldAssignmentDomainTest {

    @Test
    @DisplayName("[ASGN-DOM-01] Assignment ID generation and validation arithmetic")
    void testAssignmentIdArithmetic() {
        String fieldId = "farm-12345678-1234-1234-1234-123456789abc--plot-01";
        String rawFarmerId = "user_farmer_12345@google.com";
        String expectedSafeUid = KeyEncoder.encodeUid(rawFarmerId);
        String docId = KeyEncoder.assignmentDocId(fieldId, rawFarmerId);

        assertTrue(docId.startsWith("asgn_fld_"));
        assertTrue(docId.contains("::"));
        assertEquals("asgn_fld_" + fieldId + "::" + expectedSafeUid, docId);
        assertEquals(docId, KeyEncoder.validateAssignmentId(docId));

        // Invalid formats throw IllegalArgumentException
        assertThrows(IllegalArgumentException.class, () -> KeyEncoder.validateAssignmentId(null));
        assertThrows(IllegalArgumentException.class, () -> KeyEncoder.validateAssignmentId(""));
        assertThrows(IllegalArgumentException.class, () -> KeyEncoder.validateAssignmentId("invalid-format"));
        assertThrows(IllegalArgumentException.class, () -> KeyEncoder.validateAssignmentId("asgn_fld_short"));
        assertThrows(IllegalArgumentException.class, () -> KeyEncoder.validateAssignmentId("asgn_fld_" + fieldId));
    }

    @Test
    @DisplayName("[ASGN-DOM-02] FieldAssignment default values and constructors")
    void testFieldAssignmentDefaults() {
        String fieldId = "farm-12345678-1234-1234-1234-123456789abc--plot-01";
        String farmerUid = "farmer-uid-123";
        List<String> perms = List.of("READ", "WRITE_LOGS");

        FieldAssignment assignment = new FieldAssignment(fieldId, farmerUid, perms);

        assertEquals(fieldId, assignment.getFieldId());
        assertEquals(farmerUid, assignment.getFarmerId());
        assertEquals(AssignmentStatus.ACTIVE, assignment.getStatus());
        assertEquals(1, assignment.getVersion());
        assertEquals(perms, assignment.getPermissions());
        assertNotNull(assignment.getAssignedAt());
        assertNotNull(assignment.getCreatedAt());
        assertNotNull(assignment.getUpdatedAt());
        assertNull(assignment.getReleasedAt());
        assertNull(assignment.getReleasedByUid());
        assertNull(assignment.getReleaseReason());
    }

    @Test
    @DisplayName("[ASGN-DOM-03] FieldAssignment release lifecycle transition")
    void testAssignmentReleaseTransition() {
        FieldAssignment assignment = new FieldAssignment("field-1", "farmer-1", List.of("READ"));
        assertEquals(AssignmentStatus.ACTIVE, assignment.getStatus());

        assignment.setStatus(AssignmentStatus.RELEASED);
        assignment.setReleasedByUid("manager-uid-456");
        assignment.setReleaseReason("Contract seasonal completion");
        assignment.setReleasedAt(Instant.now());
        assignment.setVersion(assignment.getVersion() + 1);

        assertEquals(AssignmentStatus.RELEASED, assignment.getStatus());
        assertEquals("manager-uid-456", assignment.getReleasedByUid());
        assertEquals("Contract seasonal completion", assignment.getReleaseReason());
        assertNotNull(assignment.getReleasedAt());
        assertEquals(2, assignment.getVersion());
    }

    @Test
    @DisplayName("[ASGN-DOM-04] AssignmentHistory model event verification")
    void testAssignmentHistoryModel() {
        AssignmentHistory history = new AssignmentHistory();
        history.setHistoryId("asgn_hist_12345");
        history.setAssignmentId("asgn_fld_field-1::farmer-safe-1");
        history.setFieldId("field-1");
        history.setFarmId("farm-1");
        history.setFarmerUid("farmer-uid-1");
        history.setEventType(AssignmentHistory.EventType.ASSIGNED);
        history.setPerformedByUid("owner-uid-1");
        history.setReason("Initial season assignment");
        history.setTimestamp(Instant.now());

        assertEquals("asgn_hist_12345", history.getHistoryId());
        assertEquals("asgn_fld_field-1::farmer-safe-1", history.getAssignmentId());
        assertEquals("ASSIGNED", history.getEventType());
        assertEquals("owner-uid-1", history.getPerformedByUid());
        assertNotNull(history.getTimestamp());
    }
}
