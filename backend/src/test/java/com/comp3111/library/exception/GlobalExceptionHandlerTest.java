package com.comp3111.library.exception;

import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.BindException;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import javax.persistence.EntityNotFoundException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void aiDisabledException_maps503AiDisabled() {
        ResponseEntity<ApiError> response = handler.handleAiDisabled(new AiDisabledException("no key"));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        assertEquals(ErrorCode.AI_DISABLED.name(), response.getBody().getCode());
    }

    @Test
    void aiUnavailableException_maps503AiUnavailable() {
        ResponseEntity<ApiError> response = handler.handleAiUnavailable(new AiUnavailableException("down"));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        assertEquals(ErrorCode.AI_UNAVAILABLE.name(), response.getBody().getCode());
    }

    @Test
    void restClientException_noLongerMapsToAiUnavailable_fallsToCatchAll500() {
        // BookDownloadService shares externalRestTemplate with GeminiService; an arXiv/download
        // failure should not masquerade as an AI outage. GeminiService wraps its own failures in
        // AiUnavailableException, so an unwrapped RestClientException now falls to the catch-all.
        Exception ex = new org.springframework.web.client.RestClientException(
                "connect timed out to https://export.arxiv.org/api/query");
        ResponseEntity<ApiError> response = handler.handleUnexpected(ex);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertEquals(ErrorCode.INTERNAL_ERROR.name(), response.getBody().getCode());
        assertFalse(response.getBody().getMessage().contains("arxiv.org"));
    }

    @Test
    void conflictException_maps409Conflict() {
        ResponseEntity<ApiError> response = handler.handleConflict(new ConflictException("stale state"));
        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        assertEquals(ErrorCode.CONFLICT.name(), response.getBody().getCode());
    }

    @Test
    void notFoundException_maps404NotFound() {
        ResponseEntity<ApiError> response = handler.handleNotFound(new NotFoundException("missing"));
        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        assertEquals(ErrorCode.NOT_FOUND.name(), response.getBody().getCode());
    }

    @Test
    void dataIntegrityViolationException_maps409Conflict() {
        ResponseEntity<ApiError> response = handler.handleDataIntegrityViolation(
                new DataIntegrityViolationException("duplicate key value violates unique constraint \"uk_book_reviews_user_book\""));
        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        assertEquals(ErrorCode.CONFLICT.name(), response.getBody().getCode());
        assertEquals("The operation conflicts with existing data (e.g. a duplicate entry).", response.getBody().getMessage());
    }

    @Test
    void entityNotFoundException_maps404NotFound() {
        ResponseEntity<ApiError> response = handler.handleNotFound(new EntityNotFoundException("missing entity"));
        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        assertEquals(ErrorCode.NOT_FOUND.name(), response.getBody().getCode());
    }

    @Test
    void methodArgumentNotValidException_maps400ValidationFailed_joinsFieldErrors() {
        BindingResult bindingResult = new BeanPropertyBindingResult(new Object(), "target");
        bindingResult.addError(new FieldError("target", "email", "must not be blank"));
        bindingResult.addError(new FieldError("target", "age", "must be positive"));
        MethodParameter methodParameter = mock(MethodParameter.class);
        MethodArgumentNotValidException ex = new MethodArgumentNotValidException(methodParameter, bindingResult);

        ResponseEntity<ApiError> response = handler.handleMethodArgumentNotValid(ex);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals(ErrorCode.VALIDATION_FAILED.name(), response.getBody().getCode());
        assertTrue(response.getBody().getMessage().contains("email"));
        assertTrue(response.getBody().getMessage().contains("age"));
    }

    @Test
    void illegalArgumentException_maps400ValidationFailed() {
        ResponseEntity<ApiError> response = handler.handleValidation(new IllegalArgumentException("bad arg"));
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals(ErrorCode.VALIDATION_FAILED.name(), response.getBody().getCode());
        assertEquals("bad arg", response.getBody().getMessage());
    }

    @Test
    void illegalArgumentException_enumCase_sanitizedMessage() {
        IllegalArgumentException ex = new IllegalArgumentException(
                "No enum constant com.comp3111.library.model.Role.BOGUS");
        ResponseEntity<ApiError> response = handler.handleValidation(ex);
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals(ErrorCode.VALIDATION_FAILED.name(), response.getBody().getCode());
        assertEquals("Invalid value provided", response.getBody().getMessage());
    }

    @Test
    void bindException_maps400ValidationFailed() {
        BindException ex = new BindException(new Object(), "target");
        ResponseEntity<ApiError> response = handler.handleValidation(ex);
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals(ErrorCode.VALIDATION_FAILED.name(), response.getBody().getCode());
    }

    @Test
    void missingServletRequestParameterException_maps400ValidationFailed() {
        MissingServletRequestParameterException ex =
                new MissingServletRequestParameterException("page", "Integer");
        ResponseEntity<ApiError> response = handler.handleValidation(ex);
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals(ErrorCode.VALIDATION_FAILED.name(), response.getBody().getCode());
    }

    @Test
    void methodArgumentTypeMismatchException_maps400ValidationFailed() {
        MethodParameter methodParameter = mock(MethodParameter.class);
        MethodArgumentTypeMismatchException ex =
                new MethodArgumentTypeMismatchException("abc", Long.class, "id", methodParameter, new NumberFormatException());
        ResponseEntity<ApiError> response = handler.handleValidation(ex);
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals(ErrorCode.VALIDATION_FAILED.name(), response.getBody().getCode());
    }

    @Test
    void accessDeniedException_usesExceptionMessageWhenPresent() {
        ResponseEntity<ApiError> response = handler.handleAccessDenied(
                new AccessDeniedException("This book is not available to you."));
        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        assertEquals(ErrorCode.FORBIDDEN.name(), response.getBody().getCode());
        assertEquals("This book is not available to you.", response.getBody().getMessage());
    }

    @Test
    void accessDeniedException_fallsBackWhenMessageBlank() {
        ResponseEntity<ApiError> response = handler.handleAccessDenied(new AccessDeniedException(""));
        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        assertEquals(ErrorCode.FORBIDDEN.name(), response.getBody().getCode());
        assertEquals("Access is denied", response.getBody().getMessage());
    }

    @Test
    void maxUploadSizeExceededException_maps400WithFriendlyMessage() {
        ResponseEntity<ApiError> response = handler.handleMaxUploadSize(new MaxUploadSizeExceededException(10L * 1024 * 1024));
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals(ErrorCode.VALIDATION_FAILED.name(), response.getBody().getCode());
        assertEquals("File exceeds the 10MB limit", response.getBody().getMessage());
    }

    @Test
    void catchAll_maps500InternalError_withRefNotOriginalMessage() {
        Exception ex = new RuntimeException("super secret internal detail: db password=hunter2");
        ResponseEntity<ApiError> response = handler.handleUnexpected(ex);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertEquals(ErrorCode.INTERNAL_ERROR.name(), response.getBody().getCode());
        assertTrue(response.getBody().getMessage().contains("ref:"));
        assertFalse(response.getBody().getMessage().contains("secret internal detail"));
        assertFalse(response.getBody().getMessage().contains("hunter2"));
    }
}
