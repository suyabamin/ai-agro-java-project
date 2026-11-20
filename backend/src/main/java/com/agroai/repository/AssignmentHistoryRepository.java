package com.agroai.repository;

import com.agroai.model.AssignmentHistory;
import com.google.cloud.firestore.Transaction;

import java.util.List;

public interface AssignmentHistoryRepository {

    AssignmentHistory save(AssignmentHistory history);

    void saveInTransaction(Transaction transaction, AssignmentHistory history);

    List<AssignmentHistory> findByAssignmentId(String assignmentId);

    List<AssignmentHistory> findByFieldId(String fieldId);

    List<AssignmentHistory> findByFarmerUid(String farmerUid);

    CursorPage<AssignmentHistory> findByAssignmentIdPage(String assignmentId, String afterId, int limit);

    void clearAllForTesting();
}
