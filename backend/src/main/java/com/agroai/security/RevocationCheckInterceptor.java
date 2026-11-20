package com.agroai.security;

import com.agroai.exception.FirebaseAuthenticationException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * HandlerInterceptor enforcing online token revocation checks on endpoints
 * annotated with @RequiresRevocationCheck.
 */
@Component
public class RevocationCheckInterceptor implements HandlerInterceptor {

    private static final Logger log = LoggerFactory.getLogger(RevocationCheckInterceptor.class);
    private static final String REVOCATION_CHECKED_ATTR = "AGROAI_REVOCATION_CHECKED";

    private final FirebaseTokenVerifier tokenVerifier;
    private final FirebaseAuthenticationEntryPoint authenticationEntryPoint;

    public RevocationCheckInterceptor(FirebaseTokenVerifier tokenVerifier,
                                      FirebaseAuthenticationEntryPoint authenticationEntryPoint) {
        this.tokenVerifier = tokenVerifier;
        this.authenticationEntryPoint = authenticationEntryPoint;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if (!(handler instanceof HandlerMethod handlerMethod)) {
            return true;
        }

        boolean requiresCheck = handlerMethod.hasMethodAnnotation(RequiresRevocationCheck.class) ||
                handlerMethod.getBeanType().isAnnotationPresent(RequiresRevocationCheck.class);

        if (!requiresCheck) {
            return true;
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return true;
        }

        // Avoid duplicate online checks within the same HTTP request lifecycle
        if (request.getAttribute(REVOCATION_CHECKED_ATTR) != null) {
            return true;
        }

        Object credentials = auth.getCredentials();
        if (credentials instanceof String idToken && !idToken.trim().isEmpty()) {
            try {
                // Online revocation check (checkRevoked = true)
                tokenVerifier.verifyToken(idToken.trim(), true);
                request.setAttribute(REVOCATION_CHECKED_ATTR, Boolean.TRUE);
                log.debug("Online revocation check passed for high-risk endpoint {}", request.getRequestURI());
            } catch (FirebaseAuthenticationException ex) {
                log.warn("High-risk endpoint {} rejected by online revocation check: code={}, msg={}",
                        request.getRequestURI(), ex.getErrorCode(), ex.getMessage());
                SecurityContextHolder.clearContext();
                authenticationEntryPoint.commence(request, response, ex);
                return false;
            }
        }

        return true;
    }
}
