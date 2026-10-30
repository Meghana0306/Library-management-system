package com.comp3111.library;

import com.comp3111.library.model.Book;
import com.comp3111.library.repository.BookRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * CONTRACTS §2 book file / cover visibility, exercised through the real endpoints.
 * Books carry stored bytes, so they are seeded through the repository — the only
 * creation endpoints are multipart and role-gated.
 */
class FileAccessIT extends LibraryIntegrationTestBase {

    private static final byte[] FILE_BYTES = "%PDF-1.4 fake book body".getBytes(StandardCharsets.UTF_8);
    private static final byte[] COVER_BYTES = "fake-cover-bytes".getBytes(StandardCharsets.UTF_8);

    @Autowired
    private BookRepository bookRepository;

    private static boolean seeded;
    private static String studentToken;
    private static String ownerAuthorToken;
    private static String otherAuthorToken;
    private static String librarianToken;
    private static long pendingBookId;
    private static long approvedBookId;

    @BeforeEach
    void seedBooksAndAccounts() {
        if (seeded) {
            return;
        }
        long ownerAuthorId = register("file-author-owner", "AUTHOR");
        register("file-author-other", "AUTHOR");
        register("file-student", "STUDENT");
        register("file-librarian", "LIBRARIAN");

        ownerAuthorToken = login("/api/auth/login/author", username("file-author-owner"));
        otherAuthorToken = login("/api/auth/login/author", username("file-author-other"));
        studentToken = login("/api/auth/login", username("file-student"));
        librarianToken = login("/api/auth/login/librarian", username("file-librarian"));

        pendingBookId = storeBook("Pending Manuscript", Book.BookStatus.PENDING, ownerAuthorId);
        approvedBookId = storeBook("Approved Title", Book.BookStatus.APPROVED, ownerAuthorId);
        seeded = true;
    }

    private long storeBook(String title, Book.BookStatus status, Long authorId) {
        Book book = new Book();
        book.setTitle(title);
        book.setStatus(status);
        book.setSource(Book.BookSource.AUTHOR_SUBMISSION);
        book.setAuthorId(authorId);
        book.setQuantity(3);
        book.setSubmittedDate(LocalDateTime.now());
        book.setFileName(title.replace(' ', '-') + ".pdf");
        book.setFileType("application/pdf");
        book.setFileSize((long) FILE_BYTES.length);
        book.setFileData(FILE_BYTES);
        book.setCoverImageName("cover.jpg");
        book.setCoverImageType("image/jpeg");
        book.setCoverImageSize((long) COVER_BYTES.length);
        book.setCoverImageData(COVER_BYTES);
        return bookRepository.save(book).getId();
    }

    // --- pending books ----------------------------------------------------

    @Test
    void studentCannotPreviewAPendingBook() {
        assertForbiddenEnvelope(get("/api/files/preview/" + pendingBookId, studentToken));
    }

    @Test
    void owningAuthorCanPreviewTheirOwnPendingBook() {
        ResponseEntity<String> response = get("/api/files/preview/" + pendingBookId, ownerAuthorToken);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("private, max-age=3600");
        assertThat(response.getHeaders().getETag()).isNotBlank();
    }

    @Test
    void otherAuthorCannotPreviewSomeoneElsesPendingBook() {
        assertForbiddenEnvelope(get("/api/files/preview/" + pendingBookId, otherAuthorToken));
    }

    @Test
    void librarianCanPreviewAnyPendingBook() {
        assertThat(get("/api/files/preview/" + pendingBookId, librarianToken).getStatusCode())
                .isEqualTo(HttpStatus.OK);
    }

    // --- approved books ---------------------------------------------------

    @Test
    void studentCanPreviewAnApprovedBook() {
        assertThat(get("/api/files/preview/" + approvedBookId, studentToken).getStatusCode())
                .isEqualTo(HttpStatus.OK);
    }

    @Test
    void anyAuthorCanPreviewAnApprovedBook() {
        assertThat(get("/api/files/preview/" + approvedBookId, otherAuthorToken).getStatusCode())
                .isEqualTo(HttpStatus.OK);
    }

    // --- covers follow the same rule --------------------------------------

    @Test
    void coverOfAPendingBookIsHiddenFromStudents() {
        assertForbiddenEnvelope(get("/api/files/cover/" + pendingBookId, studentToken));
    }

    @Test
    void coverOfAPendingBookIsVisibleToItsAuthorAndLibrarians() {
        assertThat(get("/api/files/cover/" + pendingBookId, ownerAuthorToken).getStatusCode())
                .isEqualTo(HttpStatus.OK);
        assertThat(get("/api/files/cover/" + pendingBookId, librarianToken).getStatusCode())
                .isEqualTo(HttpStatus.OK);
    }

    @Test
    void coverOfAnApprovedBookIsVisibleToStudents() {
        assertThat(get("/api/files/cover/" + approvedBookId, studentToken).getStatusCode())
                .isEqualTo(HttpStatus.OK);
    }

    // --- download / stream by reference -----------------------------------

    @Test
    void downloadByReferenceFollowsTheSameRule() {
        assertForbiddenEnvelope(get("/api/files/download?filePath=db://book/" + pendingBookId, studentToken));
        assertThat(get("/api/files/download?filePath=db://book/" + approvedBookId, studentToken).getStatusCode())
                .isEqualTo(HttpStatus.OK);
    }

    @Test
    void streamByReferenceFollowsTheSameRule() {
        assertForbiddenEnvelope(get("/api/files/stream?filePath=db://book/" + pendingBookId, studentToken));
        assertThat(get("/api/files/stream?filePath=db://book/" + approvedBookId, studentToken).getStatusCode())
                .isEqualTo(HttpStatus.OK);
    }

    // --- authentication ---------------------------------------------------

    @Test
    void fileEndpointsRequireAuthentication() {
        assertUnauthenticatedEnvelope(get("/api/files/preview/" + approvedBookId, null));
        assertUnauthenticatedEnvelope(get("/api/files/cover/" + approvedBookId, null));
    }
}
