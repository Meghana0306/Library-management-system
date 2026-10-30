package com.comp3111.library.service;

public record PreparedBookFile(
        String fileName,
        String contentType,
        long fileSize,
        byte[] fileData
) {
}
