package com.comp3111.library.controller;

import com.comp3111.library.dto.RegistrationRequest;
import com.comp3111.library.dto.RegistrationResponse;
import com.comp3111.library.dto.LoginRequest;
import com.comp3111.library.dto.LoginResponse;
import com.comp3111.library.dto.AuthorProfileUpdateRequest;
import com.comp3111.library.exception.ApiError;
import com.comp3111.library.exception.ConflictException;
import com.comp3111.library.exception.ErrorCode;
import com.comp3111.library.exception.NotFoundException;
import com.comp3111.library.model.User;
import com.comp3111.library.repository.UserRepository;
import com.comp3111.library.security.JwtService;
import com.comp3111.library.security.LibraryPrincipal;
import com.comp3111.library.security.OwnershipGuard;
import com.comp3111.library.util.PasswordValidator;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.validation.Valid;
import java.io.IOException;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Set<String> ALLOWED_ROLES = Set.of("STUDENT", "STAFF", "AUTHOR", "LIBRARIAN");
    private static final long MAX_AVATAR_BYTES = 2L * 1024 * 1024;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private OwnershipGuard ownershipGuard;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegistrationRequest request) {
        // Strength first: a weak password should get the actionable message even when the
        // username is also taken.
        requireStrongPassword(request.getPassword());
        String role = normalizeRole(request.getRole());

        if (userRepository.findByUsername(request.getUsername()).isPresent()) {
            throw new ConflictException("Username already exists");
        }
        if (request.getEmail() != null && !request.getEmail().isEmpty() &&
                userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new ConflictException("Email already exists");
        }

        User newUser = new User();
        newUser.setUsername(request.getUsername());
        newUser.setEmail(request.getEmail() != null && !request.getEmail().isEmpty()
                ? request.getEmail() : request.getUsername() + "@library.local");
        newUser.setPassword(passwordEncoder.encode(request.getPassword()));
        newUser.setFullName(request.getFullName());
        newUser.setEmployeeId(request.getEmployeeId());
        newUser.setBio(request.getBio());
        newUser.setRole(role);
        newUser.setActive(true);

        User savedUser = userRepository.save(newUser);
        return ResponseEntity.status(HttpStatus.CREATED).body(
                new RegistrationResponse(true, "Registration successful", savedUser.getId(), savedUser.getUsername())
        );
    }

    /** Login for Student/Staff users */
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        return performLogin(request, List.of("STUDENT", "STAFF"), "Only students and staff can login here.");
    }

    /** Login for Librarian users */
    @PostMapping("/login/librarian")
    public ResponseEntity<?> librarianLogin(@Valid @RequestBody LoginRequest request) {
        return performLogin(request, List.of("LIBRARIAN"), "Only librarians can login here.");
    }

    /** Login for Author users */
    @PostMapping("/login/author")
    public ResponseEntity<?> authorLogin(@Valid @RequestBody LoginRequest request) {
        return performLogin(request, List.of("AUTHOR"), "Only authors can login here.");
    }

    private ResponseEntity<?> performLogin(LoginRequest request, List<String> allowedRoles, String roleErrorMessage) {
        User user = userRepository.findByUsername(request.getUsername()).orElse(null);
        // Same response for an unknown username and a wrong password — no account enumeration.
        if (user == null || !passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            return error(HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHENTICATED, "Invalid credentials");
        }
        if (!user.isActive()) {
            return error(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN,
                    "Account is deactivated. Please contact a librarian.");
        }
        if (!allowedRoles.contains(user.getRole())) {
            return error(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN, "Access denied. " + roleErrorMessage);
        }

        user.setLastLoginAt(LocalDateTime.now());
        userRepository.save(user);

        String token = jwtService.issueToken(user.getId(), user.getUsername(), user.getRole());
        return ResponseEntity.ok(new LoginResponse(true, "Login successful", user.getId(), user.getUsername(),
                user.getFullName(), user.getRole(), token));
    }

    @PutMapping("/profile/author/{userId}")
    public ResponseEntity<?> updateAuthorProfile(@PathVariable Long userId,
                                                 @Valid @RequestBody AuthorProfileUpdateRequest request,
                                                 @AuthenticationPrincipal LibraryPrincipal principal) {
        ownershipGuard.assertSelf(userId, principal);

        String nextBio = request.getBio() == null ? null : request.getBio().trim();
        String nextPassword = request.getPassword() == null ? "" : request.getPassword().trim();
        if (!nextPassword.isEmpty()) {
            requireStrongPassword(nextPassword);
        }

        User user = requireUser(userId);
        if (!"AUTHOR".equals(user.getRole())) {
            return error(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN,
                    "Only author profile can be updated via this endpoint");
        }
        requireCurrentPassword(request.getCurrentPassword(), user);

        user.setFullName(request.getFullName().trim());
        user.setBio(nextBio);
        if (!nextPassword.isEmpty()) {
            user.setPassword(passwordEncoder.encode(nextPassword));
        }

        User savedUser = userRepository.save(user);
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Profile updated successfully");
        response.put("userId", savedUser.getId());
        response.put("fullName", savedUser.getFullName());
        response.put("bio", savedUser.getBio());
        response.put("passwordChanged", !nextPassword.isEmpty());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/profile/student/{userId}")
    public ResponseEntity<?> getStudentProfile(@PathVariable Long userId,
                                               @AuthenticationPrincipal LibraryPrincipal principal) {
        ownershipGuard.assertSelf(userId, principal);

        User user = requireUser(userId);
        if (!isStudentOrStaff(user)) {
            return error(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN,
                    "Only student/staff profile can be retrieved via this endpoint");
        }

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("userId", user.getId());
        response.put("username", user.getUsername());
        response.put("fullName", user.getFullName());
        response.put("role", user.getRole());
        response.put("email", user.getEmail());
        return ResponseEntity.ok(response);
    }

    @PutMapping("/profile/student/{userId}")
    public ResponseEntity<?> updateStudentProfile(@PathVariable Long userId,
                                                  @RequestBody(required = false) Map<String, String> request,
                                                  @AuthenticationPrincipal LibraryPrincipal principal) {
        ownershipGuard.assertSelf(userId, principal);

        Map<String, String> body = request == null ? Map.of() : request;
        String fullName = body.get("fullName") == null ? "" : body.get("fullName").trim();
        String currentPassword = body.get("currentPassword") == null ? "" : body.get("currentPassword");
        String nextPassword = body.get("password") == null ? "" : body.get("password").trim();

        if (fullName.isEmpty()) {
            throw new IllegalArgumentException("Full Name is required");
        }
        if (currentPassword.isEmpty()) {
            throw new IllegalArgumentException("Current password is required for profile updates");
        }
        if (!nextPassword.isEmpty()) {
            requireStrongPassword(nextPassword);
        }

        User user = requireUser(userId);
        if (!isStudentOrStaff(user)) {
            return error(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN,
                    "Only student/staff profile can be updated via this endpoint");
        }
        requireCurrentPassword(currentPassword, user);

        user.setFullName(fullName);
        if (!nextPassword.isEmpty()) {
            user.setPassword(passwordEncoder.encode(nextPassword));
        }

        User savedUser = userRepository.save(user);
        Map<String, Object> userData = new HashMap<>();
        userData.put("id", savedUser.getId());
        userData.put("email", savedUser.getEmail());
        userData.put("role", savedUser.getRole());
        userData.put("fullName", savedUser.getFullName());

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Profile updated successfully");
        response.put("user", userData);
        response.put("passwordChanged", !nextPassword.isEmpty());
        return ResponseEntity.ok(response);
    }

    @PostMapping(value = "/profile/{userId}/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadProfilePicture(@PathVariable Long userId,
                                                  @RequestPart("avatar") MultipartFile avatar,
                                                  @AuthenticationPrincipal LibraryPrincipal principal) {
        ownershipGuard.assertSelf(userId, principal);

        if (avatar == null || avatar.isEmpty()) {
            throw new IllegalArgumentException("Profile picture file is required");
        }
        if (avatar.getSize() > MAX_AVATAR_BYTES) {
            throw new IllegalArgumentException("Profile picture must be less than 2MB");
        }
        String contentType = avatar.getContentType();
        if (contentType == null || (!contentType.equals("image/jpeg") && !contentType.equals("image/png"))) {
            throw new IllegalArgumentException("Profile picture must be a JPG or PNG image");
        }
        String originalFilename = avatar.getOriginalFilename();
        if (originalFilename != null) {
            String lower = originalFilename.toLowerCase(Locale.ROOT);
            if (!lower.endsWith(".jpg") && !lower.endsWith(".jpeg") && !lower.endsWith(".png")) {
                throw new IllegalArgumentException("Profile picture must be a JPG or PNG image");
            }
        }

        User user = requireUser(userId);
        try {
            user.setProfilePicture(avatar.getBytes());
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read the uploaded profile picture", e);
        }
        user.setProfilePictureType(contentType);
        userRepository.save(user);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Profile picture updated successfully");
        return ResponseEntity.ok(response);
    }

    private User requireUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found: " + userId));
    }

    private boolean isStudentOrStaff(User user) {
        return "STUDENT".equals(user.getRole()) || "STAFF".equals(user.getRole());
    }

    /**
     * A mistyped current password is a form-input problem, not a session problem — a 401
     * here would trip the frontend interceptor and sign the user out mid-edit.
     */
    private void requireCurrentPassword(String currentPassword, User user) {
        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw new IllegalArgumentException("Current password is incorrect");
        }
    }

    private void requireStrongPassword(String password) {
        PasswordValidator.PasswordValidationResult result = PasswordValidator.validate(password);
        if (!result.isValid()) {
            throw new IllegalArgumentException(result.getMessage());
        }
    }

    private String normalizeRole(String rawRole) {
        if (rawRole == null || rawRole.trim().isEmpty()) {
            return "STUDENT";
        }
        String normalized = rawRole.trim().toUpperCase(Locale.ROOT);
        if (!ALLOWED_ROLES.contains(normalized)) {
            throw new IllegalArgumentException("Role must be one of STUDENT, STAFF, AUTHOR, LIBRARIAN");
        }
        return normalized;
    }

    private ResponseEntity<ApiError> error(HttpStatus status, ErrorCode code, String message) {
        return ResponseEntity.status(status).body(ApiError.of(code, message));
    }
}
