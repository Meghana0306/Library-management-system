package com.comp3111.library.controller;

import com.comp3111.library.model.Book;
import com.comp3111.library.security.LibraryPrincipal;
import com.comp3111.library.security.OwnershipGuard;
import com.comp3111.library.service.BookSubmissionService;
import com.comp3111.library.service.FileStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The author submission endpoint is reachable by anything holding an AUTHOR token, not just
 * the browser form, so it has to apply the same content rules server-side.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BookSubmissionValidationTest {

    private static final Long AUTHOR_ID = 7L;
    private static final String VALID_DESCRIPTION =
            "A description that is comfortably longer than the fifty character minimum imposed by the API.";
    private static final LibraryPrincipal AUTHOR = new LibraryPrincipal(AUTHOR_ID, "a", "AUTHOR");

    @Mock private FileStorageService fileStorageService;
    @Mock private BookSubmissionService bookSubmissionService;
    @Mock private OwnershipGuard ownershipGuard;

    @InjectMocks private BookController controller;

    private MultipartFile pdf;

    @BeforeEach
    void setUp() {
        pdf = new MockMultipartFile("file", "book.pdf", "application/pdf",
                "%PDF-1.4 fake".getBytes(StandardCharsets.UTF_8));
        when(fileStorageService.validateFile(any())).thenReturn(true);
        when(fileStorageService.validateCoverImage(any())).thenReturn(true);
        when(bookSubmissionService.submitBook(anyLong(), anyString(), anyList(), anyString(), any(), any()))
                .thenAnswer(inv -> {
                    Book saved = new Book();
                    saved.setId(1L);
                    return saved;
                });
    }

    private void submit(String title, List<String> genres, String description) throws IOException {
        controller.submitBook(AUTHOR_ID, title, genres, description, pdf, null, AUTHOR);
    }

    private String rejectionFor(String title, List<String> genres, String description) {
        return assertThrows(IllegalArgumentException.class,
                () -> submit(title, genres, description)).getMessage();
    }

    @Test
    void acceptsAWellFormedSubmission() throws IOException {
        submit("A Real Book", List.of("Fiction"), VALID_DESCRIPTION);
        verify(bookSubmissionService).submitBook(anyLong(), anyString(), anyList(), anyString(), any(), any());
    }

    @Test
    void rejectsAShortDescription() {
        assertEquals("Description must be at least 50 characters",
                rejectionFor("A Real Book", List.of("Fiction"), "Too short."));
        verify(bookSubmissionService, never()).submitBook(anyLong(), anyString(), anyList(), anyString(), any(), any());
    }

    @Test
    void rejectsABlankTitle() {
        assertEquals("Title is required", rejectionFor("   ", List.of("Fiction"), VALID_DESCRIPTION));
    }

    @Test
    void rejectsAnOverlongTitle() {
        assertEquals("Title must not exceed 255 characters",
                rejectionFor("x".repeat(256), List.of("Fiction"), VALID_DESCRIPTION));
    }

    @Test
    void rejectsMissingGenres() {
        assertEquals("Select at least one genre", rejectionFor("A Real Book", List.of(), VALID_DESCRIPTION));
        assertEquals("Select at least one genre", rejectionFor("A Real Book", null, VALID_DESCRIPTION));
    }

    @Test
    void rejectsAnOverlongDescription() {
        assertEquals("Description must not exceed 5000 characters",
                rejectionFor("A Real Book", List.of("Fiction"), "x".repeat(5001)));
    }

    @Test
    void rejectsAnInvalidFile() {
        when(fileStorageService.validateFile(any())).thenReturn(false);
        assertEquals("Invalid book file. Check size, type, and extension.",
                rejectionFor("A Real Book", List.of("Fiction"), VALID_DESCRIPTION));
    }

    @Test
    void rejectsAnInvalidCoverImage() {
        when(fileStorageService.validateCoverImage(any())).thenReturn(false);
        assertEquals("Invalid cover image. Upload JPG/PNG and keep size within 5MB.",
                rejectionFor("A Real Book", List.of("Fiction"), VALID_DESCRIPTION));
    }
}
