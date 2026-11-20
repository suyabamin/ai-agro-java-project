package com.agroai.repository;

import com.agroai.config.FirebaseConfig;
import com.agroai.dto.InitializeProfileRequest;
import com.agroai.dto.UpdateProfileRequest;
import com.agroai.exception.DatabaseUnavailableException;
import com.agroai.exception.ProfileNotFoundException;
import com.agroai.exception.StaleProfileVersionException;
import com.agroai.model.AccountStatus;
import com.agroai.model.PublicProfile;
import com.agroai.model.QuarantinedProfile;
import com.agroai.model.UserProfile;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.firebase.cloud.FirestoreClient;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Cloud Firestore User Profile Repository.
 *
 * Implements strict environment separation:
 * - Production / Live Mode (Firebase initialized): All operations execute against live Cloud Firestore.
 *   Any database failure FAILS CLOSED by throwing DatabaseUnavailableException.
 *   Zero silent fallback to in-memory maps.
 * - Test / Development Mode (Unconfigured): Operates against thread-safe in-memory maps for fast offline development.
 * - Startup Validation: Explicitly forbids uninitialized in-memory operation in 'prod'/'production' profiles.
 */
@Repository
public class FirestoreUserRepository implements UserRepository {

    private static final Logger log = LoggerFactory.getLogger(FirestoreUserRepository.class);

    private final FirebaseConfig firebaseConfig;
    private final Environment environment;

    // Resilient concurrency-safe in-memory stores for unconfigured / mock testing modes
    private final Map<String, UserProfile> memoryPrivateProfiles = new ConcurrentHashMap<>();
    private final Map<String, PublicProfile> memoryPublicProfiles = new ConcurrentHashMap<>();
    private final Map<String, QuarantinedProfile> memoryQuarantinedProfiles = new ConcurrentHashMap<>();
    private final Map<String, ReentrantLock> userLocks = new ConcurrentHashMap<>();

    public FirestoreUserRepository(FirebaseConfig firebaseConfig, Environment environment) {
        this.firebaseConfig = firebaseConfig;
        this.environment = environment;
    }

    @PostConstruct
    public void validateEnvironmentSafety() {
        if (environment != null) {
            List<String> activeProfiles = Arrays.asList(environment.getActiveProfiles());
            boolean isProd = activeProfiles.contains("prod") || activeProfiles.contains("production");
            if (isProd && !firebaseConfig.isInitialized()) {
                throw new IllegalStateException("CRITICAL SECURITY ERROR: Production profile requires live Cloud Firestore. In-memory user repository fallback is strictly forbidden in production.");
            }
        }
    }

    private ReentrantLock getLockForUser(String uid) {
        return userLocks.computeIfAbsent(uid, k -> new ReentrantLock());
    }

    private void checkConfiguredOrReady() {
        if (firebaseConfig.isConfigured() && !firebaseConfig.isInitialized()) {
            throw new DatabaseUnavailableException("Firebase credentials configured but initialization failed (" + firebaseConfig.getInitializationMessage() + "). In-memory fallback is disabled.");
        }
    }

    @Override
    public Optional<UserProfile> findPrivateProfile(String uid) {
        if (uid == null || uid.trim().isEmpty()) {
            return Optional.empty();
        }

        checkConfiguredOrReady();

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                DocumentSnapshot doc = db.collection("users").document(uid.trim()).get().get();
                if (doc.exists()) {
                    return Optional.ofNullable(mapDocumentToUserProfile(doc));
                }
                return Optional.empty();
            } catch (Exception e) {
                log.error("Live Firestore read failed for users/{}: {}", uid, e.getMessage());
                throw new DatabaseUnavailableException("Cloud Firestore read failed for user " + uid + ": " + e.getMessage(), e);
            }
        }

        return Optional.ofNullable(memoryPrivateProfiles.get(uid.trim()));
    }

    @Override
    public Optional<UserProfile> findPrivateProfileInTransaction(com.google.cloud.firestore.Transaction transaction, String uid) {
        if (uid == null || uid.isBlank()) return Optional.empty();
        checkConfiguredOrReady();
        if (firebaseConfig.isInitialized()) {
            if (transaction == null) return findPrivateProfile(uid);
            try {
                Firestore db = FirestoreClient.getFirestore();
                DocumentSnapshot doc = transaction.get(db.collection("users").document(uid.trim())).get();
                return doc.exists() ? Optional.ofNullable(mapDocumentToUserProfile(doc)) : Optional.empty();
            } catch (Exception e) {
                throw new DatabaseUnavailableException("Failed to read user profile in transaction: " + e.getMessage(), e);
            }
        }
        return findPrivateProfile(uid);
    }

    @Override
    public Optional<PublicProfile> findPublicProfile(String uid) {
        if (uid == null || uid.trim().isEmpty()) {
            return Optional.empty();
        }

        checkConfiguredOrReady();

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                DocumentSnapshot doc = db.collection("public_profiles").document(uid.trim()).get().get();
                if (doc.exists()) {
                    return Optional.ofNullable(mapDocumentToPublicProfile(doc));
                }
                return Optional.empty();
            } catch (Exception e) {
                log.error("Live Firestore read failed for public_profiles/{}: {}", uid, e.getMessage());
                throw new DatabaseUnavailableException("Cloud Firestore read failed for public profile " + uid + ": " + e.getMessage(), e);
            }
        }

        return Optional.ofNullable(memoryPublicProfiles.get(uid.trim()));
    }

    @Override
    public UserProfile initializeProfile(String uid, String email, InitializeProfileRequest request) {
        String cleanUid = uid.trim();
        checkConfiguredOrReady();
        ReentrantLock lock = getLockForUser(cleanUid);
        lock.lock();
        try {
            if (firebaseConfig.isInitialized()) {
                try {
                    Firestore db = FirestoreClient.getFirestore();
                    return db.runTransaction(transaction -> {
                        DocumentReference privateRef = db.collection("users").document(cleanUid);
                        DocumentReference publicRef = db.collection("public_profiles").document(cleanUid);

                        DocumentSnapshot privateSnap = transaction.get(privateRef).get();
                        DocumentSnapshot publicSnap = transaction.get(publicRef).get();

                        boolean privateExists = privateSnap.exists();
                        boolean publicExists = publicSnap.exists();

                        // Case 2: Fully initialized
                        if (privateExists && publicExists) {
                            return mapDocumentToUserProfile(privateSnap);
                        }

                        // Case 3: Private exists, Public missing -> Rebuild public from private
                        if (privateExists && !publicExists) {
                            UserProfile priv = mapDocumentToUserProfile(privateSnap);
                            PublicProfile pub = PublicProfile.fromPrivate(priv);
                            transaction.set(publicRef, mapPublicProfileToMap(pub));
                            return priv;
                        }

                        // Case 4: Private missing, Public exists -> Quarantine orphan public, create private
                        if (!privateExists && publicExists) {
                            String quarantineId = "qnt_" + cleanUid + "_" + System.currentTimeMillis();
                            DocumentReference quarantineRef = db.collection("quarantined_public_profiles").document(quarantineId);
                            Map<String, Object> orphanData = publicSnap.getData();
                            QuarantinedProfile qp = new QuarantinedProfile(quarantineId, cleanUid,
                                    "ORPHAN_PUBLIC_PROJECTION_WITHOUT_PRIVATE_PROFILE", orphanData);
                            transaction.set(quarantineRef, mapQuarantinedToMap(qp));

                            // Create fresh private profile
                            UserProfile priv = createFreshUserProfile(cleanUid, email, request);
                            PublicProfile pub = PublicProfile.fromPrivate(priv);
                            transaction.set(privateRef, mapUserProfileToMap(priv));
                            transaction.set(publicRef, mapPublicProfileToMap(pub));
                            return priv;
                        }

                        // Case 1: Fresh user
                        UserProfile priv = createFreshUserProfile(cleanUid, email, request);
                        PublicProfile pub = PublicProfile.fromPrivate(priv);
                        transaction.set(privateRef, mapUserProfileToMap(priv));
                        transaction.set(publicRef, mapPublicProfileToMap(pub));
                        return priv;
                    }).get();
                } catch (Exception e) {
                    log.error("Firestore transaction failed in initializeProfile: {}", e.getMessage(), e);
                    throw new DatabaseUnavailableException("Firestore transaction failed during profile initialization: " + e.getMessage(), e);
                }
            }

            // In-Memory Engine (Dev / Test Mode Only)
            UserProfile existingPrivate = memoryPrivateProfiles.get(cleanUid);
            PublicProfile existingPublic = memoryPublicProfiles.get(cleanUid);

            boolean privateExists = (existingPrivate != null);
            boolean publicExists = (existingPublic != null);

            // Case 2: Fully initialized
            if (privateExists && publicExists) {
                return existingPrivate;
            }

            // Case 3: Private exists, Public missing -> Rebuild public from private
            if (privateExists && !publicExists) {
                PublicProfile pub = PublicProfile.fromPrivate(existingPrivate);
                memoryPublicProfiles.put(cleanUid, pub);
                return existingPrivate;
            }

            // Case 4: Private missing, Public exists -> Quarantine orphan public, create private
            if (!privateExists && publicExists) {
                String quarantineId = "qnt_" + cleanUid + "_" + System.currentTimeMillis();
                Map<String, Object> orphanData = mapPublicProfileToMap(existingPublic);
                QuarantinedProfile qp = new QuarantinedProfile(quarantineId, cleanUid,
                        "ORPHAN_PUBLIC_PROJECTION_WITHOUT_PRIVATE_PROFILE", orphanData);
                memoryQuarantinedProfiles.put(quarantineId, qp);

                // Create fresh profile
                UserProfile priv = createFreshUserProfile(cleanUid, email, request);
                PublicProfile pub = PublicProfile.fromPrivate(priv);
                memoryPrivateProfiles.put(cleanUid, priv);
                memoryPublicProfiles.put(cleanUid, pub);
                return priv;
            }

            // Case 1: Neither exists
            UserProfile priv = createFreshUserProfile(cleanUid, email, request);
            PublicProfile pub = PublicProfile.fromPrivate(priv);
            memoryPrivateProfiles.put(cleanUid, priv);
            memoryPublicProfiles.put(cleanUid, pub);
            return priv;

        } finally {
            lock.unlock();
        }
    }

    @Override
    public UserProfile updateProfile(String uid, UpdateProfileRequest request) {
        String cleanUid = uid.trim();
        checkConfiguredOrReady();
        ReentrantLock lock = getLockForUser(cleanUid);
        lock.lock();
        try {
            if (firebaseConfig.isInitialized()) {
                try {
                    Firestore db = FirestoreClient.getFirestore();
                    return db.runTransaction(transaction -> {
                        DocumentReference privateRef = db.collection("users").document(cleanUid);
                        DocumentReference publicRef = db.collection("public_profiles").document(cleanUid);

                        DocumentSnapshot privateSnap = transaction.get(privateRef).get();
                        if (!privateSnap.exists()) {
                            throw new ProfileNotFoundException(cleanUid, true);
                        }

                        UserProfile priv = mapDocumentToUserProfile(privateSnap);
                        if (priv.getProfileVersion() != request.getExpectedVersion()) {
                            throw new StaleProfileVersionException(request.getExpectedVersion(), priv.getProfileVersion());
                        }

                        // Increment version
                        int newVersion = priv.getProfileVersion() + 1;
                        priv.setFullName(request.getFullName().trim());
                        if (request.getPhoneNumber() != null) {
                            priv.setPhoneNumber(request.getPhoneNumber().trim());
                        }
                        if (request.getBio() != null) {
                            priv.setBio(request.getBio().trim());
                        }
                        if (request.getProfileImageUrl() != null) {
                            priv.setProfileImageUrl(request.getProfileImageUrl().trim());
                        }
                        if (request.getPreferredLanguage() != null) {
                            priv.setPreferredLanguage(request.getPreferredLanguage().trim());
                        }
                        priv.setProfileVersion(newVersion);
                        priv.setUpdatedAt(Instant.now());

                        PublicProfile pub = PublicProfile.fromPrivate(priv);

                        transaction.set(privateRef, mapUserProfileToMap(priv));
                        transaction.set(publicRef, mapPublicProfileToMap(pub));

                        return priv;
                    }).get();
                } catch (ExecutionException e) {
                    if (e.getCause() instanceof ProfileNotFoundException pnfe) throw pnfe;
                    if (e.getCause() instanceof StaleProfileVersionException spve) throw spve;
                    log.error("Firestore update transaction execution failed: {}", e.getMessage(), e);
                    throw new DatabaseUnavailableException("Firestore update transaction failed: " + e.getMessage(), e);
                } catch (ProfileNotFoundException | StaleProfileVersionException e) {
                    throw e;
                } catch (Exception e) {
                    log.error("Firestore update transaction failed: {}", e.getMessage(), e);
                    throw new DatabaseUnavailableException("Firestore update failed: " + e.getMessage(), e);
                }
            }

            // In-Memory Engine (Dev / Test Mode Only)
            UserProfile priv = memoryPrivateProfiles.get(cleanUid);
            if (priv == null) {
                throw new ProfileNotFoundException(cleanUid, true);
            }

            if (priv.getProfileVersion() != request.getExpectedVersion()) {
                throw new StaleProfileVersionException(request.getExpectedVersion(), priv.getProfileVersion());
            }

            int newVersion = priv.getProfileVersion() + 1;
            priv.setFullName(request.getFullName().trim());
            if (request.getPhoneNumber() != null) {
                priv.setPhoneNumber(request.getPhoneNumber().trim());
            }
            if (request.getBio() != null) {
                priv.setBio(request.getBio().trim());
            }
            if (request.getProfileImageUrl() != null) {
                priv.setProfileImageUrl(request.getProfileImageUrl().trim());
            }
            if (request.getPreferredLanguage() != null) {
                priv.setPreferredLanguage(request.getPreferredLanguage().trim());
            }
            priv.setProfileVersion(newVersion);
            priv.setUpdatedAt(Instant.now());

            PublicProfile pub = PublicProfile.fromPrivate(priv);
            memoryPrivateProfiles.put(cleanUid, priv);
            memoryPublicProfiles.put(cleanUid, pub);

            return priv;

        } finally {
            lock.unlock();
        }
    }

    @Override
    public UserProfile reconcileProfile(String uid) {
        String cleanUid = uid.trim();
        checkConfiguredOrReady();
        ReentrantLock lock = getLockForUser(cleanUid);
        lock.lock();
        try {
            if (firebaseConfig.isInitialized()) {
                try {
                    Firestore db = FirestoreClient.getFirestore();
                    return db.runTransaction(transaction -> {
                        DocumentReference privateRef = db.collection("users").document(cleanUid);
                        DocumentReference publicRef = db.collection("public_profiles").document(cleanUid);

                        DocumentSnapshot privateSnap = transaction.get(privateRef).get();
                        DocumentSnapshot publicSnap = transaction.get(publicRef).get();

                        if (!privateSnap.exists()) {
                            if (publicSnap.exists()) {
                                String qId = "qnt_" + cleanUid + "_" + System.currentTimeMillis();
                                DocumentReference qRef = db.collection("quarantined_public_profiles").document(qId);
                                QuarantinedProfile qp = new QuarantinedProfile(qId, cleanUid,
                                        "RECONCILE_ORPHAN_PUBLIC_PROJECTION", publicSnap.getData());
                                transaction.set(qRef, mapQuarantinedToMap(qp));
                                transaction.delete(publicRef);
                            }
                            throw new ProfileNotFoundException(cleanUid, true);
                        }

                        UserProfile priv = mapDocumentToUserProfile(privateSnap);
                        PublicProfile pub = PublicProfile.fromPrivate(priv);
                        transaction.set(publicRef, mapPublicProfileToMap(pub));
                        return priv;
                    }).get();
                } catch (ExecutionException e) {
                    if (e.getCause() instanceof ProfileNotFoundException pnfe) throw pnfe;
                    log.error("Firestore reconciliation transaction execution failed: {}", e.getMessage(), e);
                    throw new DatabaseUnavailableException("Firestore reconciliation failed: " + e.getMessage(), e);
                } catch (ProfileNotFoundException e) {
                    throw e;
                } catch (Exception e) {
                    log.error("Firestore reconciliation failed: {}", e.getMessage(), e);
                    throw new DatabaseUnavailableException("Firestore reconciliation failed: " + e.getMessage(), e);
                }
            }

            // In-Memory Engine (Dev / Test Mode Only)
            UserProfile priv = memoryPrivateProfiles.get(cleanUid);
            PublicProfile pub = memoryPublicProfiles.get(cleanUid);

            if (priv == null) {
                if (pub != null) {
                    String qId = "qnt_" + cleanUid + "_" + System.currentTimeMillis();
                    QuarantinedProfile qp = new QuarantinedProfile(qId, cleanUid,
                            "RECONCILE_ORPHAN_PUBLIC_PROJECTION", mapPublicProfileToMap(pub));
                    memoryQuarantinedProfiles.put(qId, qp);
                    memoryPublicProfiles.remove(cleanUid);
                }
                throw new ProfileNotFoundException(cleanUid, true);
            }

            PublicProfile syncedPub = PublicProfile.fromPrivate(priv);
            memoryPublicProfiles.put(cleanUid, syncedPub);
            return priv;

        } finally {
            lock.unlock();
        }
    }

    @Override
    public void updateAccountStatus(String uid, AccountStatus status) {
        String cleanUid = uid.trim();
        checkConfiguredOrReady();
        ReentrantLock lock = getLockForUser(cleanUid);
        lock.lock();
        try {
            if (firebaseConfig.isInitialized()) {
                try {
                    Firestore db = FirestoreClient.getFirestore();
                    db.collection("users").document(cleanUid).update("accountStatus", status.name()).get();
                    return;
                } catch (Exception e) {
                    log.error("Failed to update account status in Firestore: {}", e.getMessage(), e);
                    throw new DatabaseUnavailableException("Failed to update account status: " + e.getMessage(), e);
                }
            }

            UserProfile priv = memoryPrivateProfiles.get(cleanUid);
            if (priv != null) {
                priv.setAccountStatus(status);
            }
        } finally {
            lock.unlock();
        }
    }

    @Override
    @SuppressWarnings("unchecked")
    public Optional<QuarantinedProfile> findQuarantinedProfile(String quarantineId) {
        if (quarantineId == null || quarantineId.trim().isEmpty()) {
            return Optional.empty();
        }
        checkConfiguredOrReady();
        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                DocumentSnapshot doc = db.collection("quarantined_public_profiles").document(quarantineId.trim()).get().get();
                if (doc.exists()) {
                    QuarantinedProfile qp = new QuarantinedProfile(
                            doc.getId(),
                            doc.getString("originalUid"),
                            doc.getString("reason"),
                            (Map<String, Object>) doc.get("originalData")
                    );
                    return Optional.of(qp);
                }
                return Optional.empty();
            } catch (Exception e) {
                log.error("Failed to read quarantined profile: {}", e.getMessage(), e);
                throw new DatabaseUnavailableException("Failed to read quarantined profile: " + e.getMessage(), e);
            }
        }
        return Optional.ofNullable(memoryQuarantinedProfiles.get(quarantineId.trim()));
    }

    @Override
    public void clearAllForTesting() {
        memoryPrivateProfiles.clear();
        memoryPublicProfiles.clear();
        memoryQuarantinedProfiles.clear();
    }

    public Map<String, QuarantinedProfile> getMemoryQuarantinedProfiles() {
        return memoryQuarantinedProfiles;
    }

    private UserProfile createFreshUserProfile(String uid, String email, InitializeProfileRequest request) {
        UserProfile u = new UserProfile();
        u.setUid(uid);
        u.setEmail(email);
        u.setFullName(request.getFullName().trim());
        u.setPhoneNumber(request.getPhoneNumber() != null ? request.getPhoneNumber().trim() : null);
        u.setBio(request.getBio() != null ? request.getBio().trim() : null);
        u.setPreferredLanguage(request.getPreferredLanguage() != null ? request.getPreferredLanguage().trim() : "en");
        u.setAccountStatus(AccountStatus.ACTIVE);
        u.setProfileVersion(1);
        u.setCreatedAt(Instant.now());
        u.setUpdatedAt(Instant.now());
        return u;
    }

    private UserProfile mapDocumentToUserProfile(DocumentSnapshot doc) {
        UserProfile u = new UserProfile();
        u.setUid(doc.getId());
        u.setEmail(doc.getString("email"));
        u.setFullName(doc.getString("fullName"));
        u.setPhoneNumber(doc.getString("phoneNumber"));
        u.setBio(doc.getString("bio"));
        u.setProfileImageUrl(doc.getString("profileImageUrl"));
        u.setPreferredLanguage(doc.getString("preferredLanguage") != null ? doc.getString("preferredLanguage") : "en");

        String statusStr = doc.getString("accountStatus");
        u.setAccountStatus(statusStr != null ? AccountStatus.valueOf(statusStr) : AccountStatus.ACTIVE);

        Long version = doc.getLong("profileVersion");
        u.setProfileVersion(version != null ? version.intValue() : 1);

        String createdStr = doc.getString("createdAt");
        if (createdStr != null) {
            u.setCreatedAt(Instant.parse(createdStr));
        }

        String updatedStr = doc.getString("updatedAt");
        if (updatedStr != null) {
            u.setUpdatedAt(Instant.parse(updatedStr));
        }

        return u;
    }

    private PublicProfile mapDocumentToPublicProfile(DocumentSnapshot doc) {
        PublicProfile p = new PublicProfile();
        p.setUid(doc.getId());
        p.setFullName(doc.getString("fullName"));
        p.setProfileImageUrl(doc.getString("profileImageUrl"));
        p.setBio(doc.getString("bio"));
        p.setPreferredLanguage(doc.getString("preferredLanguage") != null ? doc.getString("preferredLanguage") : "en");

        Long version = doc.getLong("profileVersion");
        p.setProfileVersion(version != null ? version.intValue() : 1);

        String createdStr = doc.getString("createdAt");
        if (createdStr != null) {
            p.setCreatedAt(Instant.parse(createdStr));
        }

        String updatedStr = doc.getString("updatedAt");
        if (updatedStr != null) {
            p.setUpdatedAt(Instant.parse(updatedStr));
        }

        return p;
    }

    private Map<String, Object> mapUserProfileToMap(UserProfile u) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("uid", u.getUid());
        map.put("email", u.getEmail());
        map.put("fullName", u.getFullName());
        map.put("phoneNumber", u.getPhoneNumber());
        map.put("bio", u.getBio());
        map.put("profileImageUrl", u.getProfileImageUrl());
        map.put("preferredLanguage", u.getPreferredLanguage());
        map.put("accountStatus", u.getAccountStatus() != null ? u.getAccountStatus().name() : AccountStatus.ACTIVE.name());
        map.put("profileVersion", u.getProfileVersion());
        map.put("createdAt", u.getCreatedAt() != null ? u.getCreatedAt().toString() : Instant.now().toString());
        map.put("updatedAt", u.getUpdatedAt() != null ? u.getUpdatedAt().toString() : Instant.now().toString());
        return map;
    }

    private Map<String, Object> mapPublicProfileToMap(PublicProfile p) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("uid", p.getUid());
        map.put("fullName", p.getFullName());
        map.put("profileImageUrl", p.getProfileImageUrl());
        map.put("bio", p.getBio());
        map.put("preferredLanguage", p.getPreferredLanguage());
        map.put("profileVersion", p.getProfileVersion());
        map.put("publicRoleBadges", p.getPublicRoleBadges());
        map.put("createdAt", p.getCreatedAt() != null ? p.getCreatedAt().toString() : Instant.now().toString());
        map.put("updatedAt", p.getUpdatedAt() != null ? p.getUpdatedAt().toString() : Instant.now().toString());
        return map;
    }

    private Map<String, Object> mapQuarantinedToMap(QuarantinedProfile q) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("quarantineId", q.getQuarantineId());
        map.put("originalUid", q.getOriginalUid());
        map.put("capturedAt", q.getCapturedAt() != null ? q.getCapturedAt().toString() : Instant.now().toString());
        map.put("reason", q.getReason());
        map.put("originalData", q.getOriginalData());
        map.put("resolvedBy", q.getResolvedBy());
        map.put("resolvedAt", q.getResolvedAt() != null ? q.getResolvedAt().toString() : Instant.now().toString());
        return map;
    }
}
