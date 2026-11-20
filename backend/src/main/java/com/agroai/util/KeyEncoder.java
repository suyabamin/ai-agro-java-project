package com.agroai.util;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Universal Deterministic Key Encoder for Cloud Firestore document identifiers.
 * Enforces path safety, collision prevention, and exact specification from Milestone 2 Revision 2.4.
 */
public final class KeyEncoder {

    private static final Pattern FIELD_ID_PATTERN = Pattern.compile("^[a-zA-Z0-9-]{1,64}$");
    private static final Pattern FARM_ID_PATTERN = Pattern.compile("^[a-zA-Z0-9-]{1,64}$");
    private static final Pattern LOCAL_FIELD_ID_PATTERN = Pattern.compile("^[a-zA-Z0-9-]{1,21}$");
    private static final Pattern JOB_ID_PATTERN = Pattern.compile("^[a-zA-Z0-9-]{1,64}$");
    private static final Pattern APPLICATION_ID_PATTERN = Pattern.compile("^[a-zA-Z0-9:_=-]{1,128}$");
    private static final Pattern ASSIGNMENT_ID_PATTERN = Pattern.compile("^asgn_fld_[a-zA-Z0-9_-]{1,120}::uid_[a-zA-Z0-9_-]{1,128}$");

    private KeyEncoder() {
        // Utility class
    }

    /**
     * Universally encodes any Firebase UID into a deterministic, collision-safe, path-safe string.
     * Uses bijective RFC 4648 Base64URL without padding over UTF-8 bytes with a "uid_" prefix.
     *
     * @param rawUid the raw Firebase UID (standard or custom)
     * @return safe, deterministic identifier starting with "uid_"
     */
    public static String encodeUid(String rawUid) {
        if (rawUid == null || rawUid.trim().isEmpty()) {
            throw new IllegalArgumentException("UID cannot be null or blank");
        }
        String cleanUid = rawUid.trim();
        String base64Url = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(cleanUid.getBytes(StandardCharsets.UTF_8));
        return "uid_" + base64Url;
    }

    /**
     * Validates and formats a field ID.
     * Rejects path-breaking characters such as slashes, colons, dots, spaces, or non-alphanumeric chars.
     *
     * @param fieldId raw field ID
     * @return clean validated fieldId
     */
    public static String validateFieldId(String fieldId) {
        if (fieldId == null || !FIELD_ID_PATTERN.matcher(fieldId.trim()).matches()) {
            throw new IllegalArgumentException("Invalid field ID: must be 1-64 alphanumeric or hyphen characters");
        }
        return fieldId.trim();
    }

    /**
     * Validates and formats a farm ID.
     *
     * @param farmId raw farm ID
     * @return clean validated farmId
     */
    public static String validateFarmId(String farmId) {
        if (farmId == null || !FARM_ID_PATTERN.matcher(farmId.trim()).matches()) {
            throw new IllegalArgumentException("Invalid farm ID: must be 1-64 alphanumeric or hyphen characters");
        }
        return farmId.trim();
    }

    /**
     * Constructs a deterministic collision-safe farm membership document ID.
     * Format: mbr_${farmId}::${safeUid(rawUserId)}
     */
    public static String membershipDocId(String farmId, String rawUserId) {
        String cleanFarmId = validateFarmId(farmId);
        String safeUid = encodeUid(rawUserId);
        return "mbr_" + cleanFarmId + "::" + safeUid;
    }

    /**
     * Validates and formats a local field ID slug within a farm.
     * Constraint: 1-21 alphanumeric or hyphen characters.
     */
    public static String validateLocalFieldId(String localFieldId) {
        if (localFieldId == null || !LOCAL_FIELD_ID_PATTERN.matcher(localFieldId.trim()).matches()) {
            throw new IllegalArgumentException("Invalid local field ID: must be 1-21 alphanumeric or hyphen characters");
        }
        return localFieldId.trim();
    }

    /**
     * Constructs a deterministic canonical field document ID.
     * Format: {farmId}--{localFieldId} <= 64 chars
     */
    public static String fieldDocId(String farmId, String localFieldId) {
        String cleanFarmId = validateFarmId(farmId);
        String cleanLocalId = validateLocalFieldId(localFieldId);
        String composite = cleanFarmId + "--" + cleanLocalId;
        return validateFieldId(composite);
    }

    /**
     * Constructs a deterministic collision-safe field assignment document ID.
     * Format: asgn_fld_${fieldId}::${safeUid(rawFarmerId)}
     */
    public static String assignmentDocId(String fieldId, String rawFarmerId) {
        String cleanFieldId = validateFieldId(fieldId);
        String safeUid = encodeUid(rawFarmerId);
        return "asgn_fld_" + cleanFieldId + "::" + safeUid;
    }

    /** Immutable ID for a single assignment tenure. Pair uniqueness lives in the active-pair lock. */
    public static String newAssignmentTenureId() {
        return "asgn_tenure_" + UUID.randomUUID();
    }

    /**
     * Validates and formats a field assignment document ID.
     */
    public static String validateAssignmentId(String assignmentId) {
        if (assignmentId == null || !ASSIGNMENT_ID_PATTERN.matcher(assignmentId.trim()).matches()) {
            throw new IllegalArgumentException("Invalid assignment ID format: expected asgn_fld_{fieldId}::uid_{safeUid}");
        }
        return assignmentId.trim();
    }

    /**
     * Validates and formats a job ID.
     */
    public static String validateJobId(String jobId) {
        if (jobId == null || !JOB_ID_PATTERN.matcher(jobId.trim()).matches()) {
            throw new IllegalArgumentException("Invalid job ID: must be 1-64 alphanumeric or hyphen characters");
        }
        return jobId.trim();
    }

    /**
     * Validates and formats an application ID.
     */
    public static String validateApplicationId(String applicationId) {
        if (applicationId == null || !APPLICATION_ID_PATTERN.matcher(applicationId.trim()).matches()) {
            throw new IllegalArgumentException("Invalid application ID: must be 1-128 alphanumeric, colon, underscore, hyphen or equals characters");
        }
        return applicationId.trim();
    }

    /**
     * Constructs a deterministic collision-safe job application document ID.
     * Format: app_${jobId}::${safeUid(rawApplicantUid)}
     */
    public static String applicationDocId(String jobId, String rawApplicantUid) {
        String cleanJobId = validateJobId(jobId);
        String safeUid = encodeUid(rawApplicantUid);
        return "app_" + cleanJobId + "::" + safeUid;
    }
}
