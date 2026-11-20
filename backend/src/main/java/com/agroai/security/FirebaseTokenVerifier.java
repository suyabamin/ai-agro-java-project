package com.agroai.security;

import com.agroai.exception.FirebaseAuthenticationException;

public interface FirebaseTokenVerifier {

    /**
     * Verifies a Firebase ID token using cached JWKS (offline, sub-millisecond).
     *
     * @param idToken raw Firebase ID token from Authorization Bearer header
     * @return validated user details containing UID and claims
     * @throws FirebaseAuthenticationException if token is invalid, expired, revoked, or SDK is not ready
     */
    FirebaseUserDetails verifyToken(String idToken) throws FirebaseAuthenticationException;

    /**
     * Verifies a Firebase ID token with optional online revocation checking.
     * When checkRevoked is true, calls Google identity servers to check if the session was revoked or disabled.
     *
     * @param idToken raw Firebase ID token
     * @param checkRevoked whether to check revocation online
     * @return validated user details
     * @throws FirebaseAuthenticationException if token is invalid, expired, or revoked
     */
    FirebaseUserDetails verifyToken(String idToken, boolean checkRevoked) throws FirebaseAuthenticationException;
}
