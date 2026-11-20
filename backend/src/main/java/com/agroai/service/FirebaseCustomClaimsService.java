package com.agroai.service;

import com.agroai.config.FirebaseConfig;
import com.agroai.util.KeyEncoder;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.UserRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

/**
 * Trusted backend service for provisioning Firebase Auth custom user claims.
 * Ensures the canonical safeUid claim is synchronized on registration, reconciliation,
 * and profile access while preserving all existing custom claims.
 */
@Service
public class FirebaseCustomClaimsService {

    private static final Logger log = LoggerFactory.getLogger(FirebaseCustomClaimsService.class);
    private final FirebaseConfig firebaseConfig;

    public FirebaseCustomClaimsService(FirebaseConfig firebaseConfig) {
        this.firebaseConfig = firebaseConfig;
    }

    /**
     * Synchronizes the safeUid custom user claim for the given UID.
     * Preserves all other existing custom claims.
     *
     * @param uid raw Firebase UID
     * @return the computed safeUid
     */
    public String syncSafeUidClaim(String uid) {
        if (uid == null || uid.trim().isEmpty()) {
            throw new IllegalArgumentException("UID cannot be null or empty");
        }
        String cleanUid = uid.trim();
        String safeUid = KeyEncoder.encodeUid(cleanUid);

        if (firebaseConfig.isInitialized()) {
            try {
                UserRecord userRecord = FirebaseAuth.getInstance().getUser(cleanUid);
                Map<String, Object> existingClaims = userRecord.getCustomClaims();
                Map<String, Object> updatedClaims = existingClaims != null ? new HashMap<>(existingClaims) : new HashMap<>();

                if (!safeUid.equals(updatedClaims.get("safeUid"))) {
                    updatedClaims.put("safeUid", safeUid);
                    FirebaseAuth.getInstance().setCustomUserClaims(cleanUid, updatedClaims);
                    log.info("Synchronized custom claim safeUid for user {}: {}", cleanUid, safeUid);
                }
            } catch (Exception e) {
                log.warn("Failed to synchronize custom claim safeUid for user {}: {}", cleanUid, e.getMessage());
            }
        }
        return safeUid;
    }
}
