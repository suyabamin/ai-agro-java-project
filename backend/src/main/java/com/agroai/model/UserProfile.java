package com.agroai.model;

import java.time.Instant;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Canonical private user profile stored in Firestore collection 'users/{uid}'.
 * Source of truth for identity, contact information, and account standing.
 */
public class UserProfile {

    private String uid;
    private String email;
    private String fullName;
    private String phoneNumber;
    private String bio;
    private String profileImageUrl;
    private String preferredLanguage = "en";
    private AccountStatus accountStatus = AccountStatus.ACTIVE;
    private Map<String, Object> authorizationMetadata = new LinkedHashMap<>();
    private int profileVersion = 1;
    private Instant createdAt;
    private Instant updatedAt;

    public UserProfile() {
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public UserProfile(String uid, String email, String fullName) {
        this.uid = uid;
        this.email = email;
        this.fullName = fullName;
        this.accountStatus = AccountStatus.ACTIVE;
        this.profileVersion = 1;
        this.preferredLanguage = "en";
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
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

    public Map<String, Object> getAuthorizationMetadata() {
        return authorizationMetadata != null ? authorizationMetadata : Collections.emptyMap();
    }

    public void setAuthorizationMetadata(Map<String, Object> authorizationMetadata) {
        this.authorizationMetadata = authorizationMetadata != null ? authorizationMetadata : new LinkedHashMap<>();
    }

    public int getProfileVersion() {
        return profileVersion;
    }

    public void setProfileVersion(int profileVersion) {
        this.profileVersion = profileVersion;
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
}
