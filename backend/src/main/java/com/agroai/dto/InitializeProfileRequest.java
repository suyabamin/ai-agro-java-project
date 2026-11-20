package com.agroai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class InitializeProfileRequest {

    @NotBlank(message = "Full name is required")
    @Size(min = 2, max = 100, message = "Full name must be between 2 and 100 characters")
    private String fullName;

    @Pattern(regexp = "^\\+?[0-9]{7,15}$", message = "Phone number must be a valid E.164 format (e.g. +8801700000000)")
    private String phoneNumber;

    @Size(max = 500, message = "Bio cannot exceed 500 characters")
    private String bio;

    @Pattern(regexp = "^(en|bn)$", message = "Preferred language must be 'en' or 'bn'")
    private String preferredLanguage = "en";

    public InitializeProfileRequest() {
    }

    public InitializeProfileRequest(String fullName, String phoneNumber, String bio, String preferredLanguage) {
        this.fullName = fullName;
        this.phoneNumber = phoneNumber;
        this.bio = bio;
        this.preferredLanguage = preferredLanguage != null ? preferredLanguage : "en";
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

    public String getPreferredLanguage() {
        return preferredLanguage;
    }

    public void setPreferredLanguage(String preferredLanguage) {
        this.preferredLanguage = preferredLanguage;
    }
}
