package com.agroai.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class UpdateProfileRequest {

    @NotBlank(message = "Full name is required")
    @Size(min = 2, max = 100, message = "Full name must be between 2 and 100 characters")
    private String fullName;

    @Pattern(regexp = "^\\+?[0-9]{7,15}$", message = "Phone number must be a valid E.164 format (e.g. +8801700000000)")
    private String phoneNumber;

    @Size(max = 500, message = "Bio cannot exceed 500 characters")
    private String bio;

    @Size(max = 500, message = "Profile image URL cannot exceed 500 characters")
    private String profileImageUrl;

    @Pattern(regexp = "^(en|bn)$", message = "Preferred language must be 'en' or 'bn'")
    private String preferredLanguage = "en";

    @NotNull(message = "Expected version is required for optimistic concurrency control")
    @Min(value = 1, message = "Expected version must be 1 or greater")
    private Integer expectedVersion;

    public UpdateProfileRequest() {
    }

    public UpdateProfileRequest(String fullName, String phoneNumber, String bio, String profileImageUrl, String preferredLanguage, Integer expectedVersion) {
        this.fullName = fullName;
        this.phoneNumber = phoneNumber;
        this.bio = bio;
        this.profileImageUrl = profileImageUrl;
        this.preferredLanguage = preferredLanguage != null ? preferredLanguage : "en";
        this.expectedVersion = expectedVersion;
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

    public Integer getExpectedVersion() {
        return expectedVersion;
    }

    public void setExpectedVersion(Integer expectedVersion) {
        this.expectedVersion = expectedVersion;
    }
}
