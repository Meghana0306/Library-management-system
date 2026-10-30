package com.comp3111.library.controller;

import com.comp3111.library.exception.ApiError;
import com.comp3111.library.exception.ConflictException;
import com.comp3111.library.exception.ErrorCode;
import com.comp3111.library.exception.NotFoundException;
import com.comp3111.library.model.BorrowingRecord;
import com.comp3111.library.model.Book;
import com.comp3111.library.model.StudentNotification;
import com.comp3111.library.repository.BookRepository;
import com.comp3111.library.repository.BorrowingRecordRepository;
import com.comp3111.library.repository.StudentNotificationRepository;
import com.comp3111.library.repository.UserRepository;
import com.comp3111.library.security.LibraryPrincipal;
import com.comp3111.library.security.OwnershipGuard;
import com.comp3111.library.service.BorrowingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.logging.Logger;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class BorrowingController {

    private static final Logger logger = Logger.getLogger(BorrowingController.class.getName());

    @Autowired
    private BorrowingRecordRepository borrowingRecordRepository;

    @Autowired
    private BookRepository bookRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private StudentNotificationRepository studentNotificationRepository;

    @Autowired
    private BorrowingService borrowingService;

    @Autowired
    private OwnershipGuard ownershipGuard;

    /**
     * Borrow a book. The acting user is always taken from the JWT; a {@code userId} in the
     * body is accepted for backwards compatibility but ignored.
     * Request body: { "bookId": Long, "userId": Long }
     */
    @PostMapping("/borrow")
    public ResponseEntity<?> borrowBook(@RequestBody(required = false) Map<String, Object> request,
                                        @AuthenticationPrincipal LibraryPrincipal principal) {
        Long userId = ownershipGuard.actingUserId(principal);
        if (userId == null) {
            throw new AccessDeniedException("Authentication is required.");
        }

        Long bookId = parseId(request == null ? null : request.get("bookId"));
        if (bookId == null) {
            return validationFailed("A valid book ID is required");
        }

        BorrowingRecord savedRecord = borrowingService.borrow(userId, bookId);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Book borrowed successfully");
        response.put("recordId", savedRecord.getId());
        response.put("dueDate", savedRecord.getDueDate());
        return ResponseEntity.ok(response);
    }

    /**
     * Return a borrowed book
     */
    @PostMapping("/return/{recordId}")
    public ResponseEntity<?> returnBook(@PathVariable Long recordId,
                                        @AuthenticationPrincipal LibraryPrincipal principal) {
        BorrowingRecord record = borrowingService.requireRecord(recordId);
        assertRecordOwner(record, principal);

        LocalDateTime returnDate = borrowingService.selfReturn(record);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Book returned successfully");
        response.put("returnDate", returnDate);
        return ResponseEntity.ok(response);
    }

    /**
     * Get user's borrowing history
     */
    @GetMapping("/borrowing-records/user/{userId}")
    public ResponseEntity<?> getUserBorrowHistory(@PathVariable Long userId,
                                                  @AuthenticationPrincipal LibraryPrincipal principal) {
        ownershipGuard.assertSelf(userId, principal);
        requireUser(userId);

        performAutoReturnExpiredBorrowings(userId);

        List<BorrowingRecord> records = borrowingRecordRepository.findByUserIdOrderByBorrowedDateDesc(userId);
        return ResponseEntity.ok(records);
    }

    /**
     * Get user's active borrow count only (fast path for borrow form)
     */
    @GetMapping("/borrowing-records/user/{userId}/active-count")
    public ResponseEntity<?> getUserActiveBorrowCount(@PathVariable Long userId,
                                                      @AuthenticationPrincipal LibraryPrincipal principal) {
        ownershipGuard.assertSelf(userId, principal);
        requireUser(userId);

        performAutoReturnExpiredBorrowings(userId);

        long activeCount = borrowingRecordRepository.countByUserIdAndStatus(userId, BorrowingService.STATUS_BORROWED);
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("count", activeCount);
        response.put("limit", borrowingService.getMaxBorrowLimit());
        response.put("borrowDurationDays", borrowingService.getBorrowDurationDays());
        response.put("minSelfReturnSeconds", borrowingService.getMinSelfReturnSeconds());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/borrowing-records/user/{userId}/active")
    public ResponseEntity<?> getUserActiveBorrowings(@PathVariable Long userId,
                                                     @AuthenticationPrincipal LibraryPrincipal principal) {
        ownershipGuard.assertSelf(userId, principal);
        requireUser(userId);

        performAutoReturnExpiredBorrowings(userId);

        List<BorrowingRecord> records = borrowingRecordRepository
                .findByUserIdAndStatusOrderByBorrowedDateDesc(userId, BorrowingService.STATUS_BORROWED);
        return ResponseEntity.ok(records);
    }

    /**
     * Bulk return multiple borrowed books at once.
     * Request body: { "recordIds": [1, 2, 3] }
     */
    @PostMapping("/return/bulk")
    public ResponseEntity<?> returnBooksInBulk(@RequestBody(required = false) Map<String, Object> request,
                                               @AuthenticationPrincipal LibraryPrincipal principal) {
        Object idsObj = request == null ? null : request.get("recordIds");
        if (!(idsObj instanceof List)) {
            return validationFailed("recordIds must be an array");
        }
        List<?> rawIds = (List<?>) idsObj;
        if (rawIds.isEmpty()) {
            return validationFailed("recordIds must not be empty");
        }

        List<String> errors = new ArrayList<>();
        List<BorrowingRecord> records = new ArrayList<>();
        for (Object idObj : rawIds) {
            Long recordId = parseId(idObj);
            if (recordId == null) {
                errors.add("Invalid record id: " + idObj);
                continue;
            }
            Optional<BorrowingRecord> recordOpt = borrowingRecordRepository.findById(recordId);
            if (!recordOpt.isPresent()) {
                errors.add("Record not found: " + recordId);
                continue;
            }
            assertRecordOwner(recordOpt.get(), principal);
            records.add(recordOpt.get());
        }

        BorrowingService.BulkReturnResult result = borrowingService.bulkReturn(records);

        List<Map<String, Object>> returned = result.getReturned().stream()
                .map(record -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("recordId", record.getId());
                    item.put("bookTitle", safeBookTitle(record));
                    return item;
                })
                .collect(Collectors.toList());
        result.getTooSoon().forEach(recordId -> errors.add(
                "Record " + recordId + " cannot be returned yet (minimum "
                        + borrowingService.getMinSelfReturnSeconds() + "s)"));

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("returnedCount", returned.size());
        response.put("returned", returned);
        response.put("alreadyReturnedCount", result.getAlreadyReturned());
        if (!errors.isEmpty()) {
            response.put("errors", errors);
        }
        return ResponseEntity.ok(response);
    }

    @PostMapping("/borrowing-records/user/{userId}/auto-return-expired")
    public ResponseEntity<?> autoReturnExpired(@PathVariable Long userId,
                                               @AuthenticationPrincipal LibraryPrincipal principal) {
        ownershipGuard.assertSelf(userId, principal);
        requireUser(userId);

        List<BorrowingRecord> autoReturned = borrowingService.autoReturnExpiredBorrowings(userId);
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("autoReturnedCount", autoReturned.size());
        response.put("message", autoReturned.isEmpty()
                ? "No expired borrowings to auto-return"
                : "Auto-return completed");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/notifications/user/{userId}")
    @Transactional
    public ResponseEntity<?> getStudentNotifications(@PathVariable Long userId,
                                                     @AuthenticationPrincipal LibraryPrincipal principal) {
        ownershipGuard.assertSelf(userId, principal);
        requireUser(userId);

        // Auto-return persists its own "Book auto-returned" notification, so it must run
        // before the persisted list is read. Its return value is deliberately unused —
        // duplicating it as a computed item would produce an entry with no notificationId.
        borrowingService.autoReturnExpiredBorrowings(userId);

        List<StudentNotification> persistedNotifications = studentNotificationRepository
                .findByUserIdOrderByCreatedAtDesc(userId);
        List<BorrowingRecord> records = borrowingRecordRepository.findByUserIdOrderByBorrowedDateDesc(userId);
        LocalDateTime now = LocalDateTime.now();

        List<Map<String, Object>> notifications = records.stream()
                .filter(record -> BorrowingService.STATUS_BORROWED.equalsIgnoreCase(record.getStatus()))
                .map(record -> {
                    LocalDateTime dueDate = borrowingService.effectiveDueDate(record);
                    long daysLeft = ChronoUnit.DAYS.between(now.toLocalDate(), dueDate.toLocalDate());
                    if (daysLeft > 2) {
                        return null;
                    }
                    Long bookId = record.getBook() != null ? record.getBook().getId() : null;
                    if (BorrowingService.hasPersistedDueReminder(persistedNotifications, bookId, now.toLocalDate())) {
                        return null;
                    }

                    Map<String, Object> item = new HashMap<>();
                    item.put("category", "DUE_REMINDER");
                    item.put("title", daysLeft < 0 ? "Book is overdue" : "Book due reminder");
                    item.put("message", buildDueReminderMessage(record, daysLeft));
                    item.put("timestamp", dueDate);
                    item.put("priority", daysLeft <= 0 ? "HIGH" : "MEDIUM");
                    return item;
                })
                .filter(item -> item != null)
                .collect(Collectors.toList());

        persistedNotifications.forEach(notification -> notifications.add(mapStudentNotification(notification)));

        Map<String, Object> announcement = new HashMap<>();
        announcement.put("category", "ANNOUNCEMENT");
        announcement.put("title", "Library announcement");
        announcement.put("message", "Use Manage Profile to keep your account details updated.");
        announcement.put("timestamp", now);
        announcement.put("priority", "LOW");
        notifications.add(announcement);

        List<Map<String, Object>> sorted = notifications.stream()
                .sorted(Comparator.comparing((Map<String, Object> item) -> (LocalDateTime) item.get("timestamp"),
                        Comparator.nullsLast(Comparator.naturalOrder())).reversed())
                .collect(Collectors.toList());

        return ResponseEntity.ok(sorted);
    }

    /**
     * Mark a specific persisted notification as read.
     */
    @PutMapping("/notifications/{notificationId}/read")
    @Transactional
    public ResponseEntity<?> markNotificationRead(@PathVariable Long notificationId,
                                                  @AuthenticationPrincipal LibraryPrincipal principal) {
        StudentNotification notif = requireNotification(notificationId);
        ownershipGuard.assertOwner(notif.getUserId(), principal, "You may only manage your own notifications.");

        notif.setRead(true);
        studentNotificationRepository.save(notif);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Notification marked as read");
        return ResponseEntity.ok(response);
    }

    /**
     * Mark all persisted notifications for a user as read.
     */
    @PutMapping("/notifications/user/{userId}/read-all")
    @Transactional
    public ResponseEntity<?> markAllNotificationsRead(@PathVariable Long userId,
                                                      @AuthenticationPrincipal LibraryPrincipal principal) {
        ownershipGuard.assertSelf(userId, principal);
        requireUser(userId);

        List<StudentNotification> notifs = studentNotificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
        notifs.forEach(n -> n.setRead(true));
        studentNotificationRepository.saveAll(notifs);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("markedCount", notifs.size());
        return ResponseEntity.ok(response);
    }

    /**
     * Delete a specific persisted notification.
     */
    @DeleteMapping("/notifications/{notificationId}")
    @Transactional
    public ResponseEntity<?> deleteNotification(@PathVariable Long notificationId,
                                                @AuthenticationPrincipal LibraryPrincipal principal) {
        StudentNotification notif = requireNotification(notificationId);
        ownershipGuard.assertOwner(notif.getUserId(), principal, "You may only manage your own notifications.");

        studentNotificationRepository.delete(notif);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Notification deleted");
        return ResponseEntity.ok(response);
    }

    /**
     * Recommend books based on user borrowing history and overall popularity.
     */
    @GetMapping("/recommendations/user/{userId}")
    public ResponseEntity<?> getBookRecommendations(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "5") Integer limit,
            @AuthenticationPrincipal LibraryPrincipal principal) {
        ownershipGuard.assertSelf(userId, principal);
        requireUser(userId);

        int safeLimit = Math.max(1, Math.min(limit, 20));
        List<BookRepository.BookSummary> approvedBooks = bookRepository
                .findBookSummariesByStatus(Book.BookStatus.APPROVED);
        if (approvedBooks.isEmpty()) {
            return ResponseEntity.ok(new ArrayList<>());
        }

        List<BorrowingRecord> userHistory = borrowingRecordRepository.findByUserId(userId);
        Map<Long, Long> popularityByBookId = buildPopularityMap();
        Map<String, Long> preferredGenres = buildGenrePreferenceMap(userHistory);
        Set<Long> booksSeenByUser = buildSeenBookIds(userHistory);

        List<Recommendation> recommendations = approvedBooks.stream()
                .filter(book -> book.getId() != null && !booksSeenByUser.contains(book.getId()) && available(book))
                .map(book -> buildRecommendationItem(book, popularityByBookId, preferredGenres))
                .sorted(Comparator.comparingLong((Recommendation item) -> item.getScore()).reversed()
                        .thenComparing(Recommendation::getTitle, Comparator.nullsLast(String::compareToIgnoreCase)))
                .limit(safeLimit)
                .collect(Collectors.toList());

        if (recommendations.isEmpty()) {
            recommendations = approvedBooks.stream()
                    .filter(this::available)
                    .limit(safeLimit)
                    .map(book -> buildRecommendationItem(book, popularityByBookId, Map.of()))
                    .collect(Collectors.toList());
        }

        return ResponseEntity.ok(recommendations);
    }

    private boolean available(BookRepository.BookSummary book) {
        return book.getQuantity() != null && book.getQuantity() > 0;
    }

    private Map<Long, Long> buildPopularityMap() {
        return borrowingRecordRepository.countTotalBorrowsGroupedByBook().stream()
                .filter(row -> row.getBookId() != null)
                .collect(Collectors.toMap(
                        BorrowingRecordRepository.BookCount::getBookId,
                        row -> row.getCount() == null ? 0L : row.getCount()));
    }

    private Map<String, Long> buildGenrePreferenceMap(List<BorrowingRecord> userHistory) {
        return userHistory.stream()
                .filter(record -> record.getBook() != null)
                .map(record -> record.getBook().getGenre())
                .filter(genre -> genre != null && !genre.isBlank())
                .collect(Collectors.groupingBy(String::trim, Collectors.counting()));
    }

    private Set<Long> buildSeenBookIds(List<BorrowingRecord> userHistory) {
        return userHistory.stream()
                .filter(record -> record.getBook() != null && record.getBook().getId() != null)
                .map(record -> record.getBook().getId())
                .collect(Collectors.toSet());
    }

    private Recommendation buildRecommendationItem(BookRepository.BookSummary book,
                                                   Map<Long, Long> popularityByBookId,
                                                   Map<String, Long> preferredGenres) {
        long popularityScore = popularityByBookId.getOrDefault(book.getId(), 0L);
        long genreScore = preferredGenres.getOrDefault(book.getGenre() == null ? "" : book.getGenre().trim(), 0L);
        return new Recommendation(
                book.getId(),
                book.getTitle(),
                book.getAuthor(),
                book.getGenre(),
                book.getQuantity(),
                popularityScore,
                genreScore,
                popularityScore + (genreScore * 2),
                genreScore > 0 ? "Matches your borrowing genre history" : "Popular among library users");
    }

    /**
     * Get reading history for a user, with optional filtering by date range, author, and genre.
     * Returns enriched records including reading duration in days.
     *
     * Query params (all optional):
     *   startDate  – ISO datetime (e.g. 2024-01-01T00:00:00)
     *   endDate    – ISO datetime
     *   author     – partial, case-insensitive match on book author name
     *   genre      – partial, case-insensitive match on book genre
     */
    @GetMapping("/reading-history/user/{userId}")
    public ResponseEntity<?> getReadingHistory(
            @PathVariable Long userId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) String author,
            @RequestParam(required = false) String genre,
            @AuthenticationPrincipal LibraryPrincipal principal) {
        ownershipGuard.assertSelf(userId, principal);
        requireUser(userId);

        performAutoReturnExpiredBorrowings(userId);

        List<BorrowingRecord> records = borrowingRecordRepository.findByUserIdOrderByBorrowedDateDesc(userId);
        LocalDateTime now = LocalDateTime.now();

        LocalDateTime filterStart;
        LocalDateTime filterEnd;
        try {
            filterStart = (startDate == null || startDate.isBlank()) ? null : LocalDateTime.parse(startDate);
            filterEnd = (endDate == null || endDate.isBlank()) ? null : LocalDateTime.parse(endDate);
        } catch (Exception e) {
            return validationFailed("Invalid date format. Use ISO datetime (e.g. 2024-01-01T00:00:00)");
        }

        final LocalDateTime fStart = filterStart;
        final LocalDateTime fEnd = filterEnd;
        final String fAuthor = (author == null || author.isBlank()) ? null : author.trim().toLowerCase();
        final String fGenre = (genre == null || genre.isBlank()) ? null : genre.trim().toLowerCase();

        List<Map<String, Object>> history = records.stream()
                .filter(r -> fStart == null || !r.getBorrowedDate().isBefore(fStart))
                .filter(r -> fEnd == null || !r.getBorrowedDate().isAfter(fEnd))
                .filter(r -> {
                    if (fAuthor == null) return true;
                    if (r.getBook() == null) return false;
                    String bookAuthor = r.getBook().getAuthor();
                    return bookAuthor != null && bookAuthor.toLowerCase().contains(fAuthor);
                })
                .filter(r -> {
                    if (fGenre == null) return true;
                    if (r.getBook() == null) return false;
                    String bookGenre = r.getBook().getGenre();
                    return bookGenre != null && bookGenre.toLowerCase().contains(fGenre);
                })
                .map(r -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("recordId", r.getId());
                    item.put("bookId", r.getBook() != null ? r.getBook().getId() : null);
                    item.put("bookTitle", safeBookTitle(r));
                    item.put("author", r.getBook() != null ? r.getBook().getAuthor() : null);
                    item.put("genre", r.getBook() != null ? r.getBook().getGenre() : null);
                    item.put("borrowedDate", r.getBorrowedDate());
                    item.put("dueDate", r.getDueDate());
                    item.put("returnDate", r.getReturnDate());
                    item.put("status", r.getStatus());
                    item.put("readingProgress", r.getReadingProgress());

                    LocalDateTime end = r.getReturnDate() != null ? r.getReturnDate() : now;
                    item.put("readingDurationDays", ChronoUnit.DAYS.between(r.getBorrowedDate(), end));

                    return item;
                })
                .collect(Collectors.toList());

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("totalRecords", history.size());
        response.put("history", history);
        return ResponseEntity.ok(response);
    }

    /**
     * Update reading progress for an active borrowing record.
     * Request body: { "progress": 0-100 }
     */
    @PutMapping("/reading-progress/{recordId}")
    @Transactional
    public ResponseEntity<?> updateReadingProgress(@PathVariable Long recordId,
                                                   @RequestBody(required = false) Map<String, Object> request,
                                                   @AuthenticationPrincipal LibraryPrincipal principal) {
        Object progressObj = request == null ? null : request.get("progress");
        if (progressObj == null) {
            return validationFailed("progress is required (0-100)");
        }

        int progress;
        try {
            progress = Integer.parseInt(progressObj.toString());
        } catch (NumberFormatException e) {
            return validationFailed("progress must be a number between 0 and 100");
        }
        if (progress < 0 || progress > 100) {
            return validationFailed("progress must be between 0 and 100");
        }

        BorrowingRecord record = borrowingService.requireRecord(recordId);
        assertRecordOwner(record, principal);

        boolean isActiveBorrowing = BorrowingService.STATUS_BORROWED.equalsIgnoreCase(record.getStatus())
                && record.getReturnDate() == null;
        if (!isActiveBorrowing) {
            throw new ConflictException(
                    "Reading progress can only be updated for books that are currently borrowed and not yet returned");
        }

        record.setReadingProgress(progress);
        borrowingRecordRepository.save(record);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("recordId", recordId);
        response.put("readingProgress", progress);
        response.put("message", "Reading progress updated successfully");
        return ResponseEntity.ok(response);
    }

    /**
     * Get all borrowing records (for librarian)
     */
    @GetMapping("/borrowing-records")
    public ResponseEntity<?> getAllBorrowingRecords() {
        return ResponseEntity.ok(borrowingRecordRepository.findAll());
    }

    private ResponseEntity<ApiError> validationFailed(String message) {
        return ResponseEntity.badRequest().body(ApiError.of(ErrorCode.VALIDATION_FAILED, message));
    }

    private Long parseId(Object raw) {
        if (raw == null) {
            return null;
        }
        try {
            return Long.parseLong(raw.toString().trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private void requireUser(Long userId) {
        if (!userRepository.existsById(userId)) {
            throw new NotFoundException("User not found");
        }
    }

    private StudentNotification requireNotification(Long notificationId) {
        return studentNotificationRepository.findById(notificationId)
                .orElseThrow(() -> new NotFoundException("Notification not found"));
    }

    private void assertRecordOwner(BorrowingRecord record, LibraryPrincipal principal) {
        Long ownerId = record.getUser() != null ? record.getUser().getId() : null;
        ownershipGuard.assertOwner(ownerId, principal, "You may only access your own borrowing records.");
    }

    /**
     * Delegates auto-return of expired borrowings to BorrowingService,
     * which runs the logic in a proper REQUIRES_NEW transaction via Spring's proxy.
     */
    private void performAutoReturnExpiredBorrowings(Long userId) {
        try {
            borrowingService.autoReturnExpiredBorrowings(userId);
        } catch (Exception e) {
            // Log but don't fail the main request if auto-return fails
            logger.warning("Auto-return failed for user " + userId + ": " + e.getMessage());
        }
    }

    private String buildDueReminderMessage(BorrowingRecord record, long daysLeft) {
        String title = safeBookTitle(record);
        if (daysLeft < 0) {
            return "\"" + title + "\" is overdue. Please return it immediately.";
        }
        if (daysLeft == 0) {
            return "\"" + title + "\" is due today.";
        }
        return "\"" + title + "\" is due in " + daysLeft + " day" + (daysLeft > 1 ? "s" : "") + ".";
    }

    private String safeBookTitle(BorrowingRecord record) {
        return record.getBook() != null && record.getBook().getTitle() != null
                ? record.getBook().getTitle()
                : "Untitled book";
    }

    private Map<String, Object> mapStudentNotification(StudentNotification notification) {
        Map<String, Object> item = new HashMap<>();
        item.put("notificationId", notification.getId());
        item.put("category", notification.getCategory());
        item.put("title", notification.getTitle());
        item.put("message", notification.getMessage());
        item.put("timestamp", notification.getCreatedAt());
        item.put("priority", notification.getPriority());
        item.put("referenceBookId", notification.getReferenceBookId());
        item.put("isRead", notification.isRead());
        return item;
    }

    /** Serialized recommendation payload — never a Book entity. */
    private static class Recommendation {
        private final Long bookId;
        private final String title;
        private final String author;
        private final String genre;
        private final Integer availableQuantity;
        private final long popularityScore;
        private final long genreMatchScore;
        private final long score;
        private final String reason;

        Recommendation(Long bookId, String title, String author, String genre, Integer availableQuantity,
                       long popularityScore, long genreMatchScore, long score, String reason) {
            this.bookId = bookId;
            this.title = title;
            this.author = author;
            this.genre = genre;
            this.availableQuantity = availableQuantity;
            this.popularityScore = popularityScore;
            this.genreMatchScore = genreMatchScore;
            this.score = score;
            this.reason = reason;
        }

        public Long getBookId() {
            return bookId;
        }

        public String getTitle() {
            return title;
        }

        public String getAuthor() {
            return author;
        }

        public String getGenre() {
            return genre;
        }

        public Integer getAvailableQuantity() {
            return availableQuantity;
        }

        public long getPopularityScore() {
            return popularityScore;
        }

        public long getGenreMatchScore() {
            return genreMatchScore;
        }

        public long getScore() {
            return score;
        }

        public String getReason() {
            return reason;
        }
    }
}
