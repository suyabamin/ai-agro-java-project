package com.agroai.repository;

import com.agroai.model.Farm;
import com.agroai.model.PublicFarmProjection;
import com.google.cloud.firestore.Transaction;

import java.util.List;
import java.util.Optional;

public interface FarmRepository {

    Optional<Farm> findById(String farmId);

    Farm save(Farm farm);

    Farm update(Farm farm, int expectedVersion);

    void saveInTransaction(Transaction transaction, Farm farm);

    Farm findByIdInTransaction(Transaction transaction, String farmId);

    List<Farm> findByOwnerUid(String ownerUid);

    List<Farm> findByIds(List<String> farmIds);

    Optional<PublicFarmProjection> findPublicProjection(String farmId);

    void savePublicProjectionInTransaction(Transaction transaction, PublicFarmProjection projection);

    void deletePublicProjectionInTransaction(Transaction transaction, String farmId);

    List<PublicFarmProjection> listPublicProjections(String district, String division, String cropType, int page, int size);
}
