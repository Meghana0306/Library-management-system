package com.comp3111.library.service;

import com.comp3111.library.exception.AiDisabledException;
import com.comp3111.library.exception.AiUnavailableException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GeminiServiceTest {

    @Mock
    private RestTemplate restTemplate;

    private GeminiService geminiService;

    @BeforeEach
    void setUp() {
        geminiService = new GeminiService(restTemplate);
        ReflectionTestUtils.setField(geminiService, "model", "gemini-1.5-flash");
    }

    private void setApiKey(String key) {
        ReflectionTestUtils.setField(geminiService, "apiKey", key);
    }

    @SuppressWarnings("unchecked")
    private ResponseEntity<Map> validTextResponse(String text) {
        Map<String, Object> part = new HashMap<>();
        part.put("text", text);
        Map<String, Object> content = new HashMap<>();
        content.put("parts", List.of(part));
        Map<String, Object> candidate = new HashMap<>();
        candidate.put("content", content);
        Map<String, Object> body = new HashMap<>();
        body.put("candidates", List.of(candidate));
        return new ResponseEntity<>(body, org.springframework.http.HttpStatus.OK);
    }

    @Test
    void isEnabled_falseWhenKeyBlank() {
        setApiKey("");
        assertFalse(geminiService.isEnabled());

        setApiKey(null);
        assertFalse(geminiService.isEnabled());
    }

    @Test
    void isEnabled_trueWhenKeyPresent() {
        setApiKey("test-key");
        assertTrue(geminiService.isEnabled());
    }

    @Test
    void generateBookSummary_disabledKey_throwsAiDisabled() {
        setApiKey("");
        assertThrows(AiDisabledException.class,
                () -> geminiService.generateBookSummary("Title", List.of("Fiction"), "medium"));
    }

    @Test
    void analyzeSentimentBatch_disabledKey_throwsAiDisabled() {
        setApiKey(null);
        List<Map<String, Object>> reviews = List.of(Map.of("id", 1L, "rating", 5));
        assertThrows(AiDisabledException.class, () -> geminiService.analyzeSentimentBatch(reviews));
    }

    @Test
    @SuppressWarnings("unchecked")
    void analyzeSentimentBatch_capsAt50() {
        setApiKey("test-key");
        List<Map<String, Object>> reviews = new ArrayList<>();
        for (int i = 1; i <= 60; i++) {
            Map<String, Object> r = new HashMap<>();
            r.put("id", (long) i);
            r.put("rating", 5);
            r.put("text", "great");
            reviews.add(r);
        }

        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(validTextResponse("[]"));

        geminiService.analyzeSentimentBatch(reviews);

        ArgumentCaptor<HttpEntity> entityCaptor = ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate).exchange(anyString(), eq(HttpMethod.POST), entityCaptor.capture(), eq(Map.class));

        Map<String, Object> requestBody = (Map<String, Object>) entityCaptor.getValue().getBody();
        List<Map<String, Object>> contents = (List<Map<String, Object>>) requestBody.get("contents");
        List<Map<String, Object>> parts = (List<Map<String, Object>>) contents.get(0).get("parts");
        String promptText = (String) parts.get(0).get("text");

        int occurrences = promptText.split("★", -1).length - 1;
        assertEquals(50, occurrences);
    }

    @Test
    @SuppressWarnings("unchecked")
    void generateBookSummary_requestHasNoKeyInUrlAndHeaderHasKey() {
        setApiKey("super-secret-key");
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(validTextResponse("A great book."));

        geminiService.generateBookSummary("Title", List.of("Fiction"), "medium");

        ArgumentCaptor<String> urlCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<HttpEntity> entityCaptor = ArgumentCaptor.forClass(HttpEntity.class);
        verify(restTemplate).exchange(urlCaptor.capture(), eq(HttpMethod.POST), entityCaptor.capture(), eq(Map.class));

        assertFalse(urlCaptor.getValue().contains("super-secret-key"));
        assertFalse(urlCaptor.getValue().contains("key="));

        HttpHeaders headers = entityCaptor.getValue().getHeaders();
        assertEquals("super-secret-key", headers.getFirst("x-goog-api-key"));
    }

    @Test
    void generateBookSummary_restClientException_wrappedAsAiUnavailable() {
        setApiKey("test-key");
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class)))
                .thenThrow(new RestClientException("connection refused to https://generativelanguage.googleapis.com"));

        assertThrows(AiUnavailableException.class,
                () -> geminiService.generateBookSummary("Title", List.of("Fiction"), "medium"));
    }
}
