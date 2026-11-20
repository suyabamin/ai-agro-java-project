package com.agroai.security;

import com.agroai.exception.FirebaseAuthenticationException;
import com.google.firebase.FirebaseApp;
import com.google.firebase.auth.AuthErrorCode;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class DefaultFirebaseTokenVerifier implements FirebaseTokenVerifier {

    private static final Logger log = LoggerFactory.getLogger(DefaultFirebaseTokenVerifier.class);

    @Override
    public FirebaseUserDetails verifyToken(String idToken) throws FirebaseAuthenticationException {
        return verifyToken(idToken, false);
    }

    @Override
    public FirebaseUserDetails verifyToken(String idToken, boolean checkRevoked) throws FirebaseAuthenticationException {
        if (idToken == null || idToken.trim().isEmpty()) {
            throw new FirebaseAuthenticationException("Authorization token is missing or empty", "MISSING_TOKEN");
        }

        if (FirebaseApp.getApps().isEmpty()) {
            log.warn("Attempted to verify token, but FirebaseApp is not initialized");
            throw new FirebaseAuthenticationException("Firebase authentication service is not configured", "FIREBASE_UNINITIALIZED");
        }

        try {
            FirebaseToken token = FirebaseAuth.getInstance().verifyIdToken(idToken.trim(), checkRevoked);
            return new FirebaseUserDetails(
                    token.getUid(),
                    token.getEmail(),
                    token.getName(),
                    token.isEmailVerified(),
                    token.getClaims()
            );
        } catch (FirebaseAuthException e) {
            AuthErrorCode authErrorCode = e.getAuthErrorCode();
            String errorCode = authErrorCode != null ? authErrorCode.name() : "TOKEN_VERIFICATION_FAILED";
            String safeMessage;

            if (authErrorCode == AuthErrorCode.EXPIRED_ID_TOKEN) {
                safeMessage = "Firebase ID token has expired";
            } else if (authErrorCode == AuthErrorCode.REVOKED_ID_TOKEN) {
                safeMessage = "Firebase ID token has been revoked";
            } else if (authErrorCode == AuthErrorCode.USER_DISABLED) {
                safeMessage = "Firebase user account has been disabled";
            } else if (authErrorCode == AuthErrorCode.INVALID_ID_TOKEN) {
                safeMessage = "Firebase ID token is invalid";
            } else {
                safeMessage = "Failed to verify Firebase authentication token";
            }

            log.warn("Firebase token verification rejected: code={}", errorCode);
            throw new FirebaseAuthenticationException(safeMessage, errorCode, e);
        } catch (IllegalArgumentException e) {
            log.warn("Malformed token supplied to verification");
            throw new FirebaseAuthenticationException("Firebase token format is malformed", "MALFORMED_TOKEN", e);
        } catch (Exception e) {
            log.error("Unexpected error during token verification: {}", e.getClass().getSimpleName());
            throw new FirebaseAuthenticationException("Authentication verification failed", "AUTH_ERROR", e);
        }
    }
}
