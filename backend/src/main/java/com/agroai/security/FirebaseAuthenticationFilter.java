package com.agroai.security;

import com.agroai.exception.FirebaseAuthenticationException;
import com.agroai.model.AccountStatus;
import com.agroai.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class FirebaseAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(FirebaseAuthenticationFilter.class);
    private static final String BEARER_PREFIX = "Bearer ";

    private final FirebaseTokenVerifier tokenVerifier;
    private final FirebaseAuthenticationEntryPoint authenticationEntryPoint;
    private final UserRepository userRepository;

    public FirebaseAuthenticationFilter(FirebaseTokenVerifier tokenVerifier,
                                        FirebaseAuthenticationEntryPoint authenticationEntryPoint,
                                        UserRepository userRepository) {
        this.tokenVerifier = tokenVerifier;
        this.authenticationEntryPoint = authenticationEntryPoint;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith(BEARER_PREFIX)) {
            filterChain.doFilter(request, response);
            return;
        }

        String idToken = authHeader.substring(BEARER_PREFIX.length()).trim();
        if (idToken.isEmpty()) {
            authenticationEntryPoint.commence(request, response,
                    new FirebaseAuthenticationException("Bearer token is empty", "EMPTY_TOKEN"));
            return;
        }

        try {
            FirebaseUserDetails userDetails = tokenVerifier.verifyToken(idToken);

            // Active suspension check on all authenticated requests (Section 4.4 of plan)
            if (userRepository != null) {
                userRepository.findPrivateProfile(userDetails.getUid()).ifPresent(profile -> {
                    if (profile.getAccountStatus() != AccountStatus.ACTIVE) {
                        throw new FirebaseAuthenticationException(
                                "Your AgroAI account is not active.", "ACCOUNT_SUSPENDED");
                    }
                });
            }

            FirebaseAuthenticationToken authentication = new FirebaseAuthenticationToken(userDetails, idToken);
            SecurityContextHolder.getContext().setAuthentication(authentication);
            log.debug("Authenticated user uid={} on request {}", userDetails.getUid(), request.getRequestURI());
            filterChain.doFilter(request, response);
        } catch (FirebaseAuthenticationException ex) {
            SecurityContextHolder.clearContext();
            authenticationEntryPoint.commence(request, response, ex);
        }
    }
}
