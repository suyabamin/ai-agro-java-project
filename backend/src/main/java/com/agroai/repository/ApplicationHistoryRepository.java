package com.agroai.repository;

import com.agroai.model.ApplicationHistory;
import com.google.cloud.firestore.Transaction;

import java.util.List;

public interface ApplicationHistoryRepository {

    ApplicationHistory save(ApplicationHistory history);

    List<ApplicationHistory> findByApplicationId(String applicationId);

    void saveInTransaction(Transaction transaction, ApplicationHistory history);
}
