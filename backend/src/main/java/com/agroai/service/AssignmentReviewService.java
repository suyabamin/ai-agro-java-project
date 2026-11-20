package com.agroai.service;

import com.agroai.config.FirebaseConfig;
import com.agroai.dto.CreateAssignmentReviewRequest;
import com.agroai.dto.UpdateAssignmentReviewRequest;
import com.agroai.exception.AssignmentNotFoundException;
import com.agroai.exception.DatabaseUnavailableException;
import com.agroai.exception.DuplicateAssignmentReviewException;
import com.agroai.exception.InvalidStateTransitionException;
import com.agroai.exception.UnauthorizedResourceAccessException;
import com.agroai.model.AssignmentReview;
import com.agroai.model.AssignmentReviewRevision;
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
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.Transaction;
import com.google.firebase.cloud.FirestoreClient;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Service
public class AssignmentReviewService {
    private static final Set<AssignmentStatus> ENDED = Set.of(AssignmentStatus.RELEASED, AssignmentStatus.COMPLETED, AssignmentStatus.TERMINATED);
    private final AssignmentReviewRepository reviews;
    private final FieldAssignmentRepository assignments;
    private final FarmMembershipRepository memberships;
    private final FarmRepository farms;
    private final UserRepository users;
    private final FirebaseConfig firebaseConfig;

    public AssignmentReviewService(AssignmentReviewRepository reviews, FieldAssignmentRepository assignments,
                                   FarmMembershipRepository memberships, FarmRepository farms, UserRepository users, FirebaseConfig firebaseConfig) {
        this.reviews = reviews;
        this.assignments = assignments;
        this.memberships = memberships;
        this.farms = farms;
        this.users = users;
        this.firebaseConfig = firebaseConfig;
    }

    public AssignmentReview create(String assignmentId, CreateAssignmentReviewRequest request, String actorUid) {
        validate(request);
        if (firebaseConfig.isConfigured() && !firebaseConfig.isInitialized()) {
            throw new DatabaseUnavailableException("Firebase is configured but unavailable; review writes fail closed.");
        }
        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                return db.runTransaction(tx -> createInTransaction(tx, assignmentId, request, actorUid)).get();
            } catch (Exception e) {
                handleTransactionException(e, "Review creation");
            }
        }
        synchronized (this) {
            requireActiveProfile(actorUid, null);
            FieldAssignment assignment = assignments.findById(assignmentId).orElseThrow(() -> AssignmentNotFoundException.forId(assignmentId));
            requireOwner(assignment.getFarmId(), actorUid, null);
            requireEnded(assignment);
            if (farms.findById(assignment.getFarmId()).filter(farm -> farm.getStatus() == FarmStatus.ACTIVE).isEmpty()) {
                throw new InvalidStateTransitionException("Reviews are unavailable for an inactive or archived farm");
            }
            Instant now = Instant.now();
            AssignmentReview review = new AssignmentReview(assignmentId, assignment.getFarmId(), assignment.getFieldId(),
                    actorUid, assignment.getFarmerUid(), request.rating(), normalizeComment(request.comment()), now, now, List.of());
            return reviews.create(review, null);
        }
    }

    public AssignmentReview update(String assignmentId, UpdateAssignmentReviewRequest request, String actorUid) {
        validate(request);
        if (firebaseConfig.isConfigured() && !firebaseConfig.isInitialized()) {
            throw new DatabaseUnavailableException("Firebase is configured but unavailable; review updates fail closed.");
        }
        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                return db.runTransaction(tx -> updateInTransaction(tx, assignmentId, request, actorUid)).get();
            } catch (Exception e) {
                handleTransactionException(e, "Review update");
            }
        }
        synchronized (this) {
            requireActiveProfile(actorUid, null);
            FieldAssignment assignment = assignments.findById(assignmentId).orElseThrow(() -> AssignmentNotFoundException.forId(assignmentId));
            requireOwner(assignment.getFarmId(), actorUid, null);
            if (farms.findById(assignment.getFarmId()).filter(farm -> farm.getStatus() == FarmStatus.ACTIVE).isEmpty()) {
                throw new InvalidStateTransitionException("Reviews cannot be edited for an inactive or archived farm");
            }
            AssignmentReview existing = reviews.findByAssignmentId(assignmentId).orElseThrow(() -> AssignmentNotFoundException.forId(assignmentId));
            if (!existing.authorUid().equals(actorUid)) {
                throw new UnauthorizedResourceAccessException("ASSIGNMENT_REVIEW", assignmentId, "Only the author of the review may edit it");
            }
            Instant now = Instant.now();
            if (!now.isBefore(existing.createdAt().plus(24, ChronoUnit.HOURS))) {
                throw new InvalidStateTransitionException("The 24-hour review editing window has expired");
            }
            int revNum = (existing.revisions() == null ? 0 : existing.revisions().size()) + 1;
            AssignmentReviewRevision revision = new AssignmentReviewRevision(revNum, existing.rating(), existing.comment(), now, actorUid);
            List<AssignmentReviewRevision> newRevisions = new ArrayList<>(existing.revisions() == null ? List.of() : existing.revisions());
            newRevisions.add(revision);
            AssignmentReview updated = new AssignmentReview(existing.assignmentId(), existing.farmId(), existing.fieldId(),
                    existing.authorUid(), existing.farmerUid(), request.rating(), normalizeComment(request.comment()),
                    existing.createdAt(), now, Collections.unmodifiableList(newRevisions));
            return reviews.update(updated, null);
        }
    }

    public Optional<AssignmentReview> find(String assignmentId, String actorUid) {
        if (firebaseConfig.isConfigured() && !firebaseConfig.isInitialized()) {
            throw new DatabaseUnavailableException("Firebase is configured but unavailable; review reads fail closed.");
        }
        if (firebaseConfig.isInitialized()) {
            try {
                Firestore db = FirestoreClient.getFirestore();
                return db.runTransaction(tx -> findInTransaction(tx, assignmentId, actorUid)).get();
            } catch (Exception e) {
                handleTransactionException(e, "Review read");
            }
        }
        synchronized (this) {
            requireActiveProfile(actorUid, null);
            FieldAssignment assignment = assignments.findById(assignmentId).orElseThrow(() -> AssignmentNotFoundException.forId(assignmentId));
            requireReadable(assignment, actorUid, null);
            if (farms.findById(assignment.getFarmId()).filter(farm -> farm.getStatus() == FarmStatus.ACTIVE).isEmpty()) {
                throw new UnauthorizedResourceAccessException("ASSIGNMENT_REVIEW", assignmentId, "Reviews for inactive farms are unavailable");
            }
            return reviews.findByAssignmentId(assignmentId);
        }
    }

    private AssignmentReview createInTransaction(Transaction tx, String assignmentId, CreateAssignmentReviewRequest request, String actorUid) {
        requireActiveProfile(actorUid, tx);
        FieldAssignment assignment = assignments.findByIdInTransaction(tx, assignmentId);
        if (assignment == null) throw AssignmentNotFoundException.forId(assignmentId);
        requireOwner(assignment.getFarmId(), actorUid, tx);
        requireEnded(assignment);
        Farm farm = farms.findByIdInTransaction(tx, assignment.getFarmId());
        if (farm == null || farm.getStatus() != FarmStatus.ACTIVE) {
            throw new InvalidStateTransitionException("Reviews are unavailable for an inactive or archived farm");
        }
        Instant now = Instant.now();
        AssignmentReview review = new AssignmentReview(assignmentId, assignment.getFarmId(), assignment.getFieldId(),
                actorUid, assignment.getFarmerUid(), request.rating(), normalizeComment(request.comment()), now, now, List.of());
        return reviews.create(review, tx);
    }

    private AssignmentReview updateInTransaction(Transaction tx, String assignmentId, UpdateAssignmentReviewRequest request, String actorUid) {
        requireActiveProfile(actorUid, tx);
        FieldAssignment assignment = assignments.findByIdInTransaction(tx, assignmentId);
        if (assignment == null) throw AssignmentNotFoundException.forId(assignmentId);
        requireOwner(assignment.getFarmId(), actorUid, tx);
        Farm farm = farms.findByIdInTransaction(tx, assignment.getFarmId());
        if (farm == null || farm.getStatus() != FarmStatus.ACTIVE) {
            throw new InvalidStateTransitionException("Reviews cannot be edited for an inactive or archived farm");
        }
        AssignmentReview existing = reviews.findByAssignmentId(tx, assignmentId);
        if (existing == null) throw AssignmentNotFoundException.forId(assignmentId);
        if (!existing.authorUid().equals(actorUid)) {
            throw new UnauthorizedResourceAccessException("ASSIGNMENT_REVIEW", assignmentId, "Only the author of the review may edit it");
        }
        Instant now = Instant.now();
        if (!now.isBefore(existing.createdAt().plus(24, ChronoUnit.HOURS))) {
            throw new InvalidStateTransitionException("The 24-hour review editing window has expired");
        }
        int revNum = (existing.revisions() == null ? 0 : existing.revisions().size()) + 1;
        AssignmentReviewRevision revision = new AssignmentReviewRevision(revNum, existing.rating(), existing.comment(), now, actorUid);
        List<AssignmentReviewRevision> newRevisions = new ArrayList<>(existing.revisions() == null ? List.of() : existing.revisions());
        newRevisions.add(revision);
        AssignmentReview updated = new AssignmentReview(existing.assignmentId(), existing.farmId(), existing.fieldId(),
                existing.authorUid(), existing.farmerUid(), request.rating(), normalizeComment(request.comment()),
                existing.createdAt(), now, Collections.unmodifiableList(newRevisions));
        return reviews.update(updated, tx);
    }

    private Optional<AssignmentReview> findInTransaction(Transaction tx, String assignmentId, String actorUid) {
        requireActiveProfile(actorUid, tx);
        FieldAssignment assignment = assignments.findByIdInTransaction(tx, assignmentId);
        if (assignment == null) throw AssignmentNotFoundException.forId(assignmentId);
        requireReadable(assignment, actorUid, tx);
        Farm farm = farms.findByIdInTransaction(tx, assignment.getFarmId());
        if (farm == null || farm.getStatus() != FarmStatus.ACTIVE) {
            throw new UnauthorizedResourceAccessException("ASSIGNMENT_REVIEW", assignmentId, "Reviews for inactive farms are unavailable");
        }
        return Optional.ofNullable(reviews.findByAssignmentId(tx, assignmentId));
    }

    private void handleTransactionException(Exception e, String operation) {
        Throwable cause = e.getCause() == null ? e : e.getCause();
        if (cause instanceof AssignmentNotFoundException anf) throw anf;
        if (cause instanceof DuplicateAssignmentReviewException dae) throw dae;
        if (cause instanceof InvalidStateTransitionException ist) throw ist;
        if (cause instanceof UnauthorizedResourceAccessException ura) throw ura;
        if (cause instanceof IllegalArgumentException iae) throw iae;
        throw new DatabaseUnavailableException(operation + " transaction failed: " + cause.getMessage(), cause);
    }

    private void requireReadable(FieldAssignment assignment, String uid, Transaction tx) {
        if (!isOwner(assignment.getFarmId(), uid, tx) && !uid.equals(assignment.getFarmerUid())) {
            throw new UnauthorizedResourceAccessException("ASSIGNMENT_REVIEW", assignment.getAssignmentId(), "Only the assignment owner and assigned farmer may read this review");
        }
    }

    private void requireActiveProfile(String uid, Transaction tx) {
        com.agroai.model.UserProfile profile = users.findPrivateProfileInTransaction(tx, uid).orElse(null);
        if (profile == null || profile.getAccountStatus() != com.agroai.model.AccountStatus.ACTIVE) {
            throw new UnauthorizedResourceAccessException("USER", uid, "An active user profile is required for assignment review access");
        }
    }

    private void requireOwner(String farmId, String uid, Transaction tx) {
        if (!isOwner(farmId, uid, tx)) throw new UnauthorizedResourceAccessException("FARM", farmId, "Only an active farm OWNER may create or edit an assignment review");
    }

    private boolean isOwner(String farmId, String uid, Transaction tx) {
        FarmMembership membership = memberships.findMembershipInTransaction(tx, farmId, uid).orElse(null);
        return membership != null && membership.getStatus() == MembershipStatus.ACTIVE && membership.getRole() == FarmRole.OWNER;
    }

    private void requireEnded(FieldAssignment assignment) {
        if (!ENDED.contains(assignment.getStatus())) throw new InvalidStateTransitionException("A review can be created only after the assignment tenure has ended");
    }

    private void validate(CreateAssignmentReviewRequest request) {
        if (request == null || request.rating() < 1 || request.rating() > 5) throw new IllegalArgumentException("Rating must be between 1 and 5");
        if (request.comment() != null && request.comment().length() > 1000) throw new IllegalArgumentException("Comment must not exceed 1000 characters");
    }

    private void validate(UpdateAssignmentReviewRequest request) {
        if (request == null || request.rating() < 1 || request.rating() > 5) throw new IllegalArgumentException("Rating must be between 1 and 5");
        if (request.comment() != null && request.comment().length() > 1000) throw new IllegalArgumentException("Comment must not exceed 1000 characters");
    }

    private String normalizeComment(String comment) { return comment == null || comment.isBlank() ? null : comment; }
}
