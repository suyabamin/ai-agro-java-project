package com.agroai.service;

import com.agroai.config.FirebaseConfig;
import com.agroai.dto.CreateFieldRequest;
import com.agroai.dto.FieldResponseDTO;
import com.agroai.dto.UpdateFieldRequest;
import com.agroai.exception.DatabaseUnavailableException;
import com.agroai.exception.FarmNotFoundException;
import com.agroai.exception.FieldNotFoundException;
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
import com.agroai.model.MembershipStatus;
import com.agroai.repository.FarmMembershipRepository;
import com.agroai.repository.FarmRepository;
import com.agroai.repository.FieldRepository;
import com.agroai.security.FirebaseUserDetails;
import com.agroai.util.KeyEncoder;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.Transaction;
import com.google.firebase.cloud.FirestoreClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ExecutionException;
import java.util.stream.Collectors;

/**
 * Service managing operational field lifecycle, transactional activeFieldCount synchronization,
 * optimistic concurrency control, and role-based permissions.
 */
@Service
public class FieldService {

    private static final Logger log = LoggerFactory.getLogger(FieldService.class);

    private final FieldRepository fieldRepository;
    private final FarmRepository farmRepository;
    private final FarmMembershipRepository membershipRepository;
    private final PublicFarmProjectionService projectionService;
    private final FirebaseConfig firebaseConfig;
    private final AssignmentLifecycleService assignmentLifecycleService;

    public FieldService(FieldRepository fieldRepository,
                        FarmRepository farmRepository,
                        FarmMembershipRepository membershipRepository,
                        PublicFarmProjectionService projectionService,
                        FirebaseConfig firebaseConfig) {
        this(fieldRepository, farmRepository, membershipRepository, projectionService, firebaseConfig, null);
    }

    @Autowired
    public FieldService(FieldRepository fieldRepository,
                        FarmRepository farmRepository,
                        FarmMembershipRepository membershipRepository,
                        PublicFarmProjectionService projectionService,
                        FirebaseConfig firebaseConfig,
                        AssignmentLifecycleService assignmentLifecycleService) {
        this.fieldRepository = fieldRepository;
        this.farmRepository = farmRepository;
        this.membershipRepository = membershipRepository;
        this.projectionService = projectionService;
        this.firebaseConfig = firebaseConfig;
        this.assignmentLifecycleService = assignmentLifecycleService;
    }

    /**
     * Atomically creates a field within a farm and increments the farm's activeFieldCount.
     * Restricted to active OWNER or MANAGER.
     */
    public FieldResponseDTO createField(String farmId, CreateFieldRequest request, FirebaseUserDetails user) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        verifyManagerOrOwnerRole(cleanFarmId, user.getUid());

        if (request == null) {
            throw new IllegalArgumentException("Create field request cannot be null");
        }

        String fieldId = KeyEncoder.fieldDocId(cleanFarmId, request.localFieldId());

        Field newField = new Field(
                fieldId,
                request.localFieldId().trim(),
                cleanFarmId,
                request.name().trim(),
                request.areaHectares()
        );
        newField.setCropType(request.cropType());
        newField.setSoilType(request.soilType());
        newField.setIrrigationType(request.irrigationType());
        newField.setNotes(request.notes() != null ? request.notes().trim() : null);
        newField.setStatus(FieldStatus.ACTIVE);
        newField.setVersion(1);
        newField.setCreatedAt(Instant.now());
        newField.setUpdatedAt(Instant.now());

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                FieldResponseDTO result = db.runTransaction(transaction -> {
                    Farm farm = farmRepository.findByIdInTransaction(transaction, cleanFarmId);
                    if (farm == null) {
                        throw new FarmNotFoundException(cleanFarmId);
                    }
                    verifyManagerOrOwnerRoleInTransaction(transaction, cleanFarmId, user.getUid());
                    if (farm.getStatus() == FarmStatus.ARCHIVED) {
                        throw new InvalidStateTransitionException("Cannot modify an archived farm");
                    }

                    Field existingField = fieldRepository.findByIdInTransaction(transaction, fieldId);
                    if (existingField != null) {
                        throw new IllegalArgumentException("Field with ID '" + fieldId + "' already exists");
                    }

                    // Invariant update: increment activeFieldCount and farm version
                    farm.setActiveFieldCount(farm.getActiveFieldCount() + 1);
                    farm.setVersion(farm.getVersion() + 1);
                    farm.setUpdatedAt(Instant.now());

                    if (request.cropType() != null) {
                        List<String> crops = farm.getActiveCropTypes() != null ? new ArrayList<>(farm.getActiveCropTypes()) : new ArrayList<>();
                        if (!crops.contains(request.cropType().name())) {
                            crops.add(request.cropType().name());
                            farm.setActiveCropTypes(crops);
                        }
                    }

                    fieldRepository.saveInTransaction(transaction, newField);
                    farmRepository.saveInTransaction(transaction, farm);

                    if (farm.getVisibility() == FarmVisibility.PUBLIC && farm.getStatus() == FarmStatus.ACTIVE) {
                        projectionService.updateProjectionInTransaction(transaction, farm);
                    }

                    return FieldResponseDTO.fromEntity(newField);
                }).get();
                return result;
            } catch (ExecutionException e) {
                if (e.getCause() instanceof FarmNotFoundException fnfe) throw fnfe;
                if (e.getCause() instanceof InvalidStateTransitionException iste) throw iste;
                if (e.getCause() instanceof UnauthorizedResourceAccessException unauthorized) throw unauthorized;
                if (e.getCause() instanceof IllegalArgumentException iae) throw iae;
                log.error("Live Firestore field creation failed for {}: {}", fieldId, e.getMessage());
                throw new DatabaseUnavailableException("Failed to create field: " + e.getMessage(), e);
            } catch (Exception e) {
                log.error("Live Firestore transaction invocation error for {}: {}", fieldId, e.getMessage());
                throw new DatabaseUnavailableException("Failed to execute field creation transaction: " + e.getMessage(), e);
            }
        }

        // In-Memory Mode
        synchronized (this) {
            Farm farm = farmRepository.findById(cleanFarmId)
                    .orElseThrow(() -> new FarmNotFoundException(cleanFarmId));
            if (farm.getStatus() == FarmStatus.ARCHIVED) {
                throw new InvalidStateTransitionException("Cannot modify an archived farm");
            }
            if (fieldRepository.findById(fieldId).isPresent()) {
                throw new IllegalArgumentException("Field with ID '" + fieldId + "' already exists");
            }

            farm.setActiveFieldCount(farm.getActiveFieldCount() + 1);
            farm.setVersion(farm.getVersion() + 1);
            farm.setUpdatedAt(Instant.now());

            if (request.cropType() != null) {
                List<String> crops = farm.getActiveCropTypes() != null ? new ArrayList<>(farm.getActiveCropTypes()) : new ArrayList<>();
                if (!crops.contains(request.cropType().name())) {
                    crops.add(request.cropType().name());
                    farm.setActiveCropTypes(crops);
                }
            }

            fieldRepository.save(newField);
            farmRepository.save(farm);

            if (farm.getVisibility() == FarmVisibility.PUBLIC && farm.getStatus() == FarmStatus.ACTIVE) {
                projectionService.reconcileProjection(farm);
            }

            log.info("Field '{}' created successfully under farm '{}'", fieldId, cleanFarmId);
            return FieldResponseDTO.fromEntity(newField);
        }
    }

    /**
     * Lists fields for a farm. Excludes archived fields by default unless includeArchived is true.
     * Restricted to active farm members.
     */
    public List<FieldResponseDTO> getFields(String farmId, boolean includeArchived, FirebaseUserDetails user) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        verifyActiveMember(cleanFarmId, user.getUid());

        farmRepository.findById(cleanFarmId)
                .orElseThrow(() -> new FarmNotFoundException(cleanFarmId));

        List<Field> fields = includeArchived
                ? fieldRepository.findByFarmId(cleanFarmId)
                : fieldRepository.findActiveByFarmId(cleanFarmId);

        return fields.stream()
                .map(FieldResponseDTO::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * Retrieves single field by ID.
     * Restricted to active farm members.
     */
    public FieldResponseDTO getFieldById(String farmId, String fieldId, FirebaseUserDetails user) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        String cleanFieldId = KeyEncoder.validateFieldId(fieldId);
        verifyActiveMember(cleanFarmId, user.getUid());

        farmRepository.findById(cleanFarmId)
                .orElseThrow(() -> new FarmNotFoundException(cleanFarmId));

        Field field = fieldRepository.findById(cleanFieldId)
                .orElseThrow(() -> new FieldNotFoundException(cleanFieldId));

        if (!cleanFarmId.equals(field.getFarmId())) {
            throw new FieldNotFoundException(cleanFieldId);
        }

        return FieldResponseDTO.fromEntity(field);
    }

    /**
     * Updates field metadata with optimistic concurrency validation.
     * Restricted to active OWNER or MANAGER.
     */
    public FieldResponseDTO updateField(String farmId, String fieldId, UpdateFieldRequest request, FirebaseUserDetails user) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        String cleanFieldId = KeyEncoder.validateFieldId(fieldId);
        verifyManagerOrOwnerRole(cleanFarmId, user.getUid());

        if (request == null) {
            throw new IllegalArgumentException("Update field request payload cannot be null");
        }
        if (request.status() == FieldStatus.ARCHIVED) {
            throw new InvalidStateTransitionException("Field archival must use dedicated archive endpoint");
        }
        if (request.status() == FieldStatus.ACTIVE && assignmentLifecycleService != null && assignmentLifecycleService.isProcessing("field", cleanFieldId)) {
            throw new InvalidStateTransitionException("Cannot reactivate a field while assignment cleanup is processing");
        }

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                FieldResponseDTO result = db.runTransaction(transaction -> {
                    Farm farm = farmRepository.findByIdInTransaction(transaction, cleanFarmId);
                    if (farm == null) {
                        throw new FarmNotFoundException(cleanFarmId);
                    }
                    verifyManagerOrOwnerRoleInTransaction(transaction, cleanFarmId, user.getUid());
                    if (farm.getStatus() == FarmStatus.ARCHIVED) {
                        throw new InvalidStateTransitionException("Cannot modify an archived farm");
                    }

                    Field field = fieldRepository.findByIdInTransaction(transaction, cleanFieldId);
                    if (field == null || !cleanFarmId.equals(field.getFarmId())) {
                        throw new FieldNotFoundException(cleanFieldId);
                    }
                    if (field.getStatus() == FieldStatus.ARCHIVED) {
                        throw new InvalidStateTransitionException("Cannot modify an archived field");
                    }
                    if (field.getVersion() != request.expectedVersion()) {
                        throw new StaleVersionException(request.expectedVersion(), field.getVersion());
                    }

                    FieldStatus priorStatus = field.getStatus();

                    field.setName(request.name().trim());
                    field.setCropType(request.cropType());
                    field.setSoilType(request.soilType());
                    field.setIrrigationType(request.irrigationType());
                    field.setAreaHectares(request.areaHectares());
                    if (request.status() != null) {
                        field.setStatus(request.status());
                    }
                    field.setNotes(request.notes() != null ? request.notes().trim() : null);
                    field.setVersion(field.getVersion() + 1);
                    field.setUpdatedAt(Instant.now());

                    if (priorStatus != field.getStatus()) {
                        farm.setActiveFieldCount(Math.max(0, farm.getActiveFieldCount()
                                + (field.getStatus() == FieldStatus.ACTIVE ? 1 : 0)
                                - (priorStatus == FieldStatus.ACTIVE ? 1 : 0)));
                        farm.setVersion(farm.getVersion() + 1);
                        farm.setUpdatedAt(Instant.now());
                        farmRepository.saveInTransaction(transaction, farm);
                        if (farm.getVisibility() == FarmVisibility.PUBLIC && farm.getStatus() == FarmStatus.ACTIVE) {
                            projectionService.updateProjectionInTransaction(transaction, farm);
                        }
                    }

                    fieldRepository.saveInTransaction(transaction, field);
                    return FieldResponseDTO.fromEntity(field);
                }).get();
                if (request.status() != null && request.status() != FieldStatus.ACTIVE && assignmentLifecycleService != null) {
                    assignmentLifecycleService.releaseFieldAssignments(cleanFarmId, cleanFieldId, user.getUid(), "Field status changed to " + request.status());
                }
                if (request.status() == FieldStatus.ACTIVE && assignmentLifecycleService != null) assignmentLifecycleService.startNewLifecycleCycle("field", cleanFieldId);
                return result;
            } catch (ExecutionException e) {
                if (e.getCause() instanceof FarmNotFoundException fnfe) throw fnfe;
                if (e.getCause() instanceof FieldNotFoundException ffe) throw ffe;
                if (e.getCause() instanceof InvalidStateTransitionException iste) throw iste;
                if (e.getCause() instanceof UnauthorizedResourceAccessException unauthorized) throw unauthorized;
                if (e.getCause() instanceof StaleVersionException sve) throw sve;
                log.error("Live Firestore field update failed for {}: {}", cleanFieldId, e.getMessage());
                throw new DatabaseUnavailableException("Failed to update field: " + e.getMessage(), e);
            } catch (Exception e) {
                log.error("Live Firestore transaction invocation error for {}: {}", cleanFieldId, e.getMessage());
                throw new DatabaseUnavailableException("Failed to execute field update transaction: " + e.getMessage(), e);
            }
        }

        // In-Memory Mode
        synchronized (this) {
            Farm farm = farmRepository.findById(cleanFarmId)
                    .orElseThrow(() -> new FarmNotFoundException(cleanFarmId));
            if (farm.getStatus() == FarmStatus.ARCHIVED) {
                throw new InvalidStateTransitionException("Cannot modify an archived farm");
            }

            Field field = fieldRepository.findById(cleanFieldId)
                    .orElseThrow(() -> new FieldNotFoundException(cleanFieldId));
            if (!cleanFarmId.equals(field.getFarmId())) {
                throw new FieldNotFoundException(cleanFieldId);
            }
            if (field.getStatus() == FieldStatus.ARCHIVED) {
                throw new InvalidStateTransitionException("Cannot modify an archived field");
            }
            if (field.getVersion() != request.expectedVersion()) {
                throw new StaleVersionException(request.expectedVersion(), field.getVersion());
            }

            FieldStatus priorStatus = field.getStatus();

            field.setName(request.name().trim());
            field.setCropType(request.cropType());
            field.setSoilType(request.soilType());
            field.setIrrigationType(request.irrigationType());
            field.setAreaHectares(request.areaHectares());
            if (request.status() != null) {
                field.setStatus(request.status());
            }
            field.setNotes(request.notes() != null ? request.notes().trim() : null);
            field.setVersion(field.getVersion() + 1);
            field.setUpdatedAt(Instant.now());

            if (priorStatus != field.getStatus()) {
                farm.setActiveFieldCount(Math.max(0, farm.getActiveFieldCount()
                        + (field.getStatus() == FieldStatus.ACTIVE ? 1 : 0)
                        - (priorStatus == FieldStatus.ACTIVE ? 1 : 0)));
                farm.setVersion(farm.getVersion() + 1);
                farm.setUpdatedAt(Instant.now());
                farmRepository.save(farm);
                if (farm.getVisibility() == FarmVisibility.PUBLIC && farm.getStatus() == FarmStatus.ACTIVE) {
                    projectionService.reconcileProjection(farm);
                }
            }

            fieldRepository.save(field);
            if (request.status() != null && request.status() != FieldStatus.ACTIVE && assignmentLifecycleService != null) {
                assignmentLifecycleService.releaseFieldAssignments(cleanFarmId, cleanFieldId, user.getUid(), "Field status changed to " + request.status());
            }
            if (request.status() == FieldStatus.ACTIVE && assignmentLifecycleService != null) assignmentLifecycleService.startNewLifecycleCycle("field", cleanFieldId);
            return FieldResponseDTO.fromEntity(field);
        }
    }

    /**
     * Soft-archives a field and atomically decrements the farm's activeFieldCount.
     * Restricted to active OWNER.
     */
    public void archiveField(String farmId, String fieldId, Integer expectedVersion, FirebaseUserDetails user) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        String cleanFieldId = KeyEncoder.validateFieldId(fieldId);
        verifyOwnerRole(cleanFarmId, user.getUid());

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                db.runTransaction(transaction -> {
                    Farm farm = farmRepository.findByIdInTransaction(transaction, cleanFarmId);
                    if (farm == null) {
                        throw new FarmNotFoundException(cleanFarmId);
                    }
                    verifyOwnerRoleInTransaction(transaction, cleanFarmId, user.getUid());
                    if (farm.getStatus() == FarmStatus.ARCHIVED) {
                        throw new InvalidStateTransitionException("Cannot modify an archived farm");
                    }

                    Field field = fieldRepository.findByIdInTransaction(transaction, cleanFieldId);
                    if (field == null || !cleanFarmId.equals(field.getFarmId())) {
                        throw new FieldNotFoundException(cleanFieldId);
                    }

                    if (field.getStatus() == FieldStatus.ARCHIVED) {
                        return null; // Idempotent
                    }

                    if (expectedVersion != null && field.getVersion() != expectedVersion) {
                        throw new StaleVersionException(expectedVersion, field.getVersion());
                    }

                    field.setStatus(FieldStatus.ARCHIVED);
                    field.setArchivedAt(Instant.now());
                    field.setVersion(field.getVersion() + 1);
                    field.setUpdatedAt(Instant.now());

                    // Invariant update: decrement activeFieldCount (floor at 0) and increment farm version
                    int currentCount = farm.getActiveFieldCount();
                    farm.setActiveFieldCount(Math.max(0, currentCount - 1));
                    farm.setVersion(farm.getVersion() + 1);
                    farm.setUpdatedAt(Instant.now());

                    fieldRepository.saveInTransaction(transaction, field);
                    farmRepository.saveInTransaction(transaction, farm);

                    if (farm.getVisibility() == FarmVisibility.PUBLIC && farm.getStatus() == FarmStatus.ACTIVE) {
                        projectionService.updateProjectionInTransaction(transaction, farm);
                    }

                    return null;
                }).get();
                if (assignmentLifecycleService != null) assignmentLifecycleService.releaseFieldAssignments(cleanFarmId, cleanFieldId, user.getUid(), "Field archived");
                return;
            } catch (ExecutionException e) {
                if (e.getCause() instanceof FarmNotFoundException fnfe) throw fnfe;
                if (e.getCause() instanceof FieldNotFoundException ffe) throw ffe;
                if (e.getCause() instanceof InvalidStateTransitionException iste) throw iste;
                if (e.getCause() instanceof UnauthorizedResourceAccessException unauthorized) throw unauthorized;
                if (e.getCause() instanceof StaleVersionException sve) throw sve;
                log.error("Live Firestore field archival failed for {}: {}", cleanFieldId, e.getMessage());
                throw new DatabaseUnavailableException("Failed to archive field: " + e.getMessage(), e);
            } catch (Exception e) {
                log.error("Live Firestore transaction invocation error for {}: {}", cleanFieldId, e.getMessage());
                throw new DatabaseUnavailableException("Failed to execute field archival transaction: " + e.getMessage(), e);
            }
        }

        // In-Memory Mode
        synchronized (this) {
            Farm farm = farmRepository.findById(cleanFarmId)
                    .orElseThrow(() -> new FarmNotFoundException(cleanFarmId));
            if (farm.getStatus() == FarmStatus.ARCHIVED) {
                throw new InvalidStateTransitionException("Cannot modify an archived farm");
            }

            Field field = fieldRepository.findById(cleanFieldId)
                    .orElseThrow(() -> new FieldNotFoundException(cleanFieldId));
            if (!cleanFarmId.equals(field.getFarmId())) {
                throw new FieldNotFoundException(cleanFieldId);
            }

            if (field.getStatus() == FieldStatus.ARCHIVED) {
                if (assignmentLifecycleService != null) assignmentLifecycleService.releaseFieldAssignments(cleanFarmId, cleanFieldId, user.getUid(), "Field archived");
                return;
            }

            if (expectedVersion != null && field.getVersion() != expectedVersion) {
                throw new StaleVersionException(expectedVersion, field.getVersion());
            }

            field.setStatus(FieldStatus.ARCHIVED);
            field.setArchivedAt(Instant.now());
            field.setVersion(field.getVersion() + 1);
            field.setUpdatedAt(Instant.now());

            int currentCount = farm.getActiveFieldCount();
            farm.setActiveFieldCount(Math.max(0, currentCount - 1));
            farm.setVersion(farm.getVersion() + 1);
            farm.setUpdatedAt(Instant.now());

            fieldRepository.save(field);
            farmRepository.save(farm);

            if (farm.getVisibility() == FarmVisibility.PUBLIC && farm.getStatus() == FarmStatus.ACTIVE) {
                projectionService.reconcileProjection(farm);
            }

            if (assignmentLifecycleService != null) assignmentLifecycleService.releaseFieldAssignments(cleanFarmId, cleanFieldId, user.getUid(), "Field archived");

            log.info("Field '{}' archived successfully under farm '{}'", cleanFieldId, cleanFarmId);
        }
    }

    private FarmRole verifyManagerOrOwnerRole(String farmId, String uid) {
        Optional<FarmMembership> m = membershipRepository.findMembership(farmId, uid);
        if (m.isEmpty() || m.get().getStatus() != MembershipStatus.ACTIVE ||
                (m.get().getRole() != FarmRole.OWNER && m.get().getRole() != FarmRole.MANAGER)) {
            throw new UnauthorizedResourceAccessException("farm", farmId, "Only an active OWNER or MANAGER can manage fields");
        }
        return m.get().getRole();
    }

    private void verifyManagerOrOwnerRoleInTransaction(Transaction transaction, String farmId, String uid) {
        FarmMembership membership = membershipRepository.findMembershipInTransaction(transaction, farmId, uid)
                .orElseThrow(() -> new UnauthorizedResourceAccessException("farm", farmId, "Active OWNER or MANAGER membership is required"));
        if (membership.getStatus() != MembershipStatus.ACTIVE ||
                (membership.getRole() != FarmRole.OWNER && membership.getRole() != FarmRole.MANAGER)) {
            throw new UnauthorizedResourceAccessException("farm", farmId, "Active OWNER or MANAGER membership is required");
        }
    }

    private void verifyOwnerRoleInTransaction(Transaction transaction, String farmId, String uid) {
        FarmMembership membership = membershipRepository.findMembershipInTransaction(transaction, farmId, uid)
                .orElseThrow(() -> new UnauthorizedResourceAccessException("farm", farmId, "Active OWNER membership is required"));
        if (membership.getStatus() != MembershipStatus.ACTIVE || membership.getRole() != FarmRole.OWNER) {
            throw new UnauthorizedResourceAccessException("farm", farmId, "Active OWNER membership is required");
        }
    }

    private void verifyOwnerRole(String farmId, String uid) {
        Optional<FarmMembership> m = membershipRepository.findMembership(farmId, uid);
        if (m.isEmpty() || m.get().getStatus() != MembershipStatus.ACTIVE || m.get().getRole() != FarmRole.OWNER) {
            throw new UnauthorizedResourceAccessException("farm", farmId, "Only an active OWNER can archive fields");
        }
    }

    private void verifyActiveMember(String farmId, String uid) {
        Optional<FarmMembership> m = membershipRepository.findMembership(farmId, uid);
        if (m.isEmpty() || m.get().getStatus() != MembershipStatus.ACTIVE) {
            throw new UnauthorizedResourceAccessException("farm", farmId, "Active membership is required to access field details");
        }
    }
}
