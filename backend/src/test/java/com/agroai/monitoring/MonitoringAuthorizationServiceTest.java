package com.agroai.monitoring;

import com.agroai.exception.UnauthorizedResourceAccessException;
import com.agroai.model.*;
import com.agroai.repository.*;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class MonitoringAuthorizationServiceTest {
    @Test
    void permitsReadForActiveMembershipOnOperationalField() {
        Fixture f = new Fixture();
        when(f.memberships.findMembership("farm-1", "user-1")).thenReturn(Optional.of(
                new FarmMembership("membership-1", "farm-1", "user-1", FarmRole.OBSERVER, MembershipStatus.ACTIVE)));
        assertSame(f.field, f.service.requireReadAccess("farm-1", "field-1", "user-1"));
    }

    @Test
    void deniesUnassignedUserAndReleasedAssignment() {
        Fixture f = new Fixture();
        when(f.memberships.findMembership("farm-1", "user-1")).thenReturn(Optional.empty());
        when(f.assignments.findAssignment("field-1", "user-1")).thenReturn(Optional.of(
                new FieldAssignment("assignment-1", "farm-1", "field-1", "user-1", AssignmentStatus.RELEASED)));
        assertThrows(UnauthorizedResourceAccessException.class, () -> f.service.requireReadAccess("farm-1", "field-1", "user-1"));
    }

    @Test
    void deniesActiveAssignmentWithoutMonitoringPermission() {
        Fixture f = new Fixture();
        when(f.memberships.findMembership("farm-1", "user-1")).thenReturn(Optional.empty());
        FieldAssignment assignment = new FieldAssignment("assignment-1", "farm-1", "field-1", "user-1", AssignmentStatus.ACTIVE);
        assignment.setPermissions(java.util.List.of("READ"));
        when(f.assignments.findAssignment("field-1", "user-1")).thenReturn(Optional.of(assignment));
        assertThrows(UnauthorizedResourceAccessException.class, () -> f.service.requireWriteAccess("farm-1", "field-1", "user-1"));
    }

    @Test
    void permitsWriteForActiveAssignmentWithWriteLogsPermission() {
        Fixture f = new Fixture();
        when(f.memberships.findMembership("farm-1", "user-1")).thenReturn(Optional.empty());
        FieldAssignment assignment = new FieldAssignment("assignment-1", "farm-1", "field-1", "user-1", AssignmentStatus.ACTIVE);
        assignment.setPermissions(java.util.List.of("READ", "WRITE_LOGS"));
        when(f.assignments.findAssignment("field-1", "user-1")).thenReturn(Optional.of(assignment));
        assertSame(f.field, f.service.requireWriteAccess("farm-1", "field-1", "user-1"));
    }

    @Test
    void permitsWriteForActiveAssignmentWithTelemetryPermission() {
        Fixture f = new Fixture();
        when(f.memberships.findMembership("farm-1", "user-1")).thenReturn(Optional.empty());
        FieldAssignment assignment = new FieldAssignment("assignment-1", "farm-1", "field-1", "user-1", AssignmentStatus.ACTIVE);
        assignment.setPermissions(java.util.List.of("READ", "WRITE_LOGS", "TELEMETRY"));
        when(f.assignments.findAssignment("field-1", "user-1")).thenReturn(Optional.of(assignment));
        assertSame(f.field, f.service.requireWriteAccess("farm-1", "field-1", "user-1"));
    }

    @Test
    void permitsWriteForActiveAssignmentWithSubmitTelemetryPermission() {
        Fixture f = new Fixture();
        when(f.memberships.findMembership("farm-1", "user-1")).thenReturn(Optional.empty());
        FieldAssignment assignment = new FieldAssignment("assignment-1", "farm-1", "field-1", "user-1", AssignmentStatus.ACTIVE);
        assignment.setPermissions(java.util.List.of("SUBMIT_TELEMETRY"));
        when(f.assignments.findAssignment("field-1", "user-1")).thenReturn(Optional.of(assignment));
        assertSame(f.field, f.service.requireWriteAccess("farm-1", "field-1", "user-1"));
    }

    @Test
    void permitsWriteWhenCompositeFieldIdIsResolvedFromLocalFieldId() {
        Fixture f = new Fixture();
        when(f.memberships.findMembership("farm-1", "user-1")).thenReturn(Optional.empty());
        // Direct lookup for local-1 fails, but composite lookup farm-1--local-1 succeeds
        when(f.fields.findById("local-1")).thenReturn(Optional.empty());
        when(f.fields.findById("farm-1--local-1")).thenReturn(Optional.of(f.field));
        FieldAssignment assignment = new FieldAssignment("assignment-1", "farm-1", "field-1", "user-1", AssignmentStatus.ACTIVE);
        assignment.setPermissions(java.util.List.of("WRITE_LOGS"));
        when(f.assignments.findAssignment("field-1", "user-1")).thenReturn(Optional.of(assignment));

        Field resolved = f.service.requireWriteAccess("farm-1", "local-1", "user-1");
        assertSame(f.field, resolved);
    }

    @Test
    void deniesWriteWhenFieldBelongsToDifferentFarm() {
        Fixture f = new Fixture();
        Field foreignField = new Field("field-2", "local-2", "foreign-farm", "Foreign Field", 2.0);
        when(f.fields.findById("field-2")).thenReturn(Optional.of(foreignField));
        assertThrows(com.agroai.exception.FieldNotFoundException.class, () -> f.service.requireWriteAccess("farm-1", "field-2", "user-1"));
    }

    @Test
    void deniesMonitoringReadsWhenFarmIsSuspended() {
        Fixture f = new Fixture();
        f.farm.setStatus(FarmStatus.SUSPENDED);
        when(f.memberships.findMembership("farm-1", "user-1")).thenReturn(Optional.of(
                new FarmMembership("membership-1", "farm-1", "user-1", FarmRole.OWNER, MembershipStatus.ACTIVE)));
        assertThrows(UnauthorizedResourceAccessException.class, () -> f.service.requireReadAccess("farm-1", "field-1", "user-1"));
    }

    private static final class Fixture {
        final FarmRepository farms = mock(FarmRepository.class);
        final FieldRepository fields = mock(FieldRepository.class);
        final FarmMembershipRepository memberships = mock(FarmMembershipRepository.class);
        final FieldAssignmentRepository assignments = mock(FieldAssignmentRepository.class);
        final UserRepository users = mock(UserRepository.class);
        final Farm farm = new Farm();
        final Field field = new Field("field-1", "local-1", "farm-1", "Field", 1.0);
        final MonitoringAuthorizationService service = new MonitoringAuthorizationService(farms, fields, memberships, assignments, users);

        Fixture() {
            farm.setFarmId("farm-1");
            when(farms.findById("farm-1")).thenReturn(Optional.of(farm));
            when(fields.findById("field-1")).thenReturn(Optional.of(field));
            when(users.findPrivateProfile("user-1")).thenReturn(Optional.of(new UserProfile("user-1", "user@example.test", "User")));
            when(assignments.findAssignment("field-1", "user-1")).thenReturn(Optional.empty());
        }
    }
}
