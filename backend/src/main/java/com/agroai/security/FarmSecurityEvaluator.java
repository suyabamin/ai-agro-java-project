package com.agroai.security;

import com.agroai.model.FarmMembership;
import com.agroai.model.FarmRole;
import com.agroai.model.MembershipStatus;
import com.agroai.repository.FarmMembershipRepository;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Contextual security evaluator for farm-scoped permissions.
 * Bypasses trust in client flags; independently queries farm_members records.
 */
@Component("farmSecurity")
public class FarmSecurityEvaluator {

    private final FarmMembershipRepository membershipRepository;

    public FarmSecurityEvaluator(FarmMembershipRepository membershipRepository) {
        this.membershipRepository = membershipRepository;
    }

    public boolean isFarmOwner(Authentication authentication, String farmId) {
        return checkMembershipRole(authentication, farmId, FarmRole.OWNER);
    }

    public boolean isFarmManager(Authentication authentication, String farmId) {
        if (checkMembershipRole(authentication, farmId, FarmRole.OWNER)) {
            return true;
        }
        return checkMembershipRole(authentication, farmId, FarmRole.MANAGER);
    }

    public boolean isFarmMember(Authentication authentication, String farmId) {
        if (authentication == null || !(authentication.getPrincipal() instanceof FirebaseUserDetails userDetails)) {
            return false;
        }
        Optional<FarmMembership> membership = membershipRepository.findMembership(farmId, userDetails.getUid());
        return membership.isPresent() && membership.get().getStatus() == MembershipStatus.ACTIVE;
    }

    private boolean checkMembershipRole(Authentication authentication, String farmId, FarmRole requiredRole) {
        if (authentication == null || !(authentication.getPrincipal() instanceof FirebaseUserDetails userDetails)) {
            return false;
        }
        Optional<FarmMembership> membership = membershipRepository.findMembership(farmId, userDetails.getUid());
        if (membership.isEmpty() || membership.get().getStatus() != MembershipStatus.ACTIVE) {
            return false;
        }
        return membership.get().getRole() == requiredRole;
    }
}
