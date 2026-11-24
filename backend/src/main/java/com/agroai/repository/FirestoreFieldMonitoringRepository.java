package com.agroai.repository;

import com.agroai.config.FirebaseConfig;
import com.agroai.exception.DatabaseUnavailableException;
import com.agroai.util.CursorPagination;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.FieldPath;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.Query;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.google.cloud.firestore.Query.Direction;
import com.google.cloud.firestore.QuerySnapshot;
import com.google.cloud.firestore.WriteBatch;
import com.google.firebase.cloud.FirestoreClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/** Firestore adapter with bounded cursor reads and an in-memory dev/test implementation. */
@Repository
public class FirestoreFieldMonitoringRepository implements FieldMonitoringRepository {
    private static final Logger log = LoggerFactory.getLogger(FirestoreFieldMonitoringRepository.class);
    private static final String ACTIVITY = "field_activity";
    private static final List<String> ALLOWED_COLLECTIONS = List.of("field_images", "soil_telemetry", "ai_analysis_results", "irrigation_plans", "disease_research_reports");
    private final FirebaseConfig firebaseConfig;
    private final Map<String, Map<String, Map<String, Object>>> memory = new ConcurrentHashMap<>();

    public FirestoreFieldMonitoringRepository(FirebaseConfig firebaseConfig) { this.firebaseConfig = firebaseConfig; }

    @Override
    public synchronized void createWithActivity(String collection, String id, Map<String, Object> document, Map<String, Object> activity) {
        ensureCollection(collection);
        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                WriteBatch batch = db.batch();
                batch.create(db.collection(collection).document(id), document);
                String eventId = String.valueOf(activity.get("eventId"));
                batch.create(db.collection(ACTIVITY).document(eventId), activity);
                batch.commit().get();
            } catch (Exception e) {
                throw new DatabaseUnavailableException("Unable to persist monitoring record", e);
            }
        } else {
            Map<String, Map<String, Object>> records = memory.computeIfAbsent(collection, ignored -> new ConcurrentHashMap<>());
            if (records.containsKey(id)) throw new IllegalArgumentException("Duplicate monitoring record");
            records.put(id, withId(id, document));
            memory.computeIfAbsent(ACTIVITY, ignored -> new ConcurrentHashMap<>())
                    .put(String.valueOf(activity.get("eventId")), withId(String.valueOf(activity.get("eventId")), activity));
        }
    }

    @Override
    public synchronized void updateWithActivity(String collection, String id, Map<String, Object> document, Map<String, Object> activity) {
        ensureCollection(collection);
        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                WriteBatch batch = db.batch();
                batch.set(db.collection(collection).document(id), document);
                batch.create(db.collection(ACTIVITY).document(String.valueOf(activity.get("eventId"))), activity);
                batch.commit().get();
            } catch (Exception e) {
                throw new DatabaseUnavailableException("Unable to update monitoring record", e);
            }
        } else {
            Map<String, Map<String, Object>> records = memory.get(collection);
            if (records == null || !records.containsKey(id)) throw new IllegalArgumentException("Monitoring record not found");
            records.put(id, withId(id, document));
            memory.computeIfAbsent(ACTIVITY, ignored -> new ConcurrentHashMap<>())
                    .put(String.valueOf(activity.get("eventId")), withId(String.valueOf(activity.get("eventId")), activity));
        }
    }

    @Override
    public Optional<Map<String, Object>> find(String collection, String id) {
        ensureCollection(collection);
        if (firebaseConfig.isInitialized()) {
            try {
                DocumentSnapshot doc = FirestoreClient.getFirestore().collection(collection).document(id).get().get();
                return doc.exists() ? Optional.of(withId(doc.getId(), doc.getData())) : Optional.empty();
            } catch (Exception e) {
                throw new DatabaseUnavailableException("Unable to load monitoring record", e);
            }
        }
        Map<String, Map<String, Object>> records = memory.get(collection);
        return records == null ? Optional.empty() : Optional.ofNullable(records.get(id)).map(HashMap::new);
    }

    @Override
    public CursorPage<Map<String, Object>> page(String collection, String farmId, String fieldId, String afterId,
                                                int size, Map<String, Object> equalityFilters, Long fromEpochMs, Long toEpochMs) {
        if (!ALLOWED_COLLECTIONS.contains(collection) && !ACTIVITY.equals(collection)) throw new IllegalArgumentException("Unsupported monitoring collection");
        if (size < 1 || size > 100) throw new IllegalArgumentException("Page size must be between 1 and 100");
        if (firebaseConfig.isInitialized()) return firestorePage(collection, farmId, fieldId, afterId, size, equalityFilters, fromEpochMs, toEpochMs);
        return memoryPage(collection, farmId, fieldId, afterId, size, equalityFilters, fromEpochMs, toEpochMs);
    }

    private CursorPage<Map<String, Object>> firestorePage(String collection, String farmId, String fieldId, String afterId,
                                                           int size, Map<String, Object> filters, Long from, Long to) {
        try {
            Firestore db = FirestoreClient.getFirestore();
            var ref = db.collection(collection);
            Query query = ref.whereEqualTo("farmId", farmId).whereEqualTo("fieldId", fieldId);
            for (Map.Entry<String, Object> filter : filters.entrySet()) query = query.whereEqualTo(filter.getKey(), filter.getValue());
            if (from != null) query = query.whereGreaterThanOrEqualTo("createdAtEpochMs", from);
            if (to != null) query = query.whereLessThanOrEqualTo("createdAtEpochMs", to);

            Query indexedQuery = query.orderBy("createdAtEpochMs", Direction.DESCENDING).orderBy(FieldPath.documentId(), Direction.DESCENDING);
            if (afterId != null) {
                DocumentSnapshot after = ref.document(afterId).get().get();
                if (!after.exists() || !farmId.equals(after.getString("farmId")) || !fieldId.equals(after.getString("fieldId"))) {
                    throw new IllegalArgumentException("Cursor is invalid for this field");
                }
                indexedQuery = indexedQuery.startAfter(after);
            }

            QuerySnapshot result;
            try {
                result = indexedQuery.limit(size + 1).get().get();
            } catch (Exception queryEx) {
                log.warn("Composite indexed query failed for collection {} (missing index? Falling back to unindexed query with in-memory sort): {}", collection, queryEx.getMessage());
                Query unindexed = query.limit(CursorPagination.MAX_PAGE_SIZE);
                QuerySnapshot fallbackSnap = unindexed.get().get();
                List<QueryDocumentSnapshot> sortedDocs = new ArrayList<>(fallbackSnap.getDocuments());
                sortedDocs.sort((a, b) -> {
                    Object rawA = a.get("createdAtEpochMs");
                    long tA = rawA instanceof Number numA ? numA.longValue() : 0L;
                    Object rawB = b.get("createdAtEpochMs");
                    long tB = rawB instanceof Number numB ? numB.longValue() : 0L;
                    int cmp = Long.compare(tB, tA);
                    return cmp != 0 ? cmp : b.getId().compareTo(a.getId());
                });
                int startIndex = 0;
                if (afterId != null) {
                    for (int i = 0; i < sortedDocs.size(); i++) {
                        if (sortedDocs.get(i).getId().equals(afterId)) {
                            startIndex = i + 1;
                            break;
                        }
                    }
                }
                List<QueryDocumentSnapshot> pageDocs = sortedDocs.subList(Math.min(startIndex, sortedDocs.size()),
                        Math.min(startIndex + size, sortedDocs.size()));
                boolean hasNext = (startIndex + size) < sortedDocs.size();
                List<Map<String, Object>> items = pageDocs.stream().map(doc -> withId(doc.getId(), doc.getData())).toList();
                return new CursorPage<>(items, hasNext && !pageDocs.isEmpty() ? pageDocs.get(pageDocs.size() - 1).getId() : null, hasNext);
            }

            boolean hasNext = result.size() > size;
            List<QueryDocumentSnapshot> docs = result.getDocuments().stream().limit(size).toList();
            List<Map<String, Object>> items = docs.stream().map(doc -> withId(doc.getId(), doc.getData())).toList();
            return new CursorPage<>(items, hasNext && !docs.isEmpty() ? docs.get(docs.size() - 1).getId() : null, hasNext);
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.error("Unable to page monitoring records in collection {}: {}", collection, e.getMessage(), e);
            throw new DatabaseUnavailableException("Unable to page monitoring records", e);
        }
    }

    private CursorPage<Map<String, Object>> memoryPage(String collection, String farmId, String fieldId, String afterId,
                                                        int size, Map<String, Object> filters, Long from, Long to) {
        Map<String, Map<String, Object>> records = memory.getOrDefault(collection, Map.of());
        List<Map<String, Object>> values = records.values().stream()
                .filter(item -> farmId.equals(item.get("farmId")) && fieldId.equals(item.get("fieldId")))
                .filter(item -> filters.entrySet().stream().allMatch(f -> java.util.Objects.equals(item.get(f.getKey()), f.getValue())))
                .filter(item -> from == null || ((Number) item.getOrDefault("createdAtEpochMs", 0L)).longValue() >= from)
                .filter(item -> to == null || ((Number) item.getOrDefault("createdAtEpochMs", 0L)).longValue() <= to)
                .sorted(Comparator.comparingLong((Map<String, Object> item) -> ((Number) item.getOrDefault("createdAtEpochMs", 0L)).longValue())
                        .thenComparing(item -> String.valueOf(item.get("id"))).reversed())
                .toList();
        int start = 0;
        if (afterId != null) {
            int cursorIndex = -1;
            for (int i = 0; i < values.size(); i++) if (afterId.equals(values.get(i).get("id"))) cursorIndex = i;
            if (cursorIndex < 0) throw new IllegalArgumentException("Cursor is invalid for this field");
            start = cursorIndex + 1;
        }
        List<Map<String, Object>> items = values.stream().skip(start).limit(size + 1L).toList();
        boolean hasNext = items.size() > size;
        List<Map<String, Object>> page = items.stream().limit(size)
                .map(item -> (Map<String, Object>) new HashMap<String, Object>(item)).toList();
        String next = hasNext && !page.isEmpty() ? String.valueOf(page.get(page.size() - 1).get("id")) : null;
        return new CursorPage<>(page, next, hasNext);
    }

    @Override
    public synchronized void deleteWithActivity(String collection, String id, Map<String, Object> activity) {
        ensureCollection(collection);
        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                WriteBatch batch = db.batch();
                batch.delete(db.collection(collection).document(id));
                batch.create(db.collection(ACTIVITY).document(String.valueOf(activity.get("eventId"))), activity);
                batch.commit().get();
            } catch (Exception e) {
                throw new DatabaseUnavailableException("Unable to delete monitoring record", e);
            }
        } else {
            Map<String, Map<String, Object>> records = memory.get(collection);
            if (records != null) records.remove(id);
            memory.computeIfAbsent(ACTIVITY, ignored -> new ConcurrentHashMap<>())
                    .put(String.valueOf(activity.get("eventId")), withId(String.valueOf(activity.get("eventId")), activity));
        }
    }

    private static void ensureCollection(String collection) {
        if (!ALLOWED_COLLECTIONS.contains(collection) && !ACTIVITY.equals(collection)) throw new IllegalArgumentException("Unsupported monitoring collection");
    }

    private static Map<String, Object> withId(String id, Map<String, Object> source) {
        Map<String, Object> result = new LinkedHashMap<>(source == null ? Map.of() : source);
        result.put("id", id);
        return result;
    }
}
