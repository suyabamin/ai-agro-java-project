package com.agroai.repository;

import com.agroai.config.FirebaseConfig;
import com.agroai.exception.DatabaseUnavailableException;
import com.agroai.model.FarmMembership;
import com.agroai.model.FarmRole;
import com.agroai.model.MembershipStatus;
import com.agroai.util.KeyEncoder;
import com.google.cloud.Timestamp;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.google.cloud.firestore.QuerySnapshot;
import com.google.cloud.firestore.Transaction;
import com.google.firebase.cloud.FirestoreClient;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Production Cloud Firestore Farm Membership Repository.
 *
 * Implements strict environment separation:
 * - Production / Live Mode (Firebase initialized): All operations execute against live Cloud Firestore collection 'farm_members'.
 *   Failures FAIL CLOSED with DatabaseUnavailableException.
 * - Test / Dev Mode (Unconfigured): Operates against thread-safe in-memory maps for offline testing.
 */
@Repository
public class FarmMembershipRepository {

    private static final Logger log = LoggerFactory.getLogger(FarmMembershipRepository.class);

    private final FirebaseConfig firebaseConfig;
    private final Environment environment;

    private final Map<String, FarmMembership> memoryMemberships = new ConcurrentHashMap<>();
    private final Map<String, ReentrantLock> membershipLocks = new ConcurrentHashMap<>();

    public FarmMembershipRepository(FirebaseConfig firebaseConfig, Environment environment) {
        this.firebaseConfig = firebaseConfig;
        this.environment = environment;
    }

    @PostConstruct
    public void validateEnvironmentSafety() {
        if (environment != null) {
            List<String> activeProfiles = Arrays.asList(environment.getActiveProfiles());
            boolean isProd = activeProfiles.contains("prod") || activeProfiles.contains("production");
            if (isProd && !firebaseConfig.isInitialized()) {
                throw new IllegalStateException("CRITICAL SECURITY ERROR: Production profile requires live Cloud Firestore. In-memory farm membership repository fallback is strictly forbidden in production.");
            }
        }
    }

    private ReentrantLock getLockForMembership(String docId) {
        return membershipLocks.computeIfAbsent(docId, k -> new ReentrantLock());
    }

    private void checkConfiguredOrReady() {
        if (firebaseConfig.isConfigured() && !firebaseConfig.isInitialized()) {
            throw new DatabaseUnavailableException("Firebase configured but initialization failed ("
                    + firebaseConfig.getInitializationMessage() + "). In-memory fallback is disabled.");
        }
    }

    public Optional<FarmMembership> findMembership(String farmId, String rawUserId) {
        if (farmId == null || rawUserId == null) {
            return Optional.empty();
        }
        checkConfiguredOrReady();
        String docId = KeyEncoder.membershipDocId(farmId, rawUserId);

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                DocumentSnapshot doc = db.collection("farm_members").document(docId).get().get();
                if (doc.exists()) {
                    return Optional.ofNullable(mapDocumentToMembership(doc));
                }
                return Optional.empty();
            } catch (Exception e) {
                log.error("Live Firestore read failed for farm_members/{}: {}", docId, e.getMessage());
                throw new DatabaseUnavailableException("Failed to read farm membership from Firestore: " + e.getMessage(), e);
            }
        }

        return Optional.ofNullable(memoryMemberships.get(docId));
    }

    public Optional<FarmMembership> findMembershipInTransaction(Transaction transaction, String farmId, String rawUserId) {
        if (farmId == null || rawUserId == null) return Optional.empty();
        String docId = KeyEncoder.membershipDocId(farmId, rawUserId);
        checkConfiguredOrReady();
        if (firebaseConfig.isInitialized()) {
            if (transaction == null) return findMembership(farmId, rawUserId);
            try {
                Firestore db = FirestoreClient.getFirestore();
                DocumentSnapshot doc = transaction.get(db.collection("farm_members").document(docId)).get();
                return doc.exists() ? Optional.ofNullable(mapDocumentToMembership(doc)) : Optional.empty();
            } catch (Exception e) {
                throw new DatabaseUnavailableException("Failed to read farm membership in transaction: " + e.getMessage(), e);
            }
        }
        return Optional.ofNullable(memoryMemberships.get(docId));
    }

    public void saveMembership(FarmMembership membership) {
        if (membership == null || membership.getFarmId() == null || membership.getUserId() == null) {
            throw new IllegalArgumentException("Membership, farmId, and userId cannot be null");
        }
        checkConfiguredOrReady();
        String docId = KeyEncoder.membershipDocId(membership.getFarmId(), membership.getUserId());
        membership.setMembershipId(docId);
        membership.setUpdatedAt(Instant.now());

        ReentrantLock lock = getLockForMembership(docId);
        lock.lock();
        try {
            if (firebaseConfig.isInitialized()) {
                try {
                    Firestore db = FirestoreClient.getFirestore();
                    db.runTransaction(transaction -> {
                        DocumentReference ref = db.collection("farm_members").document(docId);
                        transaction.set(ref, mapMembershipToMap(membership));
                        return null;
                    }).get();
                    return;
                } catch (Exception e) {
                    log.error("Live Firestore save failed for farm_members/{}: {}", docId, e.getMessage());
                    throw new DatabaseUnavailableException("Failed to save farm membership to Firestore: " + e.getMessage(), e);
                }
            }

            memoryMemberships.put(docId, membership);
        } finally {
            lock.unlock();
        }
    }

    public void saveMembershipInTransaction(Transaction transaction, FarmMembership membership) {
        if (membership == null || membership.getFarmId() == null || membership.getUserId() == null) {
            throw new IllegalArgumentException("Membership, farmId, and userId cannot be null");
        }
        String docId = KeyEncoder.membershipDocId(membership.getFarmId(), membership.getUserId());
        membership.setMembershipId(docId);
        membership.setUpdatedAt(Instant.now());

        if (firebaseConfig.isInitialized()) {
            Firestore db = FirestoreClient.getFirestore();
            DocumentReference ref = db.collection("farm_members").document(docId);
            transaction.set(ref, mapMembershipToMap(membership));
        } else {
            memoryMemberships.put(docId, membership);
        }
    }

    public void revokeMembership(String farmId, String rawUserId) {
        if (farmId == null || rawUserId == null) {
            return;
        }
        checkConfiguredOrReady();
        String docId = KeyEncoder.membershipDocId(farmId, rawUserId);

        ReentrantLock lock = getLockForMembership(docId);
        lock.lock();
        try {
            if (firebaseConfig.isInitialized()) {
                try {
                    Firestore db = FirestoreClient.getFirestore();
                    db.runTransaction(transaction -> {
                        DocumentReference ref = db.collection("farm_members").document(docId);
                        DocumentSnapshot snap = transaction.get(ref).get();
                        if (snap.exists()) {
                            FarmMembership existing = mapDocumentToMembership(snap);
                            existing.setStatus(MembershipStatus.REVOKED);
                            existing.setRevokedAt(Instant.now());
                            existing.setUpdatedAt(Instant.now());
                            transaction.set(ref, mapMembershipToMap(existing));
                        }
                        return null;
                    }).get();
                    return;
                } catch (Exception e) {
                    log.error("Live Firestore revoke failed for farm_members/{}: {}", docId, e.getMessage());
                    throw new DatabaseUnavailableException("Failed to revoke farm membership in Firestore: " + e.getMessage(), e);
                }
            }

            FarmMembership existing = memoryMemberships.get(docId);
            if (existing != null) {
                existing.setStatus(MembershipStatus.REVOKED);
                existing.setRevokedAt(Instant.now());
                existing.setUpdatedAt(Instant.now());
                memoryMemberships.put(docId, existing);
            }
        } finally {
            lock.unlock();
        }
    }

    public List<FarmMembership> findActiveMembershipsByUser(String rawUserId) {
        if (rawUserId == null || rawUserId.trim().isEmpty()) {
            return List.of();
        }
        checkConfiguredOrReady();
        String cleanUid = rawUserId.trim();

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                QuerySnapshot snap = db.collection("farm_members")
                        .whereEqualTo("userId", cleanUid)
                        .whereEqualTo("status", "ACTIVE")
                        .get().get();
                List<FarmMembership> result = new ArrayList<>();
                for (QueryDocumentSnapshot doc : snap.getDocuments()) {
                    result.add(mapDocumentToMembership(doc));
                }
                return result;
            } catch (Exception e) {
                log.error("Live Firestore query failed for user farm_members: {}", e.getMessage());
                throw new DatabaseUnavailableException("Failed to query user farm memberships: " + e.getMessage(), e);
            }
        }

        String safeUid = KeyEncoder.encodeUid(cleanUid);
        List<FarmMembership> result = new ArrayList<>();
        for (FarmMembership m : memoryMemberships.values()) {
            if (m.getStatus() == MembershipStatus.ACTIVE && KeyEncoder.encodeUid(m.getUserId()).equals(safeUid)) {
                result.add(m);
            }
        }
        return result;
    }

    public List<FarmMembership> findMembersByFarm(String farmId) {
        if (farmId == null || farmId.trim().isEmpty()) {
            return List.of();
        }
        checkConfiguredOrReady();
        String cleanFarmId = farmId.trim();

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                QuerySnapshot snap = db.collection("farm_members")
                        .whereEqualTo("farmId", cleanFarmId)
                        .get().get();
                List<FarmMembership> result = new ArrayList<>();
                for (QueryDocumentSnapshot doc : snap.getDocuments()) {
                    result.add(mapDocumentToMembership(doc));
                }
                return result;
            } catch (Exception e) {
                log.error("Live Firestore query failed for farm memberships {}: {}", cleanFarmId, e.getMessage());
                throw new DatabaseUnavailableException("Failed to query farm members: " + e.getMessage(), e);
            }
        }

        List<FarmMembership> result = new ArrayList<>();
        for (FarmMembership m : memoryMemberships.values()) {
            if (cleanFarmId.equals(m.getFarmId())) {
                result.add(m);
            }
        }
        return result;
    }

    public long countActiveOwners(String farmId) {
        if (farmId == null || farmId.trim().isEmpty()) {
            return 0;
        }
        return findMembersByFarm(farmId).stream()
                .filter(m -> m.getRole() == FarmRole.OWNER && m.getStatus() == MembershipStatus.ACTIVE)
                .count();
    }

    public void clearAllForTesting() {
        memoryMemberships.clear();
        membershipLocks.clear();
    }

    // --- Serialization Helpers ---

    private FarmMembership mapDocumentToMembership(DocumentSnapshot doc) {
        FarmMembership m = new FarmMembership();
        m.setMembershipId(doc.getString("membershipId"));
        m.setFarmId(doc.getString("farmId"));
        m.setUserId(doc.getString("userId"));

        String role = doc.getString("role");
        m.setRole(role != null ? FarmRole.valueOf(role) : FarmRole.OBSERVER);

        String status = doc.getString("status");
        m.setStatus(status != null ? MembershipStatus.valueOf(status) : MembershipStatus.ACTIVE);

        Timestamp joinedTs = doc.getTimestamp("joinedAt");
        m.setJoinedAt(joinedTs != null ? joinedTs.toDate().toInstant() : Instant.now());

        Timestamp upTs = doc.getTimestamp("updatedAt");
        m.setUpdatedAt(upTs != null ? upTs.toDate().toInstant() : Instant.now());

        Timestamp revTs = doc.getTimestamp("revokedAt");
        m.setRevokedAt(revTs != null ? revTs.toDate().toInstant() : null);

        m.setCreatedByUid(doc.getString("createdByUid"));
        m.setUpdatedByUid(doc.getString("updatedByUid"));
        return m;
    }

    private Map<String, Object> mapMembershipToMap(FarmMembership m) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("membershipId", m.getMembershipId());
        map.put("farmId", m.getFarmId());
        map.put("userId", m.getUserId());
        map.put("safeUid", KeyEncoder.encodeUid(m.getUserId()));
        map.put("role", m.getRole() != null ? m.getRole().name() : "OBSERVER");
        map.put("status", m.getStatus() != null ? m.getStatus().name() : "ACTIVE");
        map.put("joinedAt", m.getJoinedAt() != null ? Timestamp.ofTimeSecondsAndNanos(m.getJoinedAt().getEpochSecond(), m.getJoinedAt().getNano()) : Timestamp.now());
        map.put("updatedAt", m.getUpdatedAt() != null ? Timestamp.ofTimeSecondsAndNanos(m.getUpdatedAt().getEpochSecond(), m.getUpdatedAt().getNano()) : Timestamp.now());
        if (m.getRevokedAt() != null) {
            map.put("revokedAt", Timestamp.ofTimeSecondsAndNanos(m.getRevokedAt().getEpochSecond(), m.getRevokedAt().getNano()));
        }
        map.put("createdByUid", m.getCreatedByUid());
        map.put("updatedByUid", m.getUpdatedByUid());
        return map;
    }
}
