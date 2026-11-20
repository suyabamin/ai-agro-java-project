package com.agroai.service;

import com.agroai.dto.InitializeProfileRequest;
import com.agroai.dto.PublicProfileDTO;
import com.agroai.dto.UpdateProfileRequest;
import com.agroai.dto.UserProfileDTO;
import com.agroai.exception.AccountSuspendedException;
import com.agroai.exception.EmailVerificationRequiredException;
import com.agroai.exception.ProfileNotFoundException;
import com.agroai.model.AccountStatus;
import com.agroai.model.FarmMembership;
import com.agroai.model.PublicProfile;
import com.agroai.model.UserProfile;
import com.agroai.repository.FarmMembershipRepository;
import com.agroai.repository.UserRepository;
import com.agroai.security.FirebaseUserDetails;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);

    private final UserRepository userRepository;
    private final FarmMembershipRepository farmMembershipRepository;
    private final FirebaseCustomClaimsService customClaimsService;

    public UserService(UserRepository userRepository,
                       FarmMembershipRepository farmMembershipRepository,
                       FirebaseCustomClaimsService customClaimsService) {
        this.userRepository = userRepository;
        this.farmMembershipRepository = farmMembershipRepository;
        this.customClaimsService = customClaimsService;
    }

    /**
     * Strictly read-only profile fetch. Never silently writes or reconciles.
     * Allowed for unverified users so they can inspect their profile and verification status.
     */
    public UserProfileDTO getMyProfile(FirebaseUserDetails userDetails) {
        String uid = userDetails.getUid();
        UserProfile profile = userRepository.findPrivateProfile(uid)
                .orElseThrow(() -> new ProfileNotFoundException(uid, true));

        if (profile.getAccountStatus() == AccountStatus.SUSPENDED) {
            throw new AccountSuspendedException();
        }

        UserProfileDTO dto = UserProfileDTO.fromEntity(profile, userDetails.isEmailVerified());
        attachContextualRoles(dto, uid);
        return dto;
    }

    /**
     * Idempotent profile initialization. Derives UID and email exclusively from verified token claims.
     * Automatically provisions the canonical safeUid custom claim.
     */
    public UserProfileDTO initializeMyProfile(FirebaseUserDetails userDetails, InitializeProfileRequest request) {
        String uid = userDetails.getUid();
        String email = userDetails.getEmail();

        log.info("Initializing profile for verified UID: {}", uid);
        UserProfile profile = userRepository.initializeProfile(uid, email, request);

        if (profile.getAccountStatus() == AccountStatus.SUSPENDED) {
            throw new AccountSuspendedException();
        }

        // Provision trusted custom claim safeUid
        customClaimsService.syncSafeUidClaim(uid);

        UserProfileDTO dto = UserProfileDTO.fromEntity(profile, userDetails.isEmailVerified());
        attachContextualRoles(dto, uid);
        return dto;
    }

    /**
     * Concurrency-safe profile update requiring expectedVersion.
     * Enforces email verification on mutating profile updates.
     */
    public UserProfileDTO updateMyProfile(FirebaseUserDetails userDetails, UpdateProfileRequest request) {
        if (!userDetails.isEmailVerified()) {
            throw new EmailVerificationRequiredException(
                    "Email verification is required before updating profile details. Please verify your email address.");
        }

        String uid = userDetails.getUid();
        UserProfile profile = userRepository.findPrivateProfile(uid)
                .orElseThrow(() -> new ProfileNotFoundException(uid, true));

        if (profile.getAccountStatus() == AccountStatus.SUSPENDED) {
            throw new AccountSuspendedException();
        }

        UserProfile updated = userRepository.updateProfile(uid, request);
        UserProfileDTO dto = UserProfileDTO.fromEntity(updated, userDetails.isEmailVerified());
        attachContextualRoles(dto, uid);
        return dto;
    }

    /**
     * Dedicated transactional reconciliation operation.
     * Enforces email verification and synchronizes safeUid custom claim.
     */
    public UserProfileDTO reconcileMyProfile(FirebaseUserDetails userDetails) {
        if (!userDetails.isEmailVerified()) {
            throw new EmailVerificationRequiredException(
                    "Email verification is required before reconciling profile projections. Please verify your email address.");
        }

        String uid = userDetails.getUid();
        UserProfile profile = userRepository.reconcileProfile(uid);

        // Ensure safeUid custom claim is synchronized
        customClaimsService.syncSafeUidClaim(uid);

        UserProfileDTO dto = UserProfileDTO.fromEntity(profile, userDetails.isEmailVerified());
        attachContextualRoles(dto, uid);
        return dto;
    }

    /**
     * Explicitly synchronizes custom user claims (safeUid) for the authenticated user.
     */
    public String syncClaims(FirebaseUserDetails userDetails) {
        return customClaimsService.syncSafeUidClaim(userDetails.getUid());
    }

    /**
     * Retrieves sanitized public profile projection.
     */
    public PublicProfileDTO getPublicProfile(String targetUid) {
        PublicProfile pub = userRepository.findPublicProfile(targetUid)
                .orElseThrow(() -> new ProfileNotFoundException("Public profile not found for UID: " + targetUid));

        return PublicProfileDTO.fromEntity(pub);
    }

    private void attachContextualRoles(UserProfileDTO dto, String uid) {
        List<FarmMembership> memberships = farmMembershipRepository.findActiveMembershipsByUser(uid);
        List<String> roles = new ArrayList<>();
        boolean isOwner = false;
        boolean isManager = false;

        for (FarmMembership m : memberships) {
            if (m.getRole() != null) {
                switch (m.getRole()) {
                    case OWNER -> isOwner = true;
                    case MANAGER -> isManager = true;
                    case OBSERVER -> {}
                }
            }
        }

        if (isOwner) roles.add("FARM_OWNER");
        if (isManager) roles.add("FARM_MANAGER");
        roles.add("GENERAL_USER");

        dto.setActiveRoles(roles);
    }
}
