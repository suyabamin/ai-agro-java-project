package com.agroai.model;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Quarantined orphan public profile stored in 'quarantined_public_profiles/{quarantineId}'.
 * Preserves unverified orphan documents when a public projection exists without an authoritative private profile.
 */
public class QuarantinedProfile {

    private String quarantineId;
    private String originalUid;
    private Instant capturedAt;
    private String reason;
    private Map<String, Object> originalData = new LinkedHashMap<>();
    private String resolvedBy;
    private Instant resolvedAt;

    public QuarantinedProfile() {
        this.capturedAt = Instant.now();
        this.resolvedAt = Instant.now();
    }

    public QuarantinedProfile(String quarantineId, String originalUid, String reason, Map<String, Object> originalData) {
        this.quarantineId = quarantineId;
        this.originalUid = originalUid;
        this.reason = reason;
        this.originalData = originalData != null ? originalData : new LinkedHashMap<>();
        this.capturedAt = Instant.now();
        this.resolvedBy = "SYSTEM_INITIALIZE_RECOVERY";
        this.resolvedAt = Instant.now();
    }

    public String getQuarantineId() {
        return quarantineId;
    }

    public void setQuarantineId(String quarantineId) {
        this.quarantineId = quarantineId;
    }

    public String getOriginalUid() {
        return originalUid;
    }

    public void setOriginalUid(String originalUid) {
        this.originalUid = originalUid;
    }

    public Instant getCapturedAt() {
        return capturedAt;
    }

    public void setCapturedAt(Instant capturedAt) {
        this.capturedAt = capturedAt;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public Map<String, Object> getOriginalData() {
        return originalData;
    }

    public void setOriginalData(Map<String, Object> originalData) {
        this.originalData = originalData != null ? originalData : new LinkedHashMap<>();
    }

    public String getResolvedBy() {
        return resolvedBy;
    }

    public void setResolvedBy(String resolvedBy) {
        this.resolvedBy = resolvedBy;
    }

    public Instant getResolvedAt() {
        return resolvedAt;
    }

    public void setResolvedAt(Instant resolvedAt) {
        this.resolvedAt = resolvedAt;
    }
}
