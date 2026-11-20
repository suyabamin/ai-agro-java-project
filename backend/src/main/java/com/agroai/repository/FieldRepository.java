package com.agroai.repository;

import com.agroai.model.Field;
import com.google.cloud.firestore.Transaction;

import java.util.List;
import java.util.Optional;

public interface FieldRepository {

    Optional<Field> findById(String fieldId);

    Field findByIdInTransaction(Transaction transaction, String fieldId);

    Field save(Field field);

    void saveInTransaction(Transaction transaction, Field field);

    List<Field> findByFarmId(String farmId);

    List<Field> findActiveByFarmId(String farmId);

    long countActiveFieldsByFarmId(String farmId);
}
