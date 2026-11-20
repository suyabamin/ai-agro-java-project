package com.agroai.repository;

import com.agroai.model.ApplicationMessage;
import com.google.cloud.firestore.Transaction;

import java.util.List;

public interface ApplicationMessageRepository {

    ApplicationMessage save(ApplicationMessage message);

    List<ApplicationMessage> findByApplicationIdOrderBySentAtAsc(String applicationId);

    void saveInTransaction(Transaction transaction, ApplicationMessage message);
}
