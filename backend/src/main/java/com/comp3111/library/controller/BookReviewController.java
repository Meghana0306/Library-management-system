package com.comp3111.library.controller;

import com.comp3111.library.dto.ReviewFlagRequest;
import com.comp3111.library.dto.ReviewReplyRequest;
import com.comp3111.library.dto.ReviewSubmitRequest;
import com.comp3111.library.dto.ReviewUpdateRequest;
import com.comp3111.library.exception.AiDisabledException;
import com.comp3111.library.exception.ConflictException;
import com.comp3111.library.exception.NotFoundException;
import com.comp3111.library.model.Book;
import com.comp3111.library.model.BookReview;
import com.comp3111.library.model.StudentNotification;
import com.comp3111.library.repository.BookRepository;
import com.comp3111.library.repository.BookReviewRepository;
import com.comp3111.library.repository.BorrowingRecordRepository;
import com.comp3111.library.repository.StudentNotificationRepository;
import com.comp3111.library.repository.UserRepository;
import com.comp3111.library.security.LibraryPrincipal;
import com.comp3111.library.security.OwnershipGuard;
import com.comp3111.library.service.GeminiService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.logging.Logger;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/reviews")
public class BookReviewController {

    private static final Logger logger = Logger.getLogger(BookReviewController.class.getName());

    @Autowired
    private BookReviewRepository bookReviewRepository;

    @Autowired
    private BorrowingRecordRepository borrowingRecordRepository;

    @Autowired
    private BookRepository bookRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private StudentNotificationRepository studentNotificationRepository;

    @Autowired
    private OwnershipGuard ownershipGuard;

    @Autowired
    private GeminiService geminiService;

    /**
     * Submit a new review/rating for a book. The reviewer is taken from the JWT claim
     * and the user must have borrowed the book at least once.
     */
    @PostMapping
    @Transactional
    public ResponseEntity<?> submitReview(@Valid @RequestBody ReviewSubmitRequest request,
                                          @AuthenticationPrincipal LibraryPrincipal principal) {
        Long userId = ownershipGuard.actingUserId(principal);
        if (userId == null) {
            throw new AccessDeniedException("Authentication is required to submit a review.");
        }
        Long bookId = request.getBookId();

        if (!userRepository.existsById(userId)) {
            throw new NotFoundException("User not found: " + userId);
        }
        if (!bookRepository.existsById(bookId)) {
            throw new NotFoundException("Book not found: " + bookId);
        }

        boolean hasBorrowed = borrowingRecordRepository.findByUserId(userId).stream()
                .anyMatch(r -> r.getBook() != null && bookId.equals(r.getBook().getId()));
        if (!hasBorrowed) {
            throw new AccessDeniedException("You can only review books you have borrowed");
        }

        if (bookReviewRepository.existsByUserIdAndBookId(userId, bookId)) {
            throw new ConflictException("You have already reviewed this book. Use PUT /api/reviews/{reviewId} to update it.");
        }

        BookReview review = new BookReview();
        review.setUserId(userId);
        review.setBookId(bookId);
        review.setRating(request.getRating());
        review.setReviewText(trimToNull(request.getReviewText()));
        review.setAnonymous(request.isAnonymous());
        BookReview saved = bookReviewRepository.save(review);

        logger.info("User " + userId + " submitted review for book " + bookId + " (rating=" + request.getRating() + ")");
        return ResponseEntity.status(HttpStatus.CREATED).body(buildReviewResponse(saved));
    }

    /**
     * Update an existing review. Only the review owner may edit it.
     */
    @PutMapping("/{reviewId}")
    @Transactional
    public ResponseEntity<?> updateReview(
            @PathVariable Long reviewId,
            @Valid @RequestBody ReviewUpdateRequest request,
            @AuthenticationPrincipal LibraryPrincipal principal) {
        BookReview review = bookReviewRepository.findById(reviewId)
                .orElseThrow(() -> new NotFoundException("Review not found: " + reviewId));

        ownershipGuard.assertOwner(review.getUserId(), principal, "You can only update your own reviews");

        if (request.getRating() != null) {
            review.setRating(request.getRating());
        }
        if (request.getReviewText() != null) {
            review.setReviewText(trimToNull(request.getReviewText()));
        }
        if (request.getAnonymous() != null) {
            review.setAnonymous(request.getAnonymous());
        }

        BookReview saved = bookReviewRepository.save(review);
        return ResponseEntity.ok(buildReviewResponse(saved));
    }

    /**
     * Get all reviews for a specific book, including average rating and review count.
     * Query param: sort=recent (default) | rating
     */
    @GetMapping("/book/{bookId}")
    public ResponseEntity<?> getReviewsForBook(
            @PathVariable Long bookId,
            @RequestParam(defaultValue = "recent") String sort,
            @AuthenticationPrincipal LibraryPrincipal principal) {
        if (!bookRepository.existsById(bookId)) {
            throw new NotFoundException("Book not found: " + bookId);
        }

        List<BookReview> reviews = "rating".equalsIgnoreCase(sort)
                ? bookReviewRepository.findByBookIdOrderByRatingDesc(bookId)
                : bookReviewRepository.findByBookIdOrderByCreatedAtDesc(bookId);

        Double avgRating = bookReviewRepository.findAverageRatingByBookId(bookId);
        Long reviewCount = bookReviewRepository.countByBookId(bookId);

        List<Long> userIds = reviews.stream()
                .filter(r -> !r.isAnonymous())
                .map(BookReview::getUserId)
                .distinct()
                .collect(Collectors.toList());
        Map<Long, String> reviewerNames = new HashMap<>();
        userRepository.findAllById(userIds)
                .forEach(user -> reviewerNames.put(user.getId(), user.getFullName()));

        List<Map<String, Object>> enriched = reviews.stream()
                .map(r -> {
                    Map<String, Object> item = maskIfAnonymous(buildReviewResponse(r), r, principal);
                    item.put("reviewerName", r.isAnonymous() ? "Anonymous" : reviewerNames.getOrDefault(r.getUserId(), "Unknown"));
                    return item;
                })
                .collect(Collectors.toList());

        Map<String, Object> response = new HashMap<>();
        response.put("bookId", bookId);
        response.put("averageRating", avgRating != null ? Math.round(avgRating * 10.0) / 10.0 : null);
        response.put("reviewCount", reviewCount);
        response.put("reviews", enriched);
        response.put("sort", sort);
        return ResponseEntity.ok(response);
    }

    /**
     * Get all reviews written by a specific user.
     */
    @GetMapping("/user/{userId}")
    public ResponseEntity<?> getReviewsByUser(@PathVariable Long userId,
                                              @AuthenticationPrincipal LibraryPrincipal principal) {
        ownershipGuard.assertSelf(userId, principal);
        if (!userRepository.existsById(userId)) {
            throw new NotFoundException("User not found: " + userId);
        }

        List<BookReview> reviews = bookReviewRepository.findByUserIdOrderByCreatedAtDesc(userId);
        List<Long> bookIds = reviews.stream()
                .map(BookReview::getBookId)
                .distinct()
                .collect(Collectors.toList());
        Map<Long, Map<String, String>> bookMetadataById = new HashMap<>();
        bookRepository.findAllById(bookIds).forEach(book -> {
            Map<String, String> metadata = new HashMap<>();
            metadata.put("title", book.getTitle());
            metadata.put("author", book.getAuthor());
            bookMetadataById.put(book.getId(), metadata);
        });
        List<Map<String, Object>> enriched = reviews.stream()
                .map(r -> {
                    Map<String, Object> item = buildReviewResponse(r);
                    Map<String, String> metadata = bookMetadataById.get(r.getBookId());
                    if (metadata != null) {
                        item.put("bookTitle", metadata.get("title"));
                        item.put("bookAuthor", metadata.get("author"));
                    }
                    return item;
                })
                .collect(Collectors.toList());

        Map<String, Object> response = new HashMap<>();
        response.put("userId", userId);
        response.put("totalReviews", reviews.size());
        response.put("reviews", enriched);
        return ResponseEntity.ok(response);
    }

    /**
     * Get all reviews for every published book belonging to an author.
     * Groups results by book for easy display.
     */
    @GetMapping("/author/{authorId}")
    public ResponseEntity<?> getReviewsForAuthor(@PathVariable Long authorId,
                                                 @AuthenticationPrincipal LibraryPrincipal principal) {
        ownershipGuard.assertSelf(authorId, principal);
        if (!userRepository.existsById(authorId)) {
            throw new NotFoundException("Author not found: " + authorId);
        }

        List<Book> publishedBooks = bookRepository.findByAuthorId(authorId).stream()
                .filter(b -> b.getStatus() == Book.BookStatus.APPROVED)
                .collect(Collectors.toList());

        List<Map<String, Object>> result = new ArrayList<>();
        for (Book book : publishedBooks) {
            List<BookReview> reviews = bookReviewRepository.findByBookIdOrderByCreatedAtDesc(book.getId());
            List<Long> userIds = reviews.stream().map(BookReview::getUserId).distinct().collect(Collectors.toList());
            Map<Long, String> names = new HashMap<>();
            userRepository.findAllById(userIds).forEach(u -> names.put(u.getId(), u.getFullName()));

            Double avg = bookReviewRepository.findAverageRatingByBookId(book.getId());

            List<Map<String, Object>> reviewItems = reviews.stream().map(r -> {
                Map<String, Object> item = maskIfAnonymous(buildReviewResponse(r), r, principal);
                item.put("reviewerName", r.isAnonymous() ? "Anonymous" : names.getOrDefault(r.getUserId(), "Unknown"));
                return item;
            }).collect(Collectors.toList());

            Map<String, Object> bookEntry = new LinkedHashMap<>();
            bookEntry.put("bookId", book.getId());
            bookEntry.put("bookTitle", book.getTitle());
            bookEntry.put("averageRating", avg != null ? Math.round(avg * 10.0) / 10.0 : null);
            bookEntry.put("reviewCount", reviews.size());
            bookEntry.put("reviews", reviewItems);
            result.add(bookEntry);
        }

        return ResponseEntity.ok(result);
    }

    /**
     * Author posts or updates a reply on a review of one of their own books.
     * Sends a notification to the reviewer.
     */
    @PostMapping("/{reviewId}/reply")
    @Transactional
    public ResponseEntity<?> replyToReview(@PathVariable Long reviewId,
                                           @Valid @RequestBody ReviewReplyRequest request,
                                           @AuthenticationPrincipal LibraryPrincipal principal) {
        BookReview review = requireReview(reviewId);
        Book book = requireOwnBook(review, principal, "You can only reply to reviews on your own books");

        String reply = request.getReply().trim();
        boolean isNew = review.getAuthorReply() == null;
        review.setAuthorReply(reply);
        review.setAuthorReplyAt(LocalDateTime.now());
        bookReviewRepository.save(review);

        if (isNew) {
            sendReplyNotification(review.getUserId(), book, reply);
        }

        logger.info("Author " + ownershipGuard.actingUserId(principal) + " replied to review " + reviewId);
        return ResponseEntity.ok(buildReviewResponse(review));
    }

    /**
     * Author removes their reply from a review.
     */
    @DeleteMapping("/{reviewId}/reply")
    @Transactional
    public ResponseEntity<?> deleteReply(@PathVariable Long reviewId,
                                         @AuthenticationPrincipal LibraryPrincipal principal) {
        BookReview review = requireReview(reviewId);
        requireOwnBook(review, principal, "You can only delete replies on your own books");

        review.setAuthorReply(null);
        review.setAuthorReplyAt(null);
        bookReviewRepository.save(review);
        return ResponseEntity.ok(buildReviewResponse(review));
    }

    /**
     * Author flags a review on one of their own books as inappropriate.
     */
    @PostMapping("/{reviewId}/flag")
    @Transactional
    public ResponseEntity<?> flagReview(@PathVariable Long reviewId,
                                        @Valid @RequestBody(required = false) ReviewFlagRequest request,
                                        @AuthenticationPrincipal LibraryPrincipal principal) {
        BookReview review = requireReview(reviewId);
        requireOwnBook(review, principal, "You can only flag reviews on your own books");

        String reason = request == null ? null : trimToNull(request.getReason());
        review.setFlagged(true);
        review.setFlagReason(reason);
        bookReviewRepository.save(review);

        logger.info("Author " + ownershipGuard.actingUserId(principal) + " flagged review " + reviewId);
        return ResponseEntity.ok(buildReviewResponse(review));
    }

    /**
     * Author removes the flag from a review.
     */
    @DeleteMapping("/{reviewId}/flag")
    @Transactional
    public ResponseEntity<?> unflagReview(@PathVariable Long reviewId,
                                          @AuthenticationPrincipal LibraryPrincipal principal) {
        BookReview review = requireReview(reviewId);
        requireOwnBook(review, principal, "You can only unflag reviews on your own books");

        review.setFlagged(false);
        review.setFlagReason(null);
        bookReviewRepository.save(review);
        return ResponseEntity.ok(buildReviewResponse(review));
    }

    /**
     * AI sentiment analysis for a batch of the calling author's own reviews.
     * Body: { "reviews": [{ "id": Long, "rating": int, "text": "..." }, ...] }
     * Returns: { "sentiments": { "<reviewId>": "POSITIVE|NEUTRAL|NEGATIVE", ... } }
     */
    @PostMapping("/analyze-sentiment")
    public ResponseEntity<?> analyzeSentiment(@RequestBody Map<String, Object> request,
                                              @AuthenticationPrincipal LibraryPrincipal principal) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> reviews = (List<Map<String, Object>>) request.get("reviews");

        if (reviews == null || reviews.isEmpty()) {
            throw new IllegalArgumentException("reviews list is required");
        }

        assertReviewsBelongToAuthor(reviews, principal);

        try {
            Map<Long, String> sentiments = geminiService.analyzeSentimentBatch(reviews);
            Map<String, Object> response = new HashMap<>();
            response.put("sentiments", sentiments);
            return ResponseEntity.ok(response);
        } catch (IllegalStateException e) {
            throw new AiDisabledException(e.getMessage());
        }
    }

    // ── helpers ────────────────────────────────────────────────────────────

    private BookReview requireReview(Long reviewId) {
        return bookReviewRepository.findById(reviewId)
                .orElseThrow(() -> new NotFoundException("Review not found: " + reviewId));
    }

    /** The acting author must own the book the review is attached to; LIBRARIAN bypasses. */
    private Book requireOwnBook(BookReview review, LibraryPrincipal principal, String message) {
        Book book = bookRepository.findById(review.getBookId())
                .orElseThrow(() -> new NotFoundException("Book not found: " + review.getBookId()));
        Long authorId = ownershipGuard.actingUserId(principal);
        if (authorId != null && !ownershipGuard.isLibrarian(principal)
                && !authorId.equals(book.getAuthorId())) {
            throw new AccessDeniedException(message);
        }
        return book;
    }

    private void assertReviewsBelongToAuthor(List<Map<String, Object>> reviews, LibraryPrincipal principal) {
        Long authorId = ownershipGuard.actingUserId(principal);
        if (authorId == null || ownershipGuard.isLibrarian(principal)) {
            return;
        }

        Set<Long> reviewIds = reviews.stream()
                .map(item -> parseLong(item.get("id")))
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());
        if (reviewIds.size() != reviews.size()) {
            throw new IllegalArgumentException("Every review in the batch needs a numeric id");
        }

        Set<Long> bookIds = new HashSet<>();
        bookReviewRepository.findAllById(reviewIds).forEach(review -> bookIds.add(review.getBookId()));
        if (bookIds.isEmpty()) {
            throw new NotFoundException("No matching reviews were found");
        }

        long ownedCount = bookRepository.findByIdInAndAuthorId(new ArrayList<>(bookIds), authorId).size();
        if (ownedCount != bookIds.size()) {
            throw new AccessDeniedException("You can only analyse reviews on your own books");
        }
    }

    /**
     * An anonymous review must not carry its author's id to anyone but that author (or a
     * librarian) — the name alone is not enough to keep it anonymous.
     */
    private Map<String, Object> maskIfAnonymous(Map<String, Object> item, BookReview review, LibraryPrincipal principal) {
        if (!review.isAnonymous()) {
            return item;
        }
        boolean isOwner = principal != null && review.getUserId() != null
                && review.getUserId().equals(principal.userId());
        if (!isOwner && !ownershipGuard.isLibrarian(principal)) {
            item.put("userId", null);
        }
        return item;
    }

    private Map<String, Object> buildReviewResponse(BookReview review) {
        Map<String, Object> item = new HashMap<>();
        item.put("reviewId", review.getId());
        item.put("userId", review.getUserId());
        item.put("bookId", review.getBookId());
        item.put("rating", review.getRating());
        item.put("reviewText", review.getReviewText());
        item.put("isAnonymous", review.isAnonymous());
        item.put("authorReply", review.getAuthorReply());
        item.put("authorReplyAt", review.getAuthorReplyAt());
        item.put("flagged", review.isFlagged());
        item.put("flagReason", review.getFlagReason());
        item.put("createdAt", review.getCreatedAt());
        item.put("updatedAt", review.getUpdatedAt());
        return item;
    }

    private void sendReplyNotification(Long reviewerId, Book book, String reply) {
        try {
            StudentNotification notif = new StudentNotification();
            notif.setUserId(reviewerId);
            notif.setCategory("AUTHOR_REPLY");
            notif.setTitle("The author replied to your review");
            String preview = reply.length() > 200 ? reply.substring(0, 197) + "…" : reply;
            notif.setMessage("The author of \"" + book.getTitle() + "\" replied to your review: " + preview);
            notif.setPriority("MEDIUM");
            notif.setReferenceBookId(book.getId());
            notif.setCreatedAt(LocalDateTime.now());
            studentNotificationRepository.save(notif);
        } catch (Exception e) {
            logger.warning("Failed to send reply notification: " + e.getMessage());
        }
    }

    private String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private Long parseLong(Object value) {
        if (value == null) return null;
        try { return Long.parseLong(value.toString()); } catch (NumberFormatException e) { return null; }
    }
}
