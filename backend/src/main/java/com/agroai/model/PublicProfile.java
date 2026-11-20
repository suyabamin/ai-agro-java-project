package com.agroai.model;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Public profile projection stored in Firestore collection 'public_profiles/{uid}'.
 * Readable by authenticated users; never exposes sensitive contact info or accountStatus.
 */
public class PublicProfile {

    private String uid;
    private String fullName;
    private String profileImageUrl;
    private String bio;
    private String preferredLanguage = "en";
    private List<String> publicRoleBadges = new ArrayList<>();
    private int profileVersion = 1;
    private Instant createdAt;
    private Instant updatedAt;

    public PublicProfile() {
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public PublicProfile(String uid, String fullName) {
        this.uid = uid;
        this.fullName = fullName;
        this.profileVersion = 1;
        this.preferredLanguage = "en";
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public static PublicProfile fromPrivate(UserProfile userProfile) {
        if (userProfile == null) {
            return null;
        }
        PublicProfile pub = new PublicProfile();
        pub.setUid(userProfile.getUid());
        pub.setFullName(userProfile.getFullName());
        pub.setProfileImageUrl(userProfile.getProfileImageUrl());
        pub.setBio(userProfile.getBio());
        pub.setPreferredLanguage(userProfile.getPreferredLanguage());
        pub.setProfileVersion(userProfile.getProfileVersion());
        pub.setCreatedAt(userProfile.getCreatedAt());
        pub.setUpdatedAt(userProfile.getUpdatedAt());
        return pub;
    }

    public String getUid() {
        return uid;
    }

    public void setUid(String uid) {
        this.uid = uid;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getProfileImageUrl() {
        return profileImageUrl;
    }

    public void setProfileImageUrl(String profileImageUrl) {
        this.profileImageUrl = profileImageUrl;
    }

    public String getBio() {
        return bio;
    }

    public void setBio(String bio) {
        this.bio = bio;
    }

    public String getPreferredLanguage() {
        return preferredLanguage;
    }

    public void setPreferredLanguage(String preferredLanguage) {
        this.preferredLanguage = preferredLanguage;
    }

    public List<String> getPublicRoleBadges() {
        return publicRoleBadges != null ? publicRoleBadges : Collections.emptyList();
    }

    public void setPublicRoleBadges(List<String> publicRoleBadges) {
        this.publicRoleBadges = publicRoleBadges != null ? publicRoleBadges : new ArrayList<>();
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
