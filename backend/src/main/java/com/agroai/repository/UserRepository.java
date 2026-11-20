package com.agroai.repository;

import com.agroai.dto.InitializeProfileRequest;
import com.agroai.dto.UpdateProfileRequest;
import com.agroai.model.AccountStatus;
import com.agroai.model.PublicProfile;
import com.agroai.model.QuarantinedProfile;
import com.agroai.model.UserProfile;

import java.util.Optional;
import com.google.cloud.firestore.Transaction;

public interface UserRepository {

    Optional<UserProfile> findPrivateProfile(String uid);

    Optional<UserProfile> findPrivateProfileInTransaction(Transaction transaction, String uid);

    Optional<PublicProfile> findPublicProfile(String uid);

    UserProfile initializeProfile(String uid, String email, InitializeProfileRequest request);

    UserProfile updateProfile(String uid, UpdateProfileRequest request);

    UserProfile reconcileProfile(String uid);

    void updateAccountStatus(String uid, AccountStatus status);

    Optional<QuarantinedProfile> findQuarantinedProfile(String quarantineId);

    void clearAllForTesting();
}
