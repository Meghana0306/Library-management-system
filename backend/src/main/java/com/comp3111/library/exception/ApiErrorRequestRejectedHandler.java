package com.comp3111.library.exception;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.MediaType;
import org.springframework.security.web.firewall.RequestRejectedException;
import org.springframework.security.web.firewall.RequestRejectedHandler;
import org.springframework.stereotype.Component;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.logging.Logger;

/**
 * StrictHttpFirewall rejects malformed request paths (e.g. matrix params like ";x=1") inside
 * FilterChainProxy, before the DispatcherServlet — so @ExceptionHandler methods in
 * GlobalExceptionHandler never see them. This bean is auto-detected by Spring Security's
 * WebSecurityConfiguration and wired into FilterChainProxy so the same ApiError envelope is
 * returned instead of the Boot default error page with a stack trace.
 */
@Component
public class ApiErrorRequestRejectedHandler implements RequestRejectedHandler {

    private static final Logger logger = Logger.getLogger(ApiErrorRequestRejectedHandler.class.getName());
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
                        RequestRejectedException requestRejectedException) throws IOException {
        logger.warning("Rejected request " + request.getMethod() + " " + request.getRequestURI()
                + ": " + requestRejectedException.getMessage());

        response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write(objectMapper.writeValueAsString(
                ApiError.of(ErrorCode.VALIDATION_FAILED, "Malformed request path")));
    }
}
