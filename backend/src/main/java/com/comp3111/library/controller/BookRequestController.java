package com.comp3111.library.controller;

import com.comp3111.library.dto.BookRequestCreateRequest;
import com.comp3111.library.exception.ConflictException;
import com.comp3111.library.exception.NotFoundException;
import com.comp3111.library.model.Book;
import com.comp3111.library.model.BookChangeLog;
import com.comp3111.library.model.BookRequest;
import com.comp3111.library.model.StudentNotification;
import com.comp3111.library.model.User;
import com.comp3111.library.repository.BookChangeLogRepository;
import com.comp3111.library.repository.BookRepository;
import com.comp3111.library.repository.BookRequestRepository;
import com.comp3111.library.repository.StudentNotificationRepository;
import com.comp3111.library.repository.UserRepository;
import com.comp3111.library.security.LibraryPrincipal;
import com.comp3111.library.security.OwnershipGuard;
import com.comp3111.library.service.BookDownloadService;
import com.comp3111.library.service.FileStorageService;
import com.comp3111.library.service.GeminiService;
import com.comp3111.library.service.PreparedBookFile;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.logging.Logger;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/book-requests")
public class BookRequestController {

    private static final Logger logger = Logger.getLogger(BookRequestController.class.getName());

    @Autowired
    private BookRequestRepository bookRequestRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private BookRepository bookRepository;

    @Autowired
    private StudentNotificationRepository studentNotificationRepository;

    @Autowired
    private BookDownloadService bookDownloadService;

    @Autowired
    private FileStorageService fileStorageService;

    @Autowired
    private GeminiService geminiService;

    @Autowired
    private OwnershipGuard ownershipGuard;

    @Autowired
    private BookChangeLogRepository bookChangeLogRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    /**
     * Submit a new book request (students / staff only). The requester is taken from
     * the JWT claim; genre and keywords are optional.
     */
    @PostMapping
    @Transactional
    public ResponseEntity<?> submitRequest(@Valid @RequestBody BookRequestCreateRequest body,
                                           @AuthenticationPrincipal LibraryPrincipal principal) {
        Long userId = ownershipGuard.actingUserId(principal);
        if (userId == null) {
            throw new AccessDeniedException("Authentication is required to submit a book request.");
        }

        String title = body.getTitle().trim();
        String author = body.getAuthor().trim();
        String genre = trimToNull(body.getGenre());
        String keywords = trimToNull(body.getKeywords());

        if (!userRepository.existsById(userId)) {
            throw new NotFoundException("User not found: " + userId);
        }

        // Per-user duplicate check: block only when there is an active pending request.
        List<String> activeStatuses = java.util.Collections.singletonList("PENDING");
        boolean isUserDuplicate = bookRequestRepository.existsByUserIdAndTitleIgnoreCaseAndAuthorIgnoreCaseAndStatusIn(
                userId, title, author, activeStatuses);
        if (isUserDuplicate) {
            throw new ConflictException("You already have a pending request for this book.");
        }

        // Allow re-requesting if the old request was approved/rejected/closed.
        // Global duplicate check: block only if another request is still pending.
        boolean isGlobalDuplicate = bookRequestRepository
                .existsByTitleIgnoreCaseAndAuthorIgnoreCaseAndStatusIn(title, author, activeStatuses);
        if (isGlobalDuplicate) {
            throw new ConflictException("This book is already pending review by another user. The librarian will consider all interest when reviewing.");
        }

        BookRequest request = new BookRequest();
        request.setUserId(userId);
        request.setTitle(title);
        request.setAuthor(author);
        request.setGenre(genre);
        request.setKeywords(keywords);
        request.setReason(body.getReason().trim());
        request.setStatus("PENDING");
        request.setPriority("NORMAL");

        BookRequest saved = bookRequestRepository.save(request);
        logger.info("Book request submitted by userId=" + userId + " for title=\"" + title + "\"");

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Your book request has been submitted successfully. The librarian will review it shortly.");
        response.put("request", buildRequestDto(saved, null));
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Get all book requests submitted by a specific user.
     */
    @GetMapping("/user/{userId}")
    public ResponseEntity<?> getUserRequests(@PathVariable Long userId,
                                             @AuthenticationPrincipal LibraryPrincipal principal) {
        ownershipGuard.assertSelf(userId, principal);
        if (!userRepository.existsById(userId)) {
            throw new NotFoundException("User not found: " + userId);
        }

        List<BookRequest> requests = bookRequestRepository.findByUserIdOrderByCreatedAtDesc(userId);
        List<Map<String, Object>> dtos = requests.stream()
                .map(r -> buildRequestDto(r, null))
                .collect(Collectors.toList());

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("totalRequests", dtos.size());
        response.put("requests", dtos);
        return ResponseEntity.ok(response);
    }

    /**
     * Get all book requests (librarian view), with optional status filter.
     * Query param: status=PENDING|APPROVED|REJECTED
     */
    @GetMapping
    public ResponseEntity<?> getAllRequests(@RequestParam(required = false) String status) {
        List<BookRequest> requests = (status == null || status.isBlank())
                ? bookRequestRepository.findAllByOrderByCreatedAtDesc()
                : bookRequestRepository.findByStatusOrderByCreatedAtDesc(status.toUpperCase());

        List<Long> userIds = requests.stream()
                .map(BookRequest::getUserId)
                .distinct()
                .collect(Collectors.toList());
        Map<Long, String> requesterNames = new HashMap<>();
        userRepository.findAllById(userIds)
                .forEach(user -> requesterNames.put(user.getId(), user.getFullName()));

        // Enrich with requester name
        List<Map<String, Object>> dtos = requests.stream()
                .map(r -> buildRequestDto(r, requesterNames.getOrDefault(r.getUserId(), "Unknown")))
                .collect(Collectors.toList());

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("totalRequests", dtos.size());
        response.put("requests", dtos);
        return ResponseEntity.ok(response);
    }

    /**
     * Update a book request status (librarian only — approve or reject).
     * Request body: { "status": "APPROVED"|"REJECTED", "rejectionReason": "..." (optional) }
     */
    @PutMapping("/{requestId}/status")
    @Transactional
    public ResponseEntity<?> updateRequestStatus(
            @PathVariable Long requestId,
            @RequestBody Map<String, Object> body) {
        BookRequest req = requireRequest(requestId);

        String newStatus = getString(body, "status");
        if (newStatus == null || newStatus.isBlank()) {
            throw new IllegalArgumentException("status is required (APPROVED or REJECTED)");
        }

        newStatus = newStatus.toUpperCase();
        if (!newStatus.equals("APPROVED") && !newStatus.equals("REJECTED")) {
            throw new IllegalArgumentException("status must be APPROVED or REJECTED");
        }

        if (!req.getStatus().equals("PENDING")) {
            throw new ConflictException("Only PENDING requests can be approved or rejected");
        }

        String rejectionReason = null;
        if (newStatus.equals("REJECTED")) {
            rejectionReason = getString(body, "rejectionReason");
            if (rejectionReason != null && rejectionReason.length() > 500) {
                throw new IllegalArgumentException("rejectionReason must not exceed 500 characters");
            }
        }

        req.setStatus(newStatus);
        req.setRejectionReason(rejectionReason);
        bookRequestRepository.save(req);

        // Notify the requesting user
        sendStatusNotification(req, newStatus, rejectionReason);

        logger.info("Book request " + requestId + " set to " + newStatus);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Book request " + newStatus.toLowerCase() + " successfully");
        response.put("request", buildRequestDto(req, null));
        return ResponseEntity.ok(response);
    }

    /**
     * Update the priority of a book request (librarian only).
     * Request body: { "priority": "NORMAL"|"URGENT" }
     */
    @PutMapping("/{requestId}/priority")
    @Transactional
    public ResponseEntity<?> updateRequestPriority(
            @PathVariable Long requestId,
            @RequestBody Map<String, Object> body) {
        BookRequest req = requireRequest(requestId);

        String priority = getString(body, "priority");
        if (priority == null || priority.isBlank()) {
            throw new IllegalArgumentException("priority is required (NORMAL or URGENT)");
        }
        priority = priority.toUpperCase();
        if (!priority.equals("NORMAL") && !priority.equals("URGENT")) {
            throw new IllegalArgumentException("priority must be NORMAL or URGENT");
        }

        req.setPriority(priority);
        bookRequestRepository.save(req);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Request priority updated to " + priority);
        response.put("request", buildRequestDto(req, null));
        return ResponseEntity.ok(response);
    }

    /**
     * Download a requested book and add it to the library (librarian only).
     * Optional body: { "summaryStyle": "short"|"medium"|"detailed" }
     */
    @PostMapping("/{requestId}/download")
    @Transactional
    public ResponseEntity<?> downloadRequestedBook(
            @PathVariable Long requestId,
            @RequestBody(required = false) Map<String, Object> body,
            @AuthenticationPrincipal LibraryPrincipal principal) {

        Long librarianId = ownershipGuard.actingUserId(principal);

        BookRequest req = requireRequest(requestId);
        if ("REJECTED".equals(req.getStatus())) {
            throw new ConflictException("Rejected requests cannot be downloaded");
        }

        // If librarian provided a direct sourceUrl in the body, try that first
        Optional<BookDownloadService.DownloadedBook> downloadOpt = Optional.empty();
        if (body != null) {
            String sourceUrl = getString(body, "sourceUrl");
            if (sourceUrl != null && !sourceUrl.isBlank()) {
                String downloadTitle = getString(body, "downloadTitle");
                String downloadAuthor = getString(body, "downloadAuthor");
                String directTitle = (downloadTitle != null && !downloadTitle.isBlank()) ? downloadTitle : req.getTitle();
                String directAuthor = (downloadAuthor != null && !downloadAuthor.isBlank()) ? downloadAuthor : req.getAuthor();
                downloadOpt = bookDownloadService.downloadFromDirectUrl(sourceUrl, directTitle, directAuthor);
            }
        }

        if (!downloadOpt.isPresent()) {
            downloadOpt = bookDownloadService.downloadFromArxiv(req.getTitle(), req.getAuthor(), req.getKeywords());
        }

        if (!downloadOpt.isPresent()) {
            List<BookDownloadService.ArxivSuggestion> suggestions = bookDownloadService
                    .suggestArxivDownloads(req.getTitle(), req.getAuthor(), req.getKeywords(), 3);
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "No downloadable version was found on arXiv. Try the suggested arXiv results below or upload manually.");
            response.put("searchedSources", java.util.Collections.singletonList("arXiv"));
            response.put("suggestedArxivResults", suggestions);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
        }

        BookDownloadService.DownloadedBook downloaded = downloadOpt.get();
        PreparedBookFile bookFile = downloaded.getBookFile();
        PreparedBookFile coverFile = downloaded.getCoverFile();

        if (bookFile == null || bookFile.fileData() == null || bookFile.fileData().length == 0) {
            throw new ConflictException("The downloaded file was empty — try another source or upload manually");
        }

        User externalAuthor = ensureExternalAuthor();
        List<String> genres = deriveGenres(downloaded.getSubjects(), req.getGenre());
        String description = buildDownloadedDescription(downloaded.getTitle(), genres,
                body != null ? body.get("summaryStyle") : null);

        Book book = new Book();
        book.setTitle(downloaded.getTitle());
        book.setGenre(genres.isEmpty() ? "Uncategorized" : String.join(", ", genres));
        book.setDescription(description);
        book.setAuthorId(externalAuthor.getId());
        book.setAuthorUser(externalAuthor);
        book.setSubmittedDate(LocalDateTime.now());
        book.setPublishedDate(java.time.LocalDate.now());
        book.setStatus(Book.BookStatus.APPROVED);
        // Safe direct write: the book row does not exist yet, so nothing can be borrowing it.
        book.setQuantity(1);
        book.setSource(Book.BookSource.REQUEST_DOWNLOAD);
        fileStorageService.attachPreparedFileToBook(book, bookFile);
        if (coverFile != null) {
            fileStorageService.attachPreparedCoverImageToBook(book, coverFile);
        }

        Book savedBook = bookRepository.save(book);
        savedBook.setFilePath(fileStorageService.buildBookFileReference(savedBook.getId()));
        bookRepository.save(savedBook);
        recordDownloadedBookCreate(savedBook, librarianId);

        String requestedNormalizedTitle = normalizeText(req.getTitle());
        String downloadedNormalizedTitle = normalizeText(downloaded.getTitle());
        boolean alternativeUsed = !requestedNormalizedTitle.isBlank()
            && !downloadedNormalizedTitle.isBlank()
            && !requestedNormalizedTitle.equals(downloadedNormalizedTitle);

        req.setStatus("APPROVED");
        req.setRejectionReason(null);
        bookRequestRepository.save(req);

        if (alternativeUsed) {
            sendAlternativeNotification(req, savedBook, downloaded.getTitle());
        } else {
            sendStatusNotification(req, "APPROVED", null);
        }
        notifySimilarRequesters(savedBook, req);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", alternativeUsed
            ? "Downloaded and added an alternative title to the library"
            : "Book downloaded and added to the library");
        response.put("book", savedBook);
        response.put("requestedTitle", req.getTitle());
        response.put("downloadedTitle", downloaded.getTitle());
        response.put("sourceUrl", downloaded.getSourceUrl());
        response.put("alternativeUsed", alternativeUsed);
        response.put("summaryGenerated", !description.startsWith("Summary pending"));
        return ResponseEntity.ok(response);
    }

    /**
     * Resolve a book request using an existing catalog book as an alternative.
     * This marks the request as APPROVED and notifies the requester that an alternative was provided.
     * Path: POST /api/book-requests/{requestId}/resolve-with-alternative/{bookId}
     */
    @PostMapping("/{requestId}/resolve-with-alternative/{bookId}")
    @Transactional
    public ResponseEntity<?> resolveWithAlternativeBook(
            @PathVariable Long requestId,
            @PathVariable Long bookId) {

        BookRequest req = requireRequest(requestId);
        Book book = bookRepository.findById(bookId)
                .orElseThrow(() -> new NotFoundException("Alternative book not found: " + bookId));

        if ("REJECTED".equals(req.getStatus())) {
            throw new ConflictException("Rejected requests cannot be resolved");
        }

        // Mark request as approved and associate with the alternative book
        req.setStatus("APPROVED");
        req.setRejectionReason(null);
        bookRequestRepository.save(req);

        // Notify the requester that their request was resolved with an alternative
        try {
            StudentNotification n = new StudentNotification();
            n.setUserId(req.getUserId());
            n.setCategory("BOOK_REQUEST_UPDATE");
            n.setTitle("Alternative book approved");
            n.setMessage("Your request for \"" + req.getTitle() + "\" by " + req.getAuthor()
                + " was fulfilled with an alternative title: \"" + book.getTitle()
                + "\" by " + book.getAuthor() + ". Please check it out!");
            n.setPriority("MEDIUM");
            n.setReferenceBookId(book.getId());
            n.setCreatedAt(LocalDateTime.now());
            studentNotificationRepository.save(n);
        } catch (Exception e) {
            logger.warning("Failed to send alternative notification for request " + req.getId() + ": " + e.getMessage());
        }

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Request resolved with alternative book: \"" + book.getTitle() + "\"");
        response.put("book", book);
        response.put("requestedTitle", req.getTitle());
        response.put("resolvedBookTitle", book.getTitle());
        response.put("resolvedBookAuthor", book.getAuthor());
        response.put("request", buildRequestDto(req, null));
        return ResponseEntity.ok(response);
    }

    // ── helpers ────────────────────────────────────────────────────────────

    private void sendStatusNotification(BookRequest req, String status, String rejectionReason) {
        try {
            StudentNotification n = new StudentNotification();
            n.setUserId(req.getUserId());
            n.setCategory("BOOK_REQUEST_UPDATE");
            n.setCreatedAt(LocalDateTime.now());

            if ("APPROVED".equals(status)) {
                n.setTitle("Book request approved");
                n.setMessage("Your request for \"" + req.getTitle() + "\" by " + req.getAuthor()
                        + " has been approved. The library will work on adding this book.");
                n.setPriority("HIGH");
            } else {
                String reasonSuffix = (rejectionReason != null && !rejectionReason.isBlank())
                        ? " Reason: " + rejectionReason : "";
                n.setTitle("Book request rejected");
                n.setMessage("Your request for \"" + req.getTitle() + "\" by " + req.getAuthor()
                        + " has been rejected." + reasonSuffix);
                n.setPriority("MEDIUM");
            }

            studentNotificationRepository.save(n);
        } catch (Exception e) {
            logger.warning("Failed to send notification for book request " + req.getId() + ": " + e.getMessage());
        }
    }

    private void sendAlternativeNotification(BookRequest req, Book book, String downloadedTitle) {
        try {
            StudentNotification n = new StudentNotification();
            n.setUserId(req.getUserId());
            n.setCategory("BOOK_REQUEST_UPDATE");
            n.setTitle("Alternative title added");
            n.setMessage("Your request for \"" + req.getTitle() + "\" by " + req.getAuthor()
                    + " was fulfilled with an alternative title: \"" + downloadedTitle + "\".");
            n.setPriority("MEDIUM");
            n.setReferenceBookId(book != null ? book.getId() : null);
            n.setCreatedAt(LocalDateTime.now());
            studentNotificationRepository.save(n);
        } catch (Exception e) {
            logger.warning("Failed to send alternative notification for book request " + req.getId() + ": " + e.getMessage());
        }
    }

    private void notifySimilarRequesters(Book book, BookRequest originRequest) {
        if (book == null || book.getTitle() == null) return;
        try {
            String title = book.getTitle().trim();
            List<BookRequest> similarRequests = bookRequestRepository
                    .findByStatusInAndTitleContainingIgnoreCase(
                            java.util.Arrays.asList("PENDING", "APPROVED"),
                            title);

            if (similarRequests.isEmpty()) return;

            LocalDateTime now = LocalDateTime.now();
            List<StudentNotification> notifications = similarRequests.stream()
                    .filter(req -> originRequest == null || !req.getId().equals(originRequest.getId()))
                    .map(req -> {
                        StudentNotification n = new StudentNotification();
                        n.setUserId(req.getUserId());
                        n.setCategory("BOOK_REQUEST_UPDATE");
                        n.setTitle("Similar title now available");
                        n.setMessage("A title similar to your request (\"" + title
                                + "\") has been added to the catalog. Check it out in the library.");
                        n.setPriority("MEDIUM");
                        n.setReferenceBookId(book.getId());
                        n.setCreatedAt(now);
                        return n;
                    })
                    .collect(Collectors.toList());

            if (!notifications.isEmpty()) {
                studentNotificationRepository.saveAll(notifications);
            }
        } catch (Exception e) {
            logger.warning("Failed to notify similar requesters: " + e.getMessage());
        }
    }

    private User ensureExternalAuthor() {
        return userRepository.findByUsername("library_system")
                .orElseGet(() -> {
                    User user = new User();
                    user.setUsername("library_system");
                    user.setEmail("library.system@library.local");
                    user.setFullName("Library System");
                    user.setRole("AUTHOR");
                    user.setPassword(passwordEncoder.encode("library-system"));
                    user.setActive(true);
                    return userRepository.save(user);
                });
    }

    private List<String> deriveGenres(List<String> subjects, String fallbackGenre) {
        List<String> genres = new java.util.ArrayList<>();
        if (subjects != null) {
            subjects.stream()
                    .filter(s -> s != null && !s.isBlank())
                    .limit(3)
                    .forEach(s -> genres.add(s.trim()));
        }
        if (genres.isEmpty() && fallbackGenre != null && !fallbackGenre.isBlank()) {
            genres.add(fallbackGenre.trim());
        }
        return genres;
    }

    private String buildDownloadedDescription(String title, List<String> genres, Object styleObj) {
        String style = styleObj != null ? styleObj.toString() : "medium";
        try {
            return geminiService.generateBookSummary(title, genres, style);
        } catch (Exception e) {
            return "Summary pending. Use the Generate Summary tool to add a description.";
        }
    }

    private BookRequest requireRequest(Long requestId) {
        return bookRequestRepository.findById(requestId)
                .orElseThrow(() -> new NotFoundException("Book request not found: " + requestId));
    }

    private Map<String, Object> buildRequestDto(BookRequest req, String requesterName) {
        Map<String, Object> dto = new HashMap<>();
        dto.put("requestId", req.getId());
        dto.put("userId", req.getUserId());
        dto.put("title", req.getTitle());
        dto.put("author", req.getAuthor());
        dto.put("genre", req.getGenre());
        dto.put("keywords", req.getKeywords());
        dto.put("reason", req.getReason());
        dto.put("status", req.getStatus());
        dto.put("priority", req.getPriority() != null ? req.getPriority() : "NORMAL");
        dto.put("rejectionReason", req.getRejectionReason());
        dto.put("createdAt", req.getCreatedAt());
        dto.put("updatedAt", req.getUpdatedAt());
        if (requesterName != null) {
            dto.put("requesterName", requesterName);
        }
        return dto;
    }

    private String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String getString(Map<String, Object> body, String key) {
        Object val = body.get(key);
        return val != null ? val.toString().trim() : null;
    }

    private String normalizeText(String value) {
        if (value == null) return "";
        return value.toLowerCase().replaceAll("[^a-z0-9]+", " ").trim();
    }

    private void recordDownloadedBookCreate(Book book, Long changedByUserId) {
        try {
            Map<String, Object> after = new HashMap<>();
            after.put("title", book.getTitle());
            after.put("genre", book.getGenre());
            after.put("description", book.getDescription());
            after.put("status", book.getStatus() != null ? book.getStatus().name() : null);
            after.put("quantity", book.getQuantity());
            after.put("authorId", book.getAuthorId());
            after.put("publishedDate", book.getPublishedDate() != null ? book.getPublishedDate().toString() : null);
            after.put("fileName", book.getFileName());
            after.put("coverImageName", book.getCoverImageName());
            after.put("source", book.getSource() != null ? book.getSource().name() : null);
            after.put("submittedDate", book.getSubmittedDate() != null ? book.getSubmittedDate().toString() : null);

            Map<String, Object> payload = new HashMap<>();
            payload.put("before", null);
            payload.put("after", after);

            BookChangeLog log = new BookChangeLog();
            log.setBookId(book.getId());
            log.setBookTitle(book.getTitle());
            log.setChangedBy(changedByUserId);
            log.setAction("CREATE");
            log.setDetails(objectMapper.writeValueAsString(payload));
            bookChangeLogRepository.save(log);
        } catch (Exception e) {
            logger.warning("Failed to record downloaded book create history: " + e.getMessage());
        }
    }
}
