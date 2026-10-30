package com.comp3111.library.controller;

import com.comp3111.library.exception.ConflictException;
import com.comp3111.library.exception.NotFoundException;
import com.comp3111.library.model.Book;
import com.comp3111.library.model.BorrowingRecord;
import com.comp3111.library.model.User;
import com.comp3111.library.repository.BookRepository;
import com.comp3111.library.repository.BorrowingRecordRepository;
import com.comp3111.library.repository.UserRepository;
import com.comp3111.library.util.PasswordValidator;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/librarian")
public class LibrarianController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private BookRepository bookRepository;

    @Autowired
    private BorrowingRecordRepository borrowingRecordRepository;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @GetMapping("/users")
    public ResponseEntity<?> getAllUsers(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) Boolean active) {
        String normalizedSearch = search == null ? "" : search.trim().toLowerCase();
        String normalizedRole = role == null ? "" : role.trim().toUpperCase();

        List<User> users = userRepository.findAll().stream()
                .filter(user -> normalizedRole.isEmpty() || normalizedRole.equals(user.getRole()))
                .filter(user -> active == null || user.isActive() == active)
                .filter(user -> {
                    if (normalizedSearch.isEmpty()) {
                        return true;
                    }
                    return containsIgnoreCase(user.getUsername(), normalizedSearch)
                            || containsIgnoreCase(user.getEmail(), normalizedSearch)
                            || containsIgnoreCase(user.getFullName(), normalizedSearch)
                            || containsIgnoreCase(user.getEmployeeId(), normalizedSearch);
                })
                .sorted(Comparator.comparing(User::getUsername, String.CASE_INSENSITIVE_ORDER))
                .collect(Collectors.toList());

        return ResponseEntity.ok(users);
    }

    @PutMapping("/users/{userId}")
    public ResponseEntity<?> updateUser(@PathVariable Long userId, @RequestBody Map<String, String> request) {
        User user = requireUser(userId);

        String fullName = sanitize(request.get("fullName"));
        String email = sanitize(request.get("email"));
        String employeeId = sanitize(request.get("employeeId"));
        String role = sanitize(request.get("role"));

        if (fullName == null || fullName.isBlank()) {
            throw new IllegalArgumentException("Full Name is required");
        }

        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("Email is required");
        }

        if (userRepository.existsByEmailAndIdNot(email, userId)) {
            throw new ConflictException("Email already exists");
        }

        if (role != null && !role.isBlank()) {
            String normalizedRole = role.toUpperCase();
            if (!isSupportedRole(normalizedRole)) {
                throw new IllegalArgumentException("Invalid role");
            }
            user.setRole(normalizedRole);
        }

        user.setFullName(fullName);
        user.setEmail(email);
        user.setEmployeeId(employeeId);

        User savedUser = userRepository.save(user);
        return ResponseEntity.ok(savedUser);
    }

    @PutMapping("/users/bulk-update")
    public ResponseEntity<?> bulkUpdateUsers(@RequestBody Map<String, Object> request) {
        Object rawUserIds = request.get("userIds");
        if (!(rawUserIds instanceof List)) {
            throw new IllegalArgumentException("userIds is required");
        }

        List<Long> userIds = ((List<?>) rawUserIds).stream()
                .map(this::parseLong)
                .filter(id -> id != null && id > 0)
                .distinct()
                .collect(Collectors.toList());

        if (userIds.isEmpty()) {
            throw new IllegalArgumentException("userIds is required");
        }

        String role = sanitize((String) request.get("role"));
        Boolean active = request.get("active") == null ? null : Boolean.valueOf(request.get("active").toString());

        if (role != null && !role.isBlank() && !isSupportedRole(role.toUpperCase())) {
            throw new IllegalArgumentException("Invalid role");
        }

        List<User> users = userRepository.findAllById(userIds);
        Map<Long, User> byId = users.stream().collect(Collectors.toMap(User::getId, user -> user));

        List<Long> updatedIds = new ArrayList<>();
        List<Long> skippedIds = new ArrayList<>();

        for (Long userId : userIds) {
            User user = byId.get(userId);
            if (user == null) {
                skippedIds.add(userId);
                continue;
            }

            if (role != null && !role.isBlank()) {
                user.setRole(role.toUpperCase());
            }
            if (active != null) {
                user.setActive(active);
            }
            userRepository.save(user);
            updatedIds.add(userId);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("updatedUserIds", updatedIds);
        response.put("skippedUserIds", skippedIds);
        response.put("message", "Bulk user update completed");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/users/bulk-activate")
    public ResponseEntity<?> bulkActivateUsers(@RequestBody Map<String, Object> request) {
        request.put("active", true);
        return bulkUpdateUsers(request);
    }

    @PostMapping("/users/bulk-deactivate")
    public ResponseEntity<?> bulkDeactivateUsers(@RequestBody Map<String, Object> request) {
        request.put("active", false);
        return bulkUpdateUsers(request);
    }

    @PostMapping("/users/{userId}/deactivate")
    public ResponseEntity<?> deactivateUser(@PathVariable Long userId) {
        User user = requireUser(userId);
        user.setActive(false);
        userRepository.save(user);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "User account deactivated");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/users")
    public ResponseEntity<?> createUser(@RequestBody Map<String, String> request) {
        String username = sanitize(request.get("username"));
        String email = sanitize(request.get("email"));
        String fullName = sanitize(request.get("fullName"));
        String role = sanitize(request.get("role"));
        String password = request.get("password");
        String employeeId = sanitize(request.get("employeeId"));
        String bio = sanitize(request.get("bio"));

        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException("Username is required");
        }
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("Email is required");
        }
        if (fullName == null || fullName.isBlank()) {
            throw new IllegalArgumentException("Full Name is required");
        }
        if (password == null || password.isBlank()) {
            throw new IllegalArgumentException("Password is required");
        }

        String normalizedRole = role == null ? "STUDENT" : role.toUpperCase();
        if (!isSupportedRole(normalizedRole)) {
            throw new IllegalArgumentException("Invalid role");
        }

        if ("LIBRARIAN".equals(normalizedRole) && (employeeId == null || employeeId.isBlank())) {
            throw new IllegalArgumentException("Employee ID is required for Librarian accounts");
        }

        if ("AUTHOR".equals(normalizedRole) && bio != null && bio.length() > 2000) {
            throw new IllegalArgumentException("Bio must not exceed 2000 characters");
        }

        if (userRepository.findByUsername(username).isPresent()) {
            throw new ConflictException("Username already exists");
        }

        if (userRepository.findByEmail(email).isPresent()) {
            throw new ConflictException("Email already exists");
        }

        PasswordValidator.PasswordValidationResult validation = PasswordValidator.validate(password);
        if (!validation.isValid()) {
            throw new IllegalArgumentException(validation.getMessage());
        }

        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setFullName(fullName);
        user.setRole(normalizedRole);
        user.setEmployeeId("LIBRARIAN".equals(normalizedRole) ? employeeId : null);
        user.setBio("AUTHOR".equals(normalizedRole) ? bio : null);
        user.setPassword(passwordEncoder.encode(password));
        user.setActive(true);

        User savedUser = userRepository.save(user);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedUser);
    }

    @PostMapping("/users/{userId}/activate")
    public ResponseEntity<?> activateUser(@PathVariable Long userId) {
        User user = requireUser(userId);
        user.setActive(true);
        userRepository.save(user);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "User account activated");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/profile/{userId}")
    public ResponseEntity<?> getProfile(@PathVariable Long userId) {
        return ResponseEntity.ok(requireUser(userId));
    }

    @PutMapping("/profile/{userId}")
    public ResponseEntity<?> updateProfile(@PathVariable Long userId, @RequestBody Map<String, String> request) {
        User user = requireUser(userId);

        String fullName = sanitize(request.get("fullName"));
        String employeeId = sanitize(request.get("employeeId"));
        String password = request.get("password");
        String currentPassword = request.get("currentPassword");

        if (currentPassword == null || currentPassword.isBlank()) {
            throw new IllegalArgumentException("Current password is required for profile updates");
        }

        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw new IllegalArgumentException("Current password is incorrect");
        }

        if (fullName == null || fullName.isBlank()) {
            throw new IllegalArgumentException("Full Name is required");
        }

        user.setFullName(fullName);
        user.setEmployeeId(employeeId);

        if (password != null && !password.isBlank()) {
            PasswordValidator.PasswordValidationResult validation = PasswordValidator.validate(password);
            if (!validation.isValid()) {
                throw new IllegalArgumentException(validation.getMessage());
            }
            user.setPassword(passwordEncoder.encode(password));
        }

        User savedUser = userRepository.save(user);
        Map<String, Object> response = new HashMap<>();
        response.put("user", savedUser);
        response.put("passwordChanged", password != null && !password.isBlank());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/notifications")
    public ResponseEntity<?> getNotifications(@RequestParam(defaultValue = "30") int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 200));
        List<Map<String, Object>> notifications = new ArrayList<>();

        notifications.addAll(buildPendingBookNotifications(safeLimit));
        notifications.addAll(buildUserAccountNotifications(safeLimit));
        notifications.addAll(buildBorrowingActivityNotifications(safeLimit));
        notifications.add(buildSystemAnnouncement());

        List<Map<String, Object>> sorted = notifications.stream()
                .sorted((left, right) -> toTimestamp(right.get("timestamp")).compareTo(toTimestamp(left.get("timestamp"))))
                .limit(safeLimit)
                .collect(Collectors.toList());

        return ResponseEntity.ok(sorted);
    }

    private List<Map<String, Object>> buildPendingBookNotifications(int limit) {
        return bookRepository.findByStatus(Book.BookStatus.PENDING).stream()
                .sorted(Comparator.comparing(
                        b -> b.getSubmittedDate() != null ? b.getSubmittedDate() : LocalDateTime.MIN,
                        Comparator.reverseOrder()))
                .limit(limit)
                .map(book -> buildNotification("BOOK_SUBMISSION", "New book submission",
                        "\"" + book.getTitle() + "\" is awaiting librarian review.",
                        book.getSubmittedDate()))
                .collect(Collectors.toList());
    }

    private List<Map<String, Object>> buildUserAccountNotifications(int limit) {
        return userRepository.findAll().stream()
                .sorted(Comparator.comparing(
                        u -> u.getUpdatedAt() != null ? u.getUpdatedAt() : LocalDateTime.MIN,
                        Comparator.reverseOrder()))
                .limit(limit)
                .map(user -> buildNotification("USER_ACCOUNT", "User account update",
                        "User " + user.getUsername() + " (" + user.getRole() + ") is currently "
                                + (user.isActive() ? "active" : "deactivated") + ".",
                        user.getUpdatedAt()))
                .collect(Collectors.toList());
    }

    private List<Map<String, Object>> buildBorrowingActivityNotifications(int limit) {
        return borrowingRecordRepository.findAll().stream()
                .sorted(Comparator.comparing(BorrowingRecord::getBorrowedDate, Comparator.reverseOrder()))
                .limit(limit)
                .map(record -> buildNotification("BORROWING", "Borrowing activity",
                        record.getUser().getUsername() + " borrowed \"" + record.getBook().getTitle() + "\".",
                        record.getBorrowedDate()))
                .collect(Collectors.toList());
    }

    private Map<String, Object> buildSystemAnnouncement() {
        return buildNotification("ANNOUNCEMENT", "System notice",
                "Review pending submissions and user updates regularly.", LocalDateTime.now());
    }

    private Map<String, Object> buildNotification(String category, String title, String message, LocalDateTime timestamp) {
        Map<String, Object> notification = new HashMap<>();
        notification.put("category", category);
        notification.put("title", title);
        notification.put("message", message);
        notification.put("timestamp", timestamp);
        return notification;
    }

    private User requireUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found: " + userId));
    }

    private Long parseLong(Object value) {
        if (value == null) return null;
        try { return Long.parseLong(value.toString()); } catch (NumberFormatException e) { return null; }
    }

    private boolean containsIgnoreCase(String source, String keyword) {
        return source != null && source.toLowerCase().contains(keyword);
    }

    private boolean isSupportedRole(String role) {
        return "STUDENT".equals(role)
                || "STAFF".equals(role)
                || "AUTHOR".equals(role)
                || "LIBRARIAN".equals(role);
    }

    private String sanitize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private LocalDateTime toTimestamp(Object value) {
        if (value instanceof LocalDateTime) {
            return (LocalDateTime) value;
        }
        return LocalDateTime.MIN;
    }
}
