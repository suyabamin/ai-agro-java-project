package com.agroai.repository;

import com.agroai.config.FirebaseConfig;
import com.agroai.exception.DatabaseUnavailableException;
import com.agroai.model.ApplicationMessage;
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
 * Cloud Firestore Production Application Message Repository.
 */
@Repository
public class FirestoreApplicationMessageRepository implements ApplicationMessageRepository {

    private static final Logger log = LoggerFactory.getLogger(FirestoreApplicationMessageRepository.class);

    private final FirebaseConfig firebaseConfig;
    private final Environment environment;

    private final Map<String, ApplicationMessage> memoryMessages = new ConcurrentHashMap<>();

    public FirestoreApplicationMessageRepository(FirebaseConfig firebaseConfig, Environment environment) {
        this.firebaseConfig = firebaseConfig;
        this.environment = environment;
    }

    @PostConstruct
    public void validateEnvironmentSafety() {
        if (environment != null) {
            List<String> activeProfiles = Arrays.asList(environment.getActiveProfiles());
            boolean isProd = activeProfiles.contains("prod") || activeProfiles.contains("production");
            if (isProd && !firebaseConfig.isInitialized()) {
                throw new IllegalStateException("CRITICAL SECURITY ERROR: Production profile requires live Cloud Firestore. In-memory message repository fallback is strictly forbidden in production.");
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
    public ApplicationMessage save(ApplicationMessage message) {
        if (message == null || message.getMessageId() == null) {
            throw new IllegalArgumentException("Message and messageId cannot be null");
        }
        checkConfiguredOrReady();
        String messageId = message.getMessageId().trim();

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                db.runTransaction(transaction -> {
                    DocumentReference ref = db.collection("application_messages").document(messageId);
                    transaction.set(ref, mapMessageToMap(message));
                    return null;
                }).get();
                return message;
            } catch (Exception e) {
                log.error("Live Firestore write failed for application_messages/{}: {}", messageId, e.getMessage());
                throw new DatabaseUnavailableException("Failed to save message to Firestore: " + e.getMessage(), e);
            }
        }

        memoryMessages.put(messageId, message);
        return message;
    }

    @Override
    public void saveInTransaction(Transaction transaction, ApplicationMessage message) {
        if (message == null || message.getMessageId() == null) {
            throw new IllegalArgumentException("Message and messageId cannot be null");
        }
        checkConfiguredOrReady();
        String messageId = message.getMessageId().trim();

        if (firebaseConfig.isInitialized()) {
            if (transaction == null) {
                save(message);
                return;
            }
            Firestore db = FirestoreClient.getFirestore();
            DocumentReference ref = db.collection("application_messages").document(messageId);
            transaction.set(ref, mapMessageToMap(message));
            return;
        }

        memoryMessages.put(messageId, message);
    }

    @Override
    public List<ApplicationMessage> findByApplicationIdOrderBySentAtAsc(String applicationId) {
        if (applicationId == null || applicationId.trim().isEmpty()) {
            return new ArrayList<>();
        }
        checkConfiguredOrReady();

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                QuerySnapshot qs = db.collection("application_messages")
                        .whereEqualTo("applicationId", applicationId.trim())
                        .get().get();
                List<ApplicationMessage> list = new ArrayList<>();
                for (QueryDocumentSnapshot qds : qs.getDocuments()) {
                    list.add(mapDocumentToMessage(qds));
                }
                list.sort(Comparator.comparing(ApplicationMessage::getSentAt, Comparator.nullsLast(Comparator.naturalOrder())));
                return list;
            } catch (Exception e) {
                log.error("Live Firestore query failed for application_messages: {}", e.getMessage());
                throw new DatabaseUnavailableException("Failed to query application messages: " + e.getMessage(), e);
            }
        }

        return memoryMessages.values().stream()
                .filter(m -> applicationId.trim().equals(m.getApplicationId()))
                .sorted(Comparator.comparing(ApplicationMessage::getSentAt, Comparator.nullsLast(Comparator.naturalOrder())))
                .collect(Collectors.toList());
    }

    private ApplicationMessage mapDocumentToMessage(DocumentSnapshot doc) {
        ApplicationMessage m = new ApplicationMessage();
        m.setMessageId(doc.getId());
        m.setApplicationId(doc.getString("applicationId"));
        m.setJobId(doc.getString("jobId"));
        m.setFarmId(doc.getString("farmId"));
        m.setSenderUid(doc.getString("senderUid"));
        m.setSenderRole(doc.getString("senderRole"));
        m.setSenderName(doc.getString("senderName"));
        m.setContent(doc.getString("content"));
        m.setSentAt(toInstant(doc.getTimestamp("sentAt")));
        return m;
    }

    private Map<String, Object> mapMessageToMap(ApplicationMessage m) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("messageId", m.getMessageId());
        map.put("applicationId", m.getApplicationId());
        map.put("jobId", m.getJobId());
        map.put("farmId", m.getFarmId());
        map.put("senderUid", m.getSenderUid());
        map.put("senderRole", m.getSenderRole());
        map.put("senderName", m.getSenderName());
        map.put("content", m.getContent());
        map.put("sentAt", toTimestamp(m.getSentAt()));
        return map;
    }

    private Instant toInstant(Timestamp ts) {
        return (ts != null) ? ts.toDate().toInstant() : null;
    }

    private Timestamp toTimestamp(Instant instant) {
        return (instant != null) ? Timestamp.ofTimeSecondsAndNanos(instant.getEpochSecond(), instant.getNano()) : null;
    }
}
