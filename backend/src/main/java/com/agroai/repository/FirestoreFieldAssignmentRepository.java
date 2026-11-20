package com.agroai.repository;

import com.agroai.config.FirebaseConfig;
import com.agroai.exception.DatabaseUnavailableException;
import com.agroai.model.AssignmentStatus;
import com.agroai.model.FieldAssignment;
import com.agroai.util.KeyEncoder;
import com.google.cloud.Timestamp;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.FieldPath;
import com.google.cloud.firestore.Query;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.google.cloud.firestore.QuerySnapshot;
import com.google.cloud.firestore.Transaction;
import com.google.firebase.cloud.FirestoreClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Comparator;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Cloud Firestore Production Field Assignment Repository.
 *
 * Implements strict environment separation:
 * - Production / Live Mode (Firebase initialized): All operations execute against live Cloud Firestore collection 'field_assignments'.
 *   Failures FAIL CLOSED with DatabaseUnavailableException.
 * - Test / Dev Mode (Unconfigured): Operates against thread-safe in-memory maps for offline testing.
 */
@Repository
public class FirestoreFieldAssignmentRepository implements FieldAssignmentRepository {

    private static final Logger log = LoggerFactory.getLogger(FirestoreFieldAssignmentRepository.class);

    private final FirebaseConfig firebaseConfig;
    private final Environment environment;

    private final Map<String, FieldAssignment> memoryAssignments = new ConcurrentHashMap<>();
    private final Map<String, String> memoryActivePairLocks = new ConcurrentHashMap<>();
    private final List<FieldAssignment> historicalArchive = new ArrayList<>();

    public FirestoreFieldAssignmentRepository(FirebaseConfig firebaseConfig, Environment environment) {
        this.firebaseConfig = firebaseConfig;
        this.environment = environment;
    }

    private void checkConfiguredOrReady() {
        if (firebaseConfig.isConfigured() && !firebaseConfig.isInitialized()) {
            throw new DatabaseUnavailableException("Firebase configured but initialization failed ("
                    + firebaseConfig.getInitializationMessage() + "). In-memory fallback is disabled.");
        }
    }

    @Override
    public Optional<FieldAssignment> findAssignment(String fieldId, String rawFarmerId) {
        if (fieldId == null || rawFarmerId == null) {
            return Optional.empty();
        }
        String pairId = KeyEncoder.assignmentDocId(fieldId, rawFarmerId);
        if (firebaseConfig.isInitialized()) {
            checkConfiguredOrReady();
            try {
                Firestore db = FirestoreClient.getFirestore();
                DocumentSnapshot lock = db.collection("active_field_assignment_locks").document(pairId).get().get();
                if (lock.exists()) return findById(lock.getString("assignmentId"));
                return findById(pairId); // Legacy deterministic record compatibility.
            } catch (Exception e) {
                throw new DatabaseUnavailableException("Failed to resolve active farmer-field assignment: " + e.getMessage(), e);
            }
        }
        return memoryAssignments.values().stream()
                .filter(a -> fieldId.equals(a.getFieldId()) && rawFarmerId.equals(a.getFarmerId()))
                .sorted(Comparator.comparing((FieldAssignment a) -> a.getStatus() == AssignmentStatus.ACTIVE ? 1 : 0)
                        .thenComparing(FieldAssignment::getAssignedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                .reduce((first, second) -> second);
    }

    @Override
    public Optional<FieldAssignment> findById(String assignmentId) {
        if (assignmentId == null || assignmentId.trim().isEmpty()) {
            return Optional.empty();
        }
        checkConfiguredOrReady();

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                DocumentSnapshot doc = db.collection("field_assignments").document(assignmentId.trim()).get().get();
                if (doc.exists()) {
                    return Optional.ofNullable(mapDocumentToAssignment(doc));
                }
                return Optional.empty();
            } catch (Exception e) {
                log.error("Live Firestore read failed for field_assignments/{}: {}", assignmentId, e.getMessage());
                throw new DatabaseUnavailableException("Failed to read field assignment from Firestore: " + e.getMessage(), e);
            }
        }

        return Optional.ofNullable(memoryAssignments.get(assignmentId.trim()));
    }

    @Override
    public FieldAssignment findByIdInTransaction(Transaction transaction, String assignmentId) {
        if (assignmentId == null || assignmentId.trim().isEmpty()) {
            return null;
        }
        checkConfiguredOrReady();

        if (firebaseConfig.isInitialized()) {
            if (transaction == null) {
                return findById(assignmentId).orElse(null);
            }
            try {
                Firestore db = FirestoreClient.getFirestore();
                DocumentReference ref = db.collection("field_assignments").document(assignmentId.trim());
                DocumentSnapshot snap = transaction.get(ref).get();
                if (snap.exists()) {
                    return mapDocumentToAssignment(snap);
                }
                return null;
            } catch (Exception e) {
                log.error("Live Firestore transactional read failed for field_assignments/{}: {}", assignmentId, e.getMessage());
                throw new DatabaseUnavailableException("Failed to read field assignment in transaction: " + e.getMessage(), e);
            }
        }

        return memoryAssignments.get(assignmentId.trim());
    }

    @Override
    public FieldAssignment save(FieldAssignment assignment) {
        if (assignment == null) {
            throw new IllegalArgumentException("FieldAssignment cannot be null");
        }
        String docId = assignment.getAssignmentId();
        if (docId == null || docId.trim().isEmpty()) {
            docId = KeyEncoder.newAssignmentTenureId();
            assignment.setAssignmentId(docId);
        }
        checkConfiguredOrReady();

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                Map<String, Object> map = mapAssignmentToMap(assignment);
                db.collection("field_assignments").document(docId).set(map).get();
                return assignment;
            } catch (Exception e) {
                log.error("Live Firestore write failed for field_assignments/{}: {}", docId, e.getMessage());
                throw new DatabaseUnavailableException("Failed to save field assignment to Firestore: " + e.getMessage(), e);
            }
        }

        memoryAssignments.put(docId, assignment);
        return assignment;
    }

    @Override
    public void saveInTransaction(Transaction transaction, FieldAssignment assignment) {
        if (assignment == null) {
            throw new IllegalArgumentException("FieldAssignment cannot be null");
        }
        String docId = assignment.getAssignmentId();
        if (docId == null || docId.trim().isEmpty()) {
            docId = KeyEncoder.newAssignmentTenureId();
            assignment.setAssignmentId(docId);
        }
        checkConfiguredOrReady();

        if (firebaseConfig.isInitialized()) {
            if (transaction == null) {
                save(assignment);
                return;
            }
            try {
                Firestore db = FirestoreClient.getFirestore();
                DocumentReference ref = db.collection("field_assignments").document(docId);
                transaction.set(ref, mapAssignmentToMap(assignment));
                return;
            } catch (Exception e) {
                log.error("Live Firestore transactional write failed for field_assignments/{}: {}", docId, e.getMessage());
                throw new DatabaseUnavailableException("Failed to save field assignment in transaction: " + e.getMessage(), e);
            }
        }

        memoryAssignments.put(docId, assignment);
    }

    @Override
    public FieldAssignment findActivePairInTransaction(Transaction transaction, String fieldId, String farmerUid) {
        String pairId = KeyEncoder.assignmentDocId(fieldId, farmerUid);
        checkConfiguredOrReady();
        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                DocumentSnapshot lock = transaction.get(db.collection("active_field_assignment_locks").document(pairId)).get();
                if (lock.exists()) return findByIdInTransaction(transaction, lock.getString("assignmentId"));
                // If no lock exists, support a pre-migration active legacy pair.
                return findByIdInTransaction(transaction, pairId);
            } catch (Exception e) {
                throw new DatabaseUnavailableException("Failed to read active assignment lock: " + e.getMessage(), e);
            }
        }
        String assignmentId = memoryActivePairLocks.get(pairId);
        if (assignmentId != null) return memoryAssignments.get(assignmentId);
        FieldAssignment legacy = memoryAssignments.get(pairId);
        if (legacy != null) return legacy;
        return memoryAssignments.values().stream().filter(a -> fieldId.equals(a.getFieldId()) && farmerUid.equals(a.getFarmerId())
                && a.getStatus() == AssignmentStatus.ACTIVE).findFirst().orElse(null);
    }

    @Override
    public void writeActivePairLockInTransaction(Transaction transaction, FieldAssignment assignment) {
        String pairId = KeyEncoder.assignmentDocId(assignment.getFieldId(), assignment.getFarmerId());
        checkConfiguredOrReady();
        if (firebaseConfig.isInitialized()) {
            Firestore db = FirestoreClient.getFirestore();
            Map<String, Object> lock = Map.of("fieldId", assignment.getFieldId(), "farmId", assignment.getFarmId(),
                    "farmerId", assignment.getFarmerId(), "farmerSafeUid", KeyEncoder.encodeUid(assignment.getFarmerId()),
                    "assignmentId", assignment.getAssignmentId());
            transaction.set(db.collection("active_field_assignment_locks").document(pairId), lock);
        } else {
            memoryActivePairLocks.put(pairId, assignment.getAssignmentId());
        }
    }

    @Override
    public void removeActivePairLockInTransaction(Transaction transaction, FieldAssignment assignment) {
        String pairId = KeyEncoder.assignmentDocId(assignment.getFieldId(), assignment.getFarmerId());
        checkConfiguredOrReady();
        if (firebaseConfig.isInitialized()) {
            Firestore db = FirestoreClient.getFirestore();
            DocumentReference lockRef = db.collection("active_field_assignment_locks").document(pairId);
            try {
                DocumentSnapshot lock = transaction.get(lockRef).get();
                if (lock.exists() && assignment.getAssignmentId().equals(lock.getString("assignmentId"))) {
                    transaction.delete(lockRef);
                }
            } catch (Exception e) {
                throw new DatabaseUnavailableException("Failed to read active assignment lock for release: " + e.getMessage(), e);
            }
        } else {
            memoryActivePairLocks.remove(pairId, assignment.getAssignmentId());
        }
    }

    @Override
    public void releaseAssignment(String fieldId, String rawFarmerId, String releaseReason) {
        Optional<FieldAssignment> existingOpt = findAssignment(fieldId, rawFarmerId);
        if (existingOpt.isPresent()) {
            FieldAssignment existing = existingOpt.get();
            existing.setStatus(AssignmentStatus.RELEASED);
            existing.setReleasedAt(Instant.now());
            existing.setReleaseReason(releaseReason);
            existing.setVersion(existing.getVersion() + 1);
            existing.setUpdatedAt(Instant.now());
            save(existing);
            synchronized (historicalArchive) {
                historicalArchive.add(existing);
            }
        }
    }

    @Override
    public List<FieldAssignment> findActiveAssignmentsByFarmer(String rawFarmerId) {
        String safeUid = KeyEncoder.encodeUid(rawFarmerId);
        checkConfiguredOrReady();

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                QuerySnapshot snap = db.collection("field_assignments")
                        .whereEqualTo("farmerSafeUid", safeUid)
                        .whereEqualTo("status", "ACTIVE")
                        .limit(100)
                        .get().get();
                List<FieldAssignment> list = new ArrayList<>();
                for (QueryDocumentSnapshot doc : snap.getDocuments()) {
                    list.add(mapDocumentToAssignment(doc));
                }
                return list;
            } catch (Exception e) {
                log.error("Live Firestore query failed for farmer active assignments: {}", e.getMessage());
                throw new DatabaseUnavailableException("Failed to query active assignments: " + e.getMessage(), e);
            }
        }

        List<FieldAssignment> result = new ArrayList<>();
        for (FieldAssignment a : memoryAssignments.values().stream().distinct().toList()) {
            if (a.getStatus() == AssignmentStatus.ACTIVE && safeUid.equals(KeyEncoder.encodeUid(a.getFarmerId()))) {
                result.add(a);
            }
        }
        return result;
    }

    @Override
    public List<FieldAssignment> findAssignmentsByFarmer(String rawFarmerId) {
        String safeUid = KeyEncoder.encodeUid(rawFarmerId);
        checkConfiguredOrReady();

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                QuerySnapshot snap = db.collection("field_assignments")
                        .whereEqualTo("farmerSafeUid", safeUid)
                        .limit(100)
                        .get().get();
                List<FieldAssignment> list = new ArrayList<>();
                for (QueryDocumentSnapshot doc : snap.getDocuments()) {
                    list.add(mapDocumentToAssignment(doc));
                }
                return list;
            } catch (Exception e) {
                log.error("Live Firestore query failed for farmer all assignments: {}", e.getMessage());
                throw new DatabaseUnavailableException("Failed to query assignments: " + e.getMessage(), e);
            }
        }

        return memoryAssignments.values().stream()
                .distinct()
                .filter(a -> safeUid.equals(KeyEncoder.encodeUid(a.getFarmerId())))
                .collect(Collectors.toList());
    }

    @Override
    public List<FieldAssignment> findActiveAssignmentsByField(String fieldId) {
        String cleanFieldId = KeyEncoder.validateFieldId(fieldId);
        checkConfiguredOrReady();

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                QuerySnapshot snap = db.collection("field_assignments")
                        .whereEqualTo("fieldId", cleanFieldId)
                        .whereEqualTo("status", "ACTIVE")
                        .limit(100)
                        .get().get();
                List<FieldAssignment> list = new ArrayList<>();
                for (QueryDocumentSnapshot doc : snap.getDocuments()) {
                    list.add(mapDocumentToAssignment(doc));
                }
                return list;
            } catch (Exception e) {
                log.error("Live Firestore query failed for field active assignments: {}", e.getMessage());
                throw new DatabaseUnavailableException("Failed to query field active assignments: " + e.getMessage(), e);
            }
        }

        return memoryAssignments.values().stream()
                .distinct()
                .filter(a -> cleanFieldId.equals(a.getFieldId()) && a.getStatus() == AssignmentStatus.ACTIVE)
                .collect(Collectors.toList());
    }

    @Override
    public List<FieldAssignment> findAssignmentsByField(String fieldId) {
        String cleanFieldId = KeyEncoder.validateFieldId(fieldId);
        checkConfiguredOrReady();

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                QuerySnapshot snap = db.collection("field_assignments")
                        .whereEqualTo("fieldId", cleanFieldId)
                        .limit(100)
                        .get().get();
                List<FieldAssignment> list = new ArrayList<>();
                for (QueryDocumentSnapshot doc : snap.getDocuments()) {
                    list.add(mapDocumentToAssignment(doc));
                }
                return list;
            } catch (Exception e) {
                log.error("Live Firestore query failed for field all assignments: {}", e.getMessage());
                throw new DatabaseUnavailableException("Failed to query field assignments: " + e.getMessage(), e);
            }
        }

        return memoryAssignments.values().stream()
                .distinct()
                .filter(a -> cleanFieldId.equals(a.getFieldId()))
                .collect(Collectors.toList());
    }

    @Override
    public List<FieldAssignment> findAssignmentsByFarm(String farmId) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        checkConfiguredOrReady();

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                QuerySnapshot snap = db.collection("field_assignments")
                        .whereEqualTo("farmId", cleanFarmId)
                        .limit(100)
                        .get().get();
                List<FieldAssignment> list = new ArrayList<>();
                for (QueryDocumentSnapshot doc : snap.getDocuments()) {
                    list.add(mapDocumentToAssignment(doc));
                }
                return list;
            } catch (Exception e) {
                log.error("Live Firestore query failed for farm assignments: {}", e.getMessage());
                throw new DatabaseUnavailableException("Failed to query farm assignments: " + e.getMessage(), e);
            }
        }

        return memoryAssignments.values().stream()
                .distinct()
                .filter(a -> cleanFarmId.equals(a.getFarmId()))
                .collect(Collectors.toList());
    }

    @Override
    public CursorPage<FieldAssignment> findActiveAssignmentsByFarmerPage(String farmerUid, String afterId, int limit) {
        String safeUid = KeyEncoder.encodeUid(farmerUid);
        checkConfiguredOrReady();
        if (firebaseConfig.isInitialized()) {
            return firestorePage(FirestoreClient.getFirestore().collection("field_assignments")
                    .whereEqualTo("farmerSafeUid", safeUid).whereEqualTo("status", "ACTIVE"), afterId, limit,
                    this::mapDocumentToAssignment);
        }
        return memoryPage(memoryAssignments.values().stream().distinct()
                .filter(a -> a.getStatus() == AssignmentStatus.ACTIVE && safeUid.equals(KeyEncoder.encodeUid(a.getFarmerId()))).toList(),
                afterId, limit, FieldAssignment::getAssignmentId);
    }

    @Override
    public CursorPage<FieldAssignment> findAssignmentsByFarmerPage(String farmerUid, String afterId, int limit) {
        String safeUid = KeyEncoder.encodeUid(farmerUid);
        checkConfiguredOrReady();
        if (firebaseConfig.isInitialized()) {
            return firestorePage(FirestoreClient.getFirestore().collection("field_assignments")
                    .whereEqualTo("farmerSafeUid", safeUid), afterId, limit, this::mapDocumentToAssignment);
        }
        return memoryPage(memoryAssignments.values().stream().distinct()
                .filter(a -> safeUid.equals(KeyEncoder.encodeUid(a.getFarmerId()))).toList(),
                afterId, limit, FieldAssignment::getAssignmentId);
    }

    @Override
    public CursorPage<FieldAssignment> findAssignmentsByFieldPage(String fieldId, String afterId, int limit) {
        String cleanFieldId = KeyEncoder.validateFieldId(fieldId);
        checkConfiguredOrReady();
        if (firebaseConfig.isInitialized()) {
            return firestorePage(FirestoreClient.getFirestore().collection("field_assignments")
                    .whereEqualTo("fieldId", cleanFieldId), afterId, limit, this::mapDocumentToAssignment);
        }
        return memoryPage(memoryAssignments.values().stream().distinct()
                .filter(a -> cleanFieldId.equals(a.getFieldId())).toList(), afterId, limit, FieldAssignment::getAssignmentId);
    }

    @Override
    public CursorPage<FieldAssignment> findAssignmentsByFarmPage(String farmId, String afterId, int limit) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        checkConfiguredOrReady();
        if (firebaseConfig.isInitialized()) {
            return firestorePage(FirestoreClient.getFirestore().collection("field_assignments")
                    .whereEqualTo("farmId", cleanFarmId), afterId, limit, this::mapDocumentToAssignment);
        }
        return memoryPage(memoryAssignments.values().stream().distinct()
                .filter(a -> cleanFarmId.equals(a.getFarmId())).toList(), afterId, limit, FieldAssignment::getAssignmentId);
    }

    private <T> CursorPage<T> firestorePage(Query base, String afterId, int limit,
                                            Function<QueryDocumentSnapshot, T> mapper) {
        try {
            Query query = base.orderBy(FieldPath.documentId());
            if (afterId != null) query = query.startAfter(afterId);
            QuerySnapshot snapshot = query.limit(limit + 1).get().get();
            List<QueryDocumentSnapshot> documents = snapshot.getDocuments();
            boolean hasNext = documents.size() > limit;
            List<T> items = documents.stream().limit(limit).map(mapper).toList();
            String next = hasNext ? documents.get(limit - 1).getId() : null;
            return new CursorPage<>(items, next, hasNext);
        } catch (Exception e) {
            log.error("Live Firestore cursor query failed for field_assignments: {}", e.getMessage());
            throw new DatabaseUnavailableException("Failed to query assignment page: " + e.getMessage(), e);
        }
    }

    private <T> CursorPage<T> memoryPage(List<T> values, String afterId, int limit,
                                         Function<T, String> idGetter) {
        List<T> ordered = values.stream().sorted(Comparator.comparing(idGetter)).toList();
        List<T> remaining = afterId == null ? ordered : ordered.stream()
                .filter(value -> idGetter.apply(value).compareTo(afterId) > 0).toList();
        boolean hasNext = remaining.size() > limit;
        List<T> items = remaining.stream().limit(limit).toList();
        String next = hasNext ? idGetter.apply(items.get(items.size() - 1)) : null;
        return new CursorPage<>(items, next, hasNext);
    }

    @Override
    public List<FieldAssignment> getHistoricalArchive() {
        return new ArrayList<>(historicalArchive);
    }

    @Override
    public void clearAllForTesting() {
        memoryAssignments.clear();
        memoryActivePairLocks.clear();
        historicalArchive.clear();
    }

    private Map<String, Object> mapAssignmentToMap(FieldAssignment a) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("assignmentId", a.getAssignmentId());
        map.put("farmId", a.getFarmId());
        map.put("fieldId", a.getFieldId());
        map.put("fieldDocumentId", a.getFieldDocumentId());
        map.put("farmerId", a.getFarmerId());
        map.put("farmerUid", a.getFarmerUid());
        map.put("farmerSafeUid", a.getFarmerSafeUid() != null ? a.getFarmerSafeUid() : KeyEncoder.encodeUid(a.getFarmerId()));
        map.put("farmerName", a.getFarmerName());
        map.put("status", a.getStatus() != null ? a.getStatus().name() : "ACTIVE");
        map.put("permissions", a.getPermissions());
        map.put("assignedBy", a.getAssignedBy());
        map.put("assignedByUid", a.getAssignedByUid());
        map.put("sourceApplicationId", a.getSourceApplicationId());
        map.put("sourceJobId", a.getSourceJobId());
        map.put("assignedAt", a.getAssignedAt() != null ? Timestamp.ofTimeSecondsAndNanos(a.getAssignedAt().getEpochSecond(), a.getAssignedAt().getNano()) : Timestamp.now());
        map.put("updatedAt", a.getUpdatedAt() != null ? Timestamp.ofTimeSecondsAndNanos(a.getUpdatedAt().getEpochSecond(), a.getUpdatedAt().getNano()) : Timestamp.now());
        if (a.getReleasedAt() != null) {
            map.put("releasedAt", Timestamp.ofTimeSecondsAndNanos(a.getReleasedAt().getEpochSecond(), a.getReleasedAt().getNano()));
        } else {
            map.put("releasedAt", null);
        }
        map.put("releasedByUid", a.getReleasedByUid());
        map.put("releaseReason", a.getReleaseReason());
        map.put("version", a.getVersion() != null ? a.getVersion() : 1);
        return map;
    }

    @SuppressWarnings("unchecked")
    private FieldAssignment mapDocumentToAssignment(DocumentSnapshot doc) {
        FieldAssignment a = new FieldAssignment();
        a.setAssignmentId(doc.getString("assignmentId") != null ? doc.getString("assignmentId") : doc.getId());
        a.setFarmId(doc.getString("farmId"));
        a.setFieldId(doc.getString("fieldId"));
        a.setFieldDocumentId(doc.getString("fieldDocumentId"));
        a.setFarmerId(doc.getString("farmerId") != null ? doc.getString("farmerId") : doc.getString("farmerUid"));
        a.setFarmerUid(doc.getString("farmerUid") != null ? doc.getString("farmerUid") : doc.getString("farmerId"));
        a.setFarmerSafeUid(doc.getString("farmerSafeUid"));
        a.setFarmerName(doc.getString("farmerName"));

        String statusStr = doc.getString("status");
        if (statusStr != null) {
            try {
                a.setStatus(AssignmentStatus.valueOf(statusStr));
            } catch (Exception e) {
                a.setStatus(AssignmentStatus.ACTIVE);
            }
        }

        List<String> perms = (List<String>) doc.get("permissions");
        if (perms != null) {
            a.setPermissions(perms);
        }

        a.setAssignedBy(doc.getString("assignedBy") != null ? doc.getString("assignedBy") : doc.getString("assignedByUid"));
        a.setAssignedByUid(doc.getString("assignedByUid") != null ? doc.getString("assignedByUid") : doc.getString("assignedBy"));
        a.setSourceApplicationId(doc.getString("sourceApplicationId"));
        a.setSourceJobId(doc.getString("sourceJobId"));

        Timestamp assignedAtTs = doc.getTimestamp("assignedAt");
        if (assignedAtTs != null) {
            a.setAssignedAt(Instant.ofEpochSecond(assignedAtTs.getSeconds(), assignedAtTs.getNanos()));
        }
        Timestamp updatedAtTs = doc.getTimestamp("updatedAt");
        if (updatedAtTs != null) {
            a.setUpdatedAt(Instant.ofEpochSecond(updatedAtTs.getSeconds(), updatedAtTs.getNanos()));
        }
        Timestamp releasedAtTs = doc.getTimestamp("releasedAt");
        if (releasedAtTs != null) {
            a.setReleasedAt(Instant.ofEpochSecond(releasedAtTs.getSeconds(), releasedAtTs.getNanos()));
        }

        a.setReleasedByUid(doc.getString("releasedByUid"));
        a.setReleaseReason(doc.getString("releaseReason"));

        Long v = doc.getLong("version");
        a.setVersion(v != null ? v.intValue() : 1);

        return a;
    }
}
