package com.agroai.service;

import com.agroai.config.FirebaseConfig;
import com.agroai.dto.CreateJobRequest;
import com.agroai.dto.JobResponseDTO;
import com.agroai.dto.PublicJobResponseDTO;
import com.agroai.dto.UpdateJobRequest;
import com.agroai.exception.DatabaseUnavailableException;
import com.agroai.exception.FarmNotFoundException;
import com.agroai.exception.InvalidStateTransitionException;
import com.agroai.exception.JobNotFoundException;
import com.agroai.exception.StaleVersionException;
import com.agroai.exception.UnauthorizedResourceAccessException;
import com.agroai.model.EmploymentType;
import com.agroai.model.Farm;
import com.agroai.model.FarmMembership;
import com.agroai.model.FarmRole;
import com.agroai.model.FarmStatus;
import com.agroai.model.Job;
import com.agroai.model.JobCategory;
import com.agroai.model.JobStatus;
import com.agroai.model.MembershipStatus;
import com.agroai.model.SalaryType;
import com.agroai.repository.FarmMembershipRepository;
import com.agroai.repository.FarmRepository;
import com.agroai.repository.JobRepository;
import com.agroai.security.FirebaseUserDetails;
import com.agroai.util.KeyEncoder;
import com.google.cloud.firestore.Firestore;
import com.google.firebase.cloud.FirestoreClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.stream.Collectors;

/**
 * Service managing agricultural job posting lifecycle, farm-scoped recruitment management,
 * and public job discovery.
 */
@Service
public class JobService {

    private static final Logger log = LoggerFactory.getLogger(JobService.class);

    private final JobRepository jobRepository;
    private final FarmRepository farmRepository;
    private final FarmMembershipRepository membershipRepository;
    private final FirebaseConfig firebaseConfig;

    public JobService(JobRepository jobRepository,
                      FarmRepository farmRepository,
                      FarmMembershipRepository membershipRepository,
                      FirebaseConfig firebaseConfig) {
        this.jobRepository = jobRepository;
        this.farmRepository = farmRepository;
        this.membershipRepository = membershipRepository;
        this.firebaseConfig = firebaseConfig;
    }

    /**
     * Creates a new job posting under a farm.
     * Restricted to active OWNER or MANAGER.
     */
    public JobResponseDTO createJob(String farmId, CreateJobRequest request, FirebaseUserDetails user) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        verifyManagerOrOwnerRole(cleanFarmId, user.getUid());

        Farm farm = farmRepository.findById(cleanFarmId)
                .orElseThrow(() -> new FarmNotFoundException(cleanFarmId));
        if (farm.getStatus() == FarmStatus.ARCHIVED) {
            throw new InvalidStateTransitionException("Cannot create job postings for an archived farm");
        }

        validateSalaryRange(request.minimumSalary(), request.maximumSalary());

        String jobId = "job-" + UUID.randomUUID();
        Job job = new Job();
        job.setJobId(jobId);
        job.setFarmId(cleanFarmId);
        job.setTitle(request.title().trim());
        job.setDescription(request.description().trim());
        job.setJobCategory(request.jobCategory());
        job.setEmploymentType(request.employmentType());
        job.setRequiredSkills(request.requiredSkills());
        job.setExperienceRequirements(request.experienceRequirements() != null ? request.experienceRequirements().trim() : null);
        job.setNumberOfPositions(request.numberOfPositions() != null ? request.numberOfPositions() : 1);
        job.setSalaryType(request.salaryType() != null ? request.salaryType() : SalaryType.NEGOTIABLE);
        job.setMinimumSalary(request.minimumSalary());
        job.setMaximumSalary(request.maximumSalary());
        job.setCurrency(request.currency() != null && !request.currency().trim().isEmpty() ? request.currency().trim() : "BDT");

        String location = request.locationSummary();
        if (location == null || location.trim().isEmpty()) {
            location = farm.getDistrict() + ", " + farm.getDivision();
        }
        job.setLocationSummary(location.trim());

        job.setApplicationDeadline(request.applicationDeadline());
        job.setStartDate(request.startDate());
        job.setEndDate(request.endDate());
        job.setCreatedBy(user.getUid());
        job.setCreatedAt(Instant.now());
        job.setUpdatedAt(Instant.now());
        job.setVersion(1);
        job.setTotalApplicationsCount(0);

        if (Boolean.TRUE.equals(request.publishImmediately())) {
            job.setStatus(JobStatus.PUBLISHED);
            job.setPublishedAt(Instant.now());
        } else {
            job.setStatus(JobStatus.DRAFT);
        }

        Job saved = jobRepository.save(job);
        log.info("Job '{}' created successfully under farm '{}' with status {}", jobId, cleanFarmId, saved.getStatus());
        return JobResponseDTO.fromEntity(saved);
    }

    /**
     * Lists jobs for a farm.
     * Restricted to active farm members.
     */
    public List<JobResponseDTO> getJobsByFarm(String farmId, JobStatus statusFilter, FirebaseUserDetails user) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        verifyActiveMember(cleanFarmId, user.getUid());

        farmRepository.findById(cleanFarmId)
                .orElseThrow(() -> new FarmNotFoundException(cleanFarmId));

        List<Job> jobs = (statusFilter != null)
                ? jobRepository.findByFarmIdAndStatus(cleanFarmId, statusFilter)
                : jobRepository.findByFarmId(cleanFarmId);

        return jobs.stream()
                .map(JobResponseDTO::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * Retrieves details for a specific job under a farm.
     * Restricted to active farm members.
     */
    public JobResponseDTO getJobById(String farmId, String jobId, FirebaseUserDetails user) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        String cleanJobId = KeyEncoder.validateJobId(jobId);
        verifyActiveMember(cleanFarmId, user.getUid());

        Job job = jobRepository.findById(cleanJobId)
                .orElseThrow(() -> new JobNotFoundException(cleanJobId));

        if (!cleanFarmId.equals(job.getFarmId())) {
            throw new JobNotFoundException(cleanJobId);
        }

        return JobResponseDTO.fromEntity(job);
    }

    /**
     * Updates an existing job posting with optimistic concurrency control.
     * Restricted to active OWNER or MANAGER.
     */
    public JobResponseDTO updateJob(String farmId, String jobId, UpdateJobRequest request, FirebaseUserDetails user) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        String cleanJobId = KeyEncoder.validateJobId(jobId);
        verifyManagerOrOwnerRole(cleanFarmId, user.getUid());

        validateSalaryRange(request.minimumSalary(), request.maximumSalary());

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                return db.runTransaction(transaction -> {
                    Job job = jobRepository.findByIdInTransaction(transaction, cleanJobId);
                    if (job == null || !cleanFarmId.equals(job.getFarmId())) {
                        throw new JobNotFoundException(cleanJobId);
                    }
                    if (job.getStatus() == JobStatus.ARCHIVED) {
                        throw new InvalidStateTransitionException("Cannot update an archived job");
                    }
                    if (job.getVersion() != request.expectedVersion()) {
                        throw new StaleVersionException(request.expectedVersion(), job.getVersion());
                    }

                    applyJobUpdates(job, request);
                    jobRepository.saveInTransaction(transaction, job);
                    return JobResponseDTO.fromEntity(job);
                }).get();
            } catch (ExecutionException e) {
                if (e.getCause() instanceof JobNotFoundException jnfe) throw jnfe;
                if (e.getCause() instanceof InvalidStateTransitionException iste) throw iste;
                if (e.getCause() instanceof StaleVersionException sve) throw sve;
                throw new DatabaseUnavailableException("Failed to update job: " + e.getMessage(), e);
            } catch (Exception e) {
                throw new DatabaseUnavailableException("Failed to execute job update transaction: " + e.getMessage(), e);
            }
        }

        // In-Memory Mode
        synchronized (this) {
            Job job = jobRepository.findById(cleanJobId)
                    .orElseThrow(() -> new JobNotFoundException(cleanJobId));
            if (!cleanFarmId.equals(job.getFarmId())) {
                throw new JobNotFoundException(cleanJobId);
            }
            if (job.getStatus() == JobStatus.ARCHIVED) {
                throw new InvalidStateTransitionException("Cannot update an archived job");
            }
            if (job.getVersion() != request.expectedVersion()) {
                throw new StaleVersionException(request.expectedVersion(), job.getVersion());
            }

            applyJobUpdates(job, request);
            jobRepository.save(job);
            return JobResponseDTO.fromEntity(job);
        }
    }

    /**
     * Publishes a job, making it publicly discoverable.
     * Restricted to active OWNER or MANAGER.
     */
    public JobResponseDTO publishJob(String farmId, String jobId, FirebaseUserDetails user) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        String cleanJobId = KeyEncoder.validateJobId(jobId);
        verifyManagerOrOwnerRole(cleanFarmId, user.getUid());

        Farm farm = farmRepository.findById(cleanFarmId)
                .orElseThrow(() -> new FarmNotFoundException(cleanFarmId));
        if (farm.getStatus() == FarmStatus.ARCHIVED) {
            throw new InvalidStateTransitionException("Cannot publish jobs under an archived farm");
        }

        Job job = jobRepository.findById(cleanJobId)
                .orElseThrow(() -> new JobNotFoundException(cleanJobId));
        if (!cleanFarmId.equals(job.getFarmId())) {
            throw new JobNotFoundException(cleanJobId);
        }
        if (job.getStatus() == JobStatus.ARCHIVED) {
            throw new InvalidStateTransitionException("Cannot publish an archived job");
        }
        if (job.getApplicationDeadline() != null && job.getApplicationDeadline().isBefore(Instant.now())) {
            throw new InvalidStateTransitionException("Cannot publish a job with an expired application deadline");
        }

        job.setStatus(JobStatus.PUBLISHED);
        job.setPublishedAt(Instant.now());
        job.setClosedAt(null);
        job.setUpdatedAt(Instant.now());
        job.setVersion(job.getVersion() + 1);

        Job saved = jobRepository.save(job);
        log.info("Job '{}' successfully published under farm '{}'", cleanJobId, cleanFarmId);
        return JobResponseDTO.fromEntity(saved);
    }

    /**
     * Pauses an active job posting, temporarily suspending new applications.
     * Restricted to active OWNER or MANAGER.
     */
    public JobResponseDTO pauseJob(String farmId, String jobId, FirebaseUserDetails user) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        String cleanJobId = KeyEncoder.validateJobId(jobId);
        verifyManagerOrOwnerRole(cleanFarmId, user.getUid());

        Job job = jobRepository.findById(cleanJobId)
                .orElseThrow(() -> new JobNotFoundException(cleanJobId));
        if (!cleanFarmId.equals(job.getFarmId())) {
            throw new JobNotFoundException(cleanJobId);
        }
        if (job.getStatus() != JobStatus.PUBLISHED) {
            throw new InvalidStateTransitionException("Only PUBLISHED jobs can be paused");
        }

        job.setStatus(JobStatus.PAUSED);
        job.setUpdatedAt(Instant.now());
        job.setVersion(job.getVersion() + 1);

        Job saved = jobRepository.save(job);
        log.info("Job '{}' paused under farm '{}'", cleanJobId, cleanFarmId);
        return JobResponseDTO.fromEntity(saved);
    }

    /**
     * Closes an active job posting. No new applications accepted.
     * Restricted to active OWNER or MANAGER.
     */
    public JobResponseDTO closeJob(String farmId, String jobId, FirebaseUserDetails user) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        String cleanJobId = KeyEncoder.validateJobId(jobId);
        verifyManagerOrOwnerRole(cleanFarmId, user.getUid());

        Job job = jobRepository.findById(cleanJobId)
                .orElseThrow(() -> new JobNotFoundException(cleanJobId));
        if (!cleanFarmId.equals(job.getFarmId())) {
            throw new JobNotFoundException(cleanJobId);
        }
        if (job.getStatus() == JobStatus.ARCHIVED) {
            throw new InvalidStateTransitionException("Cannot close an archived job");
        }

        job.setStatus(JobStatus.CLOSED);
        job.setClosedAt(Instant.now());
        job.setUpdatedAt(Instant.now());
        job.setVersion(job.getVersion() + 1);

        Job saved = jobRepository.save(job);
        log.info("Job '{}' closed under farm '{}'", cleanJobId, cleanFarmId);
        return JobResponseDTO.fromEntity(saved);
    }

    /**
     * Soft-archives a job posting.
     * Restricted to active OWNER only!
     */
    public void archiveJob(String farmId, String jobId, FirebaseUserDetails user) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        String cleanJobId = KeyEncoder.validateJobId(jobId);
        verifyOwnerRole(cleanFarmId, user.getUid());

        Job job = jobRepository.findById(cleanJobId)
                .orElseThrow(() -> new JobNotFoundException(cleanJobId));
        if (!cleanFarmId.equals(job.getFarmId())) {
            throw new JobNotFoundException(cleanJobId);
        }

        if (job.getStatus() == JobStatus.ARCHIVED) {
            return; // Idempotent
        }

        job.setStatus(JobStatus.ARCHIVED);
        job.setArchivedAt(Instant.now());
        job.setUpdatedAt(Instant.now());
        job.setVersion(job.getVersion() + 1);

        jobRepository.save(job);
        log.info("Job '{}' archived under farm '{}'", cleanJobId, cleanFarmId);
    }

    /**
     * Public endpoint: search and filter published jobs with pagination.
     */
    public List<PublicJobResponseDTO> getPublicJobs(String keyword, JobCategory category,
                                                    EmploymentType employmentType, String division,
                                                    String district, Double minSalary, Double maxSalary,
                                                    int page, int size) {
        List<Job> jobs = jobRepository.findPublicJobs(
                keyword, category, employmentType, division, district, minSalary, maxSalary, page, size
        );

        List<PublicJobResponseDTO> result = new ArrayList<>();
        for (Job job : jobs) {
            Optional<Farm> farmOpt = farmRepository.findById(job.getFarmId());
            String farmName = farmOpt.map(Farm::getName).orElse("Unknown Farm");
            String farmDistrict = farmOpt.map(Farm::getDistrict).orElse("");
            String farmDivision = farmOpt.map(Farm::getDivision).orElse("");
            result.add(PublicJobResponseDTO.fromEntity(job, farmName, farmDistrict, farmDivision));
        }
        return result;
    }

    /**
     * Public endpoint: retrieve details for a single published job.
     */
    public PublicJobResponseDTO getPublicJobById(String jobId) {
        String cleanJobId = KeyEncoder.validateJobId(jobId);
        Job job = jobRepository.findById(cleanJobId)
                .orElseThrow(() -> new JobNotFoundException(cleanJobId));

        if (job.getStatus() != JobStatus.PUBLISHED) {
            throw new JobNotFoundException(cleanJobId);
        }

        Optional<Farm> farmOpt = farmRepository.findById(job.getFarmId());
        String farmName = farmOpt.map(Farm::getName).orElse("Unknown Farm");
        String farmDistrict = farmOpt.map(Farm::getDistrict).orElse("");
        String farmDivision = farmOpt.map(Farm::getDivision).orElse("");

        return PublicJobResponseDTO.fromEntity(job, farmName, farmDistrict, farmDivision);
    }

    private void applyJobUpdates(Job job, UpdateJobRequest request) {
        job.setTitle(request.title().trim());
        job.setDescription(request.description().trim());
        job.setJobCategory(request.jobCategory());
        job.setEmploymentType(request.employmentType());
        job.setRequiredSkills(request.requiredSkills());
        job.setExperienceRequirements(request.experienceRequirements() != null ? request.experienceRequirements().trim() : null);
        job.setNumberOfPositions(request.numberOfPositions() != null ? request.numberOfPositions() : 1);
        job.setSalaryType(request.salaryType() != null ? request.salaryType() : SalaryType.NEGOTIABLE);
        job.setMinimumSalary(request.minimumSalary());
        job.setMaximumSalary(request.maximumSalary());
        if (request.currency() != null && !request.currency().trim().isEmpty()) {
            job.setCurrency(request.currency().trim());
        }
        if (request.locationSummary() != null && !request.locationSummary().trim().isEmpty()) {
            job.setLocationSummary(request.locationSummary().trim());
        }
        job.setApplicationDeadline(request.applicationDeadline());
        job.setStartDate(request.startDate());
        job.setEndDate(request.endDate());
        job.setVersion(job.getVersion() + 1);
        job.setUpdatedAt(Instant.now());
    }

    private void validateSalaryRange(Double minSalary, Double maxSalary) {
        if (minSalary != null && maxSalary != null && minSalary > maxSalary) {
            throw new IllegalArgumentException("Minimum salary (" + minSalary + ") cannot exceed maximum salary (" + maxSalary + ")");
        }
    }

    private FarmRole verifyManagerOrOwnerRole(String farmId, String uid) {
        Optional<FarmMembership> m = membershipRepository.findMembership(farmId, uid);
        if (m.isEmpty() || m.get().getStatus() != MembershipStatus.ACTIVE ||
                (m.get().getRole() != FarmRole.OWNER && m.get().getRole() != FarmRole.MANAGER)) {
            throw new UnauthorizedResourceAccessException("farm", farmId, "Only an active OWNER or MANAGER can manage jobs");
        }
        return m.get().getRole();
    }

    private void verifyOwnerRole(String farmId, String uid) {
        Optional<FarmMembership> m = membershipRepository.findMembership(farmId, uid);
        if (m.isEmpty() || m.get().getStatus() != MembershipStatus.ACTIVE || m.get().getRole() != FarmRole.OWNER) {
            throw new UnauthorizedResourceAccessException("farm", farmId, "Only an active OWNER can archive jobs");
        }
    }

    private void verifyActiveMember(String farmId, String uid) {
        Optional<FarmMembership> m = membershipRepository.findMembership(farmId, uid);
        if (m.isEmpty() || m.get().getStatus() != MembershipStatus.ACTIVE) {
            throw new UnauthorizedResourceAccessException("farm", farmId, "Active membership is required to view farm jobs");
        }
    }
}
