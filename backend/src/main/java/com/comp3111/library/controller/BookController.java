package com.comp3111.library.controller;

import com.comp3111.library.dto.BookApprovalRequest;
import com.comp3111.library.dto.BookListDto;
import com.comp3111.library.dto.PendingBookDto;
import com.comp3111.library.dto.AuthorBookUpdateRequest;
import com.comp3111.library.dto.AuthorBulkDeleteRequest;
import com.comp3111.library.exception.AiDisabledException;
import com.comp3111.library.exception.ConflictException;
import com.comp3111.library.exception.NotFoundException;
import com.comp3111.library.model.Book;
import com.comp3111.library.model.BookChangeLog;
import com.comp3111.library.model.StudentNotification;
import com.comp3111.library.model.User;
import com.comp3111.library.repository.BookChangeLogRepository;
import com.comp3111.library.repository.BookRepository;
import com.comp3111.library.repository.BookRequestRepository;
import com.comp3111.library.repository.BookReviewRepository;
import com.comp3111.library.repository.UserRepository;
import com.comp3111.library.repository.BorrowingRecordRepository;
import com.comp3111.library.repository.StudentNotificationRepository;
import com.comp3111.library.model.BookRequest;
import com.comp3111.library.security.LibraryPrincipal;
import com.comp3111.library.security.OwnershipGuard;
import com.comp3111.library.service.BookSubmissionService;
import com.comp3111.library.service.FileStorageService;
import com.comp3111.library.service.GeminiService;
import com.comp3111.library.service.PreparedBookFile;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.validation.Valid;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.OptionalDouble;
import java.util.Set;
import java.util.HashSet;
import java.time.LocalDateTime;
import java.util.logging.Logger;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/books")
public class BookController {

    private static final Logger logger = Logger.getLogger(BookController.class.getName());

    @Autowired
    private BookRepository bookRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private FileStorageService fileStorageService;

    @Autowired
    private BookSubmissionService bookSubmissionService;

    @Autowired
    private BorrowingRecordRepository borrowingRecordRepository;

    @Autowired
    private StudentNotificationRepository studentNotificationRepository;

    @Autowired
    private BookReviewRepository bookReviewRepository;

    @Autowired
    private BookRequestRepository bookRequestRepository;

    @Autowired
    private BookChangeLogRepository bookChangeLogRepository;

    @Autowired
    private OwnershipGuard ownershipGuard;

    @Autowired
    private GeminiService geminiService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Generate an AI book summary using Gemini.
     * Supports both JSON and multipart form submissions so uploaded files can be used as context.
     */
    @PostMapping(value = "/generate-summary", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> generateBookSummaryFromFile(
            @RequestParam String title,
            @RequestParam(required = false) List<String> genres,
            @RequestParam(required = false, defaultValue = "medium") String style,
            @RequestPart(value = "file", required = false) MultipartFile file) {

        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("Title is required to generate a summary");
        }

        try {
            String summary = (file != null && !file.isEmpty())
                    ? geminiService.generateBookSummary(title, genres, style, file)
                    : geminiService.generateBookSummary(title, genres, style);
            Map<String, String> response = new HashMap<>();
            response.put("summary", summary);
            return ResponseEntity.ok(response);
        } catch (IllegalStateException e) {
            throw new AiDisabledException(e.getMessage());
        }
    }

    @PostMapping(value = "/generate-summary", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> generateBookSummary(@RequestBody Map<String, Object> request) {
        String title = (String) request.get("title");
        @SuppressWarnings("unchecked")
        List<String> genres = (List<String>) request.get("genres");
        String style = (String) request.getOrDefault("style", "medium");

        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("Title is required to generate a summary");
        }

        try {
            String summary = geminiService.generateBookSummary(title, genres, style);
            Map<String, String> response = new HashMap<>();
            response.put("summary", summary);
            return ResponseEntity.ok(response);
        } catch (IllegalStateException e) {
            throw new AiDisabledException(e.getMessage());
        }
    }

    /**
     * Submit a new book for approval (Author only)
     */
    @PostMapping(value = "/submit", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> submitBook(
            @RequestParam Long authorId,
            @RequestParam String title,
            @RequestParam(required = false) List<String> genres,
            @RequestParam String description,
            @RequestPart("file") MultipartFile file,
            @RequestPart(value = "coverImage", required = false) MultipartFile coverImage,
            @AuthenticationPrincipal LibraryPrincipal principal) throws IOException {
        ownershipGuard.assertSelf(authorId, principal);
        logger.info("Book submission received for authorId=" + authorId + ", title=" + title);

        String validationError = validateBookSubmission(title, genres, description, file, coverImage);
        if (validationError != null) {
            throw new IllegalArgumentException(validationError);
        }

        PreparedBookFile preparedFile = fileStorageService.prepareMultipartFile(file);
        PreparedBookFile preparedCoverImage = (coverImage != null && !coverImage.isEmpty())
                ? fileStorageService.prepareMultipartFile(coverImage)
                : null;
        Book savedBook = bookSubmissionService.submitBook(
                authorId,
                title,
                genres,
                description,
                preparedFile,
                preparedCoverImage
        );
        logger.info("Book submission saved successfully for bookId=" + savedBook.getId() + ", authorId=" + authorId);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedBook);
    }

    /**
     * Get all pending books for approval (Librarian only)
     */
    @GetMapping("/pending")
    public ResponseEntity<List<PendingBookDto>> getPendingBooks(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        Pageable pageable = buildPageable(page, size);
        List<PendingBookDto> pendingBooks = bookRepository
                .findPendingBookListByStatus(Book.BookStatus.PENDING, pageable)
                .getContent();
        pendingBooks.forEach(this::ensurePendingFileReference);

        return ResponseEntity.ok(pendingBooks);
    }

    /**
     * Approve or reject a book (Librarian only)
     */
    @PostMapping("/approve")
    public ResponseEntity<?> approveBook(@Valid @RequestBody BookApprovalRequest request,
                                         @AuthenticationPrincipal LibraryPrincipal principal) {
        Book book = bookRepository.findById(request.getBookId())
                .orElseThrow(() -> new NotFoundException("Book not found: " + request.getBookId()));

        if (book.getStatus() != Book.BookStatus.PENDING) {
            throw new ConflictException("Book is not pending approval");
        }

        Book snapshot = cloneBookSnapshot(book);
        if (request.getApproved()) {
            book.setStatus(Book.BookStatus.APPROVED);
            book.setPublishedDate(java.time.LocalDate.now());
            // Safe direct write: a PENDING book cannot have been borrowed yet.
            book.setQuantity(request.getQuantity() == null ? 1 : request.getQuantity());
            book.setRejectionReason(null);
        } else {
            book.setStatus(Book.BookStatus.REJECTED);
            String reason = request.getRejectionReason();
            String normalizedReason = reason == null ? null : reason.trim();
            if (normalizedReason != null && normalizedReason.isEmpty()) {
                normalizedReason = null;
            }
            book.setRejectionReason(normalizedReason);
        }

        Book saved = bookRepository.save(book);
        recordBookChange(saved.getId(), ownershipGuard.actingUserId(principal),
                request.getApproved() ? "APPROVE" : "REJECT", snapshot, saved);
        logger.info("Book " + request.getBookId() + " " + (request.getApproved() ? "approved" : "rejected"));

        // Notify users whose book requests match this title that the book is now available
        if (request.getApproved()) {
            notifyBookRequestersOnApproval(saved);
        }

        return ResponseEntity.ok("Book " + (request.getApproved() ? "approved" : "rejected") + " successfully");
    }

    /**
     * Get all books submitted by a specific author (including pending/published/rejected)
     */
    @GetMapping("/author/{authorId}")
    public ResponseEntity<?> getBooksByAuthor(
            @PathVariable Long authorId,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @AuthenticationPrincipal LibraryPrincipal principal) {
        ownershipGuard.assertSelf(authorId, principal);
        if (!userRepository.existsById(authorId)) {
            throw new NotFoundException("Author not found: " + authorId);
        }

        Pageable pageable = buildPageable(page, size);
        List<BookListDto> authorBooks = bookRepository.findBookListByAuthorId(authorId, pageable).getContent();
        authorBooks.forEach(this::ensureBookFileReference);

        List<Long> approvedBookIds = authorBooks.stream()
                .filter(b -> b.getStatus() == Book.BookStatus.APPROVED)
                .map(BookListDto::getId)
                .collect(Collectors.toList());
        if (!approvedBookIds.isEmpty()) {
            Map<Long, Long> activeBorrowsMap = new HashMap<>();
            borrowingRecordRepository.countActiveBorrowsByBookIds(approvedBookIds)
                    .forEach(r -> activeBorrowsMap.put(r.getBookId(), r.getCount()));
            authorBooks.forEach(book -> {
                if (book.getStatus() == Book.BookStatus.APPROVED) {
                    book.setActiveBorrows(activeBorrowsMap.getOrDefault(book.getId(), 0L));
                }
            });
        }

        return ResponseEntity.ok(authorBooks);
    }

    /**
     * Get aggregated statistics for all books by a specific author.
     */
    @GetMapping("/author/{authorId}/stats")
    public ResponseEntity<?> getAuthorStats(@PathVariable Long authorId,
                                            @AuthenticationPrincipal LibraryPrincipal principal) {
        ownershipGuard.assertSelf(authorId, principal);
        if (!userRepository.existsById(authorId)) {
            throw new NotFoundException("Author not found: " + authorId);
        }

        List<Book> allBooks = bookRepository.findByAuthorId(authorId);
        List<Long> allBookIds = allBooks.stream().map(Book::getId).collect(Collectors.toList());
        List<Long> publishedBookIds = allBooks.stream()
                .filter(b -> b.getStatus() == Book.BookStatus.APPROVED)
                .map(Book::getId)
                .collect(Collectors.toList());

        // Batch fetch borrow stats for published books only
        Map<Long, Long> totalBorrowsMap = new HashMap<>();
        Map<Long, Long> activeBorrowsMap = new HashMap<>();
        Map<Long, Long> uniqueReadersMap = new HashMap<>();
        Map<Long, Long> completedReadsMap = new HashMap<>();
        if (!publishedBookIds.isEmpty()) {
            borrowingRecordRepository.countTotalBorrowsByBookIds(publishedBookIds)
                    .forEach(r -> totalBorrowsMap.put(r.getBookId(), r.getCount()));
            borrowingRecordRepository.countActiveBorrowsByBookIds(publishedBookIds)
                    .forEach(r -> activeBorrowsMap.put(r.getBookId(), r.getCount()));
            borrowingRecordRepository.countUniqueReadersByBookIds(publishedBookIds)
                    .forEach(r -> uniqueReadersMap.put(r.getBookId(), r.getCount()));
            borrowingRecordRepository.countCompletedReadsByBookIds(publishedBookIds)
                    .forEach(r -> completedReadsMap.put(r.getBookId(), r.getCount()));
        }

        // Batch fetch review stats
        Map<Long, BookReviewRepository.BookRatingAggregate> ratingAggregates = allBookIds.isEmpty()
                ? Collections.emptyMap()
                : bookReviewRepository.findRatingAggregatesByBookIds(allBookIds).stream()
                .collect(Collectors.toMap(BookReviewRepository.BookRatingAggregate::getBookId, a -> a));

        // Rating distribution across all published books
        Map<Integer, Long> ratingDistribution = new LinkedHashMap<>();
        for (int i = 1; i <= 5; i++) ratingDistribution.put(i, 0L);
        if (!publishedBookIds.isEmpty()) {
            bookReviewRepository.countRatingDistributionByBookIds(publishedBookIds)
                    .forEach(r -> ratingDistribution.put(r.getRating(), r.getCount()));
        }

        // Build per-book stats
        List<Map<String, Object>> bookStats = allBooks.stream().map(book -> {
            Map<String, Object> stat = new LinkedHashMap<>();
            stat.put("bookId", book.getId());
            stat.put("title", book.getTitle());
            stat.put("genre", book.getGenre());
            stat.put("status", book.getStatus().name());
            stat.put("publishedDate", book.getPublishedDate());
            stat.put("totalBorrows", totalBorrowsMap.getOrDefault(book.getId(), 0L));
            stat.put("activeBorrows", activeBorrowsMap.getOrDefault(book.getId(), 0L));
            stat.put("uniqueReaders", uniqueReadersMap.getOrDefault(book.getId(), 0L));
            stat.put("completedReads", completedReadsMap.getOrDefault(book.getId(), 0L));
            BookReviewRepository.BookRatingAggregate agg = ratingAggregates.get(book.getId());
            stat.put("averageRating", agg != null ? agg.getAverageRating() : null);
            stat.put("reviewCount", agg != null ? agg.getReviewCount() : 0L);
            return stat;
        }).collect(Collectors.toList());

        // Build summary
        long totalBorrows = totalBorrowsMap.values().stream().mapToLong(Long::longValue).sum();
        long totalCompletedReads = completedReadsMap.values().stream().mapToLong(Long::longValue).sum();
        long totalReviews = ratingAggregates.values().stream().mapToLong(a -> a.getReviewCount()).sum();
        OptionalDouble overallAvgRating = ratingAggregates.values().stream()
                .filter(a -> a.getAverageRating() != null)
                .mapToDouble(a -> a.getAverageRating())
                .average();

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalBooks", allBooks.size());
        summary.put("publishedBooks", (int) allBooks.stream().filter(b -> b.getStatus() == Book.BookStatus.APPROVED).count());
        summary.put("pendingBooks", (int) allBooks.stream().filter(b -> b.getStatus() == Book.BookStatus.PENDING).count());
        summary.put("rejectedBooks", (int) allBooks.stream().filter(b -> b.getStatus() == Book.BookStatus.REJECTED).count());
        summary.put("totalBorrows", totalBorrows);
        summary.put("totalCompletedReads", totalCompletedReads);
        summary.put("totalReviews", totalReviews);
        summary.put("overallAverageRating", overallAvgRating.isPresent() ? Math.round(overallAvgRating.getAsDouble() * 10.0) / 10.0 : null);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("summary", summary);
        response.put("books", bookStats);
        response.put("ratingDistribution", ratingDistribution);

        return ResponseEntity.ok(response);
    }

    /**
     * Borrowing trend data (weekly or monthly) for an author's published books.
     */
    @GetMapping("/author/{authorId}/stats/trends")
    public ResponseEntity<?> getAuthorStatsTrends(
            @PathVariable Long authorId,
            @RequestParam(defaultValue = "monthly") String period,
            @AuthenticationPrincipal LibraryPrincipal principal) {
        ownershipGuard.assertSelf(authorId, principal);

        List<Long> publishedBookIds = bookRepository.findByAuthorId(authorId).stream()
                .filter(b -> b.getStatus() == Book.BookStatus.APPROVED)
                .map(Book::getId)
                .collect(Collectors.toList());

        if (publishedBookIds.isEmpty()) {
            return ResponseEntity.ok(Collections.emptyList());
        }

        List<Object[]> raw = "weekly".equals(period)
                ? borrowingRecordRepository.countWeeklyBorrowsByBookIds(publishedBookIds)
                : borrowingRecordRepository.countMonthlyBorrowsByBookIds(publishedBookIds);

        List<Map<String, Object>> result = raw.stream().map(row -> {
            Map<String, Object> point = new LinkedHashMap<>();
            point.put("period", row[0]);
            point.put("count", ((Number) row[1]).longValue());
            return point;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    /**
     * Get all approved books (for browsing), enriched with average rating and review count.
     */
    @GetMapping
    public ResponseEntity<List<BookListDto>> getApprovedBooks(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        Pageable pageable = buildPageable(page, size);
        List<BookListDto> approvedBooks = bookRepository
                .findBookListByStatus(Book.BookStatus.APPROVED, pageable)
                .getContent();
        List<Long> bookIds = approvedBooks.stream().map(BookListDto::getId).collect(Collectors.toList());
        Map<Long, BookReviewRepository.BookRatingAggregate> aggregateByBookId = bookIds.isEmpty()
                ? Collections.emptyMap()
                : bookReviewRepository.findRatingAggregatesByBookIds(bookIds).stream()
                .collect(Collectors.toMap(BookReviewRepository.BookRatingAggregate::getBookId, aggregate -> aggregate));
        approvedBooks.forEach(book -> {
            ensureBookFileReference(book);
            BookReviewRepository.BookRatingAggregate aggregate = aggregateByBookId.get(book.getId());
            book.setAverageRating(aggregate != null ? aggregate.getAverageRating() : null);
            book.setReviewCount(aggregate != null ? aggregate.getReviewCount() : 0L);
        });
        return ResponseEntity.ok(approvedBooks);
    }

    /**
     * Get all books for librarian management (with filters).
     */
    @GetMapping("/manage")
    public ResponseEntity<?> getBooksForManagement(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String genre,
            @RequestParam(required = false) String author,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String source,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {

        Pageable pageable = buildPageable(page, size);
        List<BookListDto> books = bookRepository.findBookListAll(pageable).getContent();
        books.forEach(this::ensureBookFileReference);

        String normalizedStatus = normalize(status);
        String normalizedGenre = normalize(genre);
        String normalizedAuthor = normalize(author);
        String normalizedQuery = normalize(query);
        String normalizedSource = normalize(source);

        // Create effectively-final variables for use in lambda expressions
        final String statusFilter = "ALL".equals(normalizedStatus) ? null : normalizedStatus;
        final String sourceFilter = "ALL".equals(normalizedSource) ? null : normalizedSource;
        final String genreFilter = normalizedGenre;
        final String authorFilter = normalizedAuthor;
        final String queryFilter = normalizedQuery;

        List<BookListDto> filtered = books.stream()
                .filter(book -> {
                    if (statusFilter == null) return true;
                    return book.getStatus() != null && statusFilter.equals(book.getStatus().name());
                })
                .filter(book -> {
                    if (sourceFilter == null) return true;
                    return book.getSource() != null && sourceFilter.equals(book.getSource().name());
                })
                .filter(book -> {
                    if (genreFilter == null) return true;
                    return containsIgnoreCase(book.getGenre(), genreFilter);
                })
                .filter(book -> {
                    if (authorFilter == null) return true;
                    return containsIgnoreCase(book.getAuthor(), authorFilter);
                })
                .filter(book -> {
                    if (queryFilter == null) return true;
                    return containsIgnoreCase(book.getTitle(), queryFilter)
                            || containsIgnoreCase(book.getAuthor(), queryFilter)
                            || containsIgnoreCase(book.getGenre(), queryFilter);
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(filtered);
    }

    /**
     * Add a new book directly (librarian only).
     * The librarian becomes the book owner. Author name is provided as free text.
     */
    @PostMapping(value = "/manage", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> addBookByLibrarian(
            @RequestParam(required = false) String authorName,
            @RequestParam String title,
            @RequestParam(required = false) List<String> genres,
            @RequestParam String description,
            @RequestParam(required = false) Integer quantity,
            @RequestPart("file") MultipartFile file,
            @RequestPart(value = "coverImage", required = false) MultipartFile coverImage,
            @AuthenticationPrincipal LibraryPrincipal principal) throws IOException {

        Long librarianId = requireLibrarianId(principal);

        String validationError = validateLibrarianBookInput(title, genres, description, file, coverImage);
        if (validationError != null) {
            throw new IllegalArgumentException(validationError);
        }

        User librarian = userRepository.findById(librarianId)
                .orElseThrow(() -> new NotFoundException("Librarian not found: " + librarianId));

        PreparedBookFile preparedFile = fileStorageService.prepareMultipartFile(file);
        PreparedBookFile preparedCoverImage = (coverImage != null && !coverImage.isEmpty())
                ? fileStorageService.prepareMultipartFile(coverImage)
                : null;

        Book book = new Book();
        book.setTitle(title.trim());
        book.setGenre(normalizeGenres(genres));
        book.setDescription(description.trim());
        book.setAuthorId(librarianId);
        book.setAuthorUser(librarian);
        if (authorName != null && !authorName.trim().isEmpty()) {
            book.setAuthorDisplayName(authorName.trim());
        }
        book.setSubmittedDate(LocalDateTime.now());
        book.setPublishedDate(java.time.LocalDate.now());
        book.setStatus(Book.BookStatus.APPROVED);
        // Safe direct write: the book row does not exist yet, so nothing can be borrowing it.
        book.setQuantity(safeQuantity(quantity));
        book.setSource(Book.BookSource.LIBRARIAN_MANUAL);
        fileStorageService.attachPreparedFileToBook(book, preparedFile);
        if (preparedCoverImage != null) {
            fileStorageService.attachPreparedCoverImageToBook(book, preparedCoverImage);
        }

        Book saved = bookRepository.save(book);
        saved.setFilePath(fileStorageService.buildBookFileReference(saved.getId()));
        bookRepository.save(saved);

        recordBookChange(saved.getId(), librarianId, "CREATE", null, saved);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    /**
     * Update an existing book (librarian only).
     */
    @PutMapping(value = "/manage/{bookId}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public ResponseEntity<?> updateBookByLibrarian(
            @PathVariable Long bookId,
            @RequestParam String title,
            @RequestParam(required = false) List<String> genres,
            @RequestParam String description,
            @RequestParam(required = false) Integer quantity,
            @RequestParam(required = false) String status,
            @RequestPart(value = "file", required = false) MultipartFile file,
            @RequestPart(value = "coverImage", required = false) MultipartFile coverImage,
            @AuthenticationPrincipal LibraryPrincipal principal) throws IOException {

        Long librarianId = requireLibrarianId(principal);

        Book book = bookRepository.findById(bookId)
                .orElseThrow(() -> new NotFoundException("Book not found: " + bookId));

        String validationError = validateLibrarianBookUpdate(title, genres, description, file, coverImage, status);
        if (validationError != null) {
            throw new IllegalArgumentException(validationError);
        }

        Book snapshot = cloneBookSnapshot(book);
        Integer requestedQuantity = quantity == null ? null : clampStock(quantity);

        book.setTitle(title.trim());
        book.setGenre(normalizeGenres(genres));
        book.setDescription(description.trim());

        if (status != null && !status.isBlank()) {
            Book.BookStatus nextStatus = Book.BookStatus.valueOf(status.trim().toUpperCase());
            book.setStatus(nextStatus);
            if (nextStatus == Book.BookStatus.APPROVED && book.getPublishedDate() == null) {
                book.setPublishedDate(java.time.LocalDate.now());
            }
        }

        if (file != null && !file.isEmpty()) {
            PreparedBookFile preparedFile = fileStorageService.prepareMultipartFile(file);
            fileStorageService.attachPreparedFileToBook(book, preparedFile);
        }
        if (coverImage != null && !coverImage.isEmpty()) {
            PreparedBookFile preparedCoverImage = fileStorageService.prepareMultipartFile(coverImage);
            fileStorageService.attachPreparedCoverImageToBook(book, preparedCoverImage);
        }

        refreshQuantityFromDatabase(book);
        Book saved = bookRepository.save(book);
        if (saved.getFilePath() == null || saved.getFilePath().isBlank()) {
            saved.setFilePath(fileStorageService.buildBookFileReference(saved.getId()));
            bookRepository.save(saved);
        }
        applyExplicitQuantity(saved, requestedQuantity);

        recordBookChange(saved.getId(), librarianId, "UPDATE", snapshot, saved);
        return ResponseEntity.ok(saved);
    }

    /**
     * Delete a book (librarian only).
     */
    @DeleteMapping("/manage/{bookId}")
    public ResponseEntity<?> deleteBookByLibrarian(
            @PathVariable Long bookId,
            @AuthenticationPrincipal LibraryPrincipal principal) {

        Long librarianId = requireLibrarianId(principal);

        Book book = bookRepository.findById(bookId)
                .orElseThrow(() -> new NotFoundException("Book not found: " + bookId));

        String notDeletableReason = getNotDeletableReason(book);
        if (notDeletableReason != null) {
            throw new ConflictException(notDeletableReason);
        }

        Book snapshot = cloneBookSnapshot(book);
        List<Long> borrowerIds = findBorrowerIds(book);
        bookRepository.delete(book);
        emitBookDeletionNotifications(snapshot, borrowerIds);
        recordBookChange(null, librarianId, "DELETE", snapshot, null);
        return ResponseEntity.ok("Book deleted successfully");
    }

    /**
     * Bulk update book status/quantity (librarian only).
     */
    @PutMapping("/manage/bulk-update")
    @Transactional
    public ResponseEntity<?> bulkUpdateBooks(@RequestBody Map<String, Object> body,
                                             @AuthenticationPrincipal LibraryPrincipal principal) {
        Long librarianId = requireLibrarianId(principal);

        List<Long> bookIds = requireBookIds(body.get("bookIds"));

        String statusValue = body.get("status") != null ? body.get("status").toString().trim() : null;
        Integer quantity = null;
        if (body.get("quantity") != null) {
            try {
                quantity = Integer.parseInt(body.get("quantity").toString());
            } catch (NumberFormatException ignored) {
                throw new IllegalArgumentException("quantity must be a number");
            }
        }

        if ((statusValue == null || statusValue.isBlank()) && quantity == null) {
            throw new IllegalArgumentException("Provide status and/or quantity to update");
        }

        Book.BookStatus nextStatus = null;
        if (statusValue != null && !statusValue.isBlank()) {
            try {
                nextStatus = Book.BookStatus.valueOf(statusValue.toUpperCase());
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("Invalid status value");
            }
        }

        Integer requestedQuantity = quantity == null ? null : clampStock(quantity);

        List<Book> books = bookRepository.findAllById(bookIds);
        Map<Long, Book> byId = books.stream().collect(Collectors.toMap(Book::getId, b -> b));

        List<Long> updated = new ArrayList<>();
        List<Map<String, Object>> failed = new ArrayList<>();

        for (Long bookId : bookIds) {
            Book book = byId.get(bookId);
            if (book == null) {
                failed.add(buildBulkDeleteFailure(bookId, "Book not found"));
                continue;
            }
            Book snapshot = cloneBookSnapshot(book);
            if (nextStatus != null) {
                book.setStatus(nextStatus);
                if (nextStatus == Book.BookStatus.APPROVED && book.getPublishedDate() == null) {
                    book.setPublishedDate(java.time.LocalDate.now());
                }
            }
            refreshQuantityFromDatabase(book);
            bookRepository.save(book);
            if (requestedQuantity != null) {
                book.setQuantity(requestedQuantity);
            }
            recordBookChange(book.getId(), librarianId, "UPDATE", snapshot, book);
            updated.add(bookId);
        }

        // One statement for the whole batch: setQuantityAbsolute* clears the persistence
        // context, so running it per book would turn every later save into a full merge.
        if (requestedQuantity != null && !updated.isEmpty()) {
            bookRepository.setQuantityAbsoluteForIds(updated, requestedQuantity);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("success", failed.isEmpty());
        response.put("requestedCount", bookIds.size());
        response.put("updatedCount", updated.size());
        response.put("failedCount", failed.size());
        response.put("updatedBookIds", updated);
        response.put("failedBooks", failed);
        response.put("message", failed.isEmpty() ? "Books updated successfully" : "Bulk update completed with partial failures");
        return ResponseEntity.ok(response);
    }

    /**
     * Bulk delete books (librarian only).
     */
    @DeleteMapping("/manage/bulk-delete")
    public ResponseEntity<?> bulkDeleteBooks(@RequestBody Map<String, Object> body,
                                             @AuthenticationPrincipal LibraryPrincipal principal) {
        Long librarianId = requireLibrarianId(principal);

        List<Long> bookIds = requireBookIds(body.get("bookIds"));

        List<Book> books = bookRepository.findAllById(bookIds);
        Map<Long, Book> byId = books.stream().collect(Collectors.toMap(Book::getId, b -> b));

        List<Long> deleted = new ArrayList<>();
        List<Map<String, Object>> failed = new ArrayList<>();

        for (Long bookId : bookIds) {
            Book book = byId.get(bookId);
            if (book == null) {
                failed.add(buildBulkDeleteFailure(bookId, "Book not found"));
                continue;
            }
            String notDeletableReason = getNotDeletableReason(book);
            if (notDeletableReason != null) {
                failed.add(buildBulkDeleteFailure(bookId, notDeletableReason));
                continue;
            }
            Book snapshot = cloneBookSnapshot(book);
            List<Long> borrowerIds = findBorrowerIds(book);
            bookRepository.delete(book);
            emitBookDeletionNotifications(snapshot, borrowerIds);
            recordBookChange(null, librarianId, "DELETE", snapshot, null);
            deleted.add(bookId);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("success", failed.isEmpty());
        response.put("requestedCount", bookIds.size());
        response.put("deletedCount", deleted.size());
        response.put("failedCount", failed.size());
        response.put("deletedBookIds", deleted);
        response.put("failedBooks", failed);
        response.put("message", failed.isEmpty() ? "Books deleted successfully" : "Bulk delete completed with partial failures");
        return ResponseEntity.ok(response);
    }

    /**
     * Version history for a book (librarian only).
     */
    @GetMapping("/manage/{bookId}/history")
    public ResponseEntity<?> getBookHistory(@PathVariable Long bookId) {
        return ResponseEntity.ok(bookChangeLogRepository.findByBookIdOrderByCreatedAtDesc(bookId));
    }

    /**
     * Stats for downloaded books only (librarian view).
     */
    @GetMapping("/downloaded/stats")
    public ResponseEntity<?> getDownloadedBookStats() {
        List<Book> downloadedBooks = bookRepository.findBySource(Book.BookSource.REQUEST_DOWNLOAD);
        return ResponseEntity.ok(buildStatsResponse(downloadedBooks));
    }

    /**
     * Borrowing trends for downloaded books.
     */
    @GetMapping("/downloaded/stats/trends")
    public ResponseEntity<?> getDownloadedBookTrends(
            @RequestParam(defaultValue = "monthly") String period) {

        List<Long> downloadedIds = bookRepository.findBySource(Book.BookSource.REQUEST_DOWNLOAD).stream()
                .map(Book::getId)
                .collect(Collectors.toList());

        if (downloadedIds.isEmpty()) {
            return ResponseEntity.ok(Collections.emptyList());
        }

        List<Object[]> raw = "weekly".equals(period)
                ? borrowingRecordRepository.countWeeklyBorrowsByBookIds(downloadedIds)
                : borrowingRecordRepository.countMonthlyBorrowsByBookIds(downloadedIds);

        List<Map<String, Object>> result = raw.stream().map(row -> {
            Map<String, Object> point = new LinkedHashMap<>();
            point.put("period", row[0]);
            point.put("count", ((Number) row[1]).longValue());
            return point;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    /**
     * Update a submitted book owned by the author (rejected books cannot be edited)
     */
    @PutMapping("/author/{authorId}/{bookId}")
    public ResponseEntity<?> updateAuthorBook(
            @PathVariable Long authorId,
            @PathVariable Long bookId,
            @Valid @RequestBody AuthorBookUpdateRequest request,
            @AuthenticationPrincipal LibraryPrincipal principal) {
        ownershipGuard.assertSelf(authorId, principal);
        if (!request.getAuthorId().equals(authorId)) {
            throw new IllegalArgumentException("authorId must match the URL path");
        }

        Book book = bookRepository.findByIdAndAuthorId(bookId, authorId)
                .orElseThrow(() -> new NotFoundException("Book not found for this author: " + bookId));

        if (book.getStatus() == Book.BookStatus.REJECTED) {
            throw new ConflictException("Rejected books cannot be edited");
        }

        if (book.getStatus() == Book.BookStatus.APPROVED) {
            long activeBorrowCount = borrowingRecordRepository.countByBookIdAndStatus(book.getId(), "BORROWED");
            if (activeBorrowCount > 0) {
                throw new ConflictException("Cannot edit this published book because it is currently borrowed by a user");
            }
        }

        Book snapshot = cloneBookSnapshot(book);
        book.setTitle(request.getTitle().trim());
        book.setGenre(request.getGenre().trim());
        book.setDescription(request.getDescription().trim());

        Book updatedBook = bookRepository.save(book);
        recordBookChange(updatedBook.getId(), authorId, "UPDATE", snapshot, updatedBook);
        logger.info("Author " + authorId + " updated book " + bookId);
        return ResponseEntity.ok(updatedBook);
    }

    /**
     * Delete a submitted book owned by the author
     */
    @DeleteMapping("/author/{authorId}/{bookId}")
    public ResponseEntity<?> deleteAuthorBook(
            @PathVariable Long authorId,
            @PathVariable Long bookId,
            @AuthenticationPrincipal LibraryPrincipal principal) {
        ownershipGuard.assertSelf(authorId, principal);

        Book book = bookRepository.findByIdAndAuthorId(bookId, authorId)
                .orElseThrow(() -> new NotFoundException("Book not found for this author: " + bookId));

        String notDeletableReason = getNotDeletableReason(book);
        if (notDeletableReason != null) {
            throw new ConflictException(notDeletableReason);
        }

        Book snapshot = cloneBookSnapshot(book);
        List<Long> borrowerIds = findBorrowerIds(book);
        bookRepository.delete(book);
        emitBookDeletionNotifications(snapshot, borrowerIds);
        recordBookChange(null, authorId, "DELETE", snapshot, null);
        logger.info("Author " + authorId + " deleted book " + bookId);
        return ResponseEntity.ok("Book deleted successfully");
    }

    /**
     * Bulk delete submitted books owned by the author
     */
    @DeleteMapping("/author/{authorId}/bulk-delete")
    public ResponseEntity<?> bulkDeleteAuthorBooks(
            @PathVariable Long authorId,
            @Valid @RequestBody AuthorBulkDeleteRequest request,
            @AuthenticationPrincipal LibraryPrincipal principal) {
        ownershipGuard.assertSelf(authorId, principal);

        List<Long> inputIds = request.getBookIds().stream()
                .filter(id -> id != null && id > 0)
                .distinct()
                .collect(Collectors.toList());
        if (inputIds.isEmpty()) {
            throw new IllegalArgumentException("bookIds is required");
        }

        List<Book> ownedBooks = bookRepository.findByIdInAndAuthorId(inputIds, authorId);
        Map<Long, Book> ownedById = ownedBooks.stream().collect(Collectors.toMap(Book::getId, b -> b));

        List<Long> deletedBookIds = new ArrayList<>();
        List<Map<String, Object>> failedBooks = new ArrayList<>();

        for (Long bookId : inputIds) {
            Book book = ownedById.get(bookId);
            if (book == null) {
                failedBooks.add(buildBulkDeleteFailure(bookId, "Book not found for this author"));
                continue;
            }

            String notDeletableReason = getNotDeletableReason(book);
            if (notDeletableReason != null) {
                failedBooks.add(buildBulkDeleteFailure(bookId, notDeletableReason));
                continue;
            }

            Book snapshot = cloneBookSnapshot(book);
            List<Long> borrowerIds = findBorrowerIds(book);
            bookRepository.delete(book);
            emitBookDeletionNotifications(snapshot, borrowerIds);
            recordBookChange(null, authorId, "DELETE", snapshot, null);
            deletedBookIds.add(bookId);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("success", failedBooks.isEmpty());
        response.put("requestedCount", inputIds.size());
        response.put("deletedCount", deletedBookIds.size());
        response.put("failedCount", failedBooks.size());
        response.put("deletedBookIds", deletedBookIds);
        response.put("failedBooks", failedBooks);
        response.put(
                "message",
                failedBooks.isEmpty()
                        ? "Books deleted successfully"
                        : "Bulk delete completed with partial failures"
        );

        logger.info("Author " + authorId + " bulk delete requested=" + inputIds.size()
                + ", deleted=" + deletedBookIds.size() + ", failed=" + failedBooks.size());
        return ResponseEntity.ok(response);
    }

    private Pageable buildPageable(Integer page, Integer size) {
        if (page == null || size == null) {
            return Pageable.unpaged();
        }
        return PageRequest.of(Math.max(page, 0), sanitizePageSize(size));
    }

    private int sanitizePageSize(int size) {
        if (size < 1) {
            return 50;
        }
        return Math.min(size, 200);
    }

    private void ensureBookFileReference(BookListDto book) {
        boolean hasFileMetadata = (book.getFileSize() != null && book.getFileSize() > 0)
                || (book.getFileName() != null && !book.getFileName().isBlank());
        if (hasFileMetadata && (book.getFilePath() == null || book.getFilePath().isBlank())) {
            book.setFilePath(fileStorageService.buildBookFileReference(book.getId()));
        }
    }

    private void ensurePendingFileReference(PendingBookDto book) {
        if (book.getFilePath() == null || book.getFilePath().isBlank()) {
            book.setFilePath(fileStorageService.buildBookFileReference(book.getId()));
        }
    }

    private String normalize(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed.toUpperCase();
    }

    private String normalizeGenres(List<String> genres) {
        if (genres == null || genres.isEmpty()) {
            return "Uncategorized";
        }
        String joined = genres.stream()
                .filter(g -> g != null && !g.trim().isEmpty())
                .map(String::trim)
                .collect(Collectors.joining(", "));
        return joined.isEmpty() ? "Uncategorized" : joined;
    }

    /**
     * Saving a Book merges every column, so an entity loaded at the start of a request would
     * write its stale quantity back and silently undo a borrow that decremented stock in the
     * meantime. Re-reading immediately before the save keeps edits that do not touch stock
     * from moving it.
     */
    private void refreshQuantityFromDatabase(Book book) {
        if (book.getId() != null) {
            bookRepository.findQuantityById(book.getId()).ifPresent(book::setQuantity);
        }
    }

    /**
     * Applies an explicit "set stock to N" through a targeted column update after the save,
     * so the librarian's value wins deterministically without racing the merge.
     */
    private void applyExplicitQuantity(Book book, Integer requestedQuantity) {
        if (requestedQuantity == null) {
            return;
        }
        bookRepository.setQuantityAbsolute(book.getId(), requestedQuantity);
        book.setQuantity(requestedQuantity);
    }

    /** Default stock for a brand-new title, which is never created out of stock. */
    private int safeQuantity(Integer quantity) {
        if (quantity == null || quantity < 1) {
            return 1;
        }
        return quantity;
    }

    /**
     * Stock for an edit of an existing title. 0 is a legitimate value — it marks a title as
     * out of stock, matching what approval already accepts — so only negatives are clamped.
     */
    private int clampStock(Integer quantity) {
        if (quantity == null || quantity < 0) {
            return 0;
        }
        return quantity;
    }

    /**
     * Author submissions go through the same content rules as the librarian "add book" form —
     * the browser form is not the only client that can reach this endpoint.
     */
    private String validateBookSubmission(String title, List<String> genres, String description,
                                          MultipartFile file, MultipartFile coverImage) {
        return validateLibrarianBookInput(title, genres, description, file, coverImage);
    }

    private String validateLibrarianBookInput(String title, List<String> genres, String description,
                                              MultipartFile file, MultipartFile coverImage) {
        if (title == null || title.trim().isEmpty()) return "Title is required";
        if (title.trim().length() > 255) return "Title must not exceed 255 characters";
        if (genres == null || genres.isEmpty()) return "Select at least one genre";
        if (description == null || description.trim().isEmpty()) return "Description is required";
        if (description.trim().length() < 50) return "Description must be at least 50 characters";
        if (description.trim().length() > 5000) return "Description must not exceed 5000 characters";
        if (genres != null && String.join(",", genres).length() > 500) {
            return "Selected genres exceed the maximum allowed length";
        }
        if (file == null || file.isEmpty()) return "Book file is required";
        if (!fileStorageService.validateFile(file)) return "Invalid book file. Check size, type, and extension.";
        if (!fileStorageService.validateCoverImage(coverImage)) {
            return "Invalid cover image. Upload JPG/PNG and keep size within 5MB.";
        }
        return null;
    }

    private String validateLibrarianBookUpdate(String title, List<String> genres, String description,
                                               MultipartFile file, MultipartFile coverImage, String status) {
        if (title == null || title.trim().isEmpty()) return "Title is required";
        if (title.trim().length() > 255) return "Title must not exceed 255 characters";
        if (genres == null || genres.isEmpty()) return "Select at least one genre";
        if (description == null || description.trim().isEmpty()) return "Description is required";
        if (description.trim().length() < 50) return "Description must be at least 50 characters";
        if (description.trim().length() > 5000) return "Description must not exceed 5000 characters";
        if (genres != null && String.join(",", genres).length() > 500) {
            return "Selected genres exceed the maximum allowed length";
        }
        if (file != null && !file.isEmpty() && !fileStorageService.validateFile(file)) {
            return "Invalid book file. Check size, type, and extension.";
        }
        if (!fileStorageService.validateCoverImage(coverImage)) {
            return "Invalid cover image. Upload JPG/PNG and keep size within 5MB.";
        }
        if (status != null && !status.isBlank()) {
            try {
                Book.BookStatus.valueOf(status.trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                return "Invalid status value";
            }
        }
        return null;
    }

    private Long requireLibrarianId(LibraryPrincipal principal) {
        Long librarianId = ownershipGuard.actingUserId(principal);
        if (librarianId == null) {
            throw new AccessDeniedException("Librarian identity is required.");
        }
        return librarianId;
    }

    private List<Long> requireBookIds(Object rawValue) {
        if (!(rawValue instanceof List)) {
            throw new IllegalArgumentException("bookIds is required");
        }
        List<Long> bookIds = ((List<?>) rawValue).stream()
                .map(this::parseLong)
                .filter(id -> id != null && id > 0)
                .distinct()
                .collect(Collectors.toList());
        if (bookIds.isEmpty()) {
            throw new IllegalArgumentException("bookIds is required");
        }
        return bookIds;
    }

    private Book cloneBookSnapshot(Book book) {
        if (book == null) return null;
        Book snapshot = new Book();
        snapshot.setId(book.getId());
        snapshot.setTitle(book.getTitle());
        snapshot.setIsbn(book.getIsbn());
        snapshot.setPublishedDate(book.getPublishedDate());
        snapshot.setGenre(book.getGenre());
        snapshot.setQuantity(book.getQuantity());
        snapshot.setStatus(book.getStatus());
        snapshot.setAuthorId(book.getAuthorId());
        snapshot.setDescription(book.getDescription());
        snapshot.setSubmittedDate(book.getSubmittedDate());
        snapshot.setFilePath(book.getFilePath());
        snapshot.setFileName(book.getFileName());
        snapshot.setFileType(book.getFileType());
        snapshot.setFileSize(book.getFileSize());
        snapshot.setRejectionReason(book.getRejectionReason());
        snapshot.setCoverImageName(book.getCoverImageName());
        snapshot.setCoverImageType(book.getCoverImageType());
        snapshot.setCoverImageSize(book.getCoverImageSize());
        snapshot.setSource(book.getSource());
        return snapshot;
    }

    /**
     * @param bookId null for DELETE actions — the book row is already gone, so only the
     *               snapshotted title survives (CONTRACTS §11).
     */
    private void recordBookChange(Long bookId, Long changedByUserId, String action, Book before, Book after) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("before", before == null ? null : buildBookSnapshotMap(before));
            payload.put("after", after == null ? null : buildBookSnapshotMap(after));

            BookChangeLog log = new BookChangeLog();
            log.setBookId(bookId);
            log.setBookTitle(after != null ? after.getTitle() : (before != null ? before.getTitle() : null));
            log.setChangedBy(changedByUserId);
            log.setAction(action);

            try {
                log.setDetails(objectMapper.writeValueAsString(payload));
            } catch (JsonProcessingException e) {
                // Keep the audit row even if payload serialization fails.
                logger.warning("Failed to serialize book change log payload: " + e.getMessage());
                log.setDetails("{\"before\":null,\"after\":null,\"note\":\"payload serialization failed\"}");
            }

            bookChangeLogRepository.save(log);
        } catch (Exception e) {
            logger.warning("Failed to record book change: " + e.getMessage());
        }
    }

    private Map<String, Object> buildBookSnapshotMap(Book book) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("title", book.getTitle());
        snapshot.put("genre", book.getGenre());
        snapshot.put("description", book.getDescription());
        snapshot.put("status", book.getStatus() != null ? book.getStatus().name() : null);
        snapshot.put("quantity", book.getQuantity());
        snapshot.put("authorId", book.getAuthorId());
        snapshot.put("publishedDate", book.getPublishedDate() != null ? book.getPublishedDate().toString() : null);
        snapshot.put("fileName", book.getFileName());
        snapshot.put("coverImageName", book.getCoverImageName());
        snapshot.put("source", book.getSource() != null ? book.getSource().name() : null);
        snapshot.put("submittedDate", book.getSubmittedDate() != null ? book.getSubmittedDate().toString() : null);
        return snapshot;
    }

    private boolean containsIgnoreCase(String source, String query) {
        if (source == null || query == null) return false;
        return source.toLowerCase().contains(query.toLowerCase());
    }

    private Long parseLong(Object value) {
        if (value == null) return null;
        try {
            return Long.parseLong(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Map<String, Object> buildStatsResponse(List<Book> books) {
        List<Long> allBookIds = books.stream().map(Book::getId).collect(Collectors.toList());
        List<Long> publishedBookIds = books.stream()
                .filter(b -> b.getStatus() == Book.BookStatus.APPROVED)
                .map(Book::getId)
                .collect(Collectors.toList());

        Map<Long, Long> totalBorrowsMap = new HashMap<>();
        Map<Long, Long> activeBorrowsMap = new HashMap<>();
        Map<Long, Long> uniqueReadersMap = new HashMap<>();
        if (!publishedBookIds.isEmpty()) {
            borrowingRecordRepository.countTotalBorrowsByBookIds(publishedBookIds)
                    .forEach(r -> totalBorrowsMap.put(r.getBookId(), r.getCount()));
            borrowingRecordRepository.countActiveBorrowsByBookIds(publishedBookIds)
                    .forEach(r -> activeBorrowsMap.put(r.getBookId(), r.getCount()));
            borrowingRecordRepository.countUniqueReadersByBookIds(publishedBookIds)
                    .forEach(r -> uniqueReadersMap.put(r.getBookId(), r.getCount()));
        }

        Map<Long, BookReviewRepository.BookRatingAggregate> ratingAggregates = allBookIds.isEmpty()
                ? Collections.emptyMap()
                : bookReviewRepository.findRatingAggregatesByBookIds(allBookIds).stream()
                .collect(Collectors.toMap(BookReviewRepository.BookRatingAggregate::getBookId, a -> a));

        Map<Integer, Long> ratingDistribution = new LinkedHashMap<>();
        for (int i = 1; i <= 5; i++) ratingDistribution.put(i, 0L);
        if (!publishedBookIds.isEmpty()) {
            bookReviewRepository.countRatingDistributionByBookIds(publishedBookIds)
                    .forEach(r -> ratingDistribution.put(r.getRating(), r.getCount()));
        }

        List<Map<String, Object>> bookStats = books.stream().map(book -> {
            Map<String, Object> stat = new LinkedHashMap<>();
            stat.put("bookId", book.getId());
            stat.put("title", book.getTitle());
            stat.put("genre", book.getGenre());
            stat.put("status", book.getStatus().name());
            stat.put("publishedDate", book.getPublishedDate());
            stat.put("totalBorrows", totalBorrowsMap.getOrDefault(book.getId(), 0L));
            stat.put("activeBorrows", activeBorrowsMap.getOrDefault(book.getId(), 0L));
            stat.put("uniqueReaders", uniqueReadersMap.getOrDefault(book.getId(), 0L));
            BookReviewRepository.BookRatingAggregate agg = ratingAggregates.get(book.getId());
            stat.put("averageRating", agg != null ? agg.getAverageRating() : null);
            stat.put("reviewCount", agg != null ? agg.getReviewCount() : 0L);
            return stat;
        }).collect(Collectors.toList());

        long totalBorrows = totalBorrowsMap.values().stream().mapToLong(Long::longValue).sum();
        long totalReviews = ratingAggregates.values().stream().mapToLong(BookReviewRepository.BookRatingAggregate::getReviewCount).sum();
        OptionalDouble overallAvgRating = ratingAggregates.values().stream()
                .filter(a -> a.getAverageRating() != null)
                .mapToDouble(BookReviewRepository.BookRatingAggregate::getAverageRating)
                .average();

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalBooks", books.size());
        summary.put("publishedBooks", (int) books.stream().filter(b -> b.getStatus() == Book.BookStatus.APPROVED).count());
        summary.put("pendingBooks", (int) books.stream().filter(b -> b.getStatus() == Book.BookStatus.PENDING).count());
        summary.put("rejectedBooks", (int) books.stream().filter(b -> b.getStatus() == Book.BookStatus.REJECTED).count());
        summary.put("totalBorrows", totalBorrows);
        summary.put("totalReviews", totalReviews);
        summary.put("overallAverageRating", overallAvgRating.isPresent()
                ? Math.round(overallAvgRating.getAsDouble() * 10.0) / 10.0
                : null);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("summary", summary);
        response.put("books", bookStats);
        response.put("ratingDistribution", ratingDistribution);
        return response;
    }

    private String getNotDeletableReason(Book book) {
        if (book.getStatus() == Book.BookStatus.PENDING) {
            return null;
        }

        if (book.getStatus() == Book.BookStatus.APPROVED) {
            long activeBorrowCount = borrowingRecordRepository.countByBookIdAndStatus(book.getId(), "BORROWED");
            if (activeBorrowCount > 0) {
                return "Cannot delete this published book because it is currently borrowed by a user";
            }
            return null;
        }

        return "Only pending submissions or published books with no active borrowings can be deleted";
    }

    private Map<String, Object> buildBulkDeleteFailure(Long bookId, String reason) {
        Map<String, Object> failed = new LinkedHashMap<>();
        failed.put("bookId", bookId);
        failed.put("reason", reason);
        return failed;
    }

    /**
     * Must be read BEFORE the book row goes away — borrowing_records cascades on delete.
     */
    private List<Long> findBorrowerIds(Book book) {
        if (book == null || book.getId() == null) {
            return Collections.emptyList();
        }
        List<Long> userIds = borrowingRecordRepository.findDistinctUserIdsByBookId(book.getId());
        return userIds == null ? Collections.emptyList() : userIds;
    }

    private void emitBookDeletionNotifications(Book book, List<Long> userIds) {
        if (book == null || book.getId() == null || userIds.isEmpty()) {
            return;
        }

        // Protect against any duplicate rows from legacy data.
        Set<Long> uniqueUserIds = new HashSet<>(userIds);
        LocalDateTime now = LocalDateTime.now();
        List<StudentNotification> notifications = uniqueUserIds.stream()
                .filter(id -> id != null && id > 0)
                .map(userId -> {
                    StudentNotification notification = new StudentNotification();
                    notification.setUserId(userId);
                    notification.setCategory("BOOK_DELETION");
                    notification.setTitle("Borrowed book removed");
                    notification.setMessage("\"" + safeBookTitle(book) + "\" was removed from the library catalog.");
                    notification.setPriority("HIGH");
                    notification.setReferenceBookId(book.getId());
                    notification.setCreatedAt(now);
                    return notification;
                })
                .collect(Collectors.toList());

        if (!notifications.isEmpty()) {
            studentNotificationRepository.saveAll(notifications);
        }
    }

    private String safeBookTitle(Book book) {
        return book.getTitle() == null || book.getTitle().isBlank() ? "Untitled book" : book.getTitle();
    }

    /**
     * When a book is approved and added to the library, notify any users who requested
     * a book with the same title (case-insensitive) so they know it is now available.
     */
    private void notifyBookRequestersOnApproval(Book book) {
        if (book == null || book.getTitle() == null) return;
        try {
            String title = book.getTitle().trim();
            List<String> openStatuses = java.util.Arrays.asList("PENDING", "APPROVED");

            List<BookRequest> exactRequests = bookRequestRepository
                .findByStatusInAndTitleIgnoreCase(openStatuses, title);
            List<BookRequest> similarRequests = bookRequestRepository
                .findByStatusInAndTitleContainingIgnoreCase(openStatuses, title);

            if (exactRequests.isEmpty() && similarRequests.isEmpty()) return;

            LocalDateTime now = LocalDateTime.now();
            Set<Long> notifiedUserIds = new HashSet<>();
            List<StudentNotification> notifications = new ArrayList<>();

            // One notification per user per approved book — an exact match wins over a
            // similar-title match when the same user submitted both.
            for (BookRequest req : exactRequests) {
                if (req.getUserId() == null || !notifiedUserIds.add(req.getUserId())) continue;
                StudentNotification n = new StudentNotification();
                n.setUserId(req.getUserId());
                n.setCategory("BOOK_REQUEST_UPDATE");
                n.setTitle("Requested book is now available");
                n.setMessage("\"" + safeBookTitle(book) + "\" has been added to the library catalog and is now available to borrow.");
                n.setPriority("HIGH");
                n.setReferenceBookId(book.getId());
                n.setCreatedAt(now);
                notifications.add(n);
            }

            for (BookRequest req : similarRequests) {
                if (req.getUserId() == null || !notifiedUserIds.add(req.getUserId())) continue;
                StudentNotification n = new StudentNotification();
                n.setUserId(req.getUserId());
                n.setCategory("BOOK_REQUEST_UPDATE");
                n.setTitle("Similar title now available");
                n.setMessage("A title similar to your request (\"" + safeBookTitle(book)
                    + "\") has been added to the catalog. Check it out in the library.");
                n.setPriority("MEDIUM");
                n.setReferenceBookId(book.getId());
                n.setCreatedAt(now);
                notifications.add(n);
            }

            studentNotificationRepository.saveAll(notifications);
            logger.info("Notified " + notifications.size() + " book-request submitter(s) that \"" + book.getTitle() + "\" is available");
        } catch (Exception e) {
            logger.warning("Failed to notify book requesters for book " + book.getId() + ": " + e.getMessage());
        }
    }
}
