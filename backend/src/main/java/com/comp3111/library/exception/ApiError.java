package com.comp3111.library.exception;

import java.time.Instant;

public class ApiError {

    private final boolean success = false;
    private final String code;
    private final String message;
    private final String timestamp;

    public ApiError(ErrorCode code, String message) {
        this.code = code.name();
        this.message = message;
        this.timestamp = Instant.now().toString();
    }

    public static ApiError of(ErrorCode code, String message) {
        return new ApiError(code, message);
    }

    public boolean isSuccess() {
        return success;
    }

    public String getCode() {
        return code;
    }

    public String getMessage() {
        return message;
    }

    public String getTimestamp() {
        return timestamp;
    }
}
