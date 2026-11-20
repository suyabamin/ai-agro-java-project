package com.agroai.repository;

import com.agroai.config.FirebaseConfig;
import com.agroai.exception.DatabaseUnavailableException;
import com.agroai.model.EmploymentType;
import com.agroai.model.Job;
import com.agroai.model.JobCategory;
import com.agroai.model.JobStatus;
import com.agroai.model.SalaryType;
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
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;
import java.util.stream.Collectors;

/**
 * Cloud Firestore Production Job Repository.
 *
 * Implements strict environment separation:
 * - Production / Live Mode (Firebase initialized): All operations execute against live Cloud Firestore collection 'jobs'.
 *   Failures FAIL CLOSED with DatabaseUnavailableException.
 * - Test / Dev Mode (Unconfigured): Operates against thread-safe in-memory maps for offline testing.
 */
@Repository
public class FirestoreJobRepository implements JobRepository {

    private static final Logger log = LoggerFactory.getLogger(FirestoreJobRepository.class);

    private final FirebaseConfig firebaseConfig;
    private final Environment environment;

    private final Map<String, Job> memoryJobs = new ConcurrentHashMap<>();
    private final Map<String, ReentrantLock> jobLocks = new ConcurrentHashMap<>();

    public FirestoreJobRepository(FirebaseConfig firebaseConfig, Environment environment) {
        this.firebaseConfig = firebaseConfig;
        this.environment = environment;
    }

    @PostConstruct
    public void validateEnvironmentSafety() {
        if (environment != null) {
            List<String> activeProfiles = Arrays.asList(environment.getActiveProfiles());
            boolean isProd = activeProfiles.contains("prod") || activeProfiles.contains("production");
            if (isProd && !firebaseConfig.isInitialized()) {
                throw new IllegalStateException("CRITICAL SECURITY ERROR: Production profile requires live Cloud Firestore. In-memory job repository fallback is strictly forbidden in production.");
            }
        }
    }

    private ReentrantLock getLockForJob(String jobId) {
        return jobLocks.computeIfAbsent(jobId, k -> new ReentrantLock());
    }

    private void checkConfiguredOrReady() {
        if (firebaseConfig.isConfigured() && !firebaseConfig.isInitialized()) {
            throw new DatabaseUnavailableException("Firebase configured but initialization failed ("
                    + firebaseConfig.getInitializationMessage() + "). In-memory fallback is disabled.");
        }
    }

    @Override
    public Optional<Job> findById(String jobId) {
        if (jobId == null || jobId.trim().isEmpty()) {
            return Optional.empty();
        }
        checkConfiguredOrReady();

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                DocumentSnapshot doc = db.collection("jobs").document(jobId.trim()).get().get();
                if (doc.exists()) {
                    return Optional.ofNullable(mapDocumentToJob(doc));
                }
                return Optional.empty();
            } catch (Exception e) {
                log.error("Live Firestore read failed for jobs/{}: {}", jobId, e.getMessage());
                throw new DatabaseUnavailableException("Failed to read job from Firestore: " + e.getMessage(), e);
            }
        }

        return Optional.ofNullable(memoryJobs.get(jobId.trim()));
    }

    @Override
    public Job findByIdInTransaction(Transaction transaction, String jobId) {
        if (jobId == null || jobId.trim().isEmpty()) {
            return null;
        }
        checkConfiguredOrReady();

        if (firebaseConfig.isInitialized()) {
            if (transaction == null) {
                return findById(jobId).orElse(null);
            }
            try {
                Firestore db = FirestoreClient.getFirestore();
                DocumentReference ref = db.collection("jobs").document(jobId.trim());
                DocumentSnapshot snap = transaction.get(ref).get();
                if (snap.exists()) {
                    return mapDocumentToJob(snap);
                }
                return null;
            } catch (Exception e) {
                log.error("Live Firestore transactional read failed for jobs/{}: {}", jobId, e.getMessage());
                throw new DatabaseUnavailableException("Failed to read job in transaction: " + e.getMessage(), e);
            }
        }

        return memoryJobs.get(jobId.trim());
    }

    @Override
    public Job save(Job job) {
        if (job == null || job.getJobId() == null) {
            throw new IllegalArgumentException("Job and jobId cannot be null");
        }
        checkConfiguredOrReady();
        String jobId = job.getJobId().trim();
        ReentrantLock lock = getLockForJob(jobId);
        lock.lock();
        try {
            if (firebaseConfig.isInitialized()) {
                try {
                    Firestore db = FirestoreClient.getFirestore();
                    db.runTransaction(transaction -> {
                        DocumentReference ref = db.collection("jobs").document(jobId);
                        transaction.set(ref, mapJobToMap(job));
                        return null;
                    }).get();
                    return job;
                } catch (Exception e) {
                    log.error("Live Firestore write failed for jobs/{}: {}", jobId, e.getMessage());
                    throw new DatabaseUnavailableException("Failed to save job to Firestore: " + e.getMessage(), e);
                }
            }

            memoryJobs.put(jobId, job);
            return job;
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void saveInTransaction(Transaction transaction, Job job) {
        if (job == null || job.getJobId() == null) {
            throw new IllegalArgumentException("Job and jobId cannot be null");
        }
        checkConfiguredOrReady();
        String jobId = job.getJobId().trim();

        if (firebaseConfig.isInitialized()) {
            if (transaction == null) {
                save(job);
                return;
            }
            Firestore db = FirestoreClient.getFirestore();
            DocumentReference ref = db.collection("jobs").document(jobId);
            transaction.set(ref, mapJobToMap(job));
            return;
        }

        memoryJobs.put(jobId, job);
    }

    @Override
    public List<Job> findByFarmId(String farmId) {
        if (farmId == null || farmId.trim().isEmpty()) {
            return new ArrayList<>();
        }
        checkConfiguredOrReady();

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                QuerySnapshot qs = db.collection("jobs")
                        .whereEqualTo("farmId", farmId.trim())
                        .get().get();
                List<Job> list = new ArrayList<>();
                for (QueryDocumentSnapshot qds : qs.getDocuments()) {
                    list.add(mapDocumentToJob(qds));
                }
                list.sort(Comparator.comparing(Job::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())));
                return list;
            } catch (Exception e) {
                log.error("Live Firestore query failed for jobs by farmId {}: {}", farmId, e.getMessage());
                throw new DatabaseUnavailableException("Failed to query jobs by farm: " + e.getMessage(), e);
            }
        }

        return memoryJobs.values().stream()
                .filter(j -> farmId.trim().equals(j.getFarmId()))
                .sorted(Comparator.comparing(Job::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .collect(Collectors.toList());
    }

    @Override
    public List<Job> findByFarmIdAndStatus(String farmId, JobStatus status) {
        if (farmId == null || status == null) {
            return new ArrayList<>();
        }
        checkConfiguredOrReady();

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                QuerySnapshot qs = db.collection("jobs")
                        .whereEqualTo("farmId", farmId.trim())
                        .whereEqualTo("status", status.name())
                        .get().get();
                List<Job> list = new ArrayList<>();
                for (QueryDocumentSnapshot qds : qs.getDocuments()) {
                    list.add(mapDocumentToJob(qds));
                }
                list.sort(Comparator.comparing(Job::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())));
                return list;
            } catch (Exception e) {
                log.error("Live Firestore query failed for jobs by farm and status: {}", e.getMessage());
                throw new DatabaseUnavailableException("Failed to query jobs: " + e.getMessage(), e);
            }
        }

        return memoryJobs.values().stream()
                .filter(j -> farmId.trim().equals(j.getFarmId()) && j.getStatus() == status)
                .sorted(Comparator.comparing(Job::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .collect(Collectors.toList());
    }

    @Override
    public List<Job> findByStatus(JobStatus status) {
        if (status == null) {
            return new ArrayList<>();
        }
        checkConfiguredOrReady();

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                QuerySnapshot qs = db.collection("jobs")
                        .whereEqualTo("status", status.name())
                        .get().get();
                List<Job> list = new ArrayList<>();
                for (QueryDocumentSnapshot qds : qs.getDocuments()) {
                    list.add(mapDocumentToJob(qds));
                }
                list.sort(Comparator.comparing(Job::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())));
                return list;
            } catch (Exception e) {
                log.error("Live Firestore query failed for jobs by status: {}", e.getMessage());
                throw new DatabaseUnavailableException("Failed to query jobs by status: " + e.getMessage(), e);
            }
        }

        return memoryJobs.values().stream()
                .filter(j -> j.getStatus() == status)
                .sorted(Comparator.comparing(Job::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .collect(Collectors.toList());
    }

    @Override
    public List<Job> findPublicJobs(String keyword, JobCategory category, EmploymentType employmentType,
                                    String division, String district, Double minSalary, Double maxSalary,
                                    int page, int size) {
        checkConfiguredOrReady();

        List<Job> published;
        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                Query query = db.collection("jobs").whereEqualTo("status", JobStatus.PUBLISHED.name());
                if (category != null) {
                    query = query.whereEqualTo("jobCategory", category.name());
                }
                if (employmentType != null) {
                    query = query.whereEqualTo("employmentType", employmentType.name());
                }
                QuerySnapshot qs = query.get().get();
                published = new ArrayList<>();
                for (QueryDocumentSnapshot qds : qs.getDocuments()) {
                    published.add(mapDocumentToJob(qds));
                }
            } catch (Exception e) {
                log.error("Live Firestore query for public jobs failed: {}", e.getMessage());
                throw new DatabaseUnavailableException("Failed to query public jobs: " + e.getMessage(), e);
            }
        } else {
            published = memoryJobs.values().stream()
                    .filter(j -> j.getStatus() == JobStatus.PUBLISHED)
                    .collect(Collectors.toList());
        }

        // Apply in-memory secondary filtering for keyword, salary, location, and deadline
        Instant now = Instant.now();
        List<Job> filtered = published.stream()
                .filter(j -> j.getApplicationDeadline() == null || j.getApplicationDeadline().isAfter(now))
                .filter(j -> {
                    if (category != null && j.getJobCategory() != category) return false;
                    if (employmentType != null && j.getEmploymentType() != employmentType) return false;
                    if (keyword != null && !keyword.trim().isEmpty()) {
                        String kw = keyword.trim().toLowerCase();
                        boolean titleMatch = j.getTitle() != null && j.getTitle().toLowerCase().contains(kw);
                        boolean descMatch = j.getDescription() != null && j.getDescription().toLowerCase().contains(kw);
                        boolean skillMatch = j.getRequiredSkills() != null && j.getRequiredSkills().stream().anyMatch(s -> s.toLowerCase().contains(kw));
                        if (!titleMatch && !descMatch && !skillMatch) return false;
                    }
                    if (minSalary != null) {
                        if (j.getMaximumSalary() != null && j.getMaximumSalary() < minSalary) return false;
                        if (j.getMinimumSalary() != null && j.getMinimumSalary() < minSalary) return false;
                    }
                    if (maxSalary != null) {
                        if (j.getMinimumSalary() != null && j.getMinimumSalary() > maxSalary) return false;
                    }
                    if (division != null && !division.trim().isEmpty()) {
                        if (j.getLocationSummary() == null || !j.getLocationSummary().toLowerCase().contains(division.trim().toLowerCase())) {
                            return false;
                        }
                    }
                    if (district != null && !district.trim().isEmpty()) {
                        if (j.getLocationSummary() == null || !j.getLocationSummary().toLowerCase().contains(district.trim().toLowerCase())) {
                            return false;
                        }
                    }
                    return true;
                })
                .sorted(Comparator.comparing(Job::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .collect(Collectors.toList());

        // Pagination
        int safePage = Math.max(0, page);
        int safeSize = (size <= 0) ? 10 : Math.min(100, size);
        int start = safePage * safeSize;
        if (start >= filtered.size()) {
            return new ArrayList<>();
        }
        int end = Math.min(start + safeSize, filtered.size());
        return filtered.subList(start, end);
    }

    @Override
    public void delete(String jobId) {
        if (jobId == null || jobId.trim().isEmpty()) {
            return;
        }
        checkConfiguredOrReady();
        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                db.collection("jobs").document(jobId.trim()).delete().get();
            } catch (Exception e) {
                log.error("Live Firestore delete failed for jobs/{}: {}", jobId, e.getMessage());
                throw new DatabaseUnavailableException("Failed to delete job: " + e.getMessage(), e);
            }
        }
        memoryJobs.remove(jobId.trim());
    }

    private Job mapDocumentToJob(DocumentSnapshot doc) {
        Job job = new Job();
        job.setJobId(doc.getId());
        job.setFarmId(doc.getString("farmId"));
        job.setTitle(doc.getString("title"));
        job.setDescription(doc.getString("description"));

        String catStr = doc.getString("jobCategory");
        if (catStr != null) {
            try { job.setJobCategory(JobCategory.valueOf(catStr)); } catch (IllegalArgumentException ignored) {}
        }
        String empStr = doc.getString("employmentType");
        if (empStr != null) {
            try { job.setEmploymentType(EmploymentType.valueOf(empStr)); } catch (IllegalArgumentException ignored) {}
        }
        @SuppressWarnings("unchecked")
        List<String> skills = (List<String>) doc.get("requiredSkills");
        if (skills != null) {
            job.setRequiredSkills(skills);
        }
        job.setExperienceRequirements(doc.getString("experienceRequirements"));

        Long positions = doc.getLong("numberOfPositions");
        job.setNumberOfPositions(positions != null ? positions.intValue() : 1);

        String salStr = doc.getString("salaryType");
        if (salStr != null) {
            try { job.setSalaryType(SalaryType.valueOf(salStr)); } catch (IllegalArgumentException ignored) {}
        }
        job.setMinimumSalary(doc.getDouble("minimumSalary"));
        job.setMaximumSalary(doc.getDouble("maximumSalary"));
        job.setCurrency(doc.getString("currency"));
        job.setLocationSummary(doc.getString("locationSummary"));

        job.setApplicationDeadline(toInstant(doc.getTimestamp("applicationDeadline")));
        job.setStartDate(toInstant(doc.getTimestamp("startDate")));
        job.setEndDate(toInstant(doc.getTimestamp("endDate")));

        String statusStr = doc.getString("status");
        if (statusStr != null) {
            try { job.setStatus(JobStatus.valueOf(statusStr)); } catch (IllegalArgumentException ignored) {}
        }
        job.setCreatedBy(doc.getString("createdBy"));
        job.setCreatedAt(toInstant(doc.getTimestamp("createdAt")));
        job.setUpdatedAt(toInstant(doc.getTimestamp("updatedAt")));
        job.setPublishedAt(toInstant(doc.getTimestamp("publishedAt")));
        job.setClosedAt(toInstant(doc.getTimestamp("closedAt")));
        job.setArchivedAt(toInstant(doc.getTimestamp("archivedAt")));

        Long ver = doc.getLong("version");
        job.setVersion(ver != null ? ver.intValue() : 1);

        Long appCount = doc.getLong("totalApplicationsCount");
        job.setTotalApplicationsCount(appCount != null ? appCount.intValue() : 0);

        return job;
    }

    private Map<String, Object> mapJobToMap(Job job) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("jobId", job.getJobId());
        map.put("farmId", job.getFarmId());
        map.put("title", job.getTitle());
        map.put("description", job.getDescription());
        map.put("jobCategory", job.getJobCategory() != null ? job.getJobCategory().name() : null);
        map.put("employmentType", job.getEmploymentType() != null ? job.getEmploymentType().name() : null);
        map.put("requiredSkills", job.getRequiredSkills());
        map.put("experienceRequirements", job.getExperienceRequirements());
        map.put("numberOfPositions", job.getNumberOfPositions());
        map.put("salaryType", job.getSalaryType() != null ? job.getSalaryType().name() : null);
        map.put("minimumSalary", job.getMinimumSalary());
        map.put("maximumSalary", job.getMaximumSalary());
        map.put("currency", job.getCurrency());
        map.put("locationSummary", job.getLocationSummary());
        map.put("applicationDeadline", toTimestamp(job.getApplicationDeadline()));
        map.put("startDate", toTimestamp(job.getStartDate()));
        map.put("endDate", toTimestamp(job.getEndDate()));
        map.put("status", job.getStatus() != null ? job.getStatus().name() : JobStatus.DRAFT.name());
        map.put("createdBy", job.getCreatedBy());
        map.put("createdAt", toTimestamp(job.getCreatedAt()));
        map.put("updatedAt", toTimestamp(job.getUpdatedAt()));
        map.put("publishedAt", toTimestamp(job.getPublishedAt()));
        map.put("closedAt", toTimestamp(job.getClosedAt()));
        map.put("archivedAt", toTimestamp(job.getArchivedAt()));
        map.put("version", job.getVersion());
        map.put("totalApplicationsCount", job.getTotalApplicationsCount());
        return map;
    }

    private Instant toInstant(Timestamp ts) {
        return (ts != null) ? ts.toDate().toInstant() : null;
    }

    private Timestamp toTimestamp(Instant instant) {
        return (instant != null) ? Timestamp.ofTimeSecondsAndNanos(instant.getEpochSecond(), instant.getNano()) : null;
    }
}
