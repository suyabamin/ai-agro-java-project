package com.agroai.security;

import com.agroai.dto.ApiResponse;
import com.agroai.exception.FirebaseAuthenticationException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class FirebaseAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper;

    public FirebaseAuthenticationEntryPoint(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void commence(HttpServletRequest request,
                         HttpServletResponse response,
                         AuthenticationException authException) throws IOException {

        String message = "Authentication is required to access this resource";
        int httpStatus = HttpServletResponse.SC_UNAUTHORIZED;

        if (authException instanceof FirebaseAuthenticationException firebaseEx) {
            message = firebaseEx.getMessage();
            if ("ACCOUNT_SUSPENDED".equals(firebaseEx.getErrorCode())) {
                httpStatus = HttpServletResponse.SC_FORBIDDEN;
            }
        }

        response.setStatus(httpStatus);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");

        ApiResponse<Void> errorResponse = ApiResponse.failure(message);
        objectMapper.writeValue(response.getWriter(), errorResponse);
        response.getWriter().flush();
    }
}
