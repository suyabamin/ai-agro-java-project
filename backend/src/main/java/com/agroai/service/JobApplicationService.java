package com.agroai.service;

import com.agroai.config.FirebaseConfig;
import com.agroai.dto.ApplicationDecisionRequest;
import com.agroai.dto.ApplicationHistoryResponseDTO;
import com.agroai.dto.ApplicationMessageResponseDTO;
import com.agroai.dto.CreateApplicationRequest;
import com.agroai.dto.JobApplicationResponseDTO;
import com.agroai.dto.SendMessageRequest;
import com.agroai.exception.ApplicationNotFoundException;
import com.agroai.exception.DatabaseUnavailableException;
import com.agroai.exception.DuplicateApplicationException;
import com.agroai.exception.InvalidStateTransitionException;
import com.agroai.exception.JobNotFoundException;
import com.agroai.exception.StaleVersionException;
import com.agroai.exception.UnauthorizedResourceAccessException;
import com.agroai.model.ApplicationHistory;
import com.agroai.model.ApplicationMessage;
import com.agroai.model.ApplicationStatus;
import com.agroai.model.FarmMembership;
import com.agroai.model.FarmRole;
import com.agroai.model.Job;
import com.agroai.model.JobApplication;
import com.agroai.model.JobStatus;
import com.agroai.model.MembershipStatus;
import com.agroai.model.UserProfile;
import com.agroai.repository.ApplicationHistoryRepository;
import com.agroai.repository.ApplicationMessageRepository;
import com.agroai.repository.FarmMembershipRepository;
import com.agroai.repository.JobApplicationRepository;
import com.agroai.repository.JobRepository;
import com.agroai.repository.UserRepository;
import com.agroai.security.FirebaseUserDetails;
import com.agroai.util.KeyEncoder;
import com.google.cloud.firestore.Firestore;
import com.google.firebase.cloud.FirestoreClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.stream.Collectors;

/**
 * Service managing the farmer application lifecycle, recruitment decisions,
 * immutable audit history, and private application-scoped communication.
 */
@Service
public class JobApplicationService {

    private static final Logger log = LoggerFactory.getLogger(JobApplicationService.class);

    private final JobApplicationRepository applicationRepository;
    private final JobRepository jobRepository;
    private final FarmMembershipRepository membershipRepository;
    private final ApplicationHistoryRepository historyRepository;
    private final ApplicationMessageRepository messageRepository;
    private final UserRepository userRepository;
    private final FirebaseConfig firebaseConfig;

    public JobApplicationService(JobApplicationRepository applicationRepository,
                                 JobRepository jobRepository,
                                 FarmMembershipRepository membershipRepository,
                                 ApplicationHistoryRepository historyRepository,
                                 ApplicationMessageRepository messageRepository,
                                 UserRepository userRepository,
                                 FirebaseConfig firebaseConfig) {
        this.applicationRepository = applicationRepository;
        this.jobRepository = jobRepository;
        this.membershipRepository = membershipRepository;
        this.historyRepository = historyRepository;
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
        this.firebaseConfig = firebaseConfig;
    }

    /**
     * Submits a new job application.
     * Prevents duplicate applications and disallows farm members from applying to their own farm's jobs.
     */
    public JobApplicationResponseDTO applyForJob(String jobId, CreateApplicationRequest request, FirebaseUserDetails user) {
        String cleanJobId = KeyEncoder.validateJobId(jobId);
        String applicantUid = user.getUid();

        Job job = jobRepository.findById(cleanJobId)
                .orElseThrow(() -> new JobNotFoundException(cleanJobId));

        if (job.getStatus() != JobStatus.PUBLISHED) {
            throw new InvalidStateTransitionException("Cannot apply to a job that is not PUBLISHED");
        }
        if (job.getApplicationDeadline() != null && job.getApplicationDeadline().isBefore(Instant.now())) {
            throw new InvalidStateTransitionException("The application deadline for this job has expired");
        }

        // Integrity check: Farm members should not apply for their own farm's job postings
        Optional<FarmMembership> membership = membershipRepository.findMembership(job.getFarmId(), applicantUid);
        if (membership.isPresent() && membership.get().getStatus() == MembershipStatus.ACTIVE) {
            throw new InvalidStateTransitionException("Active farm members cannot apply to job postings on their own farm");
        }

        String applicationId = KeyEncoder.applicationDocId(cleanJobId, applicantUid);

        // Fetch applicant snapshot from user profile
        Optional<UserProfile> profileOpt = userRepository.findPrivateProfile(applicantUid);
        String applicantName = profileOpt.map(UserProfile::getFullName).orElse(user.getEmail());
        String applicantEmail = profileOpt.map(UserProfile::getEmail).orElse(user.getEmail());
        String applicantPhone = profileOpt.map(UserProfile::getPhoneNumber).orElse(null);

        JobApplication application = new JobApplication();
        application.setApplicationId(applicationId);
        application.setJobId(cleanJobId);
        application.setFarmId(job.getFarmId());
        application.setApplicantUid(applicantUid);
        application.setApplicantName(applicantName);
        application.setApplicantEmail(applicantEmail);
        application.setApplicantPhone(applicantPhone);
        application.setCoverLetter(request.coverLetter().trim());
        application.setRelevantExperience(request.relevantExperience() != null ? request.relevantExperience().trim() : null);
        application.setSkills(request.skills());
        application.setAvailability(request.availability() != null ? request.availability().trim() : null);
        application.setExpectedSalary(request.expectedSalary());
        application.setStatus(ApplicationStatus.SUBMITTED);
        application.setSubmittedAt(Instant.now());
        application.setUpdatedAt(Instant.now());
        application.setVersion(1);

        ApplicationHistory initialHistory = new ApplicationHistory(
                "hist-" + UUID.randomUUID(),
                applicationId,
                cleanJobId,
                job.getFarmId(),
                applicantUid,
                null,
                ApplicationStatus.SUBMITTED,
                applicantUid,
                "APPLICANT",
                "Application submitted by candidate"
        );

        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                return db.runTransaction(transaction -> {
                    Job txJob = jobRepository.findByIdInTransaction(transaction, cleanJobId);
                    if (txJob == null || txJob.getStatus() != JobStatus.PUBLISHED) {
                        throw new InvalidStateTransitionException("Job is no longer published");
                    }
                    if (txJob.getApplicationDeadline() != null && txJob.getApplicationDeadline().isBefore(Instant.now())) {
                        throw new InvalidStateTransitionException("Application deadline has passed");
                    }

                    JobApplication existing = applicationRepository.findByIdInTransaction(transaction, applicationId);
                    if (existing != null) {
                        throw new DuplicateApplicationException(cleanJobId, applicantUid);
                    }

                    txJob.setTotalApplicationsCount(txJob.getTotalApplicationsCount() + 1);
                    txJob.setUpdatedAt(Instant.now());

                    applicationRepository.saveInTransaction(transaction, application);
                    jobRepository.saveInTransaction(transaction, txJob);
                    historyRepository.saveInTransaction(transaction, initialHistory);

                    return JobApplicationResponseDTO.fromEntity(application);
                }).get();
            } catch (ExecutionException e) {
                if (e.getCause() instanceof DuplicateApplicationException dae) throw dae;
                if (e.getCause() instanceof InvalidStateTransitionException iste) throw iste;
                log.error("Live Firestore application submission failed: {}", e.getMessage());
                throw new DatabaseUnavailableException("Failed to submit application: " + e.getMessage(), e);
            } catch (Exception e) {
                throw new DatabaseUnavailableException("Failed to execute application transaction: " + e.getMessage(), e);
            }
        }

        // In-Memory Mode
        synchronized (this) {
            if (applicationRepository.findById(applicationId).isPresent()) {
                throw new DuplicateApplicationException(cleanJobId, applicantUid);
            }

            job.setTotalApplicationsCount(job.getTotalApplicationsCount() + 1);
            job.setUpdatedAt(Instant.now());

            applicationRepository.save(application);
            jobRepository.save(job);
            historyRepository.save(initialHistory);

            log.info("Application '{}' submitted successfully for job '{}'", applicationId, cleanJobId);
            return JobApplicationResponseDTO.fromEntity(application);
        }
    }

    /**
     * Lists all applications submitted by the authenticated user.
     */
    public List<JobApplicationResponseDTO> getMyApplications(FirebaseUserDetails user) {
        List<JobApplication> apps = applicationRepository.findByApplicantUid(user.getUid());
        return apps.stream()
                .map(JobApplicationResponseDTO::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * Retrieves application details by ID.
     * Restricted to applicant or active farm members.
     */
    public JobApplicationResponseDTO getApplicationById(String applicationId, FirebaseUserDetails user) {
        String cleanAppId = KeyEncoder.validateApplicationId(applicationId);
        JobApplication app = applicationRepository.findById(cleanAppId)
                .orElseThrow(() -> new ApplicationNotFoundException(cleanAppId));

        verifyApplicantOrFarmMember(app, user.getUid());
        return JobApplicationResponseDTO.fromEntity(app);
    }

    /**
     * Withdraws an application by the applicant.
     */
    public JobApplicationResponseDTO withdrawApplication(String applicationId, FirebaseUserDetails user) {
        String cleanAppId = KeyEncoder.validateApplicationId(applicationId);
        JobApplication app = applicationRepository.findById(cleanAppId)
                .orElseThrow(() -> new ApplicationNotFoundException(cleanAppId));

        if (!user.getUid().equals(app.getApplicantUid())) {
            throw new UnauthorizedResourceAccessException("application", cleanAppId, "Only the applicant can withdraw this application");
        }

        if (!app.getStatus().canWithdraw()) {
            throw new InvalidStateTransitionException("Cannot withdraw application in status: " + app.getStatus());
        }

        ApplicationStatus previous = app.getStatus();
        app.setStatus(ApplicationStatus.WITHDRAWN);
        app.setUpdatedAt(Instant.now());
        app.setVersion(app.getVersion() + 1);

        ApplicationHistory history = new ApplicationHistory(
                "hist-" + UUID.randomUUID(),
                cleanAppId,
                app.getJobId(),
                app.getFarmId(),
                app.getApplicantUid(),
                previous,
                ApplicationStatus.WITHDRAWN,
                user.getUid(),
                "APPLICANT",
                "Candidate withdrew application"
        );

        applicationRepository.save(app);
        historyRepository.save(history);
        log.info("Application '{}' withdrawn by candidate", cleanAppId);
        return JobApplicationResponseDTO.fromEntity(app);
    }

    /**
     * Moves application to UNDER_REVIEW status.
     * Restricted to active OWNER or MANAGER.
     */
    public JobApplicationResponseDTO reviewApplication(String farmId, String applicationId,
                                                       ApplicationDecisionRequest request, FirebaseUserDetails user) {
        return transitionApplicationStatus(farmId, applicationId, ApplicationStatus.UNDER_REVIEW,
                List.of(ApplicationStatus.SUBMITTED), request, user, "Review started by farm management");
    }

    /**
     * Shortlists an application.
     * Restricted to active OWNER or MANAGER.
     */
    public JobApplicationResponseDTO shortlistApplication(String farmId, String applicationId,
                                                          ApplicationDecisionRequest request, FirebaseUserDetails user) {
        return transitionApplicationStatus(farmId, applicationId, ApplicationStatus.SHORTLISTED,
                List.of(ApplicationStatus.SUBMITTED, ApplicationStatus.UNDER_REVIEW), request, user, "Candidate shortlisted");
    }

    /**
     * Approves an application.
     * Restricted to active OWNER or MANAGER.
     * CRITICAL INVARIANT: Application approval DOES NOT create field assignments.
     */
    public JobApplicationResponseDTO approveApplication(String farmId, String applicationId,
                                                        ApplicationDecisionRequest request, FirebaseUserDetails user) {
        return transitionApplicationStatus(farmId, applicationId, ApplicationStatus.APPROVED,
                List.of(ApplicationStatus.SUBMITTED, ApplicationStatus.UNDER_REVIEW, ApplicationStatus.SHORTLISTED),
                request, user, "Application approved by farm management");
    }

    /**
     * Rejects an application.
     * Restricted to active OWNER or MANAGER.
     */
    public JobApplicationResponseDTO rejectApplication(String farmId, String applicationId,
                                                       ApplicationDecisionRequest request, FirebaseUserDetails user) {
        return transitionApplicationStatus(farmId, applicationId, ApplicationStatus.REJECTED,
                List.of(ApplicationStatus.SUBMITTED, ApplicationStatus.UNDER_REVIEW, ApplicationStatus.SHORTLISTED),
                request, user, request != null && request.decisionReason() != null ? request.decisionReason() : "Application rejected");
    }

    /**
     * Retrieves all applications submitted to a farm's jobs.
     * Restricted to active OWNER or MANAGER.
     */
    public List<JobApplicationResponseDTO> getApplicationsByFarm(String farmId, String jobIdFilter,
                                                                 ApplicationStatus statusFilter, FirebaseUserDetails user) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        verifyManagerOrOwnerRole(cleanFarmId, user.getUid());

        List<JobApplication> apps;
        if (jobIdFilter != null && !jobIdFilter.trim().isEmpty()) {
            apps = applicationRepository.findByFarmIdAndJobId(cleanFarmId, jobIdFilter.trim());
        } else {
            apps = applicationRepository.findByFarmId(cleanFarmId);
        }

        if (statusFilter != null) {
            apps = apps.stream()
                    .filter(a -> a.getStatus() == statusFilter)
                    .collect(Collectors.toList());
        }

        return apps.stream()
                .map(JobApplicationResponseDTO::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * Retrieves the audit history for an application.
     * Restricted to applicant or active farm members.
     */
    public List<ApplicationHistoryResponseDTO> getApplicationHistory(String applicationId, FirebaseUserDetails user) {
        String cleanAppId = KeyEncoder.validateApplicationId(applicationId);
        JobApplication app = applicationRepository.findById(cleanAppId)
                .orElseThrow(() -> new ApplicationNotFoundException(cleanAppId));

        verifyApplicantOrFarmMember(app, user.getUid());

        List<ApplicationHistory> list = historyRepository.findByApplicationId(cleanAppId);
        return list.stream()
                .map(ApplicationHistoryResponseDTO::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * Sends a private message within the application discussion thread.
     */
    public ApplicationMessageResponseDTO sendMessage(String applicationId, SendMessageRequest request, FirebaseUserDetails user) {
        String cleanAppId = KeyEncoder.validateApplicationId(applicationId);
        JobApplication app = applicationRepository.findById(cleanAppId)
                .orElseThrow(() -> new ApplicationNotFoundException(cleanAppId));

        boolean isApplicant = user.getUid().equals(app.getApplicantUid());
        boolean isManager = isFarmManagerOrOwner(app.getFarmId(), user.getUid());

        if (!isApplicant && !isManager) {
            throw new UnauthorizedResourceAccessException("application", cleanAppId, "Only the applicant or farm management can send messages");
        }

        String senderRole = isApplicant ? "APPLICANT" : "FARM_MANAGEMENT";
        Optional<UserProfile> profile = userRepository.findPrivateProfile(user.getUid());
        String senderName = profile.map(UserProfile::getFullName).orElse(user.getEmail());

        ApplicationMessage message = new ApplicationMessage(
                "msg-" + UUID.randomUUID(),
                cleanAppId,
                app.getJobId(),
                app.getFarmId(),
                user.getUid(),
                senderRole,
                senderName,
                request.content().trim()
        );

        ApplicationMessage saved = messageRepository.save(message);
        return ApplicationMessageResponseDTO.fromEntity(saved);
    }

    /**
     * Retrieves the message thread for an application.
     */
    public List<ApplicationMessageResponseDTO> getMessages(String applicationId, FirebaseUserDetails user) {
        String cleanAppId = KeyEncoder.validateApplicationId(applicationId);
        JobApplication app = applicationRepository.findById(cleanAppId)
                .orElseThrow(() -> new ApplicationNotFoundException(cleanAppId));

        verifyApplicantOrFarmMember(app, user.getUid());

        List<ApplicationMessage> messages = messageRepository.findByApplicationIdOrderBySentAtAsc(cleanAppId);
        return messages.stream()
                .map(ApplicationMessageResponseDTO::fromEntity)
                .collect(Collectors.toList());
    }

    private JobApplicationResponseDTO transitionApplicationStatus(String farmId, String applicationId,
                                                                  ApplicationStatus targetStatus,
                                                                  List<ApplicationStatus> allowedSourceStatuses,
                                                                  ApplicationDecisionRequest request,
                                                                  FirebaseUserDetails user,
                                                                  String defaultReason) {
        String cleanFarmId = KeyEncoder.validateFarmId(farmId);
        String cleanAppId = KeyEncoder.validateApplicationId(applicationId);
        FarmRole role = verifyManagerOrOwnerRole(cleanFarmId, user.getUid());

        JobApplication app = applicationRepository.findById(cleanAppId)
                .orElseThrow(() -> new ApplicationNotFoundException(cleanAppId));

        if (!cleanFarmId.equals(app.getFarmId())) {
            throw new ApplicationNotFoundException(cleanAppId);
        }

        // Prevent self-decision if farm manager happens to have applied (e.g. historical data)
        if (user.getUid().equals(app.getApplicantUid())) {
            throw new UnauthorizedResourceAccessException("application", cleanAppId, "Reviewers cannot decide on their own applications");
        }

        if (request != null && request.expectedVersion() != null && app.getVersion() != request.expectedVersion()) {
            throw new StaleVersionException(request.expectedVersion(), app.getVersion());
        }

        if (!allowedSourceStatuses.contains(app.getStatus())) {
            throw new InvalidStateTransitionException(
                    String.format("Cannot transition application from %s to %s", app.getStatus(), targetStatus)
            );
        }

        ApplicationStatus previousStatus = app.getStatus();
        app.setStatus(targetStatus);
        app.setUpdatedAt(Instant.now());
        app.setReviewedAt(Instant.now());
        app.setReviewedBy(user.getUid());
        if (request != null && request.decisionReason() != null && !request.decisionReason().trim().isEmpty()) {
            app.setDecisionReason(request.decisionReason().trim());
        }
        app.setVersion(app.getVersion() + 1);

        String actorRole = (role == FarmRole.OWNER) ? "FARM_OWNER" : "FARM_MANAGER";
        String reason = (request != null && request.decisionReason() != null) ? request.decisionReason().trim() : defaultReason;

        ApplicationHistory history = new ApplicationHistory(
                "hist-" + UUID.randomUUID(),
                cleanAppId,
                app.getJobId(),
                cleanFarmId,
                app.getApplicantUid(),
                previousStatus,
                targetStatus,
                user.getUid(),
                actorRole,
                reason
        );

        applicationRepository.save(app);
        historyRepository.save(history);

        log.info("Application '{}' transitioned from {} to {} by {}", cleanAppId, previousStatus, targetStatus, user.getUid());
        return JobApplicationResponseDTO.fromEntity(app);
    }

    private void verifyApplicantOrFarmMember(JobApplication app, String uid) {
        if (uid.equals(app.getApplicantUid())) {
            return;
        }
        Optional<FarmMembership> membership = membershipRepository.findMembership(app.getFarmId(), uid);
        if (membership.isPresent() && membership.get().getStatus() == MembershipStatus.ACTIVE) {
            return;
        }
        throw new UnauthorizedResourceAccessException("application", app.getApplicationId(),
                "Access denied: you are neither the applicant nor an active farm member");
    }

    private FarmRole verifyManagerOrOwnerRole(String farmId, String uid) {
        Optional<FarmMembership> m = membershipRepository.findMembership(farmId, uid);
        if (m.isEmpty() || m.get().getStatus() != MembershipStatus.ACTIVE ||
                (m.get().getRole() != FarmRole.OWNER && m.get().getRole() != FarmRole.MANAGER)) {
            throw new UnauthorizedResourceAccessException("farm", farmId, "Only an active OWNER or MANAGER can review applications");
        }
        return m.get().getRole();
    }

    private boolean isFarmManagerOrOwner(String farmId, String uid) {
        Optional<FarmMembership> m = membershipRepository.findMembership(farmId, uid);
        return m.isPresent() && m.get().getStatus() == MembershipStatus.ACTIVE &&
                (m.get().getRole() == FarmRole.OWNER || m.get().getRole() == FarmRole.MANAGER);
    }
}
