package com.comp3111.library;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Executable form of the CONTRACTS §1 authorization matrix.
 */
class SecurityMatrixIT extends LibraryIntegrationTestBase {

    @Autowired
    private CorsConfigurationSource corsConfigurationSource;

    private static boolean seeded;
    private static long studentAId;
    private static long studentBId;
    private static long authorId;
    private static String studentAToken;
    private static String authorToken;
    private static String librarianToken;

    @BeforeEach
    void seedAccounts() {
        if (seeded) {
            return;
        }
        studentAId = register("student-a", "STUDENT");
        studentBId = register("student-b", "STUDENT");
        authorId = register("author-a", "AUTHOR");
        register("librarian-a", "LIBRARIAN");

        studentAToken = login("/api/auth/login", username("student-a"));
        authorToken = login("/api/auth/login/author", username("author-a"));
        librarianToken = login("/api/auth/login/librarian", username("librarian-a"));
        seeded = true;
    }

    // --- public endpoints -------------------------------------------------

    @Test
    void registerIsPublic() {
        ResponseEntity<String> response = post("/api/auth/register", registration(username("public-register"), "STUDENT"), null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(json(response).get("success").asBoolean()).isTrue();
    }

    @Test
    void studentLoginIsPublic() {
        ResponseEntity<String> response = post("/api/auth/login", credentials(username("student-a")), null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(json(response).get("token").asText()).isNotBlank();
    }

    @Test
    void librarianLoginIsPublic() {
        ResponseEntity<String> response = post("/api/auth/login/librarian", credentials(username("librarian-a")), null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(json(response).get("role").asText()).isEqualTo("LIBRARIAN");
    }

    @Test
    void authorLoginIsPublic() {
        ResponseEntity<String> response = post("/api/auth/login/author", credentials(username("author-a")), null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(json(response).get("role").asText()).isEqualTo("AUTHOR");
    }

    @Test
    void badCredentialsAreRejectedWithTheSharedEnvelope() {
        Map<String, Object> body = credentials(username("student-a"));
        body.put("password", "Wr0ng!Pass1");

        ResponseEntity<String> response = post("/api/auth/login", body, null);

        assertUnauthenticatedEnvelope(response);
        assertThat(json(response).get("message").asText()).isEqualTo("Invalid credentials");
    }

    @Test
    void systemEndpointsArePublic() {
        assertThat(get("/api/system/health", null).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(get("/api/system/ai-status", null).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void openApiDocsArePublic() {
        ResponseEntity<String> response = get("/v3/api-docs", null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void swaggerUiIsPublic() {
        ResponseEntity<String> response = get("/swagger-ui/index.html", null);

        assertThat(response.getStatusCode()).isNotIn(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN);
    }

    // --- unauthenticated access ------------------------------------------

    @Test
    void unauthenticatedRequestToProtectedEndpointReturns401Envelope() {
        assertUnauthenticatedEnvelope(get("/api/books", null));
    }

    @Test
    void unauthenticatedRequestToLibrarianEndpointReturns401NotForbidden() {
        assertUnauthenticatedEnvelope(get("/api/librarian/users", null));
    }

    @Test
    void malformedBearerTokenIsTreatedAsUnauthenticated() {
        assertUnauthenticatedEnvelope(get("/api/books", "not-a-real-jwt"));
    }

    // --- role matrix ------------------------------------------------------

    @Test
    void anyAuthenticatedUserCanReadTheBookCatalogue() {
        assertThat(get("/api/books", studentAToken).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(get("/api/books", authorToken).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(get("/api/books", librarianToken).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void studentOnLibrarianEndpointReturns403Envelope() {
        assertForbiddenEnvelope(get("/api/librarian/users", studentAToken));
    }

    @Test
    void librarianOnLibrarianEndpointReturns200() {
        assertThat(get("/api/librarian/users", librarianToken).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void studentOnAuthorOnlyEndpointReturns403Envelope() {
        assertForbiddenEnvelope(get("/api/books/author/" + authorId, studentAToken));
    }

    @Test
    void authorOnAuthorOnlyEndpointIsAllowed() {
        assertThat(get("/api/books/author/" + authorId, authorToken).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void authorOnStudentOnlyEndpointReturns403Envelope() {
        assertForbiddenEnvelope(get("/api/borrowing-records/user/" + authorId, authorToken));
    }

    @Test
    void studentOnOwnBorrowingRecordsIsAllowed() {
        assertThat(get("/api/borrowing-records/user/" + studentAId, studentAToken).getStatusCode())
                .isEqualTo(HttpStatus.OK);
    }

    @Test
    void allBorrowingRecordsAreLibrarianOnly() {
        assertForbiddenEnvelope(get("/api/borrowing-records", studentAToken));
        assertThat(get("/api/borrowing-records", librarianToken).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void pendingBooksAreLibrarianOnly() {
        assertForbiddenEnvelope(get("/api/books/pending", authorToken));
        assertThat(get("/api/books/pending", librarianToken).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    // --- HEAD is served by the GET handler, so it must carry the same rule --

    @Test
    void headDoesNotBypassLibrarianOnlyReads() {
        assertThat(headStatus("/api/books/pending", studentAToken)).isEqualTo(403);
        assertThat(headStatus("/api/borrowing-records", studentAToken)).isEqualTo(403);
        assertThat(headStatus("/api/book-requests", studentAToken)).isEqualTo(403);
    }

    @Test
    void headDoesNotBypassAuthorOnlyReads() {
        assertThat(headStatus("/api/books/author/" + authorId, studentAToken)).isEqualTo(403);
    }

    @Test
    void headStillRequiresAuthentication() {
        assertThat(headStatus("/api/books/pending", null)).isEqualTo(401);
        assertThat(headStatus("/api/borrowing-records", null)).isEqualTo(401);
        assertThat(headStatus("/api/book-requests", null)).isEqualTo(401);
        assertThat(headStatus("/api/books", null)).isEqualTo(401);
    }

    @Test
    void headOnPublicAndPermittedEndpointsWorks() {
        assertThat(headStatus("/api/system/health", null)).isEqualTo(200);
        assertThat(headStatus("/api/system/ai-status", null)).isEqualTo(200);
        assertThat(headStatus("/api/books/pending", librarianToken)).isEqualTo(200);
    }

    // --- trailing-slash bypass -------------------------------------------

    @Test
    void trailingSlashDoesNotBypassLibrarianOnlyReads() {
        assertForbiddenEnvelope(get("/api/books/pending/", studentAToken));
        assertForbiddenEnvelope(get("/api/borrowing-records/", studentAToken));
        assertForbiddenEnvelope(get("/api/book-requests/", studentAToken));
    }

    @Test
    void trailingSlashDoesNotBypassLibrarianOnlyWrites() {
        assertForbiddenEnvelope(post("/api/books/approve/", Map.of("bookId", 1), studentAToken));
    }

    @Test
    void trailingSlashDoesNotBypassAuthorOnlyWrites() {
        assertForbiddenEnvelope(post("/api/books/submit/", Map.of("title", "x"), studentAToken));
    }

    @Test
    void trailingSlashStillRequiresAuthentication() {
        assertUnauthenticatedEnvelope(get("/api/books/pending/", null));
        assertUnauthenticatedEnvelope(get("/api/borrowing-records/", null));
        assertUnauthenticatedEnvelope(post("/api/books/approve/", Map.of("bookId", 1), null));
    }

    @Test
    void trailingSlashIsNotServedByTheExactHandler() {
        assertThat(get("/api/books/pending/", librarianToken).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(get("/api/borrowing-records/", librarianToken).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    // --- live account state ----------------------------------------------

    @Test
    void deactivatingAUserInvalidatesTokensAlreadyIssued() {
        long userId = register("to-deactivate", "STUDENT");
        String token = login("/api/auth/login", username("to-deactivate"));
        assertThat(get("/api/books", token).getStatusCode()).isEqualTo(HttpStatus.OK);

        ResponseEntity<String> deactivated =
                post("/api/librarian/users/" + userId + "/deactivate", null, librarianToken);
        assertThat(deactivated.getStatusCode()).isEqualTo(HttpStatus.OK);

        assertUnauthenticatedEnvelope(get("/api/books", token));
    }

    @Test
    void deactivatedUserCannotLogInAgain() {
        long userId = register("to-deactivate-login", "STUDENT");
        post("/api/librarian/users/" + userId + "/deactivate", null, librarianToken);

        ResponseEntity<String> response = post("/api/auth/login", credentials(username("to-deactivate-login")), null);

        assertEnvelope(response, HttpStatus.FORBIDDEN, "FORBIDDEN");
    }

    @Test
    void roleChangeTakesEffectWithoutReissuingTheToken() {
        long userId = register("to-promote", "STUDENT");
        String token = login("/api/auth/login", username("to-promote"));
        assertForbiddenEnvelope(get("/api/librarian/users", token));

        Map<String, Object> promotion = new HashMap<>();
        promotion.put("fullName", "Promoted User");
        promotion.put("email", username("to-promote") + "@library.local");
        promotion.put("role", "LIBRARIAN");
        ResponseEntity<String> promoted = put("/api/librarian/users/" + userId, promotion, librarianToken);
        assertThat(promoted.getStatusCode()).isEqualTo(HttpStatus.OK);

        // Same token, no re-login: authorities come from the database, not the claim.
        assertThat(get("/api/librarian/users", token).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    // --- registration posture --------------------------------------------

    @Test
    void librarianRegistrationIsIntentionallyOpen() {
        String name = username("open-librarian");

        ResponseEntity<String> registered = post("/api/auth/register", registration(name, "LIBRARIAN"), null);
        assertThat(registered.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        ResponseEntity<String> loggedIn = post("/api/auth/login/librarian", credentials(name), null);
        assertThat(loggedIn.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(json(loggedIn).get("role").asText()).isEqualTo("LIBRARIAN");
    }

    @Test
    void unknownRoleIsRejected() {
        String name = username("admin-wannabe");

        ResponseEntity<String> registered = post("/api/auth/register", registration(name, "ADMIN"), null);
        assertEnvelope(registered, HttpStatus.BAD_REQUEST, "VALIDATION_FAILED");

        ResponseEntity<String> loggedIn = post("/api/auth/login", credentials(name), null);
        assertThat(loggedIn.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void duplicateUsernameIsAConflictEnvelope() {
        ResponseEntity<String> response =
                post("/api/auth/register", registration(username("student-a"), "STUDENT"), null);

        assertEnvelope(response, HttpStatus.CONFLICT, "CONFLICT");
    }

    @Test
    void roleIsNormalizedToUpperCase() {
        String name = username("lowercase-author");

        ResponseEntity<String> registered = post("/api/auth/register", registration(name, "  author "), null);
        assertThat(registered.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        ResponseEntity<String> loggedIn = post("/api/auth/login/author", credentials(name), null);
        assertThat(loggedIn.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(json(loggedIn).get("role").asText()).isEqualTo("AUTHOR");
    }

    // --- profile ownership ------------------------------------------------

    @Test
    void studentCanReadOwnProfile() {
        ResponseEntity<String> response = get("/api/auth/profile/student/" + studentAId, studentAToken);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(json(response).get("userId").asLong()).isEqualTo(studentAId);
    }

    @Test
    void studentCannotReadAnotherStudentsProfile() {
        assertForbiddenEnvelope(get("/api/auth/profile/student/" + studentBId, studentAToken));
    }

    @Test
    void studentCannotUpdateAnotherStudentsProfile() {
        Map<String, Object> body = new HashMap<>();
        body.put("fullName", "Hijacked Name");
        body.put("currentPassword", PASSWORD);

        assertForbiddenEnvelope(put("/api/auth/profile/student/" + studentBId, body, studentAToken));
    }

    @Test
    void librarianCanReadAnyStudentProfile() {
        ResponseEntity<String> response = get("/api/auth/profile/student/" + studentBId, librarianToken);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(json(response).get("userId").asLong()).isEqualTo(studentBId);
    }

    @Test
    void profileEndpointsRequireAuthentication() {
        assertUnauthenticatedEnvelope(get("/api/auth/profile/student/" + studentAId, null));
    }

    // --- CORS -------------------------------------------------------------

    @Test
    void corsPreflightIsNotBlockedByTheSecurityLayer() {
        ResponseEntity<String> response = rest.exchange("/api/books", HttpMethod.OPTIONS,
                new HttpEntity<>(new HttpHeaders()), String.class);

        assertThat(response.getStatusCode()).isNotIn(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN);
    }

    @Test
    void corsIsConfiguredForTheFrontendOrigin() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/books");
        request.addHeader(HttpHeaders.ORIGIN, "http://localhost:3000");

        CorsConfiguration configuration = corsConfigurationSource.getCorsConfiguration(request);

        assertThat(configuration).isNotNull();
        assertThat(configuration.getAllowedOrigins()).containsExactly("http://localhost:3000");
        assertThat(configuration.getAllowedMethods())
                .containsExactlyInAnyOrder("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH");
        assertThat(configuration.getAllowedHeaders()).contains("Authorization", "Content-Type");
    }
}
