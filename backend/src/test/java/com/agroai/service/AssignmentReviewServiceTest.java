package com.agroai.service;

import com.agroai.config.FirebaseConfig;
import com.agroai.dto.CreateAssignmentReviewRequest;
import com.agroai.dto.UpdateAssignmentReviewRequest;
import com.agroai.exception.DuplicateAssignmentReviewException;
import com.agroai.exception.InvalidStateTransitionException;
import com.agroai.exception.UnauthorizedResourceAccessException;
import com.agroai.model.AssignmentReview;
import com.agroai.model.AssignmentStatus;
import com.agroai.model.Farm;
import com.agroai.model.FarmMembership;
import com.agroai.model.FarmRole;
import com.agroai.model.FarmStatus;
import com.agroai.model.FieldAssignment;
import com.agroai.model.MembershipStatus;
import com.agroai.repository.AssignmentReviewRepository;
import com.agroai.repository.FarmMembershipRepository;
import com.agroai.repository.FarmRepository;
import com.agroai.repository.FieldAssignmentRepository;
import com.agroai.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class AssignmentReviewServiceTest {
    private AssignmentReviewRepository reviews;
    private FieldAssignmentRepository assignments;
    private FarmMembershipRepository memberships;
    private FarmRepository farms;
    private UserRepository users;
    private FirebaseConfig firebase;
    private AssignmentReviewService service;
    private FieldAssignment assignment;
    private Farm farm;

    @BeforeEach
    void setUp() {
        reviews = mock(AssignmentReviewRepository.class);
        assignments = mock(FieldAssignmentRepository.class);
        memberships = mock(FarmMembershipRepository.class);
        farms = mock(FarmRepository.class);
        users = mock(UserRepository.class);
        firebase = mock(FirebaseConfig.class);
        when(firebase.isInitialized()).thenReturn(false);
        when(firebase.isConfigured()).thenReturn(false);
        assignment = new FieldAssignment("tenure-1", "farm-1", "field-1", "farmer-1", AssignmentStatus.RELEASED);
        when(assignments.findById("tenure-1")).thenReturn(Optional.of(assignment));
        FarmMembership owner = new FarmMembership("m1", "farm-1", "owner-1", FarmRole.OWNER, MembershipStatus.ACTIVE);
        when(memberships.findMembershipInTransaction(any(), eq("farm-1"), eq("owner-1"))).thenReturn(Optional.of(owner));
        farm = new Farm();
        farm.setStatus(FarmStatus.ACTIVE);
        when(farms.findById("farm-1")).thenReturn(Optional.of(farm));
        for (String uid : new String[]{"owner-1", "farmer-1", "other-user"}) {
            com.agroai.model.UserProfile profile = new com.agroai.model.UserProfile(uid, uid + "@example.test", uid);
            when(users.findPrivateProfileInTransaction(any(), eq(uid))).thenReturn(Optional.of(profile));
        }
        service = new AssignmentReviewService(reviews, assignments, memberships, farms, users, firebase);
    }

    @Test
    void ownerCanCreateReviewForEndedExactTenure() {
        when(reviews.create(any(), isNull())).thenAnswer(call -> call.getArgument(0));
        AssignmentReview created = service.create("tenure-1", new CreateAssignmentReviewRequest(5, "Good work"), "owner-1");
        assertEquals("tenure-1", created.assignmentId());
        assertEquals("farmer-1", created.farmerUid());
        assertEquals(5, created.rating());
        assertEquals("Good work", created.comment());
        assertTrue(created.revisions().isEmpty());
    }

    @Test
    void activeAssignmentCannotBeReviewed() {
        assignment.setStatus(AssignmentStatus.ACTIVE);
        assertThrows(InvalidStateTransitionException.class,
                () -> service.create("tenure-1", new CreateAssignmentReviewRequest(4, null), "owner-1"));
    }

    @Test
    void nonOwnerCannotCreateReview() {
        when(memberships.findMembershipInTransaction(any(), eq("farm-1"), eq("manager-1"))).thenReturn(Optional.empty());
        assertThrows(UnauthorizedResourceAccessException.class,
                () -> service.create("tenure-1", new CreateAssignmentReviewRequest(4, null), "manager-1"));
    }

    @Test
    void ratingAndCommentBoundsAreEnforced() {
        assertThrows(IllegalArgumentException.class,
                () -> service.create("tenure-1", new CreateAssignmentReviewRequest(0, null), "owner-1"));
        assertThrows(IllegalArgumentException.class,
                () -> service.create("tenure-1", new CreateAssignmentReviewRequest(4, "x".repeat(1001)), "owner-1"));
    }

    @Test
    void onlyOwnerAndExactAssignedFarmerCanRead() {
        when(reviews.findByAssignmentId("tenure-1")).thenReturn(Optional.empty());
        assertTrue(service.find("tenure-1", "farmer-1").isEmpty());
        assertThrows(UnauthorizedResourceAccessException.class, () -> service.find("tenure-1", "other-user"));
    }

    @Test
    void duplicateMemoryRepositoryCreationIsRejected() {
        AssignmentReviewRepository memoryRepository = new AssignmentReviewRepository(firebase);
        AssignmentReview one = new AssignmentReview("tenure-1", "farm-1", "field-1", "owner-1", "farmer-1", 4, null, Instant.now());
        memoryRepository.create(one, null);
        assertThrows(DuplicateAssignmentReviewException.class, () -> memoryRepository.create(one, null));
    }

    @Test
    void ownerCanEditReviewWithin24HoursPreservingAuditHistory() {
        Instant createdTime = Instant.now().minus(2, ChronoUnit.HOURS);
        AssignmentReview existing = new AssignmentReview("tenure-1", "farm-1", "field-1", "owner-1", "farmer-1",
                4, "Initial comment", createdTime, createdTime, List.of());
        when(reviews.findByAssignmentId("tenure-1")).thenReturn(Optional.of(existing));
        when(reviews.update(any(), isNull())).thenAnswer(call -> call.getArgument(0));

        AssignmentReview updated = service.update("tenure-1", new UpdateAssignmentReviewRequest(5, "Revised comment"), "owner-1");
        assertEquals(5, updated.rating());
        assertEquals("Revised comment", updated.comment());
        assertEquals(1, updated.revisions().size());
        assertEquals(4, updated.revisions().get(0).rating());
        assertEquals("Initial comment", updated.revisions().get(0).comment());
        assertEquals("owner-1", updated.revisions().get(0).editedBy());
    }

    @Test
    void editPast24HoursIsRejected() {
        Instant createdTime = Instant.now().minus(25, ChronoUnit.HOURS);
        AssignmentReview existing = new AssignmentReview("tenure-1", "farm-1", "field-1", "owner-1", "farmer-1",
                4, "Old comment", createdTime, createdTime, List.of());
        when(reviews.findByAssignmentId("tenure-1")).thenReturn(Optional.of(existing));

        InvalidStateTransitionException ex = assertThrows(InvalidStateTransitionException.class,
                () -> service.update("tenure-1", new UpdateAssignmentReviewRequest(5, "Late edit"), "owner-1"));
        assertTrue(ex.getMessage().contains("24-hour"));
    }

    @Test
    void nonAuthorCannotEditReview() {
        Instant createdTime = Instant.now().minus(1, ChronoUnit.HOURS);
        AssignmentReview existing = new AssignmentReview("tenure-1", "farm-1", "field-1", "other-owner", "farmer-1",
                4, "Old comment", createdTime, createdTime, List.of());
        when(reviews.findByAssignmentId("tenure-1")).thenReturn(Optional.of(existing));

        assertThrows(UnauthorizedResourceAccessException.class,
                () -> service.update("tenure-1", new UpdateAssignmentReviewRequest(5, "Unauthorized"), "owner-1"));
    }

    @Test
    void inactiveFarmDeniesReviewUpdate() {
        farm.setStatus(FarmStatus.ARCHIVED);
        assertThrows(InvalidStateTransitionException.class,
                () -> service.update("tenure-1", new UpdateAssignmentReviewRequest(5, "Edit on archived farm"), "owner-1"));
    }
}
