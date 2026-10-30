package com.comp3111.library.exception;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import javax.persistence.EntityNotFoundException;
import java.util.UUID;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger logger = Logger.getLogger(GlobalExceptionHandler.class.getName());

    @ExceptionHandler(AiDisabledException.class)
    public ResponseEntity<ApiError> handleAiDisabled(AiDisabledException e) {
        return build(HttpStatus.SERVICE_UNAVAILABLE, ErrorCode.AI_DISABLED, e.getMessage());
    }

    @ExceptionHandler(AiUnavailableException.class)
    public ResponseEntity<ApiError> handleAiUnavailable(AiUnavailableException e) {
        return build(HttpStatus.SERVICE_UNAVAILABLE, ErrorCode.AI_UNAVAILABLE, "AI service is temporarily unavailable");
    }

    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ApiError> handleConflict(ConflictException e) {
        return build(HttpStatus.CONFLICT, ErrorCode.CONFLICT, e.getMessage());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiError> handleDataIntegrityViolation(DataIntegrityViolationException e) {
        return build(HttpStatus.CONFLICT, ErrorCode.CONFLICT,
                "The operation conflicts with existing data (e.g. a duplicate entry).");
    }

    @ExceptionHandler({NotFoundException.class, EntityNotFoundException.class})
    public ResponseEntity<ApiError> handleNotFound(RuntimeException e) {
        return build(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleMethodArgumentNotValid(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .collect(Collectors.joining("; "));
        if (message.isBlank()) {
            message = "Validation failed";
        }
        return build(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, message);
    }

    @ExceptionHandler({
            IllegalArgumentException.class,
            BindException.class,
            MissingServletRequestParameterException.class,
            MethodArgumentTypeMismatchException.class
    })
    public ResponseEntity<ApiError> handleValidation(Exception e) {
        String message = e.getMessage();
        if (message != null && message.startsWith("No enum constant")) {
            message = "Invalid value provided";
        }
        return build(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, message);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> handleAccessDenied(AccessDeniedException e) {
        String message = (e.getMessage() != null && !e.getMessage().isBlank()) ? e.getMessage() : "Access is denied";
        return build(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN, message);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiError> handleMaxUploadSize(MaxUploadSizeExceededException e) {
        return build(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, "File exceeds the 10MB limit");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleUnexpected(Exception e) {
        String ref = UUID.randomUUID().toString();
        logger.log(Level.SEVERE, "Unexpected error (ref: " + ref + ")", e);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL_ERROR, "Unexpected error (ref: " + ref + ")");
    }

    private ResponseEntity<ApiError> build(HttpStatus status, ErrorCode code, String message) {
        return ResponseEntity.status(status).body(ApiError.of(code, message));
    }
}
