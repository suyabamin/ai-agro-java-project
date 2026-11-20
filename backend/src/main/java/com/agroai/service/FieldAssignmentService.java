package com.agroai.service;

import com.agroai.config.FirebaseConfig;
import com.agroai.dto.AssignmentHistoryResponseDTO;
import com.agroai.dto.CreateAssignmentRequest;
import com.agroai.dto.FieldAssignmentResponseDTO;
import com.agroai.dto.CursorPageResponse;
import com.agroai.dto.ReassignFarmerRequest;
import com.agroai.dto.ReleaseAssignmentRequest;
import com.agroai.exception.ApplicationNotFoundException;
import com.agroai.exception.AssignmentNotFoundException;
import com.agroai.exception.DatabaseUnavailableException;
import com.agroai.exception.DuplicateAssignmentException;
import com.agroai.exception.FarmNotFoundException;
import com.agroai.exception.FieldNotFoundException;
import com.agroai.exception.InvalidStateTransitionException;
import com.agroai.exception.StaleVersionException;
import com.agroai.exception.UnauthorizedResourceAccessException;
import com.agroai.model.ApplicationStatus;
import com.agroai.model.AccountStatus;
import com.agroai.model.AssignmentHistory;
import com.agroai.model.AssignmentStatus;
import com.agroai.model.Farm;
import com.agroai.model.FarmMembership;
import com.agroai.model.FarmRole;
import com.agroai.model.FarmStatus;
import com.agroai.model.Field;
import com.agroai.model.FieldAssignment;
import com.agroai.model.FieldStatus;
import com.agroai.model.JobApplication;
import com.agroai.model.MembershipStatus;
import com.agroai.model.UserProfile;
import com.agroai.repository.AssignmentHistoryRepository;
import com.agroai.repository.CursorPage;
import com.agroai.repository.FarmMembershipRepository;
import com.agroai.repository.FarmRepository;
import com.agroai.repository.FieldAssignmentRepository;
import com.agroai.repository.FieldRepository;
import com.agroai.repository.JobApplicationRepository;
import com.agroai.repository.UserRepository;
import com.agroai.util.KeyEncoder;
import com.agroai.util.CursorPagination;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.Transaction;
import com.google.firebase.cloud.FirestoreClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service managing farmer-to-field assignment lifecycle, authorization enforcement,
 * transactional conflict detection, and audit history.
 */
@Service
public class FieldAssignmentService {

    private static final Logger log = LoggerFactory.getLogger(FieldAssignmentService.class);

    private final FieldAssignmentRepository assignmentRepository;
    private final AssignmentHistoryRepository historyRepository;
    private final FarmRepository farmRepository;
    private final FieldRepository fieldRepository;
    private final FarmMembershipRepository membershipRepository;
    private final UserRepository userRepository;
    private final JobApplicationRepository applicationRepository;
    private final FirebaseConfig firebaseConfig;

    public FieldAssignmentService(FieldAssignmentRepository assignmentRepository,
                                  AssignmentHistoryRepository historyRepository,
                                  FarmRepository farmRepository,
                                  FieldRepository fieldRepository,
                                  FarmMembershipRepository membershipRepository,
                                  UserRepository userRepository,
                                  JobApplicationRepository applicationRepository,
                                  FirebaseConfig firebaseConfig) {
        this.assignmentRepository = assignmentRepository;
        this.historyRepository = historyRepository;
        this.farmRepository = farmRepository;
        this.fieldRepository = fieldRepository;
        this.membershipRepository = membershipRepository;
        this.userRepository = userRepository;
        this.applicationRepository = applicationRepository;
        this.firebaseConfig = firebaseConfig;
    }

    /**
     * Explicitly assigns a farmer to a field.
     * Enforces that candidate approval alone NEVER automatically creates a field assignment.
     */
    public FieldAssignmentResponseDTO createAssignment(String farmId, String fieldId, CreateAssignmentRequest request, String actorUid) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        String cleanFieldId = KeyEncoder.validateFieldId(fieldId);
        FarmRole actorRole = verifyManagerOrOwnerRole(cleanFarmId, actorUid);

        if (request == null || request.farmerUid() == null || request.farmerUid().trim().isEmpty()) {
            throw new IllegalArgumentException("Farmer UID is required for assignment");
        }
        String farmerUid = request.farmerUid().trim();
        String safeFarmerUid = KeyEncoder.encodeUid(farmerUid);
        String assignmentDocId = KeyEncoder.newAssignmentTenureId();

        UserProfile farmerProfile = userRepository.findPrivateProfile(farmerUid)
                .orElseThrow(() -> new IllegalArgumentException("Farmer account does not exist or has no initialized profile"));
        if (farmerProfile.getAccountStatus() != AccountStatus.ACTIVE) {
            throw new IllegalArgumentException("Farmer account is not active");
        }

        // Optional application link validation
        if (request.sourceApplicationId() != null && !request.sourceApplicationId().trim().isEmpty()) {
            JobApplication app = applicationRepository.findById(request.sourceApplicationId().trim())
                    .orElseThrow(() -> new ApplicationNotFoundException(request.sourceApplicationId()));
            if (!cleanFarmId.equals(app.getFarmId())) {
                throw new IllegalArgumentException("Linked job application does not belong to farm: " + cleanFarmId);
            }
            if (!farmerUid.equals(app.getApplicantUid())) {
                throw new IllegalArgumentException("Linked job application does not belong to the selected farmer");
            }
            if (request.sourceJobId() != null && !request.sourceJobId().equals(app.getJobId())) {
                throw new IllegalArgumentException("Linked job application does not match the supplied job");
            }
            if (app.getStatus() != ApplicationStatus.APPROVED) {
                throw new InvalidStateTransitionException("Candidate application must be in APPROVED status to be linked to a field assignment");
            }
        }

        // Live Firestore transactional path
        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                return db.runTransaction(transaction -> {
                    FarmRole txActorRole = verifyManagerOrOwnerRoleInTransaction(transaction, cleanFarmId, actorUid);
                    Farm farm = farmRepository.findByIdInTransaction(transaction, cleanFarmId);
                    if (farm == null) {
                        throw new FarmNotFoundException(cleanFarmId);
                    }
                    if (farm.getStatus() != FarmStatus.ACTIVE) {
                        throw new InvalidStateTransitionException("Assignments require an active farm");
                    }

                    Field field = fieldRepository.findByIdInTransaction(transaction, cleanFieldId);
                    if (field == null) {
                        throw new FieldNotFoundException(cleanFieldId);
                    }
                    if (!cleanFarmId.equals(field.getFarmId())) {
                        throw new FieldNotFoundException(cleanFieldId);
                    }
                    if (field.getStatus() == FieldStatus.ARCHIVED) {
                        throw new InvalidStateTransitionException("Cannot assign farmers to an archived field");
                    }

                    UserProfile txFarmerProfile = userRepository.findPrivateProfileInTransaction(transaction, farmerUid)
                            .filter(profile -> profile.getAccountStatus() == AccountStatus.ACTIVE)
                            .orElseThrow(() -> new IllegalArgumentException("Farmer account does not exist or is not active"));

                    if (request.sourceApplicationId() != null && !request.sourceApplicationId().isBlank()) {
                        JobApplication txApplication = applicationRepository.findByIdInTransaction(
                                transaction, request.sourceApplicationId().trim());
                        validateApprovedApplication(txApplication, cleanFarmId, farmerUid, request.sourceJobId());
                    }

                    FieldAssignment existing = assignmentRepository.findActivePairInTransaction(transaction, cleanFieldId, farmerUid);
                    if (existing != null && existing.getStatus() == AssignmentStatus.ACTIVE) {
                        throw DuplicateAssignmentException.forFarmerAndField(farmerUid, cleanFieldId);
                    }
                    FieldAssignment assignment = new FieldAssignment();
                    populateAssignmentEntity(assignment, assignmentDocId, cleanFarmId, cleanFieldId, farmerUid,
                            safeFarmerUid, request, actorUid, false, txFarmerProfile);

                    assignmentRepository.saveInTransaction(transaction, assignment);
                    assignmentRepository.writeActivePairLockInTransaction(transaction, assignment);

                    AssignmentHistory history = buildHistoryRecord(assignment, AssignmentHistory.EventType.ASSIGNED.name(),
                            actorUid, txActorRole.name(), "Farmer assigned to field", request.sourceApplicationId());
                    historyRepository.saveInTransaction(transaction, history);

                    log.info("Field assignment '{}' created successfully in live Firestore", assignmentDocId);
                    return FieldAssignmentResponseDTO.fromEntity(assignment);
                }).get();
            } catch (Exception e) {
                Throwable cause = e.getCause() != null ? e.getCause() : e;
                if (cause instanceof DuplicateAssignmentException dae) throw dae;
                if (cause instanceof FarmNotFoundException fnf) throw fnf;
                if (cause instanceof FieldNotFoundException fnf) throw fnf;
                if (cause instanceof InvalidStateTransitionException ist) throw ist;
                if (cause instanceof IllegalArgumentException iae) throw iae;
                log.error("Live Firestore assignment transaction failed: {}", cause.getMessage());
                throw new DatabaseUnavailableException("Assignment transaction failed: " + cause.getMessage(), cause);
            }
        }

        // In-Memory Dev Mode
        synchronized (this) {
            Farm farm = farmRepository.findById(cleanFarmId)
                    .orElseThrow(() -> new FarmNotFoundException(cleanFarmId));
            if (farm.getStatus() != FarmStatus.ACTIVE) {
                throw new InvalidStateTransitionException("Assignments require an active farm");
            }

            Field field = fieldRepository.findById(cleanFieldId)
                    .orElseThrow(() -> new FieldNotFoundException(cleanFieldId));
            if (!cleanFarmId.equals(field.getFarmId())) {
                throw new FieldNotFoundException(cleanFieldId);
            }
            if (field.getStatus() == FieldStatus.ARCHIVED) {
                throw new InvalidStateTransitionException("Cannot assign farmers to an archived field");
            }

            Optional<FieldAssignment> existingOpt = assignmentRepository.findAssignment(cleanFieldId, farmerUid);
            if (existingOpt.isPresent() && existingOpt.get().getStatus() == AssignmentStatus.ACTIVE) {
                throw DuplicateAssignmentException.forFarmerAndField(farmerUid, cleanFieldId);
            }

            FieldAssignment assignment = new FieldAssignment();
            populateAssignmentEntity(assignment, assignmentDocId, cleanFarmId, cleanFieldId, farmerUid,
                    safeFarmerUid, request, actorUid, false, farmerProfile);

            assignmentRepository.save(assignment);
            assignmentRepository.writeActivePairLockInTransaction(null, assignment);

            AssignmentHistory history = buildHistoryRecord(assignment, AssignmentHistory.EventType.ASSIGNED.name(),
                    actorUid, actorRole.name(), "Farmer assigned to field", request.sourceApplicationId());
            historyRepository.save(history);

            log.info("Field assignment '{}' created successfully in memory", assignmentDocId);
            return FieldAssignmentResponseDTO.fromEntity(assignment);
        }
    }

    /**
     * Releases a farmer from a field assignment.
     * Immediately revokes field operational access across Spring Security and Firestore rules.
     */
    public FieldAssignmentResponseDTO releaseAssignment(String farmId, String fieldId, String assignmentId,
                                                        ReleaseAssignmentRequest request, String actorUid) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        String cleanFieldId = KeyEncoder.validateFieldId(fieldId);
        FarmRole actorRole = verifyManagerOrOwnerRole(cleanFarmId, actorUid);

        if (request == null) {
            throw new IllegalArgumentException("Release request payload is required");
        }
        String reason = request.releaseReason() == null || request.releaseReason().isBlank()
                ? null : request.releaseReason().trim();

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                return db.runTransaction(transaction -> {
                    FarmRole txActorRole = verifyManagerOrOwnerRoleInTransaction(transaction, cleanFarmId, actorUid);
                    Farm farm = farmRepository.findByIdInTransaction(transaction, cleanFarmId);
                    Field field = fieldRepository.findByIdInTransaction(transaction, cleanFieldId);
                    if (farm == null || field == null || !cleanFarmId.equals(field.getFarmId())) {
                        throw AssignmentNotFoundException.forId(assignmentId);
                    }
                    FieldAssignment assignment = assignmentRepository.findByIdInTransaction(transaction, assignmentId);
                    if (assignment == null || !cleanFarmId.equals(assignment.getFarmId()) ||
                            !cleanFieldId.equals(assignment.getFieldId())) {
                        throw AssignmentNotFoundException.forId(assignmentId);
                    }
                    if (assignment.getStatus() == AssignmentStatus.RELEASED) {
                        return FieldAssignmentResponseDTO.fromEntity(assignment);
                    }
                    if (request.expectedVersion() != null &&
                            !request.expectedVersion().equals(assignment.getVersion())) {
                        throw new StaleVersionException(request.expectedVersion(), assignment.getVersion());
                    }

                    Instant now = Instant.now();
                    assignment.setStatus(AssignmentStatus.RELEASED);
                    assignment.setReleasedByUid(actorUid);
                    assignment.setReleasedAt(now);
                    assignment.setReleaseReason(reason);
                    assignment.setVersion(assignment.getVersion() + 1);
                    assignment.setUpdatedAt(now);
                    assignmentRepository.removeActivePairLockInTransaction(transaction, assignment);
                    assignmentRepository.saveInTransaction(transaction, assignment);
                    historyRepository.saveInTransaction(transaction,
                            buildHistoryRecord(assignment, AssignmentHistory.EventType.RELEASED.name(),
                                    actorUid, txActorRole.name(), reason,
                                    assignment.getSourceApplicationId()));
                    return FieldAssignmentResponseDTO.fromEntity(assignment);
                }).get();
            } catch (Exception e) {
                Throwable cause = e.getCause() != null ? e.getCause() : e;
                if (cause instanceof AssignmentNotFoundException notFound) throw notFound;
                if (cause instanceof StaleVersionException stale) throw stale;
                if (cause instanceof IllegalArgumentException invalid) throw invalid;
                log.error("Live Firestore assignment release transaction failed: {}", cause.getMessage());
                throw new DatabaseUnavailableException("Assignment release transaction failed: " + cause.getMessage(), cause);
            }
        }

        synchronized (this) {
            FieldAssignment assignment = resolveAssignment(cleanFarmId, cleanFieldId, assignmentId);

            if (assignment.getStatus() == AssignmentStatus.RELEASED) {
                return FieldAssignmentResponseDTO.fromEntity(assignment); // Idempotent
            }

            if (request.expectedVersion() != null && !request.expectedVersion().equals(assignment.getVersion())) {
                throw new StaleVersionException(request.expectedVersion(), assignment.getVersion());
            }

            assignment.setStatus(AssignmentStatus.RELEASED);
            assignment.setReleasedByUid(actorUid);
            assignment.setReleasedAt(Instant.now());
            assignment.setReleaseReason(reason);
            assignment.setVersion(assignment.getVersion() + 1);
            assignment.setUpdatedAt(Instant.now());

            assignmentRepository.save(assignment);
            assignmentRepository.removeActivePairLockInTransaction(null, assignment);

            AssignmentHistory history = buildHistoryRecord(assignment, AssignmentHistory.EventType.RELEASED.name(),
                    actorUid, actorRole.name(), reason, assignment.getSourceApplicationId());
            historyRepository.save(history);

            log.info("Field assignment '{}' released successfully by actor '{}'", assignment.getAssignmentId(), actorUid);
            return FieldAssignmentResponseDTO.fromEntity(assignment);
        }
    }

    /**
     * Atomically reassigns a field to a new farmer, archiving the outgoing assignment.
     */
    public FieldAssignmentResponseDTO reassignFarmer(String farmId, String fieldId, String assignmentId,
                                                     ReassignFarmerRequest request, String actorUid) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        String cleanFieldId = KeyEncoder.validateFieldId(fieldId);
        FarmRole actorRole = verifyManagerOrOwnerRole(cleanFarmId, actorUid);

        if (request == null || request.newFarmerUid() == null || request.newFarmerUid().trim().isEmpty()) {
            throw new IllegalArgumentException("New farmer UID is required for reassignment");
        }

        String nextFarmerUid = request.newFarmerUid().trim();
        String nextFarmerSafeUid = KeyEncoder.encodeUid(nextFarmerUid);
        userRepository.findPrivateProfile(nextFarmerUid)
                .filter(profile -> profile.getAccountStatus() == AccountStatus.ACTIVE)
                .orElseThrow(() -> new IllegalArgumentException("New farmer account does not exist or is not active"));
        if (request.sourceApplicationId() != null && !request.sourceApplicationId().isBlank()) {
            JobApplication application = applicationRepository.findById(request.sourceApplicationId().trim())
                    .orElseThrow(() -> new ApplicationNotFoundException(request.sourceApplicationId()));
            if (!cleanFarmId.equals(application.getFarmId()) || !nextFarmerUid.equals(application.getApplicantUid())) {
                throw new IllegalArgumentException("Approved application must belong to the reassigned farmer and farm");
            }
            if (application.getStatus() != ApplicationStatus.APPROVED) {
                throw new InvalidStateTransitionException("Candidate application must be APPROVED before assignment");
            }
        }

        if (firebaseConfig.isInitialized()) {
            String incomingId = KeyEncoder.newAssignmentTenureId();
            CreateAssignmentRequest incomingRequest = new CreateAssignmentRequest(nextFarmerUid,
                    request.permissions(), request.sourceApplicationId(), null);
            if (request.sourceApplicationId() != null && !request.sourceApplicationId().isBlank()) {
                JobApplication application = applicationRepository.findById(request.sourceApplicationId().trim())
                        .orElseThrow(() -> new ApplicationNotFoundException(request.sourceApplicationId()));
                if (!cleanFarmId.equals(application.getFarmId()) || !nextFarmerUid.equals(application.getApplicantUid())) {
                    throw new IllegalArgumentException("Approved application must belong to the reassigned farmer and farm");
                }
                if (application.getStatus() != ApplicationStatus.APPROVED) {
                    throw new InvalidStateTransitionException("Candidate application must be APPROVED before assignment");
                }
                incomingRequest = new CreateAssignmentRequest(nextFarmerUid, request.permissions(),
                        application.getApplicationId(), application.getJobId());
            }

            try {
                CreateAssignmentRequest finalIncomingRequest = incomingRequest;
                Firestore db = FirestoreClient.getFirestore();
                return db.runTransaction(transaction -> {
                    FarmRole txActorRole = verifyManagerOrOwnerRoleInTransaction(transaction, cleanFarmId, actorUid);
                    Farm farm = farmRepository.findByIdInTransaction(transaction, cleanFarmId);
                    if (farm == null) throw new FarmNotFoundException(cleanFarmId);
                    if (farm.getStatus() != FarmStatus.ACTIVE) {
                        throw new InvalidStateTransitionException("Assignments require an active farm");
                    }
                    Field field = fieldRepository.findByIdInTransaction(transaction, cleanFieldId);
                    if (field == null || !cleanFarmId.equals(field.getFarmId())) throw new FieldNotFoundException(cleanFieldId);
                    if (field.getStatus() == FieldStatus.ARCHIVED) {
                        throw new InvalidStateTransitionException("Cannot reassign farmers on an archived field");
                    }
                    UserProfile txTargetProfile = userRepository.findPrivateProfileInTransaction(transaction, nextFarmerUid)
                            .filter(profile -> profile.getAccountStatus() == AccountStatus.ACTIVE)
                            .orElseThrow(() -> new IllegalArgumentException("New farmer account does not exist or is not active"));
                    if (finalIncomingRequest.sourceApplicationId() != null && !finalIncomingRequest.sourceApplicationId().isBlank()) {
                        JobApplication txApplication = applicationRepository.findByIdInTransaction(
                                transaction, finalIncomingRequest.sourceApplicationId().trim());
                        validateApprovedApplication(txApplication, cleanFarmId, nextFarmerUid,
                                finalIncomingRequest.sourceJobId());
                    }
                    FieldAssignment outgoing = assignmentRepository.findByIdInTransaction(transaction, assignmentId);
                    if (outgoing == null || !cleanFarmId.equals(outgoing.getFarmId()) || !cleanFieldId.equals(outgoing.getFieldId())) {
                        throw AssignmentNotFoundException.forId(assignmentId);
                    }
                    if (outgoing.getStatus() != AssignmentStatus.ACTIVE) {
                        throw new InvalidStateTransitionException("Only an active assignment can be reassigned");
                    }
                    if (request.expectedVersion() != null && !request.expectedVersion().equals(outgoing.getVersion())) {
                        throw new StaleVersionException(request.expectedVersion(), outgoing.getVersion());
                    }
                    FieldAssignment priorTarget = assignmentRepository.findActivePairInTransaction(transaction, cleanFieldId, nextFarmerUid);
                    if (priorTarget != null && priorTarget.getStatus() == AssignmentStatus.ACTIVE) {
                        throw DuplicateAssignmentException.forFarmerAndField(nextFarmerUid, cleanFieldId);
                    }

                    Instant now = Instant.now();
                    outgoing.setStatus(AssignmentStatus.RELEASED);
                    outgoing.setReleasedByUid(actorUid);
                    outgoing.setReleasedAt(now);
                    outgoing.setReleaseReason("Reassigned: " + request.releaseReason());
                    outgoing.setVersion(outgoing.getVersion() + 1);
                    outgoing.setUpdatedAt(now);
                    assignmentRepository.removeActivePairLockInTransaction(transaction, outgoing);
                    assignmentRepository.saveInTransaction(transaction, outgoing);
                    historyRepository.saveInTransaction(transaction,
                            buildHistoryRecord(outgoing, AssignmentHistory.EventType.RELEASED.name(), actorUid,
                                    txActorRole.name(), outgoing.getReleaseReason(), outgoing.getSourceApplicationId()));

                    FieldAssignment incoming = new FieldAssignment();
                    populateAssignmentEntity(incoming, incomingId, cleanFarmId, cleanFieldId, nextFarmerUid,
                            nextFarmerSafeUid, finalIncomingRequest, actorUid, false, txTargetProfile);
                    assignmentRepository.saveInTransaction(transaction, incoming);
                    assignmentRepository.writeActivePairLockInTransaction(transaction, incoming);
                    historyRepository.saveInTransaction(transaction,
                            buildHistoryRecord(incoming, AssignmentHistory.EventType.ASSIGNED.name(), actorUid,
                                    txActorRole.name(), "Farmer assigned by reassignment", finalIncomingRequest.sourceApplicationId()));
                    return FieldAssignmentResponseDTO.fromEntity(incoming);
                }).get();
            } catch (Exception e) {
                Throwable cause = e.getCause() != null ? e.getCause() : e;
                if (cause instanceof AssignmentNotFoundException notFound) throw notFound;
                if (cause instanceof DuplicateAssignmentException duplicate) throw duplicate;
                if (cause instanceof FarmNotFoundException notFound) throw notFound;
                if (cause instanceof FieldNotFoundException notFound) throw notFound;
                if (cause instanceof InvalidStateTransitionException invalid) throw invalid;
                if (cause instanceof StaleVersionException stale) throw stale;
                if (cause instanceof IllegalArgumentException invalid) throw invalid;
                log.error("Live Firestore assignment reassignment transaction failed: {}", cause.getMessage());
                throw new DatabaseUnavailableException("Assignment reassignment transaction failed: " + cause.getMessage(), cause);
            }
        }

        synchronized (this) {
            FieldAssignment outgoing = resolveAssignment(cleanFarmId, cleanFieldId, assignmentId);

            if (request.expectedVersion() != null && !request.expectedVersion().equals(outgoing.getVersion())) {
                throw new StaleVersionException(request.expectedVersion(), outgoing.getVersion());
            }

            Optional<FieldAssignment> priorTarget = assignmentRepository.findAssignment(cleanFieldId, nextFarmerUid)
                    .filter(a -> a.getStatus() == AssignmentStatus.ACTIVE);
            if (priorTarget.isPresent()) throw DuplicateAssignmentException.forFarmerAndField(nextFarmerUid, cleanFieldId);

            // Release outgoing
            outgoing.setStatus(AssignmentStatus.RELEASED);
            outgoing.setReleasedByUid(actorUid);
            outgoing.setReleasedAt(Instant.now());
            outgoing.setReleaseReason("Replaced by reassignment: " + request.releaseReason());
            outgoing.setVersion(outgoing.getVersion() + 1);
            outgoing.setUpdatedAt(Instant.now());
            assignmentRepository.save(outgoing);
            assignmentRepository.removeActivePairLockInTransaction(null, outgoing);

            AssignmentHistory releaseHistory = buildHistoryRecord(outgoing, AssignmentHistory.EventType.RELEASED.name(),
                    actorUid, actorRole.name(), outgoing.getReleaseReason(), outgoing.getSourceApplicationId());
            historyRepository.save(releaseHistory);

            // Create incoming assignment
            CreateAssignmentRequest newReq = new CreateAssignmentRequest(
                    nextFarmerUid,
                    request.permissions() != null ? request.permissions() : outgoing.getPermissions(),
                    request.sourceApplicationId(),
                    outgoing.getSourceJobId()
            );

            FieldAssignment incoming = new FieldAssignment();
            String nextAssignmentId = KeyEncoder.newAssignmentTenureId();
            populateAssignmentEntity(incoming, nextAssignmentId, cleanFarmId, cleanFieldId, nextFarmerUid,
                    nextFarmerSafeUid, newReq, actorUid, false, userRepository.findPrivateProfile(nextFarmerUid)
                            .filter(profile -> profile.getAccountStatus() == AccountStatus.ACTIVE)
                            .orElseThrow(() -> new IllegalArgumentException("New farmer account does not exist or is not active")));
            assignmentRepository.save(incoming);
            assignmentRepository.writeActivePairLockInTransaction(null, incoming);
            historyRepository.save(buildHistoryRecord(incoming, AssignmentHistory.EventType.ASSIGNED.name(), actorUid,
                    actorRole.name(), "Farmer assigned by reassignment", newReq.sourceApplicationId()));

            log.info("Field '{}' reassigned from '{}' to '{}'", cleanFieldId, outgoing.getFarmerUid(), request.newFarmerUid());
            return FieldAssignmentResponseDTO.fromEntity(incoming);
        }
    }

    public List<FieldAssignmentResponseDTO> getAssignmentsByField(String farmId, String fieldId, String actorUid) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        String cleanFieldId = KeyEncoder.validateFieldId(fieldId);
        verifyActiveMember(cleanFarmId, actorUid);

        return assignmentRepository.findAssignmentsByField(cleanFieldId).stream()
                .filter(a -> cleanFarmId.equals(a.getFarmId()))
                .map(FieldAssignmentResponseDTO::fromEntity)
                .collect(Collectors.toList());
    }

    public CursorPageResponse<FieldAssignmentResponseDTO> getAssignmentsByFieldPage(String farmId, String fieldId,
                                                                                       String cursor, Integer requestedSize,
                                                                                       String actorUid) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        String cleanFieldId = KeyEncoder.validateFieldId(fieldId);
        verifyActiveMember(cleanFarmId, actorUid);
        int size = CursorPagination.validatePageSize(requestedSize);
        CursorPage<FieldAssignment> page = assignmentRepository.findAssignmentsByFieldPage(cleanFieldId,
                CursorPagination.decode(cursor), size);
        List<FieldAssignment> scoped = page.items().stream().filter(a -> cleanFarmId.equals(a.getFarmId())).toList();
        CursorPage<FieldAssignment> scopedPage = new CursorPage<>(scoped, page.nextCursor(), page.hasNext());
        return CursorPageResponse.map(scopedPage, size, FieldAssignmentResponseDTO::fromEntity, CursorPagination::encode);
    }

    public List<FieldAssignmentResponseDTO> getAssignmentsByFarm(String farmId, String actorUid) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        verifyActiveMember(cleanFarmId, actorUid);

        return assignmentRepository.findAssignmentsByFarm(cleanFarmId).stream()
                .map(FieldAssignmentResponseDTO::fromEntity)
                .collect(Collectors.toList());
    }

    public CursorPageResponse<FieldAssignmentResponseDTO> getAssignmentsByFarmPage(String farmId, String cursor,
                                                                                      Integer requestedSize,
                                                                                      String actorUid) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        verifyActiveMember(cleanFarmId, actorUid);
        int size = CursorPagination.validatePageSize(requestedSize);
        CursorPage<FieldAssignment> page = assignmentRepository.findAssignmentsByFarmPage(cleanFarmId,
                CursorPagination.decode(cursor), size);
        return CursorPageResponse.map(page, size, FieldAssignmentResponseDTO::fromEntity, CursorPagination::encode);
    }

    public List<AssignmentHistoryResponseDTO> getAssignmentHistory(String farmId, String fieldId, String assignmentId, String actorUid) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        String cleanFieldId = KeyEncoder.validateFieldId(fieldId);
        verifyActiveMember(cleanFarmId, actorUid);

        resolveAssignment(cleanFarmId, cleanFieldId, assignmentId);

        return historyRepository.findByAssignmentId(assignmentId).stream()
                .map(AssignmentHistoryResponseDTO::fromEntity)
                .collect(Collectors.toList());
    }

    public CursorPageResponse<AssignmentHistoryResponseDTO> getAssignmentHistoryPage(String farmId, String fieldId,
                                                                                       String assignmentId, String cursor,
                                                                                       Integer requestedSize, String actorUid) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        String cleanFieldId = KeyEncoder.validateFieldId(fieldId);
        verifyActiveMember(cleanFarmId, actorUid);
        resolveAssignment(cleanFarmId, cleanFieldId, assignmentId);
        int size = CursorPagination.validatePageSize(requestedSize);
        CursorPage<com.agroai.model.AssignmentHistory> page = historyRepository.findByAssignmentIdPage(assignmentId,
                CursorPagination.decode(cursor), size);
        return CursorPageResponse.map(page, size, AssignmentHistoryResponseDTO::fromEntity, CursorPagination::encode);
    }

    private FieldAssignment resolveAssignment(String cleanFarmId, String cleanFieldId, String assignmentId) {
        FieldAssignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> AssignmentNotFoundException.forId(assignmentId));

        if (!cleanFieldId.equals(assignment.getFieldId()) || !cleanFarmId.equals(assignment.getFarmId())) {
            throw new AssignmentNotFoundException("Assignment does not belong to field '" + cleanFieldId + "' under farm '" + cleanFarmId + "'");
        }
        return assignment;
    }

    private void populateAssignmentEntity(FieldAssignment assignment, String assignmentDocId, String cleanFarmId,
                                          String cleanFieldId, String farmerUid, String safeFarmerUid,
                                          CreateAssignmentRequest request, String actorUid, boolean isReactivation,
                                          UserProfile profile) {
        assignment.setAssignmentId(assignmentDocId);
        assignment.setFarmId(cleanFarmId);
        assignment.setFieldId(cleanFieldId);
        assignment.setFieldDocumentId(cleanFieldId);
        assignment.setFarmerId(farmerUid);
        assignment.setFarmerUid(farmerUid);
        assignment.setFarmerSafeUid(safeFarmerUid);
        assignment.setStatus(AssignmentStatus.ACTIVE);
        assignment.setPermissions(request.permissions() != null && !request.permissions().isEmpty()
                ? new ArrayList<>(request.permissions())
                : List.of("READ", "WRITE_LOGS"));
        assignment.setAssignedBy(actorUid);
        assignment.setAssignedByUid(actorUid);
        assignment.setSourceApplicationId(request.sourceApplicationId());
        assignment.setSourceJobId(request.sourceJobId());
        assignment.setReleasedAt(null);
        assignment.setReleasedByUid(null);
        assignment.setReleaseReason(null);

        if (profile.getAccountStatus() != AccountStatus.ACTIVE) {
            throw new IllegalArgumentException("Farmer account is not active");
        }
        assignment.setFarmerName(profile.getFullName());

        Instant now = Instant.now();
        assignment.setAssignedAt(now);
        assignment.setUpdatedAt(now);
        assignment.setVersion(isReactivation ? assignment.getVersion() + 1 : 1);
    }

    private void validateApprovedApplication(JobApplication application, String farmId, String farmerUid,
                                             String sourceJobId) {
        if (application == null) {
            throw new ApplicationNotFoundException("Linked application was not found");
        }
        if (!farmId.equals(application.getFarmId()) || !farmerUid.equals(application.getApplicantUid())) {
            throw new IllegalArgumentException("Linked application must belong to the selected farmer and farm");
        }
        if (application.getStatus() != ApplicationStatus.APPROVED) {
            throw new InvalidStateTransitionException("Candidate application must be APPROVED before assignment");
        }
        if (sourceJobId != null && !sourceJobId.equals(application.getJobId())) {
            throw new IllegalArgumentException("Linked application does not match the supplied job");
        }
    }

    private AssignmentHistory buildHistoryRecord(FieldAssignment assignment, String eventType, String performedByUid,
                                                String performedByRole, String reason, String sourceAppId) {
        return new AssignmentHistory(
                "asgn_hist_" + UUID.randomUUID().toString(),
                assignment.getAssignmentId(),
                assignment.getFarmId(),
                assignment.getFieldId(),
                assignment.getFarmerUid(),
                assignment.getFarmerName(),
                eventType,
                performedByUid,
                performedByRole,
                reason,
                sourceAppId
        );
    }

    private FarmRole verifyManagerOrOwnerRole(String farmId, String uid) {
        Optional<FarmMembership> m = membershipRepository.findMembership(farmId, uid);
        if (m.isEmpty() || m.get().getStatus() != MembershipStatus.ACTIVE ||
                (m.get().getRole() != FarmRole.OWNER && m.get().getRole() != FarmRole.MANAGER)) {
            throw new UnauthorizedResourceAccessException("farm", farmId, "Only an active OWNER or MANAGER can manage field assignments");
        }
        return m.get().getRole();
    }

    private FarmRole verifyManagerOrOwnerRoleInTransaction(Transaction transaction, String farmId, String uid) {
        UserProfile actor = userRepository.findPrivateProfileInTransaction(transaction, uid)
                .filter(profile -> profile.getAccountStatus() == AccountStatus.ACTIVE)
                .orElseThrow(() -> new UnauthorizedResourceAccessException("user", uid,
                        "An active account is required to manage field assignments"));
        Optional<FarmMembership> membership = membershipRepository.findMembershipInTransaction(transaction, farmId, uid);
        if (membership.isEmpty() || membership.get().getStatus() != MembershipStatus.ACTIVE ||
                (membership.get().getRole() != FarmRole.OWNER && membership.get().getRole() != FarmRole.MANAGER)) {
            throw new UnauthorizedResourceAccessException("farm", farmId,
                    "Only an active OWNER or MANAGER can manage field assignments");
        }
        return membership.get().getRole();
    }

    private void verifyActiveMember(String farmId, String uid) {
        Optional<FarmMembership> m = membershipRepository.findMembership(farmId, uid);
        if (m.isEmpty() || m.get().getStatus() != MembershipStatus.ACTIVE) {
            throw new UnauthorizedResourceAccessException("farm", farmId, "Active membership is required to access farm assignments");
        }
    }
}
