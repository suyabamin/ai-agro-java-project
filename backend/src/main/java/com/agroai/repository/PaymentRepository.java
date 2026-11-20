package com.agroai.repository;

import com.agroai.model.PaymentRecord;
import com.google.cloud.firestore.Transaction;

import java.util.List;
import java.util.Optional;

public interface PaymentRepository {
    PaymentRecord save(PaymentRecord payment, Transaction transaction);
    Optional<PaymentRecord> findById(String paymentId);
    PaymentRecord findByIdInTransaction(Transaction transaction, String paymentId);
    List<PaymentRecord> findByFarmId(String farmId, String farmerFilter, int limit);
    List<PaymentRecord> findByAssignmentId(String assignmentId, int limit);
    List<PaymentRecord> findByFarmerUid(String farmerUid, int limit);
}
