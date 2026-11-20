package com.agroai.repository;

import com.agroai.config.FirebaseConfig;
import com.agroai.exception.DatabaseUnavailableException;
import com.agroai.model.AssignmentHistory;
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
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Comparator;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Cloud Firestore Production Assignment History Repository.
 * Stores immutable audit events for field assignment lifecycles in 'assignment_history'.
 */
@Repository
public class FirestoreAssignmentHistoryRepository implements AssignmentHistoryRepository {

    private static final Logger log = LoggerFactory.getLogger(FirestoreAssignmentHistoryRepository.class);

    private final FirebaseConfig firebaseConfig;
    private final Map<String, AssignmentHistory> memoryHistory = new ConcurrentHashMap<>();

    public FirestoreAssignmentHistoryRepository(FirebaseConfig firebaseConfig) {
        this.firebaseConfig = firebaseConfig;
    }

    private void checkConfiguredOrReady() {
        if (firebaseConfig.isConfigured() && !firebaseConfig.isInitialized()) {
            throw new DatabaseUnavailableException("Firebase configured but initialization failed ("
                    + firebaseConfig.getInitializationMessage() + "). In-memory fallback is disabled.");
        }
    }

    @Override
    public AssignmentHistory save(AssignmentHistory history) {
        if (history == null) {
            throw new IllegalArgumentException("AssignmentHistory cannot be null");
        }
        String id = history.getHistoryId();
        if (id == null || id.trim().isEmpty()) {
            id = "asgn_hist_" + UUID.randomUUID();
            history.setHistoryId(id);
        }
        checkConfiguredOrReady();

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                db.collection("assignment_history").document(id).set(mapToMap(history)).get();
                return history;
            } catch (Exception e) {
                log.error("Live Firestore write failed for assignment_history/{}: {}", id, e.getMessage());
                throw new DatabaseUnavailableException("Failed to save assignment history: " + e.getMessage(), e);
            }
        }

        memoryHistory.put(id, history);
        return history;
    }

    @Override
    public void saveInTransaction(Transaction transaction, AssignmentHistory history) {
        if (history == null) {
            throw new IllegalArgumentException("AssignmentHistory cannot be null");
        }
        String id = history.getHistoryId();
        if (id == null || id.trim().isEmpty()) {
            id = "asgn_hist_" + UUID.randomUUID();
            history.setHistoryId(id);
        }
        checkConfiguredOrReady();

        if (firebaseConfig.isInitialized()) {
            if (transaction == null) {
                save(history);
                return;
            }
            try {
                Firestore db = FirestoreClient.getFirestore();
                DocumentReference ref = db.collection("assignment_history").document(id);
                transaction.set(ref, mapToMap(history));
                return;
            } catch (Exception e) {
                log.error("Live Firestore transactional write failed for assignment_history/{}: {}", id, e.getMessage());
                throw new DatabaseUnavailableException("Failed to save assignment history in transaction: " + e.getMessage(), e);
            }
        }

        memoryHistory.put(id, history);
    }

    @Override
    public List<AssignmentHistory> findByAssignmentId(String assignmentId) {
        if (assignmentId == null || assignmentId.trim().isEmpty()) {
            return List.of();
        }
        checkConfiguredOrReady();

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                QuerySnapshot snap = db.collection("assignment_history")
                        .whereEqualTo("assignmentId", assignmentId.trim())
                        .limit(100)
                        .get().get();
                List<AssignmentHistory> list = new ArrayList<>();
                for (QueryDocumentSnapshot doc : snap.getDocuments()) {
                    list.add(mapFromDocument(doc));
                }
                list.sort((a, b) -> a.getTimestamp().compareTo(b.getTimestamp()));
                return list;
            } catch (Exception e) {
                log.error("Live Firestore query failed for assignment_history by assignmentId: {}", e.getMessage());
                throw new DatabaseUnavailableException("Failed to query assignment history: " + e.getMessage(), e);
            }
        }

        return memoryHistory.values().stream()
                .filter(h -> assignmentId.trim().equals(h.getAssignmentId()))
                .sorted((a, b) -> a.getTimestamp().compareTo(b.getTimestamp()))
                .collect(Collectors.toList());
    }

    @Override
    public List<AssignmentHistory> findByFieldId(String fieldId) {
        if (fieldId == null || fieldId.trim().isEmpty()) {
            return List.of();
        }
        checkConfiguredOrReady();

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                QuerySnapshot snap = db.collection("assignment_history")
                        .whereEqualTo("fieldId", fieldId.trim())
                        .limit(100)
                        .get().get();
                List<AssignmentHistory> list = new ArrayList<>();
                for (QueryDocumentSnapshot doc : snap.getDocuments()) {
                    list.add(mapFromDocument(doc));
                }
                list.sort((a, b) -> a.getTimestamp().compareTo(b.getTimestamp()));
                return list;
            } catch (Exception e) {
                log.error("Live Firestore query failed for assignment_history by fieldId: {}", e.getMessage());
                throw new DatabaseUnavailableException("Failed to query assignment history by field: " + e.getMessage(), e);
            }
        }

        return memoryHistory.values().stream()
                .filter(h -> fieldId.trim().equals(h.getFieldId()))
                .sorted((a, b) -> a.getTimestamp().compareTo(b.getTimestamp()))
                .collect(Collectors.toList());
    }

    @Override
    public List<AssignmentHistory> findByFarmerUid(String farmerUid) {
        if (farmerUid == null || farmerUid.trim().isEmpty()) {
            return List.of();
        }
        checkConfiguredOrReady();

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                QuerySnapshot snap = db.collection("assignment_history")
                        .whereEqualTo("farmerUid", farmerUid.trim())
                        .limit(100)
                        .get().get();
                List<AssignmentHistory> list = new ArrayList<>();
                for (QueryDocumentSnapshot doc : snap.getDocuments()) {
                    list.add(mapFromDocument(doc));
                }
                list.sort((a, b) -> a.getTimestamp().compareTo(b.getTimestamp()));
                return list;
            } catch (Exception e) {
                log.error("Live Firestore query failed for assignment_history by farmerUid: {}", e.getMessage());
                throw new DatabaseUnavailableException("Failed to query assignment history by farmer: " + e.getMessage(), e);
            }
        }

        return memoryHistory.values().stream()
                .filter(h -> farmerUid.trim().equals(h.getFarmerUid()))
                .sorted((a, b) -> a.getTimestamp().compareTo(b.getTimestamp()))
                .collect(Collectors.toList());
    }

    @Override
    public CursorPage<AssignmentHistory> findByAssignmentIdPage(String assignmentId, String afterId, int limit) {
        if (assignmentId == null || assignmentId.isBlank()) return new CursorPage<>(List.of(), null, false);
        checkConfiguredOrReady();
        if (firebaseConfig.isInitialized()) {
            try {
                Query query = FirestoreClient.getFirestore().collection("assignment_history")
                        .whereEqualTo("assignmentId", assignmentId.trim()).orderBy(FieldPath.documentId());
                if (afterId != null) query = query.startAfter(afterId);
                QuerySnapshot snapshot = query.limit(limit + 1).get().get();
                List<QueryDocumentSnapshot> docs = snapshot.getDocuments();
                boolean hasNext = docs.size() > limit;
                List<AssignmentHistory> items = docs.stream().limit(limit).map(this::mapFromDocument).toList();
                return new CursorPage<>(items, hasNext ? docs.get(limit - 1).getId() : null, hasNext);
            } catch (Exception e) {
                log.error("Live Firestore cursor query failed for assignment history: {}", e.getMessage());
                throw new DatabaseUnavailableException("Failed to query assignment history page: " + e.getMessage(), e);
            }
        }
        List<AssignmentHistory> ordered = memoryHistory.values().stream()
                .filter(h -> assignmentId.trim().equals(h.getAssignmentId()))
                .sorted(Comparator.comparing(AssignmentHistory::getHistoryId)).toList();
        List<AssignmentHistory> remaining = afterId == null ? ordered : ordered.stream()
                .filter(h -> h.getHistoryId().compareTo(afterId) > 0).toList();
        boolean hasNext = remaining.size() > limit;
        List<AssignmentHistory> items = remaining.stream().limit(limit).toList();
        return new CursorPage<>(items, hasNext ? items.get(items.size() - 1).getHistoryId() : null, hasNext);
    }

    @Override
    public void clearAllForTesting() {
        memoryHistory.clear();
    }

    private Map<String, Object> mapToMap(AssignmentHistory h) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("historyId", h.getHistoryId());
        map.put("assignmentId", h.getAssignmentId());
        map.put("farmId", h.getFarmId());
        map.put("fieldId", h.getFieldId());
        map.put("farmerUid", h.getFarmerUid());
        map.put("farmerName", h.getFarmerName());
        map.put("eventType", h.getEventType());
        map.put("performedByUid", h.getPerformedByUid());
        map.put("performedByRole", h.getPerformedByRole());
        map.put("reason", h.getReason());
        map.put("sourceApplicationId", h.getSourceApplicationId());
        map.put("timestamp", h.getTimestamp() != null ? Timestamp.ofTimeSecondsAndNanos(h.getTimestamp().getEpochSecond(), h.getTimestamp().getNano()) : Timestamp.now());
        return map;
    }

    private AssignmentHistory mapFromDocument(DocumentSnapshot doc) {
        AssignmentHistory h = new AssignmentHistory();
        h.setHistoryId(doc.getString("historyId") != null ? doc.getString("historyId") : doc.getId());
        h.setAssignmentId(doc.getString("assignmentId"));
        h.setFarmId(doc.getString("farmId"));
        h.setFieldId(doc.getString("fieldId"));
        h.setFarmerUid(doc.getString("farmerUid"));
        h.setFarmerName(doc.getString("farmerName"));
        h.setEventType(doc.getString("eventType"));
        h.setPerformedByUid(doc.getString("performedByUid"));
        h.setPerformedByRole(doc.getString("performedByRole"));
        h.setReason(doc.getString("reason"));
        h.setSourceApplicationId(doc.getString("sourceApplicationId"));

        Timestamp ts = doc.getTimestamp("timestamp");
        if (ts != null) {
            h.setTimestamp(Instant.ofEpochSecond(ts.getSeconds(), ts.getNanos()));
        }
        return h;
    }
}
