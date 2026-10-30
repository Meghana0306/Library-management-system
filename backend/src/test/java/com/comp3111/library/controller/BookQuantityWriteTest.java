package com.comp3111.library.controller;

import com.comp3111.library.model.Book;
import com.comp3111.library.repository.BookChangeLogRepository;
import com.comp3111.library.repository.BookRepository;
import com.comp3111.library.security.LibraryPrincipal;
import com.comp3111.library.security.OwnershipGuard;
import com.comp3111.library.service.FileStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * A librarian metadata edit must never move stock: saving the entity rewrites every column,
 * so a quantity read at the start of the request would undo a borrow that decremented it
 * in the meantime.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BookQuantityWriteTest {

    private static final Long BOOK_ID = 42L;
    private static final String VALID_DESCRIPTION =
            "A description that is comfortably longer than the fifty character minimum imposed by the API.";

    @Mock private BookRepository bookRepository;
    @Mock private BookChangeLogRepository bookChangeLogRepository;
    @Mock private FileStorageService fileStorageService;
    @Mock private OwnershipGuard ownershipGuard;

    @InjectMocks private BookController controller;

    private Book stored;

    @BeforeEach
    void setUp() {
        stored = new Book();
        stored.setId(BOOK_ID);
        stored.setTitle("Old title");
        stored.setStatus(Book.BookStatus.APPROVED);
        stored.setAuthorId(7L);
        stored.setSubmittedDate(LocalDateTime.now());
        stored.setFilePath("db://book/" + BOOK_ID);
        // Loaded when the request began: 5 copies on the shelf.
        stored.setQuantity(5);

        when(ownershipGuard.actingUserId(any())).thenReturn(1L);
        when(bookRepository.findById(BOOK_ID)).thenReturn(Optional.of(stored));
        when(bookRepository.save(any(Book.class))).thenAnswer(inv -> inv.getArgument(0));
        when(fileStorageService.validateCoverImage(any())).thenReturn(true);
    }

    private void update(Integer quantity) throws IOException {
        controller.updateBookByLibrarian(
                BOOK_ID, "New title", List.of("Fiction"), VALID_DESCRIPTION,
                quantity, null, null, null,
                new LibraryPrincipal(1L, "lib", "LIBRARIAN"));
    }

    @Test
    void editWithoutQuantityAdoptsTheLiveStockInsteadOfTheStaleOne() throws IOException {
        // A concurrent borrow committed 5 -> 4 after the entity was loaded.
        when(bookRepository.findQuantityById(BOOK_ID)).thenReturn(Optional.of(4));

        update(null);

        assertEquals(4, stored.getQuantity(), "the save must not write back the stale quantity");
        verify(bookRepository, never()).setQuantityAbsolute(anyLong(), anyInt());
    }

    @Test
    void editWithoutQuantityLeavesStockAloneWhenNothingChanged() throws IOException {
        when(bookRepository.findQuantityById(BOOK_ID)).thenReturn(Optional.of(5));

        update(null);

        assertEquals(5, stored.getQuantity());
        verify(bookRepository, never()).setQuantityAbsolute(anyLong(), anyInt());
    }

    @Test
    void explicitQuantityIsWrittenThroughATargetedColumnUpdate() throws IOException {
        when(bookRepository.findQuantityById(BOOK_ID)).thenReturn(Optional.of(4));

        update(9);

        verify(bookRepository).setQuantityAbsolute(BOOK_ID, 9);
        assertEquals(9, stored.getQuantity(), "the response should report the value that was set");
    }

    @Test
    void zeroIsAcceptedSoATitleCanBeMarkedOutOfStock() throws IOException {
        when(bookRepository.findQuantityById(BOOK_ID)).thenReturn(Optional.of(4));

        update(0);

        verify(bookRepository).setQuantityAbsolute(BOOK_ID, 0);
        assertEquals(0, stored.getQuantity());
    }

    @Test
    void negativeStockIsClampedToZero() throws IOException {
        when(bookRepository.findQuantityById(BOOK_ID)).thenReturn(Optional.of(4));

        update(-3);

        verify(bookRepository).setQuantityAbsolute(eq(BOOK_ID), eq(0));
    }

    @Test
    void bulkEditWithoutQuantityDoesNotTouchStock() {
        when(bookRepository.findAllById(any())).thenReturn(List.of(stored));
        when(bookRepository.findQuantityById(BOOK_ID)).thenReturn(Optional.of(4));

        controller.bulkUpdateBooks(
                Map.of("bookIds", List.of(BOOK_ID), "status", "APPROVED"),
                new LibraryPrincipal(1L, "lib", "LIBRARIAN"));

        assertEquals(4, stored.getQuantity());
        verify(bookRepository, never()).setQuantityAbsoluteForIds(anyList(), anyInt());
        verify(bookRepository, never()).setQuantityAbsolute(anyLong(), anyInt());
    }

    @Test
    void bulkEditWithQuantityWritesOneStatementForTheWholeBatch() {
        Book other = new Book();
        other.setId(43L);
        other.setTitle("Second");
        other.setStatus(Book.BookStatus.APPROVED);
        other.setQuantity(2);
        when(bookRepository.findAllById(any())).thenReturn(List.of(stored, other));
        when(bookRepository.findQuantityById(anyLong())).thenReturn(Optional.of(4));

        controller.bulkUpdateBooks(
                Map.of("bookIds", List.of(BOOK_ID, 43L), "quantity", 12),
                new LibraryPrincipal(1L, "lib", "LIBRARIAN"));

        // One batched statement, not one per book — a per-book call clears the
        // persistence context and forces the next save into a full merge.
        verify(bookRepository).setQuantityAbsoluteForIds(List.of(BOOK_ID, 43L), 12);
        verify(bookRepository, never()).setQuantityAbsolute(anyLong(), anyInt());
        assertEquals(12, stored.getQuantity());
        assertEquals(12, other.getQuantity());
    }

    @Test
    void bulkEditSkipsTheStockStatementWhenNoBookMatched() {
        when(bookRepository.findAllById(any())).thenReturn(List.of());

        controller.bulkUpdateBooks(
                Map.of("bookIds", List.of(BOOK_ID), "quantity", 12),
                new LibraryPrincipal(1L, "lib", "LIBRARIAN"));

        verify(bookRepository, never()).setQuantityAbsoluteForIds(anyList(), anyInt());
    }

    @Test
    void bulkEditAcceptsZeroStock() {
        when(bookRepository.findAllById(any())).thenReturn(List.of(stored));
        when(bookRepository.findQuantityById(BOOK_ID)).thenReturn(Optional.of(4));

        controller.bulkUpdateBooks(
                Map.of("bookIds", List.of(BOOK_ID), "quantity", 0),
                new LibraryPrincipal(1L, "lib", "LIBRARIAN"));

        verify(bookRepository).setQuantityAbsoluteForIds(List.of(BOOK_ID), 0);
    }
}
