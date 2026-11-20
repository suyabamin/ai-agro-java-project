package com.agroai.monitoring;

import com.agroai.exception.FarmNotFoundException;
import com.agroai.exception.FieldNotFoundException;
import com.agroai.exception.UnauthorizedResourceAccessException;
import com.agroai.model.AccountStatus;
import com.agroai.model.AssignmentStatus;
import com.agroai.model.Farm;
import com.agroai.model.FarmMembership;
import com.agroai.model.FarmRole;
import com.agroai.model.FarmStatus;
import com.agroai.model.Field;
import com.agroai.model.FieldAssignment;
import com.agroai.model.FieldStatus;
import com.agroai.model.MembershipStatus;
import com.agroai.repository.FarmMembershipRepository;
import com.agroai.repository.FarmRepository;
import com.agroai.repository.FieldAssignmentRepository;
import com.agroai.repository.FieldRepository;
import com.agroai.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class MonitoringAuthorizationService {
    private final FarmRepository farms;
    private final FieldRepository fields;
    private final FarmMembershipRepository memberships;
    private final FieldAssignmentRepository assignments;
    private final UserRepository users;

    public MonitoringAuthorizationService(FarmRepository farms, FieldRepository fields,
            FarmMembershipRepository memberships, FieldAssignmentRepository assignments, UserRepository users) {
        this.farms = farms;
        this.fields = fields;
        this.memberships = memberships;
        this.assignments = assignments;
        this.users = users;
    }

    public Field requireReadAccess(String farmId, String fieldId, String uid) {
        Field field = requireMatchingField(farmId, fieldId);
        requireActiveAccount(uid);
        if (!isOperational(farmId, field)) throw new UnauthorizedResourceAccessException("field", fieldId, "Monitoring access requires an ACTIVE farm and field");
        Optional<FarmMembership> membership = memberships.findMembership(farmId, uid);
        if (membership.isPresent() && membership.get().getStatus() == MembershipStatus.ACTIVE) return field;
        FieldAssignment assignment = activeAssignment(fieldId, farmId, uid);
        if (assignment != null && isOperational(farmId, field)) return field;
        throw denied(farmId, "Active farm membership or field assignment is required");
    }

    public Field requireWriteAccess(String farmId, String fieldId, String uid) {
        Field field = requireMatchingField(farmId, fieldId);
        requireActiveAccount(uid);
        Farm farm = farms.findById(farmId).orElseThrow(() -> new FarmNotFoundException(farmId));
        if (farm.getStatus() != FarmStatus.ACTIVE || field.getStatus() != FieldStatus.ACTIVE) {
            throw new UnauthorizedResourceAccessException("field", fieldId, "Monitoring writes require an ACTIVE farm and field");
        }
        Optional<FarmMembership> membership = memberships.findMembership(farmId, uid);
        if (membership.isPresent() && membership.get().getStatus() == MembershipStatus.ACTIVE &&
                (membership.get().getRole() == FarmRole.OWNER || membership.get().getRole() == FarmRole.MANAGER)) return field;
        FieldAssignment assignment = activeAssignment(fieldId, farmId, uid);
        if (assignment != null && (assignment.getPermissions().isEmpty() ||
                assignment.getPermissions().contains("SUBMIT_TELEMETRY"))) return field;
        throw denied(farmId, "OWNER, MANAGER, or an assigned farmer with monitoring permission is required");
    }

    public void requireManager(String farmId, String uid) {
        requireActiveAccount(uid);
        Farm farm = farms.findById(farmId).orElseThrow(() -> new FarmNotFoundException(farmId));
        if (farm.getStatus() != FarmStatus.ACTIVE) throw new UnauthorizedResourceAccessException("farm", farmId, "Monitoring management requires an ACTIVE farm");
        Optional<FarmMembership> membership = memberships.findMembership(farmId, uid);
        if (membership.isEmpty() || membership.get().getStatus() != MembershipStatus.ACTIVE ||
                (membership.get().getRole() != FarmRole.OWNER && membership.get().getRole() != FarmRole.MANAGER)) {
            throw denied(farmId, "Active OWNER or MANAGER membership is required");
        }
    }

    private Field requireMatchingField(String farmId, String fieldId) {
        Farm farm = farms.findById(farmId).orElseThrow(() -> new FarmNotFoundException(farmId));
        Field field = fields.findById(fieldId).orElseThrow(() -> new FieldNotFoundException(fieldId));
        if (!farmId.equals(field.getFarmId())) throw new FieldNotFoundException(fieldId);
        return field;
    }

    private FieldAssignment activeAssignment(String fieldId, String farmId, String uid) {
        FieldAssignment assignment = assignments.findAssignment(fieldId, uid).orElse(null);
        return assignment != null && assignment.getStatus() == AssignmentStatus.ACTIVE && farmId.equals(assignment.getFarmId())
                ? assignment : null;
    }

    private boolean isOperational(String farmId, Field field) {
        Farm farm = farms.findById(farmId).orElse(null);
        return farm != null && farm.getStatus() == FarmStatus.ACTIVE && field.getStatus() == FieldStatus.ACTIVE;
    }

    private void requireActiveAccount(String uid) {
        var profile = users.findPrivateProfile(uid).orElse(null);
        if (profile == null || profile.getAccountStatus() != AccountStatus.ACTIVE) throw denied(uid, "Active account is required");
    }

    private UnauthorizedResourceAccessException denied(String resourceId, String message) {
        return new UnauthorizedResourceAccessException("field monitoring", resourceId, message);
    }
}
