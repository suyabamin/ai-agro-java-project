package com.agroai.repository;

import com.agroai.config.FirebaseConfig;
import com.agroai.exception.DatabaseUnavailableException;
import com.agroai.model.ApplicationStatus;
import com.agroai.model.JobApplication;
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
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;
import java.util.stream.Collectors;

/**
 * Cloud Firestore Production Job Application Repository.
 */
@Repository
public class FirestoreJobApplicationRepository implements JobApplicationRepository {

    private static final Logger log = LoggerFactory.getLogger(FirestoreJobApplicationRepository.class);

    private final FirebaseConfig firebaseConfig;
    private final Environment environment;

    private final Map<String, JobApplication> memoryApplications = new ConcurrentHashMap<>();
    private final Map<String, ReentrantLock> applicationLocks = new ConcurrentHashMap<>();

    public FirestoreJobApplicationRepository(FirebaseConfig firebaseConfig, Environment environment) {
        this.firebaseConfig = firebaseConfig;
        this.environment = environment;
    }

    @PostConstruct
    public void validateEnvironmentSafety() {
        if (environment != null) {
            List<String> activeProfiles = Arrays.asList(environment.getActiveProfiles());
            boolean isProd = activeProfiles.contains("prod") || activeProfiles.contains("production");
            if (isProd && !firebaseConfig.isInitialized()) {
                throw new IllegalStateException("CRITICAL SECURITY ERROR: Production profile requires live Cloud Firestore. In-memory application repository fallback is strictly forbidden in production.");
            }
        }
    }

    private ReentrantLock getLockForApplication(String applicationId) {
        return applicationLocks.computeIfAbsent(applicationId, k -> new ReentrantLock());
    }

    private void checkConfiguredOrReady() {
        if (firebaseConfig.isConfigured() && !firebaseConfig.isInitialized()) {
            throw new DatabaseUnavailableException("Firebase configured but initialization failed ("
                    + firebaseConfig.getInitializationMessage() + "). In-memory fallback is disabled.");
        }
    }

    @Override
    public Optional<JobApplication> findById(String applicationId) {
        if (applicationId == null || applicationId.trim().isEmpty()) {
            return Optional.empty();
        }
        checkConfiguredOrReady();

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                DocumentSnapshot doc = db.collection("applications").document(applicationId.trim()).get().get();
                if (doc.exists()) {
                    return Optional.ofNullable(mapDocumentToApplication(doc));
                }
                return Optional.empty();
            } catch (Exception e) {
                log.error("Live Firestore read failed for applications/{}: {}", applicationId, e.getMessage());
                throw new DatabaseUnavailableException("Failed to read application from Firestore: " + e.getMessage(), e);
            }
        }

        return Optional.ofNullable(memoryApplications.get(applicationId.trim()));
    }

    @Override
    public JobApplication findByIdInTransaction(Transaction transaction, String applicationId) {
        if (applicationId == null || applicationId.trim().isEmpty()) {
            return null;
        }
        checkConfiguredOrReady();

        if (firebaseConfig.isInitialized()) {
            if (transaction == null) {
                return findById(applicationId).orElse(null);
            }
            try {
                Firestore db = FirestoreClient.getFirestore();
                DocumentReference ref = db.collection("applications").document(applicationId.trim());
                DocumentSnapshot snap = transaction.get(ref).get();
                if (snap.exists()) {
                    return mapDocumentToApplication(snap);
                }
                return null;
            } catch (Exception e) {
                log.error("Live Firestore transactional read failed for applications/{}: {}", applicationId, e.getMessage());
                throw new DatabaseUnavailableException("Failed to read application in transaction: " + e.getMessage(), e);
            }
        }

        return memoryApplications.get(applicationId.trim());
    }

    @Override
    public Optional<JobApplication> findByJobIdAndApplicantUid(String jobId, String applicantUid) {
        if (jobId == null || applicantUid == null) {
            return Optional.empty();
        }
        checkConfiguredOrReady();

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                QuerySnapshot qs = db.collection("applications")
                        .whereEqualTo("jobId", jobId.trim())
                        .whereEqualTo("applicantUid", applicantUid.trim())
                        .limit(1)
                        .get().get();
                if (!qs.isEmpty()) {
                    return Optional.ofNullable(mapDocumentToApplication(qs.getDocuments().get(0)));
                }
                return Optional.empty();
            } catch (Exception e) {
                log.error("Live Firestore query failed for application by jobId and applicantUid: {}", e.getMessage());
                throw new DatabaseUnavailableException("Failed to query application: " + e.getMessage(), e);
            }
        }

        return memoryApplications.values().stream()
                .filter(a -> jobId.trim().equals(a.getJobId()) && applicantUid.trim().equals(a.getApplicantUid()))
                .findFirst();
    }

    @Override
    public JobApplication save(JobApplication application) {
        if (application == null || application.getApplicationId() == null) {
            throw new IllegalArgumentException("Application and applicationId cannot be null");
        }
        checkConfiguredOrReady();
        String applicationId = application.getApplicationId().trim();
        ReentrantLock lock = getLockForApplication(applicationId);
        lock.lock();
        try {
            if (firebaseConfig.isInitialized()) {
                try {
                    Firestore db = FirestoreClient.getFirestore();
                    db.runTransaction(transaction -> {
                        DocumentReference ref = db.collection("applications").document(applicationId);
                        transaction.set(ref, mapApplicationToMap(application));
                        return null;
                    }).get();
                    return application;
                } catch (Exception e) {
                    log.error("Live Firestore write failed for applications/{}: {}", applicationId, e.getMessage());
                    throw new DatabaseUnavailableException("Failed to save application to Firestore: " + e.getMessage(), e);
                }
            }

            memoryApplications.put(applicationId, application);
            return application;
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void saveInTransaction(Transaction transaction, JobApplication application) {
        if (application == null || application.getApplicationId() == null) {
            throw new IllegalArgumentException("Application and applicationId cannot be null");
        }
        checkConfiguredOrReady();
        String applicationId = application.getApplicationId().trim();

        if (firebaseConfig.isInitialized()) {
            if (transaction == null) {
                save(application);
                return;
            }
            Firestore db = FirestoreClient.getFirestore();
            DocumentReference ref = db.collection("applications").document(applicationId);
            transaction.set(ref, mapApplicationToMap(application));
            return;
        }

        memoryApplications.put(applicationId, application);
    }

    @Override
    public List<JobApplication> findByJobId(String jobId) {
        if (jobId == null || jobId.trim().isEmpty()) {
            return new ArrayList<>();
        }
        checkConfiguredOrReady();

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                QuerySnapshot qs = db.collection("applications")
                        .whereEqualTo("jobId", jobId.trim())
                        .get().get();
                List<JobApplication> list = new ArrayList<>();
                for (QueryDocumentSnapshot qds : qs.getDocuments()) {
                    list.add(mapDocumentToApplication(qds));
                }
                list.sort(Comparator.comparing(JobApplication::getSubmittedAt, Comparator.nullsLast(Comparator.reverseOrder())));
                return list;
            } catch (Exception e) {
                log.error("Live Firestore query failed for applications by jobId: {}", e.getMessage());
                throw new DatabaseUnavailableException("Failed to query applications by job: " + e.getMessage(), e);
            }
        }

        return memoryApplications.values().stream()
                .filter(a -> jobId.trim().equals(a.getJobId()))
                .sorted(Comparator.comparing(JobApplication::getSubmittedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .collect(Collectors.toList());
    }

    @Override
    public List<JobApplication> findByFarmId(String farmId) {
        if (farmId == null || farmId.trim().isEmpty()) {
            return new ArrayList<>();
        }
        checkConfiguredOrReady();

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                QuerySnapshot qs = db.collection("applications")
                        .whereEqualTo("farmId", farmId.trim())
                        .get().get();
                List<JobApplication> list = new ArrayList<>();
                for (QueryDocumentSnapshot qds : qs.getDocuments()) {
                    list.add(mapDocumentToApplication(qds));
                }
                list.sort(Comparator.comparing(JobApplication::getSubmittedAt, Comparator.nullsLast(Comparator.reverseOrder())));
                return list;
            } catch (Exception e) {
                log.error("Live Firestore query failed for applications by farmId: {}", e.getMessage());
                throw new DatabaseUnavailableException("Failed to query applications by farm: " + e.getMessage(), e);
            }
        }

        return memoryApplications.values().stream()
                .filter(a -> farmId.trim().equals(a.getFarmId()))
                .sorted(Comparator.comparing(JobApplication::getSubmittedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .collect(Collectors.toList());
    }

    @Override
    public List<JobApplication> findByFarmIdAndJobId(String farmId, String jobId) {
        if (farmId == null || jobId == null) {
            return new ArrayList<>();
        }
        checkConfiguredOrReady();

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                QuerySnapshot qs = db.collection("applications")
                        .whereEqualTo("farmId", farmId.trim())
                        .whereEqualTo("jobId", jobId.trim())
                        .get().get();
                List<JobApplication> list = new ArrayList<>();
                for (QueryDocumentSnapshot qds : qs.getDocuments()) {
                    list.add(mapDocumentToApplication(qds));
                }
                list.sort(Comparator.comparing(JobApplication::getSubmittedAt, Comparator.nullsLast(Comparator.reverseOrder())));
                return list;
            } catch (Exception e) {
                log.error("Live Firestore query failed for applications by farm and job: {}", e.getMessage());
                throw new DatabaseUnavailableException("Failed to query applications: " + e.getMessage(), e);
            }
        }

        return memoryApplications.values().stream()
                .filter(a -> farmId.trim().equals(a.getFarmId()) && jobId.trim().equals(a.getJobId()))
                .sorted(Comparator.comparing(JobApplication::getSubmittedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .collect(Collectors.toList());
    }

    @Override
    public List<JobApplication> findByApplicantUid(String applicantUid) {
        if (applicantUid == null || applicantUid.trim().isEmpty()) {
            return new ArrayList<>();
        }
        checkConfiguredOrReady();

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                QuerySnapshot qs = db.collection("applications")
                        .whereEqualTo("applicantUid", applicantUid.trim())
                        .get().get();
                List<JobApplication> list = new ArrayList<>();
                for (QueryDocumentSnapshot qds : qs.getDocuments()) {
                    list.add(mapDocumentToApplication(qds));
                }
                list.sort(Comparator.comparing(JobApplication::getSubmittedAt, Comparator.nullsLast(Comparator.reverseOrder())));
                return list;
            } catch (Exception e) {
                log.error("Live Firestore query failed for applications by applicantUid: {}", e.getMessage());
                throw new DatabaseUnavailableException("Failed to query applications by applicant: " + e.getMessage(), e);
            }
        }

        return memoryApplications.values().stream()
                .filter(a -> applicantUid.trim().equals(a.getApplicantUid()))
                .sorted(Comparator.comparing(JobApplication::getSubmittedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .collect(Collectors.toList());
    }

    private JobApplication mapDocumentToApplication(DocumentSnapshot doc) {
        JobApplication app = new JobApplication();
        app.setApplicationId(doc.getId());
        app.setJobId(doc.getString("jobId"));
        app.setFarmId(doc.getString("farmId"));
        app.setApplicantUid(doc.getString("applicantUid"));
        app.setApplicantName(doc.getString("applicantName"));
        app.setApplicantEmail(doc.getString("applicantEmail"));
        app.setApplicantPhone(doc.getString("applicantPhone"));
        app.setCoverLetter(doc.getString("coverLetter"));
        app.setRelevantExperience(doc.getString("relevantExperience"));

        @SuppressWarnings("unchecked")
        List<String> skills = (List<String>) doc.get("skills");
        if (skills != null) {
            app.setSkills(skills);
        }
        app.setAvailability(doc.getString("availability"));
        app.setExpectedSalary(doc.getDouble("expectedSalary"));

        String statusStr = doc.getString("status");
        if (statusStr != null) {
            try { app.setStatus(ApplicationStatus.valueOf(statusStr)); } catch (IllegalArgumentException ignored) {}
        }
        app.setSubmittedAt(toInstant(doc.getTimestamp("submittedAt")));
        app.setUpdatedAt(toInstant(doc.getTimestamp("updatedAt")));
        app.setReviewedAt(toInstant(doc.getTimestamp("reviewedAt")));
        app.setReviewedBy(doc.getString("reviewedBy"));
        app.setDecisionReason(doc.getString("decisionReason"));

        Long ver = doc.getLong("version");
        app.setVersion(ver != null ? ver.intValue() : 1);

        return app;
    }

    private Map<String, Object> mapApplicationToMap(JobApplication app) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("applicationId", app.getApplicationId());
        map.put("jobId", app.getJobId());
        map.put("farmId", app.getFarmId());
        map.put("applicantUid", app.getApplicantUid());
        map.put("applicantName", app.getApplicantName());
        map.put("applicantEmail", app.getApplicantEmail());
        map.put("applicantPhone", app.getApplicantPhone());
        map.put("coverLetter", app.getCoverLetter());
        map.put("relevantExperience", app.getRelevantExperience());
        map.put("skills", app.getSkills());
        map.put("availability", app.getAvailability());
        map.put("expectedSalary", app.getExpectedSalary());
        map.put("status", app.getStatus() != null ? app.getStatus().name() : ApplicationStatus.SUBMITTED.name());
        map.put("submittedAt", toTimestamp(app.getSubmittedAt()));
        map.put("updatedAt", toTimestamp(app.getUpdatedAt()));
        map.put("reviewedAt", toTimestamp(app.getReviewedAt()));
        map.put("reviewedBy", app.getReviewedBy());
        map.put("decisionReason", app.getDecisionReason());
        map.put("version", app.getVersion());
        return map;
    }

    private Instant toInstant(Timestamp ts) {
        return (ts != null) ? ts.toDate().toInstant() : null;
    }

    private Timestamp toTimestamp(Instant instant) {
        return (instant != null) ? Timestamp.ofTimeSecondsAndNanos(instant.getEpochSecond(), instant.getNano()) : null;
    }
}
