package com.comp3111.library.security;

import com.comp3111.library.exception.ApiError;
import com.comp3111.library.exception.ErrorCode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * 403 responses raised by the security layer never reach @ControllerAdvice, so the
 * shared error envelope is written here.
 */
@Component
public class ApiErrorAccessDeniedHandler implements AccessDeniedHandler {

    private static final String DEFAULT_MESSAGE = "You do not have permission to access this resource.";

    private final ObjectMapper objectMapper;

    public ApiErrorAccessDeniedHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
                       AccessDeniedException accessDeniedException) throws IOException {
        String message = accessDeniedException.getMessage();
        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        objectMapper.writeValue(response.getOutputStream(),
                ApiError.of(ErrorCode.FORBIDDEN, message == null || message.isBlank() ? DEFAULT_MESSAGE : message));
    }
}
