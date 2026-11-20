package com.agroai.repository;

import com.agroai.config.FirebaseConfig;
import com.agroai.exception.DatabaseUnavailableException;
import com.agroai.model.CropType;
import com.agroai.model.Field;
import com.agroai.model.FieldStatus;
import com.agroai.model.IrrigationType;
import com.agroai.model.SoilType;
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
import java.util.stream.Collectors;

/**
 * Cloud Firestore Production Field Repository.
 *
 * Implements strict environment separation:
 * - Production / Live Mode (Firebase initialized): All operations execute against live Cloud Firestore collection 'fields'.
 *   Failures FAIL CLOSED with DatabaseUnavailableException.
 * - Test / Dev Mode (Unconfigured): Operates against thread-safe in-memory maps for offline testing.
 */
@Repository
public class FirestoreFieldRepository implements FieldRepository {

    private static final Logger log = LoggerFactory.getLogger(FirestoreFieldRepository.class);

    private final FirebaseConfig firebaseConfig;
    private final Environment environment;

    private final Map<String, Field> memoryFields = new ConcurrentHashMap<>();
    private final Map<String, ReentrantLock> fieldLocks = new ConcurrentHashMap<>();

    public FirestoreFieldRepository(FirebaseConfig firebaseConfig, Environment environment) {
        this.firebaseConfig = firebaseConfig;
        this.environment = environment;
    }

    @PostConstruct
    public void validateEnvironmentSafety() {
        if (environment != null) {
            List<String> activeProfiles = Arrays.asList(environment.getActiveProfiles());
            boolean isProd = activeProfiles.contains("prod") || activeProfiles.contains("production");
            if (isProd && !firebaseConfig.isInitialized()) {
                throw new IllegalStateException("CRITICAL SECURITY ERROR: Production profile requires live Cloud Firestore. In-memory field repository fallback is strictly forbidden in production.");
            }
        }
    }

    private ReentrantLock getLockForField(String fieldId) {
        return fieldLocks.computeIfAbsent(fieldId, k -> new ReentrantLock());
    }

    private void checkConfiguredOrReady() {
        if (firebaseConfig.isConfigured() && !firebaseConfig.isInitialized()) {
            throw new DatabaseUnavailableException("Firebase configured but initialization failed ("
                    + firebaseConfig.getInitializationMessage() + "). In-memory fallback is disabled.");
        }
    }

    @Override
    public Optional<Field> findById(String fieldId) {
        if (fieldId == null || fieldId.trim().isEmpty()) {
            return Optional.empty();
        }
        checkConfiguredOrReady();

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                DocumentSnapshot doc = db.collection("fields").document(fieldId.trim()).get().get();
                if (doc.exists()) {
                    return Optional.ofNullable(mapDocumentToField(doc));
                }
                return Optional.empty();
            } catch (Exception e) {
                log.error("Live Firestore read failed for fields/{}: {}", fieldId, e.getMessage());
                throw new DatabaseUnavailableException("Failed to read field from Firestore: " + e.getMessage(), e);
            }
        }

        return Optional.ofNullable(memoryFields.get(fieldId.trim()));
    }

    @Override
    public Field findByIdInTransaction(Transaction transaction, String fieldId) {
        if (fieldId == null || fieldId.trim().isEmpty()) {
            return null;
        }
        checkConfiguredOrReady();

        if (firebaseConfig.isInitialized()) {
            if (transaction == null) {
                return findById(fieldId).orElse(null);
            }
            try {
                Firestore db = FirestoreClient.getFirestore();
                DocumentReference ref = db.collection("fields").document(fieldId.trim());
                DocumentSnapshot snap = transaction.get(ref).get();
                if (snap.exists()) {
                    return mapDocumentToField(snap);
                }
                return null;
            } catch (Exception e) {
                log.error("Live Firestore transactional read failed for fields/{}: {}", fieldId, e.getMessage());
                throw new DatabaseUnavailableException("Failed to read field in transaction: " + e.getMessage(), e);
            }
        }

        return memoryFields.get(fieldId.trim());
    }

    @Override
    public Field save(Field field) {
        if (field == null || field.getFieldId() == null) {
            throw new IllegalArgumentException("Field and fieldId cannot be null");
        }
        checkConfiguredOrReady();
        String fieldId = field.getFieldId().trim();
        ReentrantLock lock = getLockForField(fieldId);
        lock.lock();
        try {
            if (firebaseConfig.isInitialized()) {
                try {
                    Firestore db = FirestoreClient.getFirestore();
                    db.runTransaction(transaction -> {
                        DocumentReference ref = db.collection("fields").document(fieldId);
                        transaction.set(ref, mapFieldToMap(field));
                        return null;
                    }).get();
                    return field;
                } catch (Exception e) {
                    log.error("Live Firestore save failed for fields/{}: {}", fieldId, e.getMessage());
                    throw new DatabaseUnavailableException("Failed to save field to Firestore: " + e.getMessage(), e);
                }
            }

            memoryFields.put(fieldId, field);
            return field;
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void saveInTransaction(Transaction transaction, Field field) {
        if (field == null || field.getFieldId() == null) {
            throw new IllegalArgumentException("Field and fieldId cannot be null");
        }
        checkConfiguredOrReady();
        String fieldId = field.getFieldId().trim();

        if (firebaseConfig.isInitialized()) {
            if (transaction == null) {
                save(field);
                return;
            }
            Firestore db = FirestoreClient.getFirestore();
            DocumentReference ref = db.collection("fields").document(fieldId);
            transaction.set(ref, mapFieldToMap(field));
        } else {
            memoryFields.put(fieldId, field);
        }
    }

    @Override
    public List<Field> findByFarmId(String farmId) {
        if (farmId == null || farmId.trim().isEmpty()) {
            return List.of();
        }
        checkConfiguredOrReady();

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                QuerySnapshot snapshot = db.collection("fields")
                        .whereEqualTo("farmId", farmId.trim())
                        .get().get();
                List<Field> list = new ArrayList<>();
                for (QueryDocumentSnapshot doc : snapshot.getDocuments()) {
                    list.add(mapDocumentToField(doc));
                }
                return list;
            } catch (Exception e) {
                log.error("Live Firestore query failed for fields under farm {}: {}", farmId, e.getMessage());
                throw new DatabaseUnavailableException("Failed to query farm fields from Firestore: " + e.getMessage(), e);
            }
        }

        return memoryFields.values().stream()
                .filter(f -> farmId.trim().equals(f.getFarmId()))
                .collect(Collectors.toList());
    }

    @Override
    public List<Field> findActiveByFarmId(String farmId) {
        return findByFarmId(farmId).stream()
                .filter(f -> f.getStatus() != FieldStatus.ARCHIVED)
                .collect(Collectors.toList());
    }

    @Override
    public long countActiveFieldsByFarmId(String farmId) {
        return findActiveByFarmId(farmId).size();
    }

    private Field mapDocumentToField(DocumentSnapshot doc) {
        Field f = new Field();
        f.setFieldId(doc.getString("fieldId"));
        f.setLocalFieldId(doc.getString("localFieldId"));
        f.setFarmId(doc.getString("farmId"));
        f.setName(doc.getString("name"));

        String crop = doc.getString("cropType");
        f.setCropType(crop != null ? CropType.valueOf(crop) : null);

        String soil = doc.getString("soilType");
        f.setSoilType(soil != null ? SoilType.valueOf(soil) : null);

        String irrigation = doc.getString("irrigationType");
        f.setIrrigationType(irrigation != null ? IrrigationType.valueOf(irrigation) : null);

        Double area = doc.getDouble("areaHectares");
        f.setAreaHectares(area != null ? area : 0.0);

        String status = doc.getString("status");
        f.setStatus(status != null ? FieldStatus.valueOf(status) : FieldStatus.ACTIVE);

        f.setNotes(doc.getString("notes"));

        Long ver = doc.getLong("version");
        f.setVersion(ver != null ? ver.intValue() : 1);

        Timestamp createdTs = doc.getTimestamp("createdAt");
        f.setCreatedAt(createdTs != null ? createdTs.toDate().toInstant() : Instant.now());

        Timestamp updatedTs = doc.getTimestamp("updatedAt");
        f.setUpdatedAt(updatedTs != null ? updatedTs.toDate().toInstant() : Instant.now());

        Timestamp archTs = doc.getTimestamp("archivedAt");
        f.setArchivedAt(archTs != null ? archTs.toDate().toInstant() : null);

        return f;
    }

    private Map<String, Object> mapFieldToMap(Field f) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("fieldId", f.getFieldId());
        map.put("localFieldId", f.getLocalFieldId());
        map.put("farmId", f.getFarmId());
        map.put("name", f.getName());
        map.put("cropType", f.getCropType() != null ? f.getCropType().name() : null);
        map.put("soilType", f.getSoilType() != null ? f.getSoilType().name() : null);
        map.put("irrigationType", f.getIrrigationType() != null ? f.getIrrigationType().name() : null);
        map.put("areaHectares", f.getAreaHectares());
        map.put("status", f.getStatus() != null ? f.getStatus().name() : "ACTIVE");
        map.put("notes", f.getNotes());
        map.put("version", f.getVersion());
        map.put("createdAt", f.getCreatedAt() != null ? Timestamp.ofTimeSecondsAndNanos(f.getCreatedAt().getEpochSecond(), f.getCreatedAt().getNano()) : Timestamp.now());
        map.put("updatedAt", f.getUpdatedAt() != null ? Timestamp.ofTimeSecondsAndNanos(f.getUpdatedAt().getEpochSecond(), f.getUpdatedAt().getNano()) : Timestamp.now());
        if (f.getArchivedAt() != null) {
            map.put("archivedAt", Timestamp.ofTimeSecondsAndNanos(f.getArchivedAt().getEpochSecond(), f.getArchivedAt().getNano()));
        }
        return map;
    }
}
