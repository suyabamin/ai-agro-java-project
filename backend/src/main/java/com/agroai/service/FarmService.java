package com.agroai.service;

import com.agroai.config.FirebaseConfig;
import com.agroai.dto.CreateFarmRequest;
import com.agroai.dto.FarmResponseDTO;
import com.agroai.dto.PublicFarmResponseDTO;
import com.agroai.dto.UpdateFarmRequest;
import com.agroai.dto.UpdateFarmVisibilityRequest;
import com.agroai.exception.DatabaseUnavailableException;
import com.agroai.exception.FarmNotFoundException;
import com.agroai.exception.InvalidStateTransitionException;
import com.agroai.exception.StaleVersionException;
import com.agroai.exception.UnauthorizedResourceAccessException;
import com.agroai.model.Farm;
import com.agroai.model.FarmMembership;
import com.agroai.model.FarmRole;
import com.agroai.model.FarmStatus;
import com.agroai.model.FarmVisibility;
import com.agroai.model.MembershipStatus;
import com.agroai.model.PublicFarmProjection;
import com.agroai.repository.FarmMembershipRepository;
import com.agroai.repository.FarmRepository;
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
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service managing core farm lifecycle operations, visibility, and multi-farm ownership.
 */
@Service
public class FarmService {

    private static final Logger log = LoggerFactory.getLogger(FarmService.class);

    private final FarmRepository farmRepository;
    private final FarmMembershipRepository membershipRepository;
    private final PublicFarmProjectionService projectionService;
    private final FirebaseConfig firebaseConfig;
    private final AssignmentLifecycleService assignmentLifecycleService;

    public FarmService(FarmRepository farmRepository,
                       FarmMembershipRepository membershipRepository,
                       PublicFarmProjectionService projectionService,
                       FirebaseConfig firebaseConfig) {
        this(farmRepository, membershipRepository, projectionService, firebaseConfig, null);
    }

    @Autowired
    public FarmService(FarmRepository farmRepository,
                       FarmMembershipRepository membershipRepository,
                       PublicFarmProjectionService projectionService,
                       FirebaseConfig firebaseConfig,
                       AssignmentLifecycleService assignmentLifecycleService) {
        this.farmRepository = farmRepository;
        this.membershipRepository = membershipRepository;
        this.projectionService = projectionService;
        this.firebaseConfig = firebaseConfig;
        this.assignmentLifecycleService = assignmentLifecycleService;
    }

    /**
     * Atomically registers a new farm, assigns creator as OWNER, and generates public projection if PUBLIC.
     */
    public FarmResponseDTO registerFarm(FirebaseUserDetails user, CreateFarmRequest request) {
        if (user == null || user.getUid() == null) {
            throw new IllegalArgumentException("Authenticated user is required to register a farm");
        }
        if (request == null) {
            throw new IllegalArgumentException("Registration request payload cannot be null");
        }

        // Generate canonical farm ID: farm-<uuid> (41 chars)
        String farmId = (request.farmId() != null && !request.farmId().trim().isEmpty())
                ? KeyEncoder.validateFarmId(request.farmId().trim())
                : "farm-" + UUID.randomUUID().toString().toLowerCase();

        // Check ID uniqueness
        if (farmRepository.findById(farmId).isPresent()) {
            throw new IllegalArgumentException("Farm with ID '" + farmId + "' already exists");
        }

        String ownerUid = user.getUid().trim();
        String ownerSafeUid = KeyEncoder.encodeUid(ownerUid);

        Farm farm = new Farm(
                farmId,
                request.name().trim(),
                ownerUid,
                ownerSafeUid,
                request.district().trim(),
                request.division().trim(),
                request.totalAreaHectares(),
                request.visibility()
        );
        farm.setDescription(request.description() != null ? request.description().trim() : null);
        farm.setDetailedAddress(request.detailedAddress() != null ? request.detailedAddress().trim() : null);
        farm.setActiveFieldCount(0);
        farm.setVersion(1);

        FarmMembership ownerMembership = new FarmMembership(
                KeyEncoder.membershipDocId(farmId, ownerUid),
                farmId,
                ownerUid,
                FarmRole.OWNER,
                MembershipStatus.ACTIVE
        );
        ownerMembership.setCreatedByUid(ownerUid);

        // Atomic multi-document transaction
        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                db.runTransaction(transaction -> {
                    farmRepository.saveInTransaction(transaction, farm);
                    membershipRepository.saveMembershipInTransaction(transaction, ownerMembership);
                    if (farm.getVisibility() == FarmVisibility.PUBLIC) {
                        projectionService.createProjectionInTransaction(transaction, farm);
                    }
                    return null;
                }).get();
            } catch (Exception e) {
                log.error("Live Firestore registration transaction failed for farm {}: {}", farmId, e.getMessage());
                throw new DatabaseUnavailableException("Failed to register farm: " + e.getMessage(), e);
            }
        } else {
            // In-Memory Mode
            farmRepository.save(farm);
            membershipRepository.saveMembership(ownerMembership);
            if (farm.getVisibility() == FarmVisibility.PUBLIC) {
                projectionService.createProjectionInTransaction(null, farm);
            }
        }

        log.info("Farm '{}' successfully registered by owner: {}", farmId, ownerUid);
        return FarmResponseDTO.fromEntity(farm, FarmRole.OWNER);
    }

    /**
     * Lists all farms where the authenticated user holds an active membership.
     */
    public List<FarmResponseDTO> getMyFarms(FirebaseUserDetails user) {
        if (user == null || user.getUid() == null) {
            return List.of();
        }
        String uid = user.getUid().trim();
        List<FarmMembership> memberships = membershipRepository.findActiveMembershipsByUser(uid);
        if (memberships.isEmpty()) {
            return List.of();
        }

        Map<String, FarmRole> roleMap = memberships.stream()
                .collect(Collectors.toMap(FarmMembership::getFarmId, FarmMembership::getRole, (r1, r2) -> r1));

        List<String> farmIds = new ArrayList<>(roleMap.keySet());
        List<Farm> farms = farmRepository.findByIds(farmIds);

        return farms.stream()
                .map(f -> FarmResponseDTO.fromEntity(f, roleMap.get(f.getFarmId())))
                .collect(Collectors.toList());
    }

    /**
     * Retrieves farm details for an active member.
     */
    public FarmResponseDTO getFarmById(String farmId, FirebaseUserDetails user) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        String uid = user.getUid().trim();

        Optional<FarmMembership> membership = membershipRepository.findMembership(cleanFarmId, uid);
        if (membership.isEmpty() || membership.get().getStatus() != MembershipStatus.ACTIVE) {
            throw new UnauthorizedResourceAccessException("farm", cleanFarmId, "Active membership is required to access farm details");
        }

        Farm farm = farmRepository.findById(cleanFarmId)
                .orElseThrow(() -> new FarmNotFoundException(cleanFarmId));

        return FarmResponseDTO.fromEntity(farm, membership.get().getRole());
    }

    /**
     * Updates farm metadata with optimistic concurrency validation. Restricted to OWNER or MANAGER.
     */
    public FarmResponseDTO updateFarm(String farmId, UpdateFarmRequest request, FirebaseUserDetails user) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        FarmRole callerRole = verifyManagerOrOwnerRole(cleanFarmId, user.getUid());

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                return db.runTransaction(transaction -> {
                    Farm existing = farmRepository.findByIdInTransaction(transaction, cleanFarmId);
                    if (existing == null) {
                        throw new FarmNotFoundException(cleanFarmId);
                    }
                    if (existing.getStatus() == FarmStatus.ARCHIVED) {
                        throw new InvalidStateTransitionException("Cannot modify an archived farm");
                    }
                    if (existing.getVersion() != request.expectedVersion()) {
                        throw new StaleVersionException(request.expectedVersion(), existing.getVersion());
                    }

                    int newVersion = existing.getVersion() + 1;
                    existing.setName(request.name().trim());
                    existing.setDescription(request.description() != null ? request.description().trim() : null);
                    existing.setDistrict(request.district().trim());
                    existing.setDivision(request.division().trim());
                    existing.setDetailedAddress(request.detailedAddress() != null ? request.detailedAddress().trim() : null);
                    existing.setTotalAreaHectares(request.totalAreaHectares());
                    existing.setVersion(newVersion);
                    existing.setUpdatedAt(Instant.now());

                    farmRepository.saveInTransaction(transaction, existing);
                    if (existing.getVisibility() == FarmVisibility.PUBLIC && existing.getStatus() == FarmStatus.ACTIVE) {
                        projectionService.updateProjectionInTransaction(transaction, existing);
                    }
                    return FarmResponseDTO.fromEntity(existing, callerRole);
                }).get();
            } catch (Exception e) {
                if (e.getCause() instanceof StaleVersionException sve) throw sve;
                if (e.getCause() instanceof FarmNotFoundException fnfe) throw fnfe;
                if (e.getCause() instanceof InvalidStateTransitionException iste) throw iste;
                log.error("Firestore farm update failed for {}: {}", cleanFarmId, e.getMessage());
                throw new DatabaseUnavailableException("Failed to update farm: " + e.getMessage(), e);
            }
        }

        // In-Memory Mode
        Farm existing = farmRepository.findById(cleanFarmId)
                .orElseThrow(() -> new FarmNotFoundException(cleanFarmId));
        if (existing.getStatus() == FarmStatus.ARCHIVED) {
            throw new InvalidStateTransitionException("Cannot modify an archived farm");
        }
        if (existing.getVersion() != request.expectedVersion()) {
            throw new StaleVersionException(request.expectedVersion(), existing.getVersion());
        }
        int newVersion = existing.getVersion() + 1;
        existing.setName(request.name().trim());
        existing.setDescription(request.description() != null ? request.description().trim() : null);
        existing.setDistrict(request.district().trim());
        existing.setDivision(request.division().trim());
        existing.setDetailedAddress(request.detailedAddress() != null ? request.detailedAddress().trim() : null);
        existing.setTotalAreaHectares(request.totalAreaHectares());
        existing.setVersion(newVersion);
        existing.setUpdatedAt(Instant.now());

        farmRepository.save(existing);
        if (existing.getVisibility() == FarmVisibility.PUBLIC && existing.getStatus() == FarmStatus.ACTIVE) {
            projectionService.reconcileProjection(existing);
        }
        return FarmResponseDTO.fromEntity(existing, callerRole);
    }

    /**
     * Toggles visibility (PUBLIC/PRIVATE) and synchronizes public projection. Restricted to OWNER.
     */
    public FarmResponseDTO updateVisibility(String farmId, UpdateFarmVisibilityRequest request, FirebaseUserDetails user) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        verifyOwnerRole(cleanFarmId, user.getUid());

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                return db.runTransaction(transaction -> {
                    Farm existing = farmRepository.findByIdInTransaction(transaction, cleanFarmId);
                    if (existing == null) {
                        throw new FarmNotFoundException(cleanFarmId);
                    }
                    verifyOwnerRoleInTransaction(transaction, cleanFarmId, user.getUid());
                    if (existing.getStatus() == FarmStatus.ARCHIVED) {
                        throw new InvalidStateTransitionException("Cannot modify an archived farm");
                    }
                    if (existing.getVersion() != request.expectedVersion()) {
                        throw new StaleVersionException(request.expectedVersion(), existing.getVersion());
                    }

                    int newVersion = existing.getVersion() + 1;
                    existing.setVisibility(request.visibility());
                    existing.setVersion(newVersion);
                    existing.setUpdatedAt(Instant.now());

                    farmRepository.saveInTransaction(transaction, existing);
                    if (request.visibility() == FarmVisibility.PUBLIC && existing.getStatus() == FarmStatus.ACTIVE) {
                        projectionService.createProjectionInTransaction(transaction, existing);
                    } else {
                        projectionService.deleteProjectionInTransaction(transaction, cleanFarmId);
                    }
                    return FarmResponseDTO.fromEntity(existing, FarmRole.OWNER);
                }).get();
            } catch (Exception e) {
                if (e.getCause() instanceof StaleVersionException sve) throw sve;
                if (e.getCause() instanceof FarmNotFoundException fnfe) throw fnfe;
                if (e.getCause() instanceof InvalidStateTransitionException iste) throw iste;
                log.error("Firestore visibility update failed for {}: {}", cleanFarmId, e.getMessage());
                throw new DatabaseUnavailableException("Failed to update farm visibility: " + e.getMessage(), e);
            }
        }

        // In-Memory Mode
        Farm existing = farmRepository.findById(cleanFarmId)
                .orElseThrow(() -> new FarmNotFoundException(cleanFarmId));
        if (existing.getStatus() == FarmStatus.ARCHIVED) {
            throw new InvalidStateTransitionException("Cannot modify an archived farm");
        }
        if (existing.getVersion() != request.expectedVersion()) {
            throw new StaleVersionException(request.expectedVersion(), existing.getVersion());
        }
        int newVersion = existing.getVersion() + 1;
        existing.setVisibility(request.visibility());
        existing.setVersion(newVersion);
        existing.setUpdatedAt(Instant.now());

        farmRepository.save(existing);
        projectionService.reconcileProjection(existing);
        return FarmResponseDTO.fromEntity(existing, FarmRole.OWNER);
    }

    /**
     * Soft-archives a farm and deletes its public projection. Restricted to OWNER.
     */
    public void archiveFarm(String farmId, Integer expectedVersion, FirebaseUserDetails user) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        verifyOwnerRole(cleanFarmId, user.getUid());

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                db.runTransaction(transaction -> {
                    Farm existing = farmRepository.findByIdInTransaction(transaction, cleanFarmId);
                    if (existing == null) {
                        throw new FarmNotFoundException(cleanFarmId);
                    }
                    verifyOwnerRoleInTransaction(transaction, cleanFarmId, user.getUid());
                    if (existing.getStatus() == FarmStatus.ARCHIVED) {
                        return null; // Idempotent
                    }
                    if (expectedVersion != null && existing.getVersion() != expectedVersion) {
                        throw new StaleVersionException(expectedVersion, existing.getVersion());
                    }

                    int newVersion = existing.getVersion() + 1;
                    existing.setStatus(FarmStatus.ARCHIVED);
                    existing.setArchivedAt(Instant.now());
                    existing.setVersion(newVersion);
                    existing.setUpdatedAt(Instant.now());

                    farmRepository.saveInTransaction(transaction, existing);
                    projectionService.deleteProjectionInTransaction(transaction, cleanFarmId);
                    return null;
                }).get();
                if (assignmentLifecycleService != null) assignmentLifecycleService.releaseFarmAssignments(cleanFarmId, user.getUid(), "Farm archived");
                return;
            } catch (Exception e) {
                if (e.getCause() instanceof StaleVersionException sve) throw sve;
                if (e.getCause() instanceof FarmNotFoundException fnfe) throw fnfe;
                if (e.getCause() instanceof UnauthorizedResourceAccessException unauthorized) throw unauthorized;
                if (e.getCause() instanceof InvalidStateTransitionException invalid) throw invalid;
                log.error("Firestore farm archival failed for {}: {}", cleanFarmId, e.getMessage());
                throw new DatabaseUnavailableException("Failed to archive farm: " + e.getMessage(), e);
            }
        }

        // In-Memory Mode
        Farm existing = farmRepository.findById(cleanFarmId)
                .orElseThrow(() -> new FarmNotFoundException(cleanFarmId));
        if (existing.getStatus() != FarmStatus.ARCHIVED) {
            if (expectedVersion != null && existing.getVersion() != expectedVersion) {
                throw new StaleVersionException(expectedVersion, existing.getVersion());
            }
            int newVersion = existing.getVersion() + 1;
            existing.setStatus(FarmStatus.ARCHIVED);
            existing.setArchivedAt(Instant.now());
            existing.setVersion(newVersion);
            existing.setUpdatedAt(Instant.now());
            farmRepository.save(existing);
            projectionService.reconcileProjection(existing);
        }
        if (assignmentLifecycleService != null) assignmentLifecycleService.releaseFarmAssignments(cleanFarmId, user.getUid(), "Farm archived");
    }

    public void suspendFarm(String farmId, Integer expectedVersion, FirebaseUserDetails user) {
        transitionFarmStatus(farmId, expectedVersion, user, FarmStatus.SUSPENDED);
    }

    public void reactivateFarm(String farmId, Integer expectedVersion, FirebaseUserDetails user) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        if (assignmentLifecycleService != null && assignmentLifecycleService.isProcessing("farm", cleanFarmId)) {
            throw new InvalidStateTransitionException("Cannot reactivate farm while assignment cleanup is processing");
        }
        transitionFarmStatus(cleanFarmId, expectedVersion, user, FarmStatus.ACTIVE);
        if (assignmentLifecycleService != null) assignmentLifecycleService.startNewLifecycleCycle("farm", cleanFarmId);
    }

    private void transitionFarmStatus(String farmId, Integer expectedVersion, FirebaseUserDetails user, FarmStatus target) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        verifyOwnerRole(cleanFarmId, user.getUid());
        if (firebaseConfig.isInitialized()) {
            try {
                FirestoreClient.getFirestore().runTransaction(transaction -> {
                    Farm farm = farmRepository.findByIdInTransaction(transaction, cleanFarmId);
                    if (farm == null) throw new FarmNotFoundException(cleanFarmId);
                    verifyOwnerRoleInTransaction(transaction, cleanFarmId, user.getUid());
                    if (farm.getStatus() == FarmStatus.ARCHIVED) {
                        if (target == FarmStatus.ACTIVE) throw new InvalidStateTransitionException("Archived farm cannot be reactivated");
                        return null;
                    }
                    if (target == FarmStatus.SUSPENDED && farm.getStatus() == FarmStatus.SUSPENDED) return null;
                    if (expectedVersion != null && farm.getVersion() != expectedVersion) throw new StaleVersionException(expectedVersion, farm.getVersion());
                    farm.setStatus(target);
                    farm.setVersion(farm.getVersion() + 1);
                    farm.setUpdatedAt(Instant.now());
                    farmRepository.saveInTransaction(transaction, farm);
                    if (target == FarmStatus.ACTIVE && farm.getVisibility() == FarmVisibility.PUBLIC) projectionService.updateProjectionInTransaction(transaction, farm);
                    else projectionService.deleteProjectionInTransaction(transaction, cleanFarmId);
                    return null;
                }).get();
            } catch (Exception e) {
                if (e.getCause() instanceof StaleVersionException sve) throw sve;
                if (e.getCause() instanceof FarmNotFoundException fnfe) throw fnfe;
                if (e.getCause() instanceof InvalidStateTransitionException iste) throw iste;
                if (e.getCause() instanceof UnauthorizedResourceAccessException unauthorized) throw unauthorized;
                throw new DatabaseUnavailableException("Failed to change farm lifecycle status: " + e.getMessage(), e);
            }
        } else {
            Farm farm = farmRepository.findById(cleanFarmId).orElseThrow(() -> new FarmNotFoundException(cleanFarmId));
            if (farm.getStatus() == FarmStatus.ARCHIVED) throw new InvalidStateTransitionException("Archived farm cannot be reactivated");
            if (expectedVersion != null && farm.getVersion() != expectedVersion) throw new StaleVersionException(expectedVersion, farm.getVersion());
            farm.setStatus(target);
            farm.setVersion(farm.getVersion() + 1);
            farm.setUpdatedAt(Instant.now());
            farmRepository.save(farm);
            projectionService.reconcileProjection(farm);
        }
        if (target == FarmStatus.SUSPENDED && assignmentLifecycleService != null) {
            assignmentLifecycleService.releaseFarmAssignments(cleanFarmId, user.getUid(), "Farm suspended");
        }
    }

    /**
     * Public discovery query: returns paginated public farm projections.
     */
    public List<PublicFarmResponseDTO> listPublicFarms(String district, String division, String cropType, int page, int size) {
        List<PublicFarmProjection> projections = farmRepository.listPublicProjections(district, division, cropType, page, size);
        return projections.stream()
                .map(PublicFarmResponseDTO::fromProjection)
                .collect(Collectors.toList());
    }

    /**
     * Public discovery: returns a single public farm projection.
     */
    public PublicFarmResponseDTO getPublicFarmById(String farmId) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        PublicFarmProjection projection = farmRepository.findPublicProjection(cleanFarmId)
                .orElseThrow(() -> new FarmNotFoundException(cleanFarmId));

        if (!"ACTIVE".equals(projection.getStatus()) || !"PUBLIC".equals(projection.getVisibility())) {
            throw new FarmNotFoundException(cleanFarmId);
        }

        return PublicFarmResponseDTO.fromProjection(projection);
    }

    private FarmRole verifyManagerOrOwnerRole(String farmId, String uid) {
        Optional<FarmMembership> m = membershipRepository.findMembership(farmId, uid);
        if (m.isEmpty() || m.get().getStatus() != MembershipStatus.ACTIVE ||
                (m.get().getRole() != FarmRole.OWNER && m.get().getRole() != FarmRole.MANAGER)) {
            throw new UnauthorizedResourceAccessException("farm", farmId, "Only an active OWNER or MANAGER can perform this operation");
        }
        return m.get().getRole();
    }

    private void verifyOwnerRole(String farmId, String uid) {
        Optional<FarmMembership> m = membershipRepository.findMembership(farmId, uid);
        if (m.isEmpty() || m.get().getStatus() != MembershipStatus.ACTIVE || m.get().getRole() != FarmRole.OWNER) {
            throw new UnauthorizedResourceAccessException("farm", farmId, "Only an active OWNER can perform this operation");
        }
    }

    private void verifyOwnerRoleInTransaction(Transaction transaction, String farmId, String uid) {
        FarmMembership membership = membershipRepository.findMembershipInTransaction(transaction, farmId, uid)
                .orElseThrow(() -> new UnauthorizedResourceAccessException("farm", farmId, "Active OWNER membership is required"));
        if (membership.getStatus() != MembershipStatus.ACTIVE || membership.getRole() != FarmRole.OWNER) {
            throw new UnauthorizedResourceAccessException("farm", farmId, "Active OWNER membership is required");
        }
    }
}
