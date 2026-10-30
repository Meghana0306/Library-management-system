package com.comp3111.library.util;

/**
 * Utility class for validating password strength.
 * Follows NIST 800-63B guidelines for password composition.
 */
public class PasswordValidator {

    private static final int MIN_LENGTH = 8;
    private static final String UPPERCASE_PATTERN = ".*[A-Z].*";
    private static final String LOWERCASE_PATTERN = ".*[a-z].*";
    private static final String DIGIT_PATTERN = ".*\\d.*";
    private static final String SPECIAL_CHAR_PATTERN = ".*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>/?].*";

    /**
     * Validates if a password meets strong password criteria.
     * Requirements:
     * - Minimum 8 characters
     * - At least one uppercase letter
     * - At least one lowercase letter
     * - At least one digit
     * - At least one special character
     *
     * @param password the password to validate
     * @return PasswordValidationResult containing success status and specific error messages
     */
    public static PasswordValidationResult validate(String password) {
        if (password == null || password.isEmpty()) {
            return new PasswordValidationResult(false, "Password is required");
        }

        if (password.length() < MIN_LENGTH) {
            return new PasswordValidationResult(false,
                "Password must be at least " + MIN_LENGTH + " characters long");
        }

        if (!password.matches(UPPERCASE_PATTERN)) {
            return new PasswordValidationResult(false,
                "Password must contain at least one uppercase letter");
        }

        if (!password.matches(LOWERCASE_PATTERN)) {
            return new PasswordValidationResult(false,
                "Password must contain at least one lowercase letter");
        }

        if (!password.matches(DIGIT_PATTERN)) {
            return new PasswordValidationResult(false,
                "Password must contain at least one digit");
        }

        if (!password.matches(SPECIAL_CHAR_PATTERN)) {
            return new PasswordValidationResult(false,
                "Password must contain at least one special character (!@#$%^&* etc)");
        }

        return new PasswordValidationResult(true, "Password is strong");
    }

    /**
     * Inner class to hold validation result
     */
    public static class PasswordValidationResult {
        private final boolean valid;
        private final String message;

        public PasswordValidationResult(boolean valid, String message) {
            this.valid = valid;
            this.message = message;
        }

        public boolean isValid() {
            return valid;
        }

        public String getMessage() {
            return message;
        }
    }
}

