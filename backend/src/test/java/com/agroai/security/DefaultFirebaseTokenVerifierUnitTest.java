package com.agroai.security;

import com.agroai.exception.FirebaseAuthenticationException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Unit Test (MOCKED / ISOLATED):
 * Tests input validation and uninitialized states of DefaultFirebaseTokenVerifier
 * without requiring remote Firebase connection.
 */
class DefaultFirebaseTokenVerifierUnitTest {

    private final DefaultFirebaseTokenVerifier verifier = new DefaultFirebaseTokenVerifier();

    @Test
    @DisplayName("[MOCK/UNIT] Null token should throw MISSING_TOKEN exception")
    void testNullTokenThrowsException() {
        FirebaseAuthenticationException ex = assertThrows(
                FirebaseAuthenticationException.class,
                () -> verifier.verifyToken(null)
        );
        assertEquals("MISSING_TOKEN", ex.getErrorCode());
    }

    @Test
    @DisplayName("[MOCK/UNIT] Blank token should throw MISSING_TOKEN exception")
    void testBlankTokenThrowsException() {
        FirebaseAuthenticationException ex = assertThrows(
                FirebaseAuthenticationException.class,
                () -> verifier.verifyToken("   ")
        );
        assertEquals("MISSING_TOKEN", ex.getErrorCode());
    }

    @Test
    @DisplayName("[MOCK/UNIT] Verification when FirebaseApp is not initialized should throw FIREBASE_UNINITIALIZED")
    void testUninitializedAppThrowsException() {
        FirebaseAuthenticationException ex = assertThrows(
                FirebaseAuthenticationException.class,
                () -> verifier.verifyToken("some.dummy.token")
        );
        assertEquals("FIREBASE_UNINITIALIZED", ex.getErrorCode());
    }
}
