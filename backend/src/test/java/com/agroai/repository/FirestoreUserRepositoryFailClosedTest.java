package com.agroai.repository;

import com.agroai.config.FirebaseConfig;
import com.agroai.dto.InitializeProfileRequest;
import com.agroai.dto.UpdateProfileRequest;
import com.agroai.exception.DatabaseUnavailableException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@DisplayName("FirestoreUserRepository Fail-Closed & Environment Guard Tests")
class FirestoreUserRepositoryFailClosedTest {

    @Test
    @DisplayName("[FAIL-CLOSED-01] Production environment throws IllegalStateException on startup if Firestore is uninitialized")
    void testProductionEnvironment_RejectsUninitializedFirestore() {
        FirebaseConfig uninitializedConfig = mock(FirebaseConfig.class);
        when(uninitializedConfig.isInitialized()).thenReturn(false);

        MockEnvironment prodEnv = new MockEnvironment();
        prodEnv.setActiveProfiles("production");

        FirestoreUserRepository repo = new FirestoreUserRepository(uninitializedConfig, prodEnv);

        IllegalStateException ex = assertThrows(IllegalStateException.class, repo::validateEnvironmentSafety);
        assertEquals("CRITICAL SECURITY ERROR: Production profile requires live Cloud Firestore. In-memory user repository fallback is strictly forbidden in production.", ex.getMessage());
    }

    @Test
    @DisplayName("[FAIL-CLOSED-02] Dev environment permits in-memory operation when Firebase is uninitialized")
    void testDevEnvironment_PermitsInMemoryWhenUninitialized() {
        FirebaseConfig uninitializedConfig = mock(FirebaseConfig.class);
        when(uninitializedConfig.isInitialized()).thenReturn(false);

        MockEnvironment devEnv = new MockEnvironment();
        devEnv.setActiveProfiles("dev");

        FirestoreUserRepository repo = new FirestoreUserRepository(uninitializedConfig, devEnv);
        assertDoesNotThrow(repo::validateEnvironmentSafety);
    }

    @Test
    @DisplayName("[FAIL-CLOSED-03] Live mode fails closed and throws DatabaseUnavailableException on read error without falling back to memory")
    void testLiveMode_ReadFailure_ThrowsDatabaseUnavailableException() {
        FirebaseConfig liveConfig = mock(FirebaseConfig.class);
        when(liveConfig.isInitialized()).thenReturn(true);

        MockEnvironment env = new MockEnvironment();
        FirestoreUserRepository repo = new FirestoreUserRepository(liveConfig, env);

        // FirebaseApp is not initialized in unit test, so FirestoreClient.getFirestore() will throw
        assertThrows(DatabaseUnavailableException.class, () -> repo.findPrivateProfile("some-uid"));
    }

    @Test
    @DisplayName("[FAIL-CLOSED-04] Live mode fails closed and throws DatabaseUnavailableException on write error without falling back to memory")
    void testLiveMode_WriteFailure_ThrowsDatabaseUnavailableException() {
        FirebaseConfig liveConfig = mock(FirebaseConfig.class);
        when(liveConfig.isInitialized()).thenReturn(true);

        MockEnvironment env = new MockEnvironment();
        FirestoreUserRepository repo = new FirestoreUserRepository(liveConfig, env);

        InitializeProfileRequest req = new InitializeProfileRequest("Test User", null, null, "en");
        assertThrows(DatabaseUnavailableException.class, () -> repo.initializeProfile("some-uid", "test@agroai.org", req));
    }

    @Test
    @DisplayName("[FAIL-CLOSED-05] Live mode fails closed and throws DatabaseUnavailableException on update error without falling back to memory")
    void testLiveMode_UpdateFailure_ThrowsDatabaseUnavailableException() {
        FirebaseConfig liveConfig = mock(FirebaseConfig.class);
        when(liveConfig.isInitialized()).thenReturn(true);

        MockEnvironment env = new MockEnvironment();
        FirestoreUserRepository repo = new FirestoreUserRepository(liveConfig, env);

        UpdateProfileRequest req = new UpdateProfileRequest("New Name", null, null, null, "en", 1);
        assertThrows(DatabaseUnavailableException.class, () -> repo.updateProfile("some-uid", req));
    }

    @Test
    @DisplayName("[FAIL-CLOSED-06] When credentials are configured but initialization failed, operations fail closed with DatabaseUnavailableException")
    void testConfiguredButUninitialized_ThrowsDatabaseUnavailableException() {
        FirebaseConfig badConfig = mock(FirebaseConfig.class);
        when(badConfig.isConfigured()).thenReturn(true);
        when(badConfig.isInitialized()).thenReturn(false);
        when(badConfig.getInitializationMessage()).thenReturn("Specified credentials file not found on filesystem");

        MockEnvironment env = new MockEnvironment();
        FirestoreUserRepository repo = new FirestoreUserRepository(badConfig, env);

        assertThrows(DatabaseUnavailableException.class, () -> repo.findPrivateProfile("some-uid"));
        assertThrows(DatabaseUnavailableException.class, () -> repo.findPublicProfile("some-uid"));
        assertThrows(DatabaseUnavailableException.class, () -> repo.initializeProfile("some-uid", "a@b.com", new InitializeProfileRequest("Name", null, null, "en")));
    }
}
