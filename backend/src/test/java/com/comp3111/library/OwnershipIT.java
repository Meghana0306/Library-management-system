package com.comp3111.library;

import com.comp3111.library.model.Book;
import com.comp3111.library.model.StudentNotification;
import com.comp3111.library.repository.BookRepository;
import com.comp3111.library.repository.StudentNotificationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * CONTRACTS §3 resource-id ownership: loading the resource and comparing its owner to
 * the JWT claim. Records, reviews and borrowings are created through the real endpoints;
 * only the book row and the notification (which no endpoint creates directly) are seeded.
 */
class OwnershipIT extends LibraryIntegrationTestBase {

    @Autowired
    private BookRepository bookRepository;

    @Autowired
    private StudentNotificationRepository notificationRepository;

    private static boolean seeded;
    private static String studentAToken;
    private static String studentBToken;
    private static String librarianToken;
    private static long studentBId;
    private static long recordOfB;
    private static long reviewOfB;
    private static long notificationOfB;

    @BeforeEach
    void seedOwnedResources() {
        if (seeded) {
            return;
        }
        long authorId = register("own-author", "AUTHOR");
        register("own-student-a", "STUDENT");
        studentBId = register("own-student-b", "STUDENT");
        register("own-librarian", "LIBRARIAN");

        studentAToken = login("/api/auth/login", username("own-student-a"));
        studentBToken = login("/api/auth/login", username("own-student-b"));
        librarianToken = login("/api/auth/login/librarian", username("own-librarian"));

        long bookId = storeApprovedBook(authorId);

        // B borrows the book, then reviews it — both through the real endpoints.
        ResponseEntity<String> borrowed = post("/api/borrow", Map.of("bookId", bookId), studentBToken);
        assertThat(borrowed.getStatusCode()).isEqualTo(HttpStatus.OK);
        recordOfB = json(borrowed).get("recordId").asLong();

        Map<String, Object> review = new HashMap<>();
        review.put("bookId", bookId);
        review.put("rating", 4);
        review.put("reviewText", "Solid read.");
        ResponseEntity<String> reviewed = post("/api/reviews", review, studentBToken);
        assertThat(reviewed.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        reviewOfB = json(reviewed).get("reviewId").asLong();

        notificationOfB = storeNotification(studentBId);
        seeded = true;
    }

    private long storeApprovedBook(Long authorId) {
        Book book = new Book();
        book.setTitle("Ownership Fixture");
        book.setStatus(Book.BookStatus.APPROVED);
        book.setSource(Book.BookSource.AUTHOR_SUBMISSION);
        book.setAuthorId(authorId);
        book.setQuantity(5);
        book.setSubmittedDate(LocalDateTime.now());
        return bookRepository.save(book).getId();
    }

    private long storeNotification(Long userId) {
        StudentNotification notification = new StudentNotification();
        notification.setUserId(userId);
        notification.setCategory("GENERAL");
        notification.setTitle("Fixture notification");
        notification.setMessage("Belongs to student B");
        notification.setPriority("LOW");
        notification.setCreatedAt(LocalDateTime.now());
        notification.setUpdatedAt(LocalDateTime.now());
        return notificationRepository.save(notification).getId();
    }

    // --- borrowing records ------------------------------------------------

    @Test
    void userCannotReturnSomeoneElsesBorrowingRecord() {
        assertForbiddenEnvelope(post("/api/return/" + recordOfB, null, studentAToken));
    }

    @Test
    void userCannotUpdateReadingProgressOnSomeoneElsesRecord() {
        assertForbiddenEnvelope(put("/api/reading-progress/" + recordOfB, Map.of("progress", 50), studentAToken));
    }

    @Test
    void ownerCanUpdateReadingProgressOnTheirOwnRecord() {
        ResponseEntity<String> response =
                put("/api/reading-progress/" + recordOfB, Map.of("progress", 25), studentBToken);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(json(response).get("readingProgress").asInt()).isEqualTo(25);
    }

    @Test
    void userCannotReadSomeoneElsesBorrowingHistory() {
        assertForbiddenEnvelope(get("/api/borrowing-records/user/" + studentBId, studentAToken));
    }

    // --- notifications ----------------------------------------------------

    @Test
    void userCannotDeleteSomeoneElsesNotification() {
        assertForbiddenEnvelope(delete("/api/notifications/" + notificationOfB, studentAToken));
    }

    @Test
    void userCannotMarkSomeoneElsesNotificationRead() {
        assertForbiddenEnvelope(put("/api/notifications/" + notificationOfB + "/read", null, studentAToken));
    }

    @Test
    void userCannotMarkAllNotificationsReadForAnotherUser() {
        assertForbiddenEnvelope(put("/api/notifications/user/" + studentBId + "/read-all", null, studentAToken));
    }

    @Test
    void ownerCanMarkTheirOwnNotificationRead() {
        assertThat(put("/api/notifications/" + notificationOfB + "/read", null, studentBToken).getStatusCode())
                .isEqualTo(HttpStatus.OK);
    }

    // --- reviews ----------------------------------------------------------

    @Test
    void userCannotUpdateSomeoneElsesReview() {
        assertForbiddenEnvelope(put("/api/reviews/" + reviewOfB, Map.of("rating", 1), studentAToken));
    }

    @Test
    void ownerCanUpdateTheirOwnReview() {
        assertThat(put("/api/reviews/" + reviewOfB, Map.of("rating", 5), studentBToken).getStatusCode())
                .isEqualTo(HttpStatus.OK);
    }

    @Test
    void userCannotReadSomeoneElsesReviewList() {
        assertForbiddenEnvelope(get("/api/reviews/user/" + studentBId, studentAToken));
    }

    // --- librarian bypass -------------------------------------------------

    @Test
    void librarianBypassesOwnershipOnPathReads() {
        assertThat(get("/api/auth/profile/student/" + studentBId, librarianToken).getStatusCode())
                .isEqualTo(HttpStatus.OK);
    }

    // --- derive-from-claim ------------------------------------------------

    @Test
    void borrowIgnoresAClientSuppliedUserId() {
        Book book = new Book();
        book.setTitle("Derive From Claim");
        book.setStatus(Book.BookStatus.APPROVED);
        book.setSource(Book.BookSource.AUTHOR_SUBMISSION);
        book.setAuthorId(studentBId);
        book.setQuantity(2);
        book.setSubmittedDate(LocalDateTime.now());
        long bookId = bookRepository.save(book).getId();

        Map<String, Object> body = new HashMap<>();
        body.put("bookId", bookId);
        body.put("userId", studentBId);

        ResponseEntity<String> borrowed = post("/api/borrow", body, studentAToken);
        assertThat(borrowed.getStatusCode()).isEqualTo(HttpStatus.OK);
        long recordId = json(borrowed).get("recordId").asLong();

        // The record belongs to A (the caller), not to the userId in the body.
        assertThat(put("/api/reading-progress/" + recordId, Map.of("progress", 10), studentAToken).getStatusCode())
                .isEqualTo(HttpStatus.OK);
        assertForbiddenEnvelope(put("/api/reading-progress/" + recordId, Map.of("progress", 10), studentBToken));
    }
}
