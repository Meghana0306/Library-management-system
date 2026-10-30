package com.comp3111.library.controller;

import com.comp3111.library.exception.NotFoundException;
import com.comp3111.library.model.User;
import com.comp3111.library.repository.UserRepository;
import com.comp3111.library.service.FileStorageService;
import com.comp3111.library.service.StoredFileResource;
import com.comp3111.library.security.LibraryPrincipal;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/files")
public class FileController {

    private static final String CACHE_CONTROL_VALUE = "private, max-age=3600";

    @Autowired
    private FileStorageService fileStorageService;

    @Autowired
    private UserRepository userRepository;

    /** Preview a book file inline by book ID */
    @GetMapping("/preview/{bookId}")
    public ResponseEntity<Resource> previewFile(
            @PathVariable Long bookId,
            @AuthenticationPrincipal LibraryPrincipal principal,
            @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String ifNoneMatch) {
        return fileResponse(fileStorageService.loadBookFile(bookId, principal), "inline", ifNoneMatch);
    }

    /** Download a book file as an attachment by file reference */
    @GetMapping("/download")
    public ResponseEntity<Resource> downloadFile(
            @RequestParam("filePath") String filePath,
            @AuthenticationPrincipal LibraryPrincipal principal,
            @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String ifNoneMatch) {
        return fileResponse(fileStorageService.loadBookFileByReference(filePath, principal), "attachment", ifNoneMatch);
    }

    /** Stream a book file inline by file reference */
    @GetMapping("/stream")
    public ResponseEntity<Resource> streamFile(
            @RequestParam("filePath") String filePath,
            @AuthenticationPrincipal LibraryPrincipal principal,
            @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String ifNoneMatch) {
        return fileResponse(fileStorageService.loadBookFileByReference(filePath, principal), "inline", ifNoneMatch);
    }

    /** Stream a cover image inline by book ID — same access rule as the book file */
    @GetMapping("/cover/{bookId}")
    public ResponseEntity<Resource> streamCoverImage(
            @PathVariable Long bookId,
            @AuthenticationPrincipal LibraryPrincipal principal,
            @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String ifNoneMatch) {
        return fileResponse(fileStorageService.loadBookCover(bookId, principal), "inline", ifNoneMatch);
    }

    /** Stream a user profile picture by user ID — readable by any authenticated caller */
    @GetMapping("/avatar/{userId}")
    public ResponseEntity<Resource> streamAvatar(
            @PathVariable Long userId,
            @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String ifNoneMatch) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found: " + userId));

        byte[] data = user.getProfilePicture();
        if (data == null || data.length == 0) {
            throw new NotFoundException("No profile picture found for user: " + userId);
        }

        String contentType = user.getProfilePictureType() != null ? user.getProfilePictureType() : "image/jpeg";
        String etag = FileStorageService.etag("avatar", userId, data.length, contentType, user.getUpdatedAt());
        if (FileStorageService.matchesIfNoneMatch(etag, ifNoneMatch)) {
            return notModified(etag);
        }

        return cacheableResponse(etag)
                .contentType(MediaType.parseMediaType(contentType))
                .contentLength(data.length)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"avatar-" + userId + "\"")
                .body(new ByteArrayResource(data));
    }

    private ResponseEntity<Resource> fileResponse(StoredFileResource storedFile, String disposition, String ifNoneMatch) {
        if (FileStorageService.matchesIfNoneMatch(storedFile.etag(), ifNoneMatch)) {
            return notModified(storedFile.etag());
        }
        return cacheableResponse(storedFile.etag())
                .contentType(MediaType.parseMediaType(storedFile.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition + "; filename=\"" + storedFile.fileName() + "\"")
                .contentLength(storedFile.fileSize())
                .body(storedFile.resource());
    }

    private ResponseEntity.BodyBuilder cacheableResponse(String etag) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, CACHE_CONTROL_VALUE)
                .eTag(etag);
    }

    private ResponseEntity<Resource> notModified(String etag) {
        return ResponseEntity.status(HttpStatus.NOT_MODIFIED)
                .header(HttpHeaders.CACHE_CONTROL, CACHE_CONTROL_VALUE)
                .eTag(etag)
                .build();
    }
}
