package com.agroai.security;

import com.agroai.model.AssignmentStatus;
import com.agroai.model.FieldAssignment;
import com.agroai.model.Farm;
import com.agroai.model.FarmStatus;
import com.agroai.model.Field;
import com.agroai.model.FieldStatus;
import com.agroai.repository.FieldAssignmentRepository;
import com.agroai.repository.FarmRepository;
import com.agroai.repository.FieldRepository;
import com.agroai.repository.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Contextual security evaluator for field-scoped operations.
 * Enforces that a valid Firebase token alone grants zero field access.
 * Access is granted if and only if the farmer has an ACTIVE assignment.
 */
@Component("fieldSecurity")
public class FieldSecurityEvaluator {

    private final FieldAssignmentRepository assignmentRepository;
    private final FarmRepository farmRepository;
    private final FieldRepository fieldRepository;
    private final UserRepository userRepository;

    public FieldSecurityEvaluator(FieldAssignmentRepository assignmentRepository, FarmRepository farmRepository,
                                  FieldRepository fieldRepository, UserRepository userRepository) {
        this.assignmentRepository = assignmentRepository;
        this.farmRepository = farmRepository;
        this.fieldRepository = fieldRepository;
        this.userRepository = userRepository;
    }

    public boolean hasFieldAccess(Authentication authentication, String fieldId) {
        if (authentication == null || !(authentication.getPrincipal() instanceof FirebaseUserDetails userDetails)) {
            return false;
        }
        Optional<FieldAssignment> assignment = assignmentRepository.findAssignment(fieldId, userDetails.getUid());
        if (assignment.isEmpty() || assignment.get().getStatus() != AssignmentStatus.ACTIVE) return false;
        return hasOperationalLifecycle(assignment.get());
    }

    public boolean canSubmitTelemetry(Authentication authentication, String fieldId) {
        if (authentication == null || !(authentication.getPrincipal() instanceof FirebaseUserDetails userDetails)) {
            return false;
        }
        Optional<FieldAssignment> assignment = assignmentRepository.findAssignment(fieldId, userDetails.getUid());
        if (assignment.isEmpty() || assignment.get().getStatus() != AssignmentStatus.ACTIVE ||
                !hasOperationalLifecycle(assignment.get())) {
            return false;
        }
        // OBSERVER cannot submit telemetry
        return assignment.get().getPermissions().contains("SUBMIT_TELEMETRY") ||
                assignment.get().getPermissions().isEmpty(); // Default active assigned farmer permission
    }

    private boolean hasOperationalLifecycle(FieldAssignment assignment) {
        Farm farm = farmRepository.findById(assignment.getFarmId()).orElse(null);
        Field field = fieldRepository.findById(assignment.getFieldId()).orElse(null);
        var profile = userRepository.findPrivateProfile(assignment.getFarmerUid()).orElse(null);
        return profile != null && profile.getAccountStatus() == com.agroai.model.AccountStatus.ACTIVE &&
                farm != null && farm.getStatus() == FarmStatus.ACTIVE && field != null &&
                field.getFarmId().equals(assignment.getFarmId()) && field.getStatus() == FieldStatus.ACTIVE;
    }
}
