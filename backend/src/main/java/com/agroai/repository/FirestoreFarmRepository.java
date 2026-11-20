package com.agroai.repository;

import com.agroai.config.FirebaseConfig;
import com.agroai.exception.DatabaseUnavailableException;
import com.agroai.exception.FarmNotFoundException;
import com.agroai.exception.StaleVersionException;
import com.agroai.model.Farm;
import com.agroai.model.FarmStatus;
import com.agroai.model.FarmVisibility;
import com.agroai.model.PublicFarmProjection;
import com.google.cloud.Timestamp;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.Query;
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
import java.util.concurrent.ExecutionException;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Cloud Firestore Production Farm Repository.
 *
 * Implements strict environment separation:
 * - Production / Live Mode (Firebase initialized): All operations execute against live Cloud Firestore.
 *   Failures FAIL CLOSED with DatabaseUnavailableException.
 * - Test / Dev Mode (Unconfigured): Operates against thread-safe in-memory maps for offline testing.
 */
@Repository
public class FirestoreFarmRepository implements FarmRepository {

    private static final Logger log = LoggerFactory.getLogger(FirestoreFarmRepository.class);

    private final FirebaseConfig firebaseConfig;
    private final Environment environment;

    // Concurrency-safe in-memory stores for unconfigured/mock test modes
    private final Map<String, Farm> memoryFarms = new ConcurrentHashMap<>();
    private final Map<String, PublicFarmProjection> memoryProjections = new ConcurrentHashMap<>();
    private final Map<String, ReentrantLock> farmLocks = new ConcurrentHashMap<>();

    public FirestoreFarmRepository(FirebaseConfig firebaseConfig, Environment environment) {
        this.firebaseConfig = firebaseConfig;
        this.environment = environment;
    }

    @PostConstruct
    public void validateEnvironmentSafety() {
        if (environment != null) {
            List<String> activeProfiles = Arrays.asList(environment.getActiveProfiles());
            boolean isProd = activeProfiles.contains("prod") || activeProfiles.contains("production");
            if (isProd && !firebaseConfig.isInitialized()) {
                throw new IllegalStateException("CRITICAL SECURITY ERROR: Production profile requires live Cloud Firestore. In-memory farm repository fallback is strictly forbidden in production.");
            }
        }
    }

    private ReentrantLock getLockForFarm(String farmId) {
        return farmLocks.computeIfAbsent(farmId, k -> new ReentrantLock());
    }

    private void checkConfiguredOrReady() {
        if (firebaseConfig.isConfigured() && !firebaseConfig.isInitialized()) {
            throw new DatabaseUnavailableException("Firebase configured but initialization failed ("
                    + firebaseConfig.getInitializationMessage() + "). In-memory fallback is disabled.");
        }
    }

    @Override
    public Optional<Farm> findById(String farmId) {
        if (farmId == null || farmId.trim().isEmpty()) {
            return Optional.empty();
        }
        checkConfiguredOrReady();

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                DocumentSnapshot doc = db.collection("farms").document(farmId.trim()).get().get();
                if (doc.exists()) {
                    return Optional.ofNullable(mapDocumentToFarm(doc));
                }
                return Optional.empty();
            } catch (Exception e) {
                log.error("Live Firestore read failed for farms/{}: {}", farmId, e.getMessage());
                throw new DatabaseUnavailableException("Failed to read farm from Firestore: " + e.getMessage(), e);
            }
        }

        return Optional.ofNullable(memoryFarms.get(farmId.trim()));
    }

    @Override
    public Farm save(Farm farm) {
        if (farm == null || farm.getFarmId() == null) {
            throw new IllegalArgumentException("Farm and farmId cannot be null");
        }
        checkConfiguredOrReady();
        String farmId = farm.getFarmId().trim();
        ReentrantLock lock = getLockForFarm(farmId);
        lock.lock();
        try {
            if (firebaseConfig.isInitialized()) {
                try {
                    Firestore db = FirestoreClient.getFirestore();
                    db.runTransaction(transaction -> {
                        DocumentReference ref = db.collection("farms").document(farmId);
                        transaction.set(ref, mapFarmToMap(farm));
                        return null;
                    }).get();
                    return farm;
                } catch (Exception e) {
                    log.error("Live Firestore save failed for farms/{}: {}", farmId, e.getMessage());
                    throw new DatabaseUnavailableException("Failed to save farm to Firestore: " + e.getMessage(), e);
                }
            }

            memoryFarms.put(farmId, farm);
            return farm;
        } finally {
            lock.unlock();
        }
    }

    @Override
    public Farm update(Farm farm, int expectedVersion) {
        if (farm == null || farm.getFarmId() == null) {
            throw new IllegalArgumentException("Farm and farmId cannot be null");
        }
        checkConfiguredOrReady();
        String farmId = farm.getFarmId().trim();
        ReentrantLock lock = getLockForFarm(farmId);
        lock.lock();
        try {
            if (firebaseConfig.isInitialized()) {
                try {
                    Firestore db = FirestoreClient.getFirestore();
                    return db.runTransaction(transaction -> {
                        DocumentReference ref = db.collection("farms").document(farmId);
                        DocumentSnapshot snap = transaction.get(ref).get();
                        if (!snap.exists()) {
                            throw new FarmNotFoundException(farmId);
                        }
                        Farm existing = mapDocumentToFarm(snap);
                        if (existing.getVersion() != expectedVersion) {
                            throw new StaleVersionException(expectedVersion, existing.getVersion());
                        }

                        int newVersion = existing.getVersion() + 1;
                        farm.setVersion(newVersion);
                        farm.setUpdatedAt(Instant.now());

                        transaction.set(ref, mapFarmToMap(farm));
                        return farm;
                    }).get();
                } catch (ExecutionException e) {
                    if (e.getCause() instanceof FarmNotFoundException fnfe) throw fnfe;
                    if (e.getCause() instanceof StaleVersionException sve) throw sve;
                    log.error("Firestore farm update transaction failed: {}", e.getMessage(), e);
                    throw new DatabaseUnavailableException("Firestore update transaction failed: " + e.getMessage(), e);
                } catch (FarmNotFoundException | StaleVersionException e) {
                    throw e;
                } catch (Exception e) {
                    log.error("Firestore farm update failed: {}", e.getMessage(), e);
                    throw new DatabaseUnavailableException("Firestore update failed: " + e.getMessage(), e);
                }
            }

            // In-Memory Mode
            Farm existing = memoryFarms.get(farmId);
            if (existing == null) {
                throw new FarmNotFoundException(farmId);
            }
            if (existing.getVersion() != expectedVersion) {
                throw new StaleVersionException(expectedVersion, existing.getVersion());
            }
            int newVersion = existing.getVersion() + 1;
            farm.setVersion(newVersion);
            farm.setUpdatedAt(Instant.now());
            memoryFarms.put(farmId, farm);
            return farm;
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void saveInTransaction(Transaction transaction, Farm farm) {
        if (transaction == null || farm == null) {
            throw new IllegalArgumentException("Transaction and farm cannot be null");
        }
        if (firebaseConfig.isInitialized()) {
            Firestore db = FirestoreClient.getFirestore();
            DocumentReference ref = db.collection("farms").document(farm.getFarmId().trim());
            transaction.set(ref, mapFarmToMap(farm));
        } else {
            memoryFarms.put(farm.getFarmId().trim(), farm);
        }
    }

    @Override
    public Farm findByIdInTransaction(Transaction transaction, String farmId) {
        if (farmId == null) {
            return null;
        }
        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                DocumentReference ref = db.collection("farms").document(farmId.trim());
                DocumentSnapshot snap = transaction.get(ref).get();
                if (snap.exists()) {
                    return mapDocumentToFarm(snap);
                }
                return null;
            } catch (Exception e) {
                throw new DatabaseUnavailableException("Failed reading farm in transaction: " + e.getMessage(), e);
            }
        }
        return memoryFarms.get(farmId.trim());
    }

    @Override
    public List<Farm> findByOwnerUid(String ownerUid) {
        if (ownerUid == null || ownerUid.trim().isEmpty()) {
            return List.of();
        }
        checkConfiguredOrReady();
        String cleanUid = ownerUid.trim();

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                QuerySnapshot snap = db.collection("farms")
                        .whereEqualTo("ownerUid", cleanUid)
                        .get().get();
                List<Farm> result = new ArrayList<>();
                for (QueryDocumentSnapshot doc : snap.getDocuments()) {
                    result.add(mapDocumentToFarm(doc));
                }
                return result;
            } catch (Exception e) {
                log.error("Live Firestore query failed for ownerUid={}: {}", cleanUid, e.getMessage());
                throw new DatabaseUnavailableException("Failed querying farms by owner: " + e.getMessage(), e);
            }
        }

        List<Farm> result = new ArrayList<>();
        for (Farm f : memoryFarms.values()) {
            if (cleanUid.equals(f.getOwnerUid())) {
                result.add(f);
            }
        }
        return result;
    }

    @Override
    public List<Farm> findByIds(List<String> farmIds) {
        if (farmIds == null || farmIds.isEmpty()) {
            return List.of();
        }
        checkConfiguredOrReady();

        List<Farm> result = new ArrayList<>();
        for (String id : farmIds) {
            findById(id).ifPresent(result::add);
        }
        return result;
    }

    @Override
    public Optional<PublicFarmProjection> findPublicProjection(String farmId) {
        if (farmId == null || farmId.trim().isEmpty()) {
            return Optional.empty();
        }
        checkConfiguredOrReady();

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                DocumentSnapshot doc = db.collection("public_farms").document(farmId.trim()).get().get();
                if (doc.exists()) {
                    return Optional.ofNullable(mapDocumentToProjection(doc));
                }
                return Optional.empty();
            } catch (Exception e) {
                log.error("Live Firestore read failed for public_farms/{}: {}", farmId, e.getMessage());
                throw new DatabaseUnavailableException("Failed reading public projection: " + e.getMessage(), e);
            }
        }

        return Optional.ofNullable(memoryProjections.get(farmId.trim()));
    }

    @Override
    public void savePublicProjectionInTransaction(Transaction transaction, PublicFarmProjection projection) {
        if (projection == null || projection.getFarmId() == null) {
            throw new IllegalArgumentException("Projection and farmId cannot be null");
        }
        if (firebaseConfig.isInitialized()) {
            Firestore db = FirestoreClient.getFirestore();
            DocumentReference ref = db.collection("public_farms").document(projection.getFarmId().trim());
            transaction.set(ref, mapProjectionToMap(projection));
        } else {
            memoryProjections.put(projection.getFarmId().trim(), projection);
        }
    }

    @Override
    public void deletePublicProjectionInTransaction(Transaction transaction, String farmId) {
        if (farmId == null) {
            return;
        }
        if (firebaseConfig.isInitialized()) {
            Firestore db = FirestoreClient.getFirestore();
            DocumentReference ref = db.collection("public_farms").document(farmId.trim());
            transaction.delete(ref);
        } else {
            memoryProjections.remove(farmId.trim());
        }
    }

    @Override
    public List<PublicFarmProjection> listPublicProjections(String district, String division, String cropType, int page, int size) {
        checkConfiguredOrReady();
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(100, size));

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                Query query = db.collection("public_farms")
                        .whereEqualTo("status", "ACTIVE")
                        .whereEqualTo("visibility", "PUBLIC");

                if (division != null && !division.trim().isEmpty()) {
                    query = query.whereEqualTo("division", division.trim());
                }
                if (district != null && !district.trim().isEmpty()) {
                    query = query.whereEqualTo("district", district.trim());
                }
                if (cropType != null && !cropType.trim().isEmpty()) {
                    query = query.whereArrayContains("activeCropTypes", cropType.trim().toUpperCase());
                }

                query = query.orderBy("registeredAt", Query.Direction.DESCENDING)
                        .offset(safePage * safeSize)
                        .limit(safeSize);

                QuerySnapshot snap = query.get().get();
                List<PublicFarmProjection> list = new ArrayList<>();
                for (QueryDocumentSnapshot doc : snap.getDocuments()) {
                    list.add(mapDocumentToProjection(doc));
                }
                return list;
            } catch (Exception e) {
                log.error("Live Firestore query failed for public_farms: {}", e.getMessage());
                throw new DatabaseUnavailableException("Failed to query public farms: " + e.getMessage(), e);
            }
        }

        // In-Memory Mode
        List<PublicFarmProjection> filtered = new ArrayList<>();
        for (PublicFarmProjection p : memoryProjections.values()) {
            if (!"ACTIVE".equals(p.getStatus()) || !"PUBLIC".equals(p.getVisibility())) {
                continue;
            }
            if (division != null && !division.trim().isEmpty() && !division.trim().equalsIgnoreCase(p.getDivision())) {
                continue;
            }
            if (district != null && !district.trim().isEmpty() && !district.trim().equalsIgnoreCase(p.getDistrict())) {
                continue;
            }
            if (cropType != null && !cropType.trim().isEmpty()) {
                boolean hasCrop = p.getActiveCropTypes() != null &&
                        p.getActiveCropTypes().stream().anyMatch(c -> c.equalsIgnoreCase(cropType.trim()));
                if (!hasCrop) continue;
            }
            filtered.add(p);
        }
        filtered.sort((a, b) -> b.getRegisteredAt().compareTo(a.getRegisteredAt()));
        int from = Math.min(safePage * safeSize, filtered.size());
        int to = Math.min(from + safeSize, filtered.size());
        return filtered.subList(from, to);
    }

    public void clearAllForTesting() {
        memoryFarms.clear();
        memoryProjections.clear();
        farmLocks.clear();
    }

    // --- Serialization Helpers ---

    private Farm mapDocumentToFarm(DocumentSnapshot doc) {
        Farm f = new Farm();
        f.setFarmId(doc.getString("farmId"));
        f.setName(doc.getString("name"));
        f.setDescription(doc.getString("description"));
        f.setOwnerUid(doc.getString("ownerUid"));
        f.setOwnerSafeUid(doc.getString("ownerSafeUid"));
        f.setDistrict(doc.getString("district"));
        f.setDivision(doc.getString("division"));
        f.setDetailedAddress(doc.getString("detailedAddress"));
        Double area = doc.getDouble("totalAreaHectares");
        f.setTotalAreaHectares(area != null ? area : 0.0);

        String vis = doc.getString("visibility");
        f.setVisibility(vis != null ? FarmVisibility.valueOf(vis) : FarmVisibility.PRIVATE);

        String status = doc.getString("status");
        f.setStatus(status != null ? FarmStatus.valueOf(status) : FarmStatus.ACTIVE);

        Long fieldCount = doc.getLong("activeFieldCount");
        f.setActiveFieldCount(fieldCount != null ? fieldCount.intValue() : 0);

        List<String> crops = (List<String>) doc.get("activeCropTypes");
        f.setActiveCropTypes(crops != null ? crops : new ArrayList<>());

        Long ver = doc.getLong("version");
        f.setVersion(ver != null ? ver.intValue() : 1);

        Timestamp regTs = doc.getTimestamp("registeredAt");
        f.setRegisteredAt(regTs != null ? regTs.toDate().toInstant() : Instant.now());

        Timestamp upTs = doc.getTimestamp("updatedAt");
        f.setUpdatedAt(upTs != null ? upTs.toDate().toInstant() : Instant.now());

        Timestamp archTs = doc.getTimestamp("archivedAt");
        f.setArchivedAt(archTs != null ? archTs.toDate().toInstant() : null);

        return f;
    }

    private Map<String, Object> mapFarmToMap(Farm f) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("farmId", f.getFarmId());
        map.put("name", f.getName());
        map.put("description", f.getDescription());
        map.put("ownerUid", f.getOwnerUid());
        map.put("ownerSafeUid", f.getOwnerSafeUid());
        map.put("district", f.getDistrict());
        map.put("division", f.getDivision());
        map.put("detailedAddress", f.getDetailedAddress());
        map.put("totalAreaHectares", f.getTotalAreaHectares());
        map.put("visibility", f.getVisibility() != null ? f.getVisibility().name() : "PRIVATE");
        map.put("status", f.getStatus() != null ? f.getStatus().name() : "ACTIVE");
        map.put("activeFieldCount", f.getActiveFieldCount());
        map.put("activeCropTypes", f.getActiveCropTypes());
        map.put("version", f.getVersion());
        map.put("registeredAt", f.getRegisteredAt() != null ? Timestamp.ofTimeSecondsAndNanos(f.getRegisteredAt().getEpochSecond(), f.getRegisteredAt().getNano()) : Timestamp.now());
        map.put("updatedAt", f.getUpdatedAt() != null ? Timestamp.ofTimeSecondsAndNanos(f.getUpdatedAt().getEpochSecond(), f.getUpdatedAt().getNano()) : Timestamp.now());
        if (f.getArchivedAt() != null) {
            map.put("archivedAt", Timestamp.ofTimeSecondsAndNanos(f.getArchivedAt().getEpochSecond(), f.getArchivedAt().getNano()));
        }
        return map;
    }

    private PublicFarmProjection mapDocumentToProjection(DocumentSnapshot doc) {
        PublicFarmProjection p = new PublicFarmProjection();
        p.setFarmId(doc.getString("farmId"));
        p.setName(doc.getString("name"));
        p.setDescription(doc.getString("description"));
        p.setDistrict(doc.getString("district"));
        p.setDivision(doc.getString("division"));
        Double area = doc.getDouble("totalAreaHectares");
        p.setTotalAreaHectares(area != null ? area : 0.0);

        Long fieldCount = doc.getLong("activeFieldCount");
        p.setActiveFieldCount(fieldCount != null ? fieldCount.intValue() : 0);

        List<String> crops = (List<String>) doc.get("activeCropTypes");
        p.setActiveCropTypes(crops != null ? crops : new ArrayList<>());

        p.setStatus(doc.getString("status"));
        p.setVisibility(doc.getString("visibility"));

        Long farmVer = doc.getLong("farmVersion");
        p.setFarmVersion(farmVer != null ? farmVer.intValue() : 1);

        Long projVer = doc.getLong("projectionVersion");
        p.setProjectionVersion(projVer != null ? projVer.intValue() : 1);

        Timestamp regTs = doc.getTimestamp("registeredAt");
        p.setRegisteredAt(regTs != null ? regTs.toDate().toInstant() : Instant.now());

        Timestamp upTs = doc.getTimestamp("updatedAt");
        p.setUpdatedAt(upTs != null ? upTs.toDate().toInstant() : Instant.now());

        return p;
    }

    private Map<String, Object> mapProjectionToMap(PublicFarmProjection p) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("farmId", p.getFarmId());
        map.put("name", p.getName());
        map.put("description", p.getDescription());
        map.put("district", p.getDistrict());
        map.put("division", p.getDivision());
        map.put("totalAreaHectares", p.getTotalAreaHectares());
        map.put("activeFieldCount", p.getActiveFieldCount());
        map.put("activeCropTypes", p.getActiveCropTypes());
        map.put("status", p.getStatus() != null ? p.getStatus() : "ACTIVE");
        map.put("visibility", p.getVisibility() != null ? p.getVisibility() : "PUBLIC");
        map.put("farmVersion", p.getFarmVersion());
        map.put("projectionVersion", p.getProjectionVersion());
        map.put("registeredAt", p.getRegisteredAt() != null ? Timestamp.ofTimeSecondsAndNanos(p.getRegisteredAt().getEpochSecond(), p.getRegisteredAt().getNano()) : Timestamp.now());
        map.put("updatedAt", p.getUpdatedAt() != null ? Timestamp.ofTimeSecondsAndNanos(p.getUpdatedAt().getEpochSecond(), p.getUpdatedAt().getNano()) : Timestamp.now());
        return map;
    }
}
