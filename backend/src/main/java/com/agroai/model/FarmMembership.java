package com.agroai.model;

import java.time.Instant;

/**
 * Contextual farm membership stored in 'farm_members/mbr_${farmId}::${safeUid}'.
 * Decouples user identity from farm permissions.
 */
public class FarmMembership {

    private String membershipId;
    private String farmId;
    private String userId;
    private FarmRole role = FarmRole.OBSERVER;
    private MembershipStatus status = MembershipStatus.ACTIVE;
    private Instant invitedAt;
    private Instant joinedAt;
    private Instant updatedAt;
    private Instant revokedAt;
    private String createdByUid;
    private String updatedByUid;

    public FarmMembership() {
        this.joinedAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public FarmMembership(String membershipId, String farmId, String userId, FarmRole role, MembershipStatus status) {
        this.membershipId = membershipId;
        this.farmId = farmId;
        this.userId = userId;
        this.role = role;
        this.status = status;
        this.joinedAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public String getMembershipId() {
        return membershipId;
    }

    public void setMembershipId(String membershipId) {
        this.membershipId = membershipId;
    }

    public String getFarmId() {
        return farmId;
    }

    public void setFarmId(String farmId) {
        this.farmId = farmId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public FarmRole getRole() {
        return role;
    }

    public void setRole(FarmRole role) {
        this.role = role;
    }

    public MembershipStatus getStatus() {
        return status;
    }

    public void setStatus(MembershipStatus status) {
        this.status = status;
    }

    public Instant getInvitedAt() {
        return invitedAt;
    }

    public void setInvitedAt(Instant invitedAt) {
        this.invitedAt = invitedAt;
    }

    public Instant getJoinedAt() {
        return joinedAt;
    }

    public void setJoinedAt(Instant joinedAt) {
        this.joinedAt = joinedAt;
    }

    public Instant getRevokedAt() {
        return revokedAt;
    }

    public void setRevokedAt(Instant revokedAt) {
        this.revokedAt = revokedAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getCreatedByUid() {
        return createdByUid;
    }

    public void setCreatedByUid(String createdByUid) {
        this.createdByUid = createdByUid;
    }

    public String getUpdatedByUid() {
        return updatedByUid;
    }

    public void setUpdatedByUid(String updatedByUid) {
        this.updatedByUid = updatedByUid;
    }
}
