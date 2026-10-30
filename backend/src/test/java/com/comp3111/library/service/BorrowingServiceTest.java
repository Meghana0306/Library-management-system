package com.comp3111.library.service;

import com.comp3111.library.exception.ConflictException;
import com.comp3111.library.exception.NotFoundException;
import com.comp3111.library.model.Book;
import com.comp3111.library.model.BorrowingRecord;
import com.comp3111.library.model.StudentNotification;
import com.comp3111.library.model.User;
import com.comp3111.library.repository.BookRepository;
import com.comp3111.library.repository.BorrowingRecordRepository;
import com.comp3111.library.repository.StudentNotificationRepository;
import com.comp3111.library.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BorrowingServiceTest {

    private static final Long USER_ID = 7L;
    private static final Long BOOK_ID = 42L;
    private static final int DURATION_DAYS = 14;
    private static final long MIN_SELF_RETURN_SECONDS = 30;

    @Mock
    private BorrowingRecordRepository borrowingRecordRepository;

    @Mock
    private BookRepository bookRepository;

    @Mock
    private StudentNotificationRepository studentNotificationRepository;

    @Mock
    private UserRepository userRepository;

    private BorrowingService service;

    @BeforeEach
    void setUp() {
        service = new BorrowingService(borrowingRecordRepository, bookRepository,
                studentNotificationRepository, userRepository, DURATION_DAYS, MIN_SELF_RETURN_SECONDS);
    }

    // ---------- auto-return date boundary ----------

    @Test
    @DisplayName("auto-return: a borrowing due yesterday is returned and the book quantity is restored")
    void autoReturnsBorrowingDueInThePast() {
        BorrowingRecord expired = record(1L, LocalDateTime.now().minusDays(20), LocalDateTime.now().minusDays(1));
        when(borrowingRecordRepository.findByUserIdAndStatusOrderByBorrowedDateDesc(USER_ID, "BORROWED"))
                .thenReturn(Collections.singletonList(expired));
        when(borrowingRecordRepository.markReturnedIfBorrowed(eq(1L), any(LocalDateTime.class))).thenReturn(1);

        List<BorrowingRecord> autoReturned = service.autoReturnExpiredBorrowings(USER_ID);

        assertEquals(1, autoReturned.size());
        assertSame(expired, autoReturned.get(0));
        assertEquals("RETURNED", expired.getStatus());
        verify(bookRepository).incrementQuantity(BOOK_ID);
        verify(studentNotificationRepository).save(any());
    }

    @Test
    @DisplayName("auto-return: a borrowing due tomorrow is left alone")
    void doesNotAutoReturnBorrowingDueInTheFuture() {
        BorrowingRecord active = record(2L, LocalDateTime.now().minusDays(1), LocalDateTime.now().plusDays(1));
        when(borrowingRecordRepository.findByUserIdAndStatusOrderByBorrowedDateDesc(USER_ID, "BORROWED"))
                .thenReturn(Collections.singletonList(active));

        List<BorrowingRecord> autoReturned = service.autoReturnExpiredBorrowings(USER_ID);

        assertTrue(autoReturned.isEmpty());
        assertEquals("BORROWED", active.getStatus());
        verify(borrowingRecordRepository, never()).markReturnedIfBorrowed(anyLong(), any(LocalDateTime.class));
        verify(bookRepository, never()).incrementQuantity(anyLong());
    }

    @Test
    @DisplayName("auto-return: a record with no due date falls back to borrowedDate + duration")
    void usesBorrowDurationWhenDueDateIsMissing() {
        BorrowingRecord noDueDate = record(3L, LocalDateTime.now().minusDays(DURATION_DAYS + 1), null);
        when(borrowingRecordRepository.findByUserIdAndStatusOrderByBorrowedDateDesc(USER_ID, "BORROWED"))
                .thenReturn(Collections.singletonList(noDueDate));
        when(borrowingRecordRepository.markReturnedIfBorrowed(eq(3L), any(LocalDateTime.class))).thenReturn(1);

        assertEquals(1, service.autoReturnExpiredBorrowings(USER_ID).size());
        verify(bookRepository).incrementQuantity(BOOK_ID);
    }

    // ---------- status-transition gate ----------

    @Test
    @DisplayName("auto-return: a lost status-transition race does not increment the quantity")
    void autoReturnSkipsWhenStatusGateReturnsZero() {
        BorrowingRecord expired = record(4L, LocalDateTime.now().minusDays(20), LocalDateTime.now().minusDays(1));
        when(borrowingRecordRepository.findByUserIdAndStatusOrderByBorrowedDateDesc(USER_ID, "BORROWED"))
                .thenReturn(Collections.singletonList(expired));
        when(borrowingRecordRepository.markReturnedIfBorrowed(eq(4L), any(LocalDateTime.class))).thenReturn(0);

        List<BorrowingRecord> autoReturned = service.autoReturnExpiredBorrowings(USER_ID);

        assertTrue(autoReturned.isEmpty());
        verify(bookRepository, never()).incrementQuantity(anyLong());
        verify(studentNotificationRepository, never()).save(any());
    }

    @Test
    @DisplayName("self-return: a lost status-transition race is a conflict and does not increment the quantity")
    void selfReturnThrowsWhenStatusGateReturnsZero() {
        BorrowingRecord record = record(5L, LocalDateTime.now().minusDays(1), LocalDateTime.now().plusDays(13));
        when(borrowingRecordRepository.markReturnedIfBorrowed(eq(5L), any(LocalDateTime.class))).thenReturn(0);

        ConflictException thrown = assertThrows(ConflictException.class, () -> service.selfReturn(record));

        assertEquals("Already returned", thrown.getMessage());
        verify(bookRepository, never()).incrementQuantity(anyLong());
    }

    @Test
    @DisplayName("self-return: a successful status transition increments the quantity exactly once")
    void selfReturnIncrementsQuantityOnce() {
        BorrowingRecord record = record(6L, LocalDateTime.now().minusDays(1), LocalDateTime.now().plusDays(13));
        when(borrowingRecordRepository.markReturnedIfBorrowed(eq(6L), any(LocalDateTime.class))).thenReturn(1);

        assertNotNull(service.selfReturn(record));

        verify(bookRepository, times(1)).incrementQuantity(BOOK_ID);
    }

    @Test
    @DisplayName("self-return: an already-returned record never reaches the status gate")
    void selfReturnRejectsAlreadyReturnedRecord() {
        BorrowingRecord record = record(7L, LocalDateTime.now().minusDays(1), LocalDateTime.now().plusDays(13));
        record.setStatus("RETURNED");

        assertEquals("Already returned",
                assertThrows(ConflictException.class, () -> service.selfReturn(record)).getMessage());

        verify(borrowingRecordRepository, never()).markReturnedIfBorrowed(anyLong(), any(LocalDateTime.class));
        verify(bookRepository, never()).incrementQuantity(anyLong());
    }

    @Test
    @DisplayName("self-return: a record borrowed seconds ago is rejected before the status gate")
    void selfReturnEnforcesMinimumBorrowWindow() {
        BorrowingRecord record = record(8L, LocalDateTime.now().minusSeconds(1), LocalDateTime.now().plusDays(14));

        assertThrows(ConflictException.class, () -> service.selfReturn(record));

        verify(borrowingRecordRepository, never()).markReturnedIfBorrowed(anyLong(), any(LocalDateTime.class));
        verify(bookRepository, never()).incrementQuantity(anyLong());
    }

    @Test
    @DisplayName("bulk return: records that lost the race are counted as already processed, not failed")
    void bulkReturnSkipsRecordsThatLostTheRace() {
        BorrowingRecord winner = record(9L, LocalDateTime.now().minusDays(1), LocalDateTime.now().plusDays(13));
        BorrowingRecord loser = record(10L, LocalDateTime.now().minusDays(1), LocalDateTime.now().plusDays(13));
        when(borrowingRecordRepository.markReturnedIfBorrowed(eq(9L), any(LocalDateTime.class))).thenReturn(1);
        when(borrowingRecordRepository.markReturnedIfBorrowed(eq(10L), any(LocalDateTime.class))).thenReturn(0);

        BorrowingService.BulkReturnResult result = service.bulkReturn(Arrays.asList(winner, loser));

        assertEquals(1, result.getReturned().size());
        assertEquals(9L, result.getReturned().get(0).getId());
        assertEquals(1, result.getAlreadyReturned());
        assertTrue(result.getTooSoon().isEmpty());
        verify(bookRepository, times(1)).incrementQuantity(BOOK_ID);
    }

    // ---------- borrow validation order ----------

    @Test
    @DisplayName("borrow: an unknown book is a 404 and never touches the quantity")
    void borrowRejectsUnknownBook() {
        when(bookRepository.findById(BOOK_ID)).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class, () -> service.borrow(USER_ID, BOOK_ID));

        verify(bookRepository, never()).decrementQuantityIfAvailable(anyLong());
    }

    @Test
    @DisplayName("borrow: a non-APPROVED book is rejected before the quantity is decremented")
    void borrowRejectsNonApprovedBookBeforeDecrement() {
        when(bookRepository.findById(BOOK_ID)).thenReturn(Optional.of(book(Book.BookStatus.PENDING)));

        ConflictException thrown = assertThrows(ConflictException.class, () -> service.borrow(USER_ID, BOOK_ID));

        assertEquals("This book is not available for borrowing", thrown.getMessage());
        verify(bookRepository, never()).decrementQuantityIfAvailable(anyLong());
        verify(borrowingRecordRepository, never()).save(any());
    }

    @Test
    @DisplayName("borrow: borrowing the same book twice is rejected before the quantity is decremented")
    void borrowRejectsDuplicateActiveBorrow() {
        when(bookRepository.findById(BOOK_ID)).thenReturn(Optional.of(book(Book.BookStatus.APPROVED)));
        when(borrowingRecordRepository.countByUser_IdAndBook_IdAndStatus(USER_ID, BOOK_ID, "BORROWED")).thenReturn(1);

        assertThrows(ConflictException.class, () -> service.borrow(USER_ID, BOOK_ID));

        verify(bookRepository, never()).decrementQuantityIfAvailable(anyLong());
        verify(borrowingRecordRepository, never()).save(any());
    }

    @Test
    @DisplayName("borrow: the sixth simultaneous borrow is rejected before the quantity is decremented")
    void borrowRejectsWhenLimitReached() {
        when(bookRepository.findById(BOOK_ID)).thenReturn(Optional.of(book(Book.BookStatus.APPROVED)));
        when(borrowingRecordRepository.countByUserIdAndStatus(USER_ID, "BORROWED"))
                .thenReturn((long) BorrowingService.MAX_BORROW_LIMIT);

        ConflictException thrown = assertThrows(ConflictException.class, () -> service.borrow(USER_ID, BOOK_ID));

        assertTrue(thrown.getMessage().contains("maximum borrowing limit"));
        verify(bookRepository, never()).decrementQuantityIfAvailable(anyLong());
        verify(borrowingRecordRepository, never()).save(any());
    }

    @Test
    @DisplayName("borrow: an out-of-stock decrement is a conflict and no record is saved")
    void borrowThrowsWhenDecrementMatchesNoRow() {
        when(bookRepository.findById(BOOK_ID)).thenReturn(Optional.of(book(Book.BookStatus.APPROVED)));
        when(bookRepository.decrementQuantityIfAvailable(BOOK_ID)).thenReturn(0);

        ConflictException thrown = assertThrows(ConflictException.class, () -> service.borrow(USER_ID, BOOK_ID));

        assertEquals("This book is currently unavailable", thrown.getMessage());
        verify(borrowingRecordRepository, never()).save(any());
    }

    @Test
    @DisplayName("borrow: expired borrowings are auto-returned before the limit is checked")
    void borrowAutoReturnsExpiredBorrowingsFirst() {
        BorrowingRecord expired = record(11L, LocalDateTime.now().minusDays(20), LocalDateTime.now().minusDays(1));
        when(borrowingRecordRepository.findByUserIdAndStatusOrderByBorrowedDateDesc(USER_ID, "BORROWED"))
                .thenReturn(Collections.singletonList(expired));
        when(borrowingRecordRepository.markReturnedIfBorrowed(eq(11L), any(LocalDateTime.class))).thenReturn(1);
        when(bookRepository.findById(BOOK_ID)).thenReturn(Optional.of(book(Book.BookStatus.APPROVED)));
        when(bookRepository.decrementQuantityIfAvailable(BOOK_ID)).thenReturn(1);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(new User()));
        when(borrowingRecordRepository.save(any(BorrowingRecord.class))).thenAnswer(call -> call.getArgument(0));

        service.borrow(USER_ID, BOOK_ID);

        InOrder order = inOrder(borrowingRecordRepository, bookRepository);
        order.verify(borrowingRecordRepository).markReturnedIfBorrowed(eq(11L), any(LocalDateTime.class));
        order.verify(borrowingRecordRepository).countByUserIdAndStatus(USER_ID, "BORROWED");
        order.verify(bookRepository).decrementQuantityIfAvailable(BOOK_ID);
        order.verify(borrowingRecordRepository).save(any(BorrowingRecord.class));
    }

    @Test
    @DisplayName("borrow: a saved record is BORROWED and due after the configured duration")
    void borrowSavesRecordWithConfiguredDueDate() {
        when(bookRepository.findById(BOOK_ID)).thenReturn(Optional.of(book(Book.BookStatus.APPROVED)));
        when(bookRepository.decrementQuantityIfAvailable(BOOK_ID)).thenReturn(1);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(new User()));
        when(borrowingRecordRepository.save(any(BorrowingRecord.class))).thenAnswer(call -> call.getArgument(0));

        service.borrow(USER_ID, BOOK_ID);

        ArgumentCaptor<BorrowingRecord> captor = ArgumentCaptor.forClass(BorrowingRecord.class);
        verify(borrowingRecordRepository).save(captor.capture());
        BorrowingRecord saved = captor.getValue();
        assertEquals("BORROWED", saved.getStatus());
        assertEquals(saved.getBorrowedDate().plusDays(DURATION_DAYS), saved.getDueDate());
    }

    // ---------- duplicate due-reminder suppression ----------

    @Test
    @DisplayName("due reminders: a persisted reminder for the same book today suppresses the computed one")
    void suppressesComputedReminderWhenPersistedReminderExistsToday() {
        LocalDate today = LocalDate.now();
        List<StudentNotification> persisted = Collections.singletonList(
                notification("DUE_REMINDER", BOOK_ID, today.atTime(8, 0)));

        assertTrue(BorrowingService.hasPersistedDueReminder(persisted, BOOK_ID, today));
    }

    @Test
    @DisplayName("due reminders: yesterday's persisted reminder does not suppress today's computed one")
    void doesNotSuppressWhenPersistedReminderIsFromAnotherDay() {
        LocalDate today = LocalDate.now();
        List<StudentNotification> persisted = Collections.singletonList(
                notification("DUE_REMINDER", BOOK_ID, today.minusDays(1).atTime(8, 0)));

        assertFalse(BorrowingService.hasPersistedDueReminder(persisted, BOOK_ID, today));
    }

    @Test
    @DisplayName("due reminders: a reminder for a different book does not suppress this book's")
    void doesNotSuppressWhenPersistedReminderIsForAnotherBook() {
        LocalDate today = LocalDate.now();
        List<StudentNotification> persisted = Collections.singletonList(
                notification("DUE_REMINDER", 999L, today.atTime(8, 0)));

        assertFalse(BorrowingService.hasPersistedDueReminder(persisted, BOOK_ID, today));
    }

    @Test
    @DisplayName("due reminders: a non-reminder notification for the same book does not suppress")
    void doesNotSuppressOnUnrelatedCategory() {
        LocalDate today = LocalDate.now();
        List<StudentNotification> persisted = Collections.singletonList(
                notification("BORROWING_UPDATE", BOOK_ID, today.atTime(8, 0)));

        assertFalse(BorrowingService.hasPersistedDueReminder(persisted, BOOK_ID, today));
    }

    @Test
    @DisplayName("due reminders: a record with no book is never suppressed")
    void doesNotSuppressWhenBookIdIsMissing() {
        LocalDate today = LocalDate.now();
        List<StudentNotification> persisted = Collections.singletonList(
                notification("DUE_REMINDER", BOOK_ID, today.atTime(8, 0)));

        assertFalse(BorrowingService.hasPersistedDueReminder(persisted, null, today));
    }

    // ---------- helpers ----------

    private StudentNotification notification(String category, Long referenceBookId, LocalDateTime createdAt) {
        StudentNotification notification = new StudentNotification();
        notification.setUserId(USER_ID);
        notification.setCategory(category);
        notification.setReferenceBookId(referenceBookId);
        notification.setCreatedAt(createdAt);
        return notification;
    }

    private Book book(Book.BookStatus status) {
        Book book = new Book();
        book.setId(BOOK_ID);
        book.setTitle("Domain Driven Design");
        book.setStatus(status);
        book.setQuantity(1);
        return book;
    }

    private BorrowingRecord record(Long id, LocalDateTime borrowedDate, LocalDateTime dueDate) {
        User user = new User();
        user.setId(USER_ID);

        BorrowingRecord record = new BorrowingRecord();
        record.setId(id);
        record.setUser(user);
        record.setBook(book(Book.BookStatus.APPROVED));
        record.setBorrowedDate(borrowedDate);
        record.setDueDate(dueDate);
        record.setStatus("BORROWED");
        return record;
    }
}
