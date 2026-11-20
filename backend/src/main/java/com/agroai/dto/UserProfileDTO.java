package com.agroai.dto;

import com.agroai.model.AccountStatus;
import com.agroai.model.UserProfile;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

public class UserProfileDTO {

    private String uid;
    private String email;
    private String fullName;
    private String phoneNumber;
    private String bio;
    private String profileImageUrl;
    private String preferredLanguage;
    private AccountStatus accountStatus;
    private int profileVersion;
    private boolean emailVerified;
    private Instant createdAt;
    private Instant updatedAt;
    private List<String> activeRoles = new ArrayList<>();
    private Map<String, Object> contextualPermissions;

    public UserProfileDTO() {
    }

    public static UserProfileDTO fromEntity(UserProfile profile, boolean emailVerified) {
        if (profile == null) {
            return null;
        }
        UserProfileDTO dto = new UserProfileDTO();
        dto.setUid(profile.getUid());
        dto.setEmail(profile.getEmail());
        dto.setFullName(profile.getFullName());
        dto.setPhoneNumber(profile.getPhoneNumber());
        dto.setBio(profile.getBio());
        dto.setProfileImageUrl(profile.getProfileImageUrl());
        dto.setPreferredLanguage(profile.getPreferredLanguage());
        dto.setAccountStatus(profile.getAccountStatus());
        dto.setProfileVersion(profile.getProfileVersion());
        dto.setEmailVerified(emailVerified);
        dto.setCreatedAt(profile.getCreatedAt());
        dto.setUpdatedAt(profile.getUpdatedAt());
        dto.setContextualPermissions(profile.getAuthorizationMetadata());
        return dto;
    }

    public String getUid() {
        return uid;
    }

    public void setUid(String uid) {
        this.uid = uid;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    public String getBio() {
        return bio;
    }

    public void setBio(String bio) {
        this.bio = bio;
    }

    public String getProfileImageUrl() {
        return profileImageUrl;
    }

    public void setProfileImageUrl(String profileImageUrl) {
        this.profileImageUrl = profileImageUrl;
    }

    public String getPreferredLanguage() {
        return preferredLanguage;
    }

    public void setPreferredLanguage(String preferredLanguage) {
        this.preferredLanguage = preferredLanguage;
    }

    public AccountStatus getAccountStatus() {
        return accountStatus;
    }

    public void setAccountStatus(AccountStatus accountStatus) {
        this.accountStatus = accountStatus;
    }

    public int getProfileVersion() {
        return profileVersion;
    }

    public void setProfileVersion(int profileVersion) {
        this.profileVersion = profileVersion;
    }

    public boolean isEmailVerified() {
        return emailVerified;
    }

    public void setEmailVerified(boolean emailVerified) {
        this.emailVerified = emailVerified;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public List<String> getActiveRoles() {
        return activeRoles != null ? activeRoles : Collections.emptyList();
    }

    public void setActiveRoles(List<String> activeRoles) {
        this.activeRoles = activeRoles != null ? activeRoles : new ArrayList<>();
    }

    public Map<String, Object> getContextualPermissions() {
        return contextualPermissions != null ? contextualPermissions : Collections.emptyMap();
    }

    public void setContextualPermissions(Map<String, Object> contextualPermissions) {
        this.contextualPermissions = contextualPermissions;
    }
}
