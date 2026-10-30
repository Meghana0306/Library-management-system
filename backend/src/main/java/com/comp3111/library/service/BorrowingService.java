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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.logging.Logger;

/**
 * Owns the borrow/return domain logic. Every quantity change goes through a conditional
 * update on the repository, and every return goes through the BORROWED -> RETURNED status
 * gate, so a lost update or a double return can never inflate a book's stock.
 */
@Service
public class BorrowingService {

    private static final Logger logger = Logger.getLogger(BorrowingService.class.getName());

    public static final String STATUS_BORROWED = "BORROWED";
    public static final String STATUS_RETURNED = "RETURNED";
    public static final int MAX_BORROW_LIMIT = 5;

    private final BorrowingRecordRepository borrowingRecordRepository;
    private final BookRepository bookRepository;
    private final StudentNotificationRepository studentNotificationRepository;
    private final UserRepository userRepository;
    private final int borrowDurationDays;
    private final long minSelfReturnSeconds;

    public BorrowingService(BorrowingRecordRepository borrowingRecordRepository,
                            BookRepository bookRepository,
                            StudentNotificationRepository studentNotificationRepository,
                            UserRepository userRepository,
                            @Value("${library.borrow.duration-days:14}") int borrowDurationDays,
                            @Value("${library.borrow.min-self-return-seconds:30}") long minSelfReturnSeconds) {
        this.borrowingRecordRepository = borrowingRecordRepository;
        this.bookRepository = bookRepository;
        this.studentNotificationRepository = studentNotificationRepository;
        this.userRepository = userRepository;
        this.borrowDurationDays = borrowDurationDays;
        this.minSelfReturnSeconds = minSelfReturnSeconds;
    }

    public int getBorrowDurationDays() {
        return borrowDurationDays;
    }

    public long getMinSelfReturnSeconds() {
        return minSelfReturnSeconds;
    }

    public int getMaxBorrowLimit() {
        return MAX_BORROW_LIMIT;
    }

    @Transactional(readOnly = true)
    public BorrowingRecord requireRecord(Long recordId) {
        return borrowingRecordRepository.findById(recordId)
                .orElseThrow(() -> new NotFoundException("Borrowing record not found"));
    }

    /**
     * Borrow a book for the acting user. Runs entirely inside one transaction: any failure
     * throws so the whole attempt (including the decrement) rolls back.
     */
    @Transactional
    public BorrowingRecord borrow(Long userId, Long bookId) {
        LocalDateTime now = LocalDateTime.now();

        autoReturnExpiredForUser(userId, now);

        Book book = bookRepository.findById(bookId)
                .orElseThrow(() -> new NotFoundException("Book not found"));

        if (book.getStatus() != Book.BookStatus.APPROVED) {
            throw new ConflictException("This book is not available for borrowing");
        }
        if (borrowingRecordRepository.countByUser_IdAndBook_IdAndStatus(userId, bookId, STATUS_BORROWED) > 0) {
            throw new ConflictException("You have already borrowed this book and have not returned it yet");
        }
        if (borrowingRecordRepository.countByUserIdAndStatus(userId, STATUS_BORROWED) >= MAX_BORROW_LIMIT) {
            throw new ConflictException("You have reached the maximum borrowing limit of " + MAX_BORROW_LIMIT + " books");
        }
        if (bookRepository.decrementQuantityIfAvailable(bookId) == 0) {
            throw new ConflictException("This book is currently unavailable");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found"));
        Book borrowedBook = bookRepository.findById(bookId)
                .orElseThrow(() -> new NotFoundException("Book not found"));

        BorrowingRecord record = new BorrowingRecord();
        record.setUser(user);
        record.setBook(borrowedBook);
        record.setBorrowedDate(now);
        record.setDueDate(now.plusDays(borrowDurationDays));
        record.setStatus(STATUS_BORROWED);
        return borrowingRecordRepository.save(record);
    }

    /**
     * User-initiated return of a single record. Unlike the bulk and automatic paths, a
     * record that is already returned is an error the caller should see.
     */
    @Transactional
    public LocalDateTime selfReturn(BorrowingRecord record) {
        if (!STATUS_BORROWED.equalsIgnoreCase(record.getStatus())) {
            throw new ConflictException("Already returned");
        }

        LocalDateTime now = LocalDateTime.now();
        if (ChronoUnit.SECONDS.between(record.getBorrowedDate(), now) < minSelfReturnSeconds) {
            throw new ConflictException(
                    "Self-return is available after at least " + minSelfReturnSeconds + " seconds from borrowing");
        }

        Long bookId = record.getBook() != null ? record.getBook().getId() : null;
        if (borrowingRecordRepository.markReturnedIfBorrowed(record.getId(), now) == 0) {
            throw new ConflictException("Already returned");
        }
        if (bookId != null) {
            bookRepository.incrementQuantity(bookId);
        }
        return now;
    }

    /**
     * Bulk return of records the caller already owns. Records that lost the status-transition
     * race are counted as already processed rather than failing the whole batch.
     */
    @Transactional
    public BulkReturnResult bulkReturn(List<BorrowingRecord> records) {
        LocalDateTime now = LocalDateTime.now();
        BulkReturnResult result = new BulkReturnResult();

        for (BorrowingRecord record : records) {
            if (!STATUS_BORROWED.equalsIgnoreCase(record.getStatus())) {
                result.alreadyReturned++;
                continue;
            }
            if (ChronoUnit.SECONDS.between(record.getBorrowedDate(), now) < minSelfReturnSeconds) {
                result.tooSoon.add(record.getId());
                continue;
            }
            Long bookId = record.getBook() != null ? record.getBook().getId() : null;
            if (borrowingRecordRepository.markReturnedIfBorrowed(record.getId(), now) == 0) {
                result.alreadyReturned++;
                continue;
            }
            if (bookId != null) {
                bookRepository.incrementQuantity(bookId);
            }
            record.setStatus(STATUS_RETURNED);
            record.setReturnDate(now);
            result.returned.add(record);
        }
        return result;
    }

    /**
     * Auto-return expired borrowings for the given user in a new transaction.
     * Creates a persisted notification for each auto-returned book.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public List<BorrowingRecord> autoReturnExpiredBorrowings(Long userId) {
        return autoReturnExpiredForUser(userId, LocalDateTime.now());
    }

    /**
     * Auto-return ALL expired borrowings across all users (used by scheduled job).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int autoReturnAllExpiredBorrowings() {
        LocalDateTime now = LocalDateTime.now();
        List<BorrowingRecord> expired = borrowingRecordRepository
                .findByStatusAndDueDateLessThanEqual(STATUS_BORROWED, now);
        return completeAutoReturn(expired, now).size();
    }

    private List<BorrowingRecord> autoReturnExpiredForUser(Long userId, LocalDateTime now) {
        List<BorrowingRecord> expired = new ArrayList<>();
        for (BorrowingRecord record : borrowingRecordRepository
                .findByUserIdAndStatusOrderByBorrowedDateDesc(userId, STATUS_BORROWED)) {
            if (!effectiveDueDate(record).isAfter(now)) {
                expired.add(record);
            }
        }
        return completeAutoReturn(expired, now);
    }

    private List<BorrowingRecord> completeAutoReturn(List<BorrowingRecord> expired, LocalDateTime now) {
        List<BorrowingRecord> autoReturned = new ArrayList<>();
        for (BorrowingRecord record : expired) {
            Book book = record.getBook();
            Long ownerId = record.getUser() != null ? record.getUser().getId() : null;

            if (borrowingRecordRepository.markReturnedIfBorrowed(record.getId(), now) == 0) {
                continue;
            }
            record.setStatus(STATUS_RETURNED);
            record.setReturnDate(now);

            if (book != null && book.getId() != null) {
                bookRepository.incrementQuantity(book.getId());
                if (ownerId != null) {
                    createAutoReturnNotification(ownerId, book);
                }
            }
            autoReturned.add(record);
        }
        return autoReturned;
    }

    /**
     * True when a persisted DUE_REMINDER already covers this book on the given day. The
     * scheduled reminder job and the computed reminders in the notification feed would
     * otherwise both fire for the same record; the persisted one wins because it carries a
     * notificationId and can be marked read or deleted.
     */
    public static boolean hasPersistedDueReminder(List<StudentNotification> persisted, Long bookId, LocalDate day) {
        if (bookId == null || persisted == null) {
            return false;
        }
        for (StudentNotification notification : persisted) {
            if ("DUE_REMINDER".equals(notification.getCategory())
                    && bookId.equals(notification.getReferenceBookId())
                    && notification.getCreatedAt() != null
                    && notification.getCreatedAt().toLocalDate().equals(day)) {
                return true;
            }
        }
        return false;
    }

    public LocalDateTime effectiveDueDate(BorrowingRecord record) {
        return record.getDueDate() != null
                ? record.getDueDate()
                : record.getBorrowedDate().plusDays(borrowDurationDays);
    }

    private void createAutoReturnNotification(Long userId, Book book) {
        try {
            StudentNotification notif = new StudentNotification();
            notif.setUserId(userId);
            notif.setCategory("BORROWING_UPDATE");
            notif.setTitle("Book auto-returned");
            notif.setMessage("\"" + book.getTitle() + "\" was automatically returned because the borrowing period expired.");
            notif.setPriority("HIGH");
            notif.setReferenceBookId(book.getId());
            notif.setCreatedAt(LocalDateTime.now());
            notif.setRead(false);
            studentNotificationRepository.save(notif);
        } catch (Exception e) {
            logger.warning("Failed to create auto-return notification for userId=" + userId + ": " + e.getMessage());
        }
    }

    /** Outcome of a bulk return: what was returned, what was already gone, what is still too fresh. */
    public static class BulkReturnResult {
        private final List<BorrowingRecord> returned = new ArrayList<>();
        private final List<Long> tooSoon = new ArrayList<>();
        private int alreadyReturned;

        public List<BorrowingRecord> getReturned() {
            return returned;
        }

        public List<Long> getTooSoon() {
            return tooSoon;
        }

        public int getAlreadyReturned() {
            return alreadyReturned;
        }
    }
}
