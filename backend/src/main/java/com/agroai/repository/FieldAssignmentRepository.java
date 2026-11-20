package com.agroai.repository;

import com.agroai.model.FieldAssignment;
import com.google.cloud.firestore.Transaction;

import java.util.List;
import java.util.Optional;

public interface FieldAssignmentRepository {

    Optional<FieldAssignment> findAssignment(String fieldId, String rawFarmerId);

    Optional<FieldAssignment> findById(String assignmentId);

    FieldAssignment findByIdInTransaction(Transaction transaction, String assignmentId);

    FieldAssignment findActivePairInTransaction(Transaction transaction, String fieldId, String farmerUid);

    void writeActivePairLockInTransaction(Transaction transaction, FieldAssignment assignment);

    void removeActivePairLockInTransaction(Transaction transaction, FieldAssignment assignment);

    FieldAssignment save(FieldAssignment assignment);

    default void saveAssignment(FieldAssignment assignment) {
        save(assignment);
    }

    void saveInTransaction(Transaction transaction, FieldAssignment assignment);

    void releaseAssignment(String fieldId, String rawFarmerId, String releaseReason);

    List<FieldAssignment> findActiveAssignmentsByFarmer(String rawFarmerId);

    List<FieldAssignment> findAssignmentsByFarmer(String rawFarmerId);

    List<FieldAssignment> findActiveAssignmentsByField(String fieldId);

    List<FieldAssignment> findAssignmentsByField(String fieldId);

    List<FieldAssignment> findAssignmentsByFarm(String farmId);

    List<FieldAssignment> getHistoricalArchive();

    CursorPage<FieldAssignment> findActiveAssignmentsByFarmerPage(String farmerUid, String afterId, int limit);

    CursorPage<FieldAssignment> findAssignmentsByFarmerPage(String farmerUid, String afterId, int limit);

    CursorPage<FieldAssignment> findAssignmentsByFieldPage(String fieldId, String afterId, int limit);

    CursorPage<FieldAssignment> findAssignmentsByFarmPage(String farmId, String afterId, int limit);

    void clearAllForTesting();
}
