package com.comp3111.library.service;

import org.springframework.core.io.Resource;

public record StoredFileResource(Resource resource, String fileName, String contentType, long fileSize, String etag) {
}
