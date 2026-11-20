package com.agroai.dto;

import com.agroai.model.PublicProfile;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class PublicProfileDTO {

    private String uid;
    private String fullName;
    private String profileImageUrl;
    private String bio;
    private String preferredLanguage;
    private List<String> publicRoleBadges = new ArrayList<>();
    private int profileVersion;
    private Instant createdAt;

    public PublicProfileDTO() {
    }

    public static PublicProfileDTO fromEntity(PublicProfile pub) {
        if (pub == null) {
            return null;
        }
        PublicProfileDTO dto = new PublicProfileDTO();
        dto.setUid(pub.getUid());
        dto.setFullName(pub.getFullName());
        dto.setProfileImageUrl(pub.getProfileImageUrl());
        dto.setBio(pub.getBio());
        dto.setPreferredLanguage(pub.getPreferredLanguage());
        dto.setPublicRoleBadges(pub.getPublicRoleBadges());
        dto.setProfileVersion(pub.getProfileVersion());
        dto.setCreatedAt(pub.getCreatedAt());
        return dto;
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
}
