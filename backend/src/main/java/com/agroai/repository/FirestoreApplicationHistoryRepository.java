package com.agroai.repository;

import com.agroai.config.FirebaseConfig;
import com.agroai.exception.DatabaseUnavailableException;
import com.agroai.model.ApplicationHistory;
import com.agroai.model.ApplicationStatus;
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
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Cloud Firestore Production Application History Repository (Immutable Audit Trail).
 */
@Repository
public class FirestoreApplicationHistoryRepository implements ApplicationHistoryRepository {

    private static final Logger log = LoggerFactory.getLogger(FirestoreApplicationHistoryRepository.class);

    private final FirebaseConfig firebaseConfig;
    private final Environment environment;

    private final Map<String, ApplicationHistory> memoryHistory = new ConcurrentHashMap<>();

    public FirestoreApplicationHistoryRepository(FirebaseConfig firebaseConfig, Environment environment) {
        this.firebaseConfig = firebaseConfig;
        this.environment = environment;
    }

    @PostConstruct
    public void validateEnvironmentSafety() {
        if (environment != null) {
            List<String> activeProfiles = Arrays.asList(environment.getActiveProfiles());
            boolean isProd = activeProfiles.contains("prod") || activeProfiles.contains("production");
            if (isProd && !firebaseConfig.isInitialized()) {
                throw new IllegalStateException("CRITICAL SECURITY ERROR: Production profile requires live Cloud Firestore. In-memory history repository fallback is strictly forbidden in production.");
            }
        }
    }

    private void checkConfiguredOrReady() {
        if (firebaseConfig.isConfigured() && !firebaseConfig.isInitialized()) {
            throw new DatabaseUnavailableException("Firebase configured but initialization failed ("
                    + firebaseConfig.getInitializationMessage() + "). In-memory fallback is disabled.");
        }
    }

    @Override
    public ApplicationHistory save(ApplicationHistory history) {
        if (history == null || history.getHistoryId() == null) {
            throw new IllegalArgumentException("History and historyId cannot be null");
        }
        checkConfiguredOrReady();
        String historyId = history.getHistoryId().trim();

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                db.runTransaction(transaction -> {
                    DocumentReference ref = db.collection("application_history").document(historyId);
                    transaction.set(ref, mapHistoryToMap(history));
                    return null;
                }).get();
                return history;
            } catch (Exception e) {
                log.error("Live Firestore write failed for application_history/{}: {}", historyId, e.getMessage());
                throw new DatabaseUnavailableException("Failed to save application history to Firestore: " + e.getMessage(), e);
            }
        }

        memoryHistory.put(historyId, history);
        return history;
    }

    @Override
    public void saveInTransaction(Transaction transaction, ApplicationHistory history) {
        if (history == null || history.getHistoryId() == null) {
            throw new IllegalArgumentException("History and historyId cannot be null");
        }
        checkConfiguredOrReady();
        String historyId = history.getHistoryId().trim();

        if (firebaseConfig.isInitialized()) {
            if (transaction == null) {
                save(history);
                return;
            }
            Firestore db = FirestoreClient.getFirestore();
            DocumentReference ref = db.collection("application_history").document(historyId);
            transaction.set(ref, mapHistoryToMap(history));
            return;
        }

        memoryHistory.put(historyId, history);
    }

    @Override
    public List<ApplicationHistory> findByApplicationId(String applicationId) {
        if (applicationId == null || applicationId.trim().isEmpty()) {
            return new ArrayList<>();
        }
        checkConfiguredOrReady();

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                QuerySnapshot qs = db.collection("application_history")
                        .whereEqualTo("applicationId", applicationId.trim())
                        .get().get();
                List<ApplicationHistory> list = new ArrayList<>();
                for (QueryDocumentSnapshot qds : qs.getDocuments()) {
                    list.add(mapDocumentToHistory(qds));
                }
                list.sort(Comparator.comparing(ApplicationHistory::getTimestamp, Comparator.nullsLast(Comparator.naturalOrder())));
                return list;
            } catch (Exception e) {
                log.error("Live Firestore query failed for application_history by applicationId: {}", e.getMessage());
                throw new DatabaseUnavailableException("Failed to query application history: " + e.getMessage(), e);
            }
        }

        return memoryHistory.values().stream()
                .filter(h -> applicationId.trim().equals(h.getApplicationId()))
                .sorted(Comparator.comparing(ApplicationHistory::getTimestamp, Comparator.nullsLast(Comparator.naturalOrder())))
                .collect(Collectors.toList());
    }

    private ApplicationHistory mapDocumentToHistory(DocumentSnapshot doc) {
        ApplicationHistory h = new ApplicationHistory();
        h.setHistoryId(doc.getId());
        h.setApplicationId(doc.getString("applicationId"));
        h.setJobId(doc.getString("jobId"));
        h.setFarmId(doc.getString("farmId"));
        h.setApplicantUid(doc.getString("applicantUid"));

        String prevStr = doc.getString("previousStatus");
        if (prevStr != null) {
            try { h.setPreviousStatus(ApplicationStatus.valueOf(prevStr)); } catch (IllegalArgumentException ignored) {}
        }
        String newStr = doc.getString("newStatus");
        if (newStr != null) {
            try { h.setNewStatus(ApplicationStatus.valueOf(newStr)); } catch (IllegalArgumentException ignored) {}
        }
        h.setActorUid(doc.getString("actorUid"));
        h.setActorRole(doc.getString("actorRole"));
        h.setTimestamp(toInstant(doc.getTimestamp("timestamp")));
        h.setReason(doc.getString("reason"));
        return h;
    }

    private Map<String, Object> mapHistoryToMap(ApplicationHistory h) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("historyId", h.getHistoryId());
        map.put("applicationId", h.getApplicationId());
        map.put("jobId", h.getJobId());
        map.put("farmId", h.getFarmId());
        map.put("applicantUid", h.getApplicantUid());
        map.put("previousStatus", h.getPreviousStatus() != null ? h.getPreviousStatus().name() : null);
        map.put("newStatus", h.getNewStatus() != null ? h.getNewStatus().name() : null);
        map.put("actorUid", h.getActorUid());
        map.put("actorRole", h.getActorRole());
        map.put("timestamp", toTimestamp(h.getTimestamp()));
        map.put("reason", h.getReason());
        return map;
    }

    private Instant toInstant(Timestamp ts) {
        return (ts != null) ? ts.toDate().toInstant() : null;
    }

    private Timestamp toTimestamp(Instant instant) {
        return (instant != null) ? Timestamp.ofTimeSecondsAndNanos(instant.getEpochSecond(), instant.getNano()) : null;
    }
}
