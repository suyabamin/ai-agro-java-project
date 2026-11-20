package com.agroai.service;

import com.agroai.dto.AddFarmMemberRequest;
import com.agroai.dto.FarmMemberResponseDTO;
import com.agroai.dto.UpdateFarmMemberRoleRequest;
import com.agroai.exception.FarmNotFoundException;
import com.agroai.exception.UnauthorizedResourceAccessException;
import com.agroai.model.FarmMembership;
import com.agroai.model.FarmRole;
import com.agroai.model.MembershipStatus;
import com.agroai.repository.FarmMembershipRepository;
import com.agroai.repository.FarmRepository;
import com.agroai.repository.UserRepository;
import com.agroai.security.FirebaseUserDetails;
import com.agroai.util.KeyEncoder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Service managing farm member rosters, role grants, and revocations.
 * Enforces sole-owner protections and validates user existence.
 */
@Service
public class FarmMembershipService {

    private static final Logger log = LoggerFactory.getLogger(FarmMembershipService.class);

    private final FarmMembershipRepository membershipRepository;
    private final FarmRepository farmRepository;
    private final UserRepository userRepository;

    public FarmMembershipService(FarmMembershipRepository membershipRepository,
                                 FarmRepository farmRepository,
                                 UserRepository userRepository) {
        this.membershipRepository = membershipRepository;
        this.farmRepository = farmRepository;
        this.userRepository = userRepository;
    }

    /**
     * Lists members of a farm. Requires active membership on the farm.
     */
    public List<FarmMemberResponseDTO> getMembers(String farmId, FirebaseUserDetails user) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        verifyActiveMember(cleanFarmId, user.getUid());

        List<FarmMembership> members = membershipRepository.findMembersByFarm(cleanFarmId);
        return members.stream()
                .map(FarmMemberResponseDTO::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * Grants MANAGER or OBSERVER membership to an existing registered user. Restricted to OWNER.
     */
    public FarmMemberResponseDTO addMember(String farmId, AddFarmMemberRequest request, FirebaseUserDetails user) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        verifyOwnerRole(cleanFarmId, user.getUid());

        if (request == null || request.userId() == null || request.role() == null) {
            throw new IllegalArgumentException("User ID and role are required");
        }
        if (request.role() == FarmRole.OWNER) {
            throw new IllegalArgumentException("OWNER role cannot be granted through member management. Ownership transfer is not supported in this phase.");
        }

        String targetUserId = request.userId().trim();
        if (targetUserId.equals(user.getUid().trim())) {
            throw new IllegalArgumentException("Cannot grant membership to yourself");
        }

        // Verify target user exists and has a profile
        if (userRepository.findPrivateProfile(targetUserId).isEmpty()) {
            throw new IllegalArgumentException("Target user with UID '" + targetUserId + "' does not exist");
        }

        // Verify farm exists
        farmRepository.findById(cleanFarmId)
                .orElseThrow(() -> new FarmNotFoundException(cleanFarmId));

        Optional<FarmMembership> existing = membershipRepository.findMembership(cleanFarmId, targetUserId);
        if (existing.isPresent() && existing.get().getStatus() == MembershipStatus.ACTIVE) {
            throw new IllegalArgumentException("User is already an active member of this farm");
        }

        FarmMembership membership = existing.orElseGet(() -> new FarmMembership(
                KeyEncoder.membershipDocId(cleanFarmId, targetUserId),
                cleanFarmId,
                targetUserId,
                request.role(),
                MembershipStatus.ACTIVE
        ));

        membership.setRole(request.role());
        membership.setStatus(MembershipStatus.ACTIVE);
        membership.setJoinedAt(Instant.now());
        membership.setUpdatedAt(Instant.now());
        membership.setCreatedByUid(user.getUid().trim());
        membership.setRevokedAt(null);

        membershipRepository.saveMembership(membership);
        log.info("Granted {} role on farm '{}' to user '{}' by owner '{}'", request.role(), cleanFarmId, targetUserId, user.getUid());
        return FarmMemberResponseDTO.fromEntity(membership);
    }

    /**
     * Updates an existing member's role between MANAGER and OBSERVER. Restricted to OWNER.
     */
    public FarmMemberResponseDTO updateMemberRole(String farmId, String targetUserId, UpdateFarmMemberRoleRequest request, FirebaseUserDetails user) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        verifyOwnerRole(cleanFarmId, user.getUid());

        if (request == null || request.role() == null) {
            throw new IllegalArgumentException("Target role is required");
        }
        if (request.role() == FarmRole.OWNER) {
            throw new IllegalArgumentException("Cannot elevate member to OWNER through role update");
        }

        String cleanTargetUid = targetUserId.trim();
        FarmMembership existing = membershipRepository.findMembership(cleanFarmId, cleanTargetUid)
                .orElseThrow(() -> new IllegalArgumentException("Membership not found for user: " + cleanTargetUid));

        if (existing.getStatus() != MembershipStatus.ACTIVE) {
            throw new IllegalArgumentException("Cannot change role of an inactive or revoked membership");
        }

        // Protect sole active owner from demotion
        if (existing.getRole() == FarmRole.OWNER && membershipRepository.countActiveOwners(cleanFarmId) <= 1) {
            throw new IllegalArgumentException("Cannot demote the sole active OWNER of the farm");
        }

        existing.setRole(request.role());
        existing.setUpdatedAt(Instant.now());
        existing.setUpdatedByUid(user.getUid().trim());

        membershipRepository.saveMembership(existing);
        log.info("Updated role to {} for user '{}' on farm '{}'", request.role(), cleanTargetUid, cleanFarmId);
        return FarmMemberResponseDTO.fromEntity(existing);
    }

    /**
     * Revokes a user's membership (soft revocation). Restricted to OWNER.
     */
    public void revokeMember(String farmId, String targetUserId, FirebaseUserDetails user) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        verifyOwnerRole(cleanFarmId, user.getUid());

        String cleanTargetUid = targetUserId.trim();
        FarmMembership existing = membershipRepository.findMembership(cleanFarmId, cleanTargetUid)
                .orElseThrow(() -> new IllegalArgumentException("Membership not found for user: " + cleanTargetUid));

        // Protect sole active owner from removal
        if (existing.getRole() == FarmRole.OWNER && membershipRepository.countActiveOwners(cleanFarmId) <= 1) {
            throw new IllegalArgumentException("Cannot remove or revoke the sole active OWNER of the farm");
        }

        if (existing.getStatus() == MembershipStatus.REVOKED) {
            return; // Idempotent
        }

        existing.setStatus(MembershipStatus.REVOKED);
        existing.setRevokedAt(Instant.now());
        existing.setUpdatedAt(Instant.now());
        existing.setUpdatedByUid(user.getUid().trim());

        membershipRepository.saveMembership(existing);
        log.info("Revoked membership for user '{}' on farm '{}' by owner '{}'", cleanTargetUid, cleanFarmId, user.getUid());
    }

    private void verifyOwnerRole(String farmId, String uid) {
        Optional<FarmMembership> m = membershipRepository.findMembership(farmId, uid);
        if (m.isEmpty() || m.get().getStatus() != MembershipStatus.ACTIVE || m.get().getRole() != FarmRole.OWNER) {
            throw new UnauthorizedResourceAccessException("farm", farmId, "Only an active OWNER can manage memberships");
        }
    }

    private void verifyActiveMember(String farmId, String uid) {
        Optional<FarmMembership> m = membershipRepository.findMembership(farmId, uid);
        if (m.isEmpty() || m.get().getStatus() != MembershipStatus.ACTIVE) {
            throw new UnauthorizedResourceAccessException("farm", farmId, "Active farm membership is required");
        }
    }
}
