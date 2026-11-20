package com.agroai.exception;

import com.agroai.dto.ApiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(DuplicateAssignmentReviewException.class)
    public ResponseEntity<ApiResponse<Void>> handleDuplicateAssignmentReview(DuplicateAssignmentReviewException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiResponse.failure(ex.getMessage()));
    }

    @ExceptionHandler(PaymentNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handlePaymentNotFoundException(PaymentNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.failure(ex.getMessage()));
    }

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(FirebaseAuthenticationException.class)
    public ResponseEntity<ApiResponse<Void>> handleFirebaseAuthException(FirebaseAuthenticationException ex) {
        log.warn("Authentication failed: code={}, message={}", ex.getErrorCode(), ex.getMessage());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ApiResponse.failure(ex.getMessage()));
    }

    @ExceptionHandler(ProfileNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleProfileNotFoundException(ProfileNotFoundException ex) {
        log.warn("Profile not found: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.failure(ex.getMessage()));
    }

    @ExceptionHandler(FarmNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleFarmNotFoundException(FarmNotFoundException ex) {
        log.warn("Farm not found: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.failure(ex.getMessage()));
    }

    @ExceptionHandler(FieldNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleFieldNotFoundException(FieldNotFoundException ex) {
        log.warn("Field not found: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.failure(ex.getMessage()));
    }

    @ExceptionHandler(JobNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleJobNotFoundException(JobNotFoundException ex) {
        log.warn("Job not found: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.failure(ex.getMessage()));
    }

    @ExceptionHandler(ApplicationNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleApplicationNotFoundException(ApplicationNotFoundException ex) {
        log.warn("Application not found: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.failure(ex.getMessage()));
    }

    @ExceptionHandler(AssignmentNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleAssignmentNotFoundException(AssignmentNotFoundException ex) {
        log.warn("Field assignment not found: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.failure(ex.getMessage()));
    }

    @ExceptionHandler(DuplicateAssignmentException.class)
    public ResponseEntity<ApiResponse<Void>> handleDuplicateAssignmentException(DuplicateAssignmentException ex) {
        log.warn("Duplicate assignment conflict: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.failure(ex.getMessage()));
    }

    @ExceptionHandler(DuplicateApplicationException.class)
    public ResponseEntity<ApiResponse<Void>> handleDuplicateApplicationException(DuplicateApplicationException ex) {
        log.warn("Duplicate application: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.failure(ex.getMessage()));
    }

    @ExceptionHandler(StaleProfileVersionException.class)
    public ResponseEntity<ApiResponse<Void>> handleStaleVersionException(StaleProfileVersionException ex) {
        log.warn("Optimistic lock conflict: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.failure(ex.getMessage()));
    }

    @ExceptionHandler(StaleVersionException.class)
    public ResponseEntity<ApiResponse<Void>> handleGenericStaleVersionException(StaleVersionException ex) {
        log.warn("Document version conflict: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.failure(ex.getMessage()));
    }

    @ExceptionHandler(InvalidStateTransitionException.class)
    public ResponseEntity<ApiResponse<Void>> handleInvalidStateTransitionException(InvalidStateTransitionException ex) {
        log.warn("Invalid state transition: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.failure(ex.getMessage()));
    }

    @ExceptionHandler(AccountSuspendedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccountSuspendedException(AccountSuspendedException ex) {
        log.warn("Account suspended access blocked: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.failure(ex.getMessage()));
    }

    @ExceptionHandler(EmailVerificationRequiredException.class)
    public ResponseEntity<ApiResponse<Void>> handleEmailVerificationRequiredException(EmailVerificationRequiredException ex) {
        log.warn("Email verification required: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.failure(ex.getMessage()));
    }

    @ExceptionHandler(DatabaseUnavailableException.class)
    public ResponseEntity<ApiResponse<Void>> handleDatabaseUnavailableException(DatabaseUnavailableException ex) {
        log.error("Database unavailable: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(ApiResponse.failure("Database service is currently unavailable. Please try again shortly."));
    }

    @ExceptionHandler(MonitoringServiceUnavailableException.class)
    public ResponseEntity<ApiResponse<Void>> handleMonitoringServiceUnavailable(MonitoringServiceUnavailableException ex) {
        log.warn("Monitoring dependency unavailable: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(ApiResponse.failure("Monitoring storage or processing is currently unavailable."));
    }

    @ExceptionHandler(UnauthorizedResourceAccessException.class)
    public ResponseEntity<ApiResponse<Void>> handleUnauthorizedResourceAccess(UnauthorizedResourceAccessException ex) {
        log.warn("Unauthorized resource access: resourceType={}, resourceId={}, message={}",
                ex.getResourceType(), ex.getResourceId(), ex.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.failure(ex.getMessage()));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccessDeniedException(AccessDeniedException ex) {
        log.warn("Access denied: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.failure("You do not have permission to perform this action"));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalArgumentException(IllegalArgumentException ex) {
        log.warn("Illegal argument: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.failure(ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidationException(MethodArgumentNotValidException ex) {
        String validationErrors = ex.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .collect(Collectors.joining("; "));
        log.warn("Validation error: {}", validationErrors);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.failure("Validation failed: " + validationErrors));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGenericException(Exception ex) {
        log.error("Unhandled server exception: {}", ex.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.failure("An internal server error occurred"));
    }
}
