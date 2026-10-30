package com.comp3111.library;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * One Postgres container and one Spring context shared by every integration test —
 * the property set is identical across subclasses so the context is cached and reused.
 * Accounts are always minted through the real register + login endpoints.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
abstract class LibraryIntegrationTestBase {

    protected static final String PASSWORD = "Str0ng!Pass1";

    private static final String RUN_ID = Long.toString(System.nanoTime(), 36);

    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16")
            .withDatabaseName("library_db")
            .withUsername("postgres")
            .withPassword("postgres");

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void libraryProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("library.jwt.secret", () -> "library-integration-test-signing-secret-of-at-least-32-bytes");
        registry.add("library.cors.allowed-origins", () -> "http://localhost:3000");
        registry.add("gemini.api.key", () -> "");
    }

    @Autowired
    protected TestRestTemplate rest;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void useBufferedRequests() {
        // HttpURLConnection refuses to read a 401 body when the request was streamed.
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setOutputStreaming(false);
        rest.getRestTemplate().setRequestFactory(requestFactory);
    }

    // --- account fixtures -------------------------------------------------

    /** Unique per test class so subclasses sharing the container never collide. */
    protected String username(String key) {
        return key + "-" + getClass().getSimpleName().toLowerCase(Locale.ROOT) + "-" + RUN_ID;
    }

    protected long register(String key, String role) {
        ResponseEntity<String> response = post("/api/auth/register", registration(username(key), role), null);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return json(response).get("userId").asLong();
    }

    protected String login(String path, String name) {
        ResponseEntity<String> response = post(path, credentials(name), null);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        return json(response).get("token").asText();
    }

    protected String registerAndLogin(String key, String role, String loginPath) {
        register(key, role);
        return login(loginPath, username(key));
    }

    protected Map<String, Object> registration(String name, String role) {
        Map<String, Object> body = new HashMap<>();
        body.put("username", name);
        body.put("email", name + "@library.local");
        body.put("password", PASSWORD);
        body.put("fullName", "Test " + name);
        body.put("role", role);
        return body;
    }

    protected Map<String, Object> credentials(String name) {
        Map<String, Object> body = new HashMap<>();
        body.put("username", name);
        body.put("password", PASSWORD);
        return body;
    }

    // --- HTTP helpers -----------------------------------------------------

    protected ResponseEntity<String> get(String path, String token) {
        return exchange(HttpMethod.GET, path, null, token);
    }

    /**
     * HEAD responses carry no body, and HttpURLConnection refuses to hand RestTemplate a
     * bodyless 4xx, so the status is read straight off the connection.
     */
    protected int headStatus(String path, String token) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(rest.getRootUri() + path).openConnection();
            connection.setRequestMethod("HEAD");
            if (token != null) {
                connection.setRequestProperty(HttpHeaders.AUTHORIZATION, "Bearer " + token);
            }
            return connection.getResponseCode();
        } catch (IOException e) {
            throw new AssertionError("HEAD " + path + " failed", e);
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    protected ResponseEntity<String> post(String path, Object body, String token) {
        return exchange(HttpMethod.POST, path, body, token);
    }

    protected ResponseEntity<String> put(String path, Object body, String token) {
        return exchange(HttpMethod.PUT, path, body, token);
    }

    protected ResponseEntity<String> delete(String path, String token) {
        return exchange(HttpMethod.DELETE, path, null, token);
    }

    protected ResponseEntity<String> exchange(HttpMethod method, String path, Object body, String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (token != null) {
            headers.setBearerAuth(token);
        }
        return rest.exchange(path, method, new HttpEntity<>(body, headers), String.class);
    }

    protected JsonNode json(ResponseEntity<String> response) {
        try {
            return objectMapper.readTree(response.getBody());
        } catch (Exception e) {
            throw new AssertionError("Expected a JSON body but got: " + response.getBody(), e);
        }
    }

    // --- envelope assertions ----------------------------------------------

    protected void assertUnauthenticatedEnvelope(ResponseEntity<String> response) {
        assertEnvelope(response, HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED");
    }

    protected void assertForbiddenEnvelope(ResponseEntity<String> response) {
        assertEnvelope(response, HttpStatus.FORBIDDEN, "FORBIDDEN");
    }

    protected void assertEnvelope(ResponseEntity<String> response, HttpStatus status, String code) {
        assertThat(response.getStatusCode()).isEqualTo(status);
        JsonNode body = json(response);
        assertThat(body.get("success").asBoolean()).isFalse();
        assertThat(body.get("code").asText()).isEqualTo(code);
        assertThat(body.get("message").asText()).isNotBlank();
        assertThat(body.get("timestamp").asText()).isNotBlank();
    }
}
