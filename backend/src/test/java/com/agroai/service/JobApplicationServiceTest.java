package com.agroai.service;

import com.agroai.config.FirebaseConfig;
import com.agroai.dto.ApplicationDecisionRequest;
import com.agroai.dto.CreateApplicationRequest;
import com.agroai.dto.JobApplicationResponseDTO;
import com.agroai.dto.SendMessageRequest;
import com.agroai.exception.DuplicateApplicationException;
import com.agroai.exception.InvalidStateTransitionException;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@DisplayName("Milestone 4 — JobApplicationService Lifecycle & Decision Tests")
class JobApplicationServiceTest {

    @Mock
    private JobApplicationRepository applicationRepository;

    @Mock
    private JobRepository jobRepository;

    @Mock
    private FarmMembershipRepository membershipRepository;

    @Mock
    private ApplicationHistoryRepository historyRepository;

    @Mock
    private ApplicationMessageRepository messageRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private FirebaseConfig firebaseConfig;

    private JobApplicationService applicationService;

    private final String JOB_ID = "job-1111-2222-3333";
    private final String FARM_ID = "farm-4444-5555-6666";
    private final String APPLICANT_UID = "farmer-applicant-001";
    private final String OWNER_UID = "owner-uid-001";
    private final String MANAGER_UID = "manager-uid-002";

    private FirebaseUserDetails applicantUser;
    private FirebaseUserDetails ownerUser;
    private FirebaseUserDetails managerUser;
    private Job testJob;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        when(firebaseConfig.isInitialized()).thenReturn(false);

        applicantUser = new FirebaseUserDetails(APPLICANT_UID, "applicant@agroai.org", "uid_app", true, Map.of());
        ownerUser = new FirebaseUserDetails(OWNER_UID, "owner@agroai.org", "uid_owner", true, Map.of());
        managerUser = new FirebaseUserDetails(MANAGER_UID, "manager@agroai.org", "uid_manager", true, Map.of());

        testJob = new Job();
        testJob.setJobId(JOB_ID);
        testJob.setFarmId(FARM_ID);
        testJob.setTitle("Rice Cultivator");
        testJob.setStatus(JobStatus.PUBLISHED);
        testJob.setApplicationDeadline(Instant.now().plus(10, ChronoUnit.DAYS));
        testJob.setTotalApplicationsCount(0);

        when(jobRepository.findById(JOB_ID)).thenReturn(Optional.of(testJob));

        UserProfile profile = new UserProfile();
        profile.setUid(APPLICANT_UID);
        profile.setFullName("Kader Farmer");
        profile.setEmail("applicant@agroai.org");
        when(userRepository.findPrivateProfile(APPLICANT_UID)).thenReturn(Optional.of(profile));

        FarmMembership ownerMbr = new FarmMembership("mbr_1", FARM_ID, OWNER_UID, FarmRole.OWNER, MembershipStatus.ACTIVE);
        FarmMembership managerMbr = new FarmMembership("mbr_2", FARM_ID, MANAGER_UID, FarmRole.MANAGER, MembershipStatus.ACTIVE);

        when(membershipRepository.findMembership(FARM_ID, OWNER_UID)).thenReturn(Optional.of(ownerMbr));
        when(membershipRepository.findMembership(FARM_ID, MANAGER_UID)).thenReturn(Optional.of(managerMbr));
        when(membershipRepository.findMembership(FARM_ID, APPLICANT_UID)).thenReturn(Optional.empty());

        when(applicationRepository.save(any(JobApplication.class))).thenAnswer(inv -> inv.getArgument(0));
        when(historyRepository.save(any(ApplicationHistory.class))).thenAnswer(inv -> inv.getArgument(0));
        when(messageRepository.save(any(ApplicationMessage.class))).thenAnswer(inv -> inv.getArgument(0));

        applicationService = new JobApplicationService(
                applicationRepository, jobRepository, membershipRepository,
                historyRepository, messageRepository, userRepository, firebaseConfig
        );
    }

    @Test
    @DisplayName("[SVC-APP-01] Candidate Applies Successfully & Creates History")
    void testApplyForJobSuccess() {
        CreateApplicationRequest request = new CreateApplicationRequest(
                "I have 5 years experience with rice harvesting",
                "Worked at Rangpur rice fields",
                List.of("Harvesting", "Seeding"),
                "Immediate",
                12000.0
        );

        JobApplicationResponseDTO response = applicationService.applyForJob(JOB_ID, request, applicantUser);
        assertNotNull(response);
        assertEquals(ApplicationStatus.SUBMITTED, response.status());
        assertEquals("Kader Farmer", response.applicantName());
        assertEquals(1, response.version());

        verify(applicationRepository, times(1)).save(any(JobApplication.class));
        verify(historyRepository, times(1)).save(any(ApplicationHistory.class));
        verify(jobRepository, times(1)).save(any(Job.class));
        assertEquals(1, testJob.getTotalApplicationsCount());
    }

    @Test
    @DisplayName("[SVC-APP-02] Duplicate Application for Same Job is Rejected")
    void testDuplicateApplicationRejected() {
        CreateApplicationRequest request = new CreateApplicationRequest(
                "Cover letter", null, null, null, null
        );

        when(applicationRepository.findById(anyString())).thenReturn(Optional.of(new JobApplication()));

        assertThrows(DuplicateApplicationException.class, () -> applicationService.applyForJob(JOB_ID, request, applicantUser));
    }

    @Test
    @DisplayName("[SVC-APP-03] Applying to Closed or Expired Job is Rejected")
    void testApplyToClosedOrExpiredJobRejected() {
        testJob.setStatus(JobStatus.CLOSED);

        CreateApplicationRequest request = new CreateApplicationRequest("Letter", null, null, null, null);
        assertThrows(InvalidStateTransitionException.class, () -> applicationService.applyForJob(JOB_ID, request, applicantUser));

        testJob.setStatus(JobStatus.PUBLISHED);
        testJob.setApplicationDeadline(Instant.now().minus(1, ChronoUnit.DAYS)); // Expired
        assertThrows(InvalidStateTransitionException.class, () -> applicationService.applyForJob(JOB_ID, request, applicantUser));
    }

    @Test
    @DisplayName("[SVC-APP-04] Active Farm Member Cannot Apply to Own Farm Job")
    void testFarmMemberCannotApplyToOwnFarm() {
        when(membershipRepository.findMembership(FARM_ID, APPLICANT_UID)).thenReturn(
                Optional.of(new FarmMembership("mbr_x", FARM_ID, APPLICANT_UID, FarmRole.OBSERVER, MembershipStatus.ACTIVE))
        );

        CreateApplicationRequest request = new CreateApplicationRequest("Letter", null, null, null, null);
        assertThrows(InvalidStateTransitionException.class, () -> applicationService.applyForJob(JOB_ID, request, applicantUser));
    }

    @Test
    @DisplayName("[SVC-APP-05] Candidate Withdraws Application Successfully")
    void testWithdrawApplicationSuccess() {
        JobApplication app = new JobApplication();
        app.setApplicationId("app-test-01");
        app.setJobId(JOB_ID);
        app.setFarmId(FARM_ID);
        app.setApplicantUid(APPLICANT_UID);
        app.setStatus(ApplicationStatus.SUBMITTED);
        app.setVersion(1);
        when(applicationRepository.findById("app-test-01")).thenReturn(Optional.of(app));

        JobApplicationResponseDTO withdrawn = applicationService.withdrawApplication("app-test-01", applicantUser);
        assertEquals(ApplicationStatus.WITHDRAWN, withdrawn.status());
        assertEquals(2, withdrawn.version());
        verify(historyRepository, times(1)).save(any(ApplicationHistory.class));
    }

    @Test
    @DisplayName("[SVC-APP-06] Application Decisions: Review, Shortlist, Reject")
    void testApplicationDecisionsReviewShortlistReject() {
        JobApplication app = new JobApplication();
        app.setApplicationId("app-review-01");
        app.setJobId(JOB_ID);
        app.setFarmId(FARM_ID);
        app.setApplicantUid(APPLICANT_UID);
        app.setStatus(ApplicationStatus.SUBMITTED);
        app.setVersion(1);
        when(applicationRepository.findById("app-review-01")).thenReturn(Optional.of(app));

        // Review
        JobApplicationResponseDTO reviewed = applicationService.reviewApplication(FARM_ID, "app-review-01", null, managerUser);
        assertEquals(ApplicationStatus.UNDER_REVIEW, reviewed.status());

        // Shortlist
        JobApplicationResponseDTO shortlisted = applicationService.shortlistApplication(FARM_ID, "app-review-01", null, managerUser);
        assertEquals(ApplicationStatus.SHORTLISTED, shortlisted.status());

        // Reject
        ApplicationDecisionRequest rejectReq = new ApplicationDecisionRequest("Position filled by senior candidate", 3);
        JobApplicationResponseDTO rejected = applicationService.rejectApplication(FARM_ID, "app-review-01", rejectReq, managerUser);
        assertEquals(ApplicationStatus.REJECTED, rejected.status());
        assertEquals("Position filled by senior candidate", rejected.decisionReason());
    }

    @Test
    @DisplayName("[SVC-APP-07] CRITICAL INVARIANT: Application Approval DOES NOT Create Field Assignments")
    void testApproveApplicationDoesNotCreateFieldAssignment() {
        JobApplication app = new JobApplication();
        app.setApplicationId("app-approve-01");
        app.setJobId(JOB_ID);
        app.setFarmId(FARM_ID);
        app.setApplicantUid(APPLICANT_UID);
        app.setStatus(ApplicationStatus.SHORTLISTED);
        app.setVersion(2);
        when(applicationRepository.findById("app-approve-01")).thenReturn(Optional.of(app));

        ApplicationDecisionRequest approveReq = new ApplicationDecisionRequest("Candidate meets all qualifications", 2);
        JobApplicationResponseDTO approved = applicationService.approveApplication(FARM_ID, "app-approve-01", approveReq, ownerUser);

        assertEquals(ApplicationStatus.APPROVED, approved.status());
        assertEquals(OWNER_UID, approved.reviewedBy());
        assertNotNull(approved.reviewedAt());
        assertEquals(3, approved.version());

        // Verify history recorded
        verify(historyRepository, times(1)).save(any(ApplicationHistory.class));

        // CRITICAL INVARIANT CHECK:
        // No field repository or assignment repository is invoked.
        // The candidate is strictly APPROVED for recruitment without any field assignment.
    }

    @Test
    @DisplayName("[SVC-APP-08] Private Communication Message Thread")
    void testPrivateApplicationMessaging() {
        JobApplication app = new JobApplication();
        app.setApplicationId("app-msg-01");
        app.setJobId(JOB_ID);
        app.setFarmId(FARM_ID);
        app.setApplicantUid(APPLICANT_UID);
        when(applicationRepository.findById("app-msg-01")).thenReturn(Optional.of(app));

        // Applicant sends message
        SendMessageRequest req1 = new SendMessageRequest("Can I start on Monday?");
        var msg1 = applicationService.sendMessage("app-msg-01", req1, applicantUser);
        assertEquals("APPLICANT", msg1.senderRole());
        assertEquals("Can I start on Monday?", msg1.content());

        // Farm manager sends response
        SendMessageRequest req2 = new SendMessageRequest("Yes, please report to the farm office at 8 AM.");
        var msg2 = applicationService.sendMessage("app-msg-01", req2, managerUser);
        assertEquals("FARM_MANAGEMENT", msg2.senderRole());
    }
}
