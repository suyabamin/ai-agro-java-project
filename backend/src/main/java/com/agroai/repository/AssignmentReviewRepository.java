package com.agroai.repository;

import com.agroai.exception.AssignmentNotFoundException;
import com.agroai.exception.DatabaseUnavailableException;
import com.agroai.exception.DuplicateAssignmentReviewException;
import com.agroai.model.AssignmentReview;
import com.agroai.model.AssignmentReviewRevision;
import com.google.cloud.Timestamp;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.Transaction;
import com.google.firebase.cloud.FirestoreClient;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Repository
public class AssignmentReviewRepository {
    private final com.agroai.config.FirebaseConfig firebaseConfig;
    private final Map<String, AssignmentReview> memory = new ConcurrentHashMap<>();

    public AssignmentReviewRepository(com.agroai.config.FirebaseConfig firebaseConfig) {
        this.firebaseConfig = firebaseConfig;
    }

    public Optional<AssignmentReview> findByAssignmentId(String assignmentId) {
        checkConfiguration();
        if (!firebaseConfig.isInitialized()) return Optional.ofNullable(memory.get(assignmentId));
        try {
            DocumentSnapshot snapshot = FirestoreClient.getFirestore().collection("assignment_reviews")
                    .document(assignmentId).get().get();
            return snapshot.exists() ? Optional.of(from(snapshot)) : Optional.empty();
        } catch (Exception e) {
            throw new DatabaseUnavailableException("Failed to read assignment review: " + e.getMessage(), e);
        }
    }

    public AssignmentReview create(AssignmentReview review, Transaction transaction) {
        checkConfiguration();
        if (!firebaseConfig.isInitialized()) {
            synchronized (memory) {
                if (memory.containsKey(review.assignmentId())) throw new DuplicateAssignmentReviewException(review.assignmentId());
                memory.put(review.assignmentId(), review);
            }
            return review;
        }
        try {
            Firestore db = FirestoreClient.getFirestore();
            DocumentReference ref = db.collection("assignment_reviews").document(review.assignmentId());
            if (transaction != null) {
                if (transaction.get(ref).get().exists()) throw new DuplicateAssignmentReviewException(review.assignmentId());
                transaction.create(ref, toMap(review));
            } else {
                db.runTransaction(tx -> {
                    if (tx.get(ref).get().exists()) throw new DuplicateAssignmentReviewException(review.assignmentId());
                    tx.create(ref, toMap(review));
                    return null;
                }).get();
            }
            return review;
        } catch (DuplicateAssignmentReviewException e) {
            throw e;
        } catch (Exception e) {
            throw new DatabaseUnavailableException("Failed to create assignment review: " + e.getMessage(), e);
        }
    }

    public AssignmentReview update(AssignmentReview review, Transaction transaction) {
        checkConfiguration();
        if (!firebaseConfig.isInitialized()) {
            synchronized (memory) {
                if (!memory.containsKey(review.assignmentId())) {
                    throw new AssignmentNotFoundException(review.assignmentId());
                }
                memory.put(review.assignmentId(), review);
            }
            return review;
        }
        try {
            Firestore db = FirestoreClient.getFirestore();
            DocumentReference ref = db.collection("assignment_reviews").document(review.assignmentId());
            if (transaction != null) {
                transaction.set(ref, toMap(review));
            } else {
                db.runTransaction(tx -> {
                    tx.set(ref, toMap(review));
                    return null;
                }).get();
            }
            return review;
        } catch (Exception e) {
            throw new DatabaseUnavailableException("Failed to update assignment review: " + e.getMessage(), e);
        }
    }

    public AssignmentReview findByAssignmentId(Transaction transaction, String assignmentId) {
        checkConfiguration();
        if (!firebaseConfig.isInitialized()) return memory.get(assignmentId);
        try {
            Firestore db = FirestoreClient.getFirestore();
            DocumentSnapshot snapshot = transaction.get(db.collection("assignment_reviews").document(assignmentId)).get();
            return snapshot.exists() ? from(snapshot) : null;
        } catch (Exception e) {
            throw new DatabaseUnavailableException("Failed to read assignment review in transaction: " + e.getMessage(), e);
        }
    }

    private void checkConfiguration() {
        if (firebaseConfig.isConfigured() && !firebaseConfig.isInitialized()) {
            throw new DatabaseUnavailableException("Firebase configured but unavailable; assignment review memory fallback is disabled.");
        }
    }

    private Map<String, Object> toMap(AssignmentReview review) {
        List<Map<String, Object>> revList = review.revisions() == null ? List.of() :
                review.revisions().stream().map(r -> Map.<String, Object>of(
                        "revisionNumber", r.revisionNumber(),
                        "rating", r.rating(),
                        "comment", r.comment() == null ? "" : r.comment(),
                        "editedAt", Timestamp.ofTimeSecondsAndNanos(r.editedAt().getEpochSecond(), r.editedAt().getNano()),
                        "editedBy", r.editedBy()
                )).toList();
        Instant updated = review.updatedAt() != null ? review.updatedAt() : review.createdAt();
        return Map.of(
                "assignmentId", review.assignmentId(),
                "farmId", review.farmId(),
                "fieldId", review.fieldId(),
                "authorUid", review.authorUid(),
                "farmerUid", review.farmerUid(),
                "rating", review.rating(),
                "comment", review.comment() == null ? "" : review.comment(),
                "createdAt", Timestamp.ofTimeSecondsAndNanos(review.createdAt().getEpochSecond(), review.createdAt().getNano()),
                "updatedAt", Timestamp.ofTimeSecondsAndNanos(updated.getEpochSecond(), updated.getNano()),
                "revisions", revList
        );
    }

    private AssignmentReview from(DocumentSnapshot snapshot) {
        Timestamp created = snapshot.getTimestamp("createdAt");
        Timestamp updated = snapshot.getTimestamp("updatedAt");
        Instant createdInstant = created == null ? Instant.EPOCH : created.toDate().toInstant();
        Instant updatedInstant = updated == null ? createdInstant : updated.toDate().toInstant();

        List<?> rawRevisions = (List<?>) snapshot.get("revisions");
        List<AssignmentReviewRevision> revisions = new ArrayList<>();
        if (rawRevisions != null) {
            for (Object item : rawRevisions) {
                if (item instanceof Map<?, ?> m) {
                    Number revNum = (Number) m.get("revisionNumber");
                    Number revRating = (Number) m.get("rating");
                    String revComment = (String) m.get("comment");
                    String revEditedBy = (String) m.get("editedBy");
                    Object editedAtObj = m.get("editedAt");
                    Instant revEditedAt = createdInstant;
                    if (editedAtObj instanceof Timestamp ts) {
                        revEditedAt = ts.toDate().toInstant();
                    }
                    revisions.add(new AssignmentReviewRevision(
                            revNum != null ? revNum.intValue() : 1,
                            revRating != null ? revRating.intValue() : 5,
                            revComment,
                            revEditedAt,
                            revEditedBy != null ? revEditedBy : ""
                    ));
                }
            }
        }

        return new AssignmentReview(
                snapshot.getId(),
                snapshot.getString("farmId"),
                snapshot.getString("fieldId"),
                snapshot.getString("authorUid"),
                snapshot.getString("farmerUid"),
                Math.toIntExact(snapshot.getLong("rating")),
                snapshot.getString("comment"),
                createdInstant,
                updatedInstant,
                Collections.unmodifiableList(revisions)
        );
    }
}
