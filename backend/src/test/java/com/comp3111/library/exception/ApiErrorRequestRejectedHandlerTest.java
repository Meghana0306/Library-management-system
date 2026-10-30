package com.comp3111.library.exception;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.web.firewall.RequestRejectedException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ApiErrorRequestRejectedHandlerTest {

    private final ApiErrorRequestRejectedHandler handler = new ApiErrorRequestRejectedHandler();

    @Test
    void handle_writes400ValidationFailedEnvelope() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/books/pending;x=1");
        MockHttpServletResponse response = new MockHttpServletResponse();

        handler.handle(request, response,
                new RequestRejectedException("The request was rejected because the URL contained a potentially malicious String"));

        assertEquals(400, response.getStatus());
        assertTrue(response.getContentType().contains("application/json"));

        String body = response.getContentAsString();
        assertTrue(body.contains("\"success\":false"));
        assertTrue(body.contains("\"code\":\"VALIDATION_FAILED\""));
        assertTrue(body.contains("Malformed request path"));
    }
}
