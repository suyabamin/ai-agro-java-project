package com.agroai.service;

import com.agroai.model.Farm;
import com.agroai.model.FarmStatus;
import com.agroai.model.FarmVisibility;
import com.agroai.model.PublicFarmProjection;
import com.agroai.repository.FarmRepository;
import com.google.cloud.firestore.Transaction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Authoritative service managing the lifecycle of sanitized public farm projections in 'public_farms/{farmId}'.
 * Direct client writes to 'public_farms' are strictly prohibited in Cloud Firestore Security Rules.
 */
@Service
public class PublicFarmProjectionService {

    private static final Logger log = LoggerFactory.getLogger(PublicFarmProjectionService.class);

    private final FarmRepository farmRepository;

    public PublicFarmProjectionService(FarmRepository farmRepository) {
        this.farmRepository = farmRepository;
    }

    /**
     * Builds a sanitized public projection with strict allowlist fields.
     */
    public PublicFarmProjection buildAllowlistProjection(Farm farm) {
        return PublicFarmProjection.fromPrivate(farm);
    }

    /**
     * Creates a public projection within a Firestore transaction.
     */
    public void createProjectionInTransaction(Transaction transaction, Farm farm) {
        if (farm == null || farm.getVisibility() != FarmVisibility.PUBLIC || farm.getStatus() != FarmStatus.ACTIVE) {
            return;
        }
        PublicFarmProjection projection = buildAllowlistProjection(farm);
        farmRepository.savePublicProjectionInTransaction(transaction, projection);
        log.info("Queued public projection creation for farm: {}", farm.getFarmId());
    }

    /**
     * Updates an existing public projection within a Firestore transaction.
     */
    public void updateProjectionInTransaction(Transaction transaction, Farm farm) {
        if (farm == null) {
            return;
        }
        if (farm.getVisibility() == FarmVisibility.PUBLIC && farm.getStatus() == FarmStatus.ACTIVE) {
            PublicFarmProjection projection = buildAllowlistProjection(farm);
            farmRepository.savePublicProjectionInTransaction(transaction, projection);
            log.info("Queued public projection update for farm: {}", farm.getFarmId());
        } else {
            // When not PUBLIC + ACTIVE, projection must be deleted
            farmRepository.deletePublicProjectionInTransaction(transaction, farm.getFarmId());
            log.info("Queued public projection deletion for farm: {}", farm.getFarmId());
        }
    }

    /**
     * Deletes a public projection within a Firestore transaction.
     */
    public void deleteProjectionInTransaction(Transaction transaction, String farmId) {
        if (farmId == null) {
            return;
        }
        farmRepository.deletePublicProjectionInTransaction(transaction, farmId);
        log.info("Queued public projection deletion for farm: {}", farmId);
    }

    /**
     * Self-healing reconciliation: aligns public projection state with the private farm document.
     */
    public void reconcileProjection(Farm farm) {
        if (farm == null || farm.getFarmId() == null) {
            return;
        }
        String farmId = farm.getFarmId();
        Optional<PublicFarmProjection> existingProjection = farmRepository.findPublicProjection(farmId);

        boolean shouldBePublic = (farm.getVisibility() == FarmVisibility.PUBLIC && farm.getStatus() == FarmStatus.ACTIVE);

        if (shouldBePublic) {
            PublicFarmProjection projection = buildAllowlistProjection(farm);
            farmRepository.savePublicProjectionInTransaction(null, projection);
            log.info("Self-healing: Rebuilt missing or updated public projection for farm: {}", farmId);
        } else if (existingProjection.isPresent()) {
            farmRepository.deletePublicProjectionInTransaction(null, farmId);
            log.info("Self-healing: Removed orphaned public projection for private/archived farm: {}", farmId);
        }
    }
}
