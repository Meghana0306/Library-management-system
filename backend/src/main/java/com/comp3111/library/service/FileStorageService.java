package com.comp3111.library.service;

import com.comp3111.library.exception.NotFoundException;
import com.comp3111.library.model.Book;
import com.comp3111.library.repository.BookRepository;
import com.comp3111.library.security.LibraryPrincipal;
import org.apache.commons.io.FilenameUtils;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import javax.annotation.PostConstruct;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.logging.Logger;

@Service
public class FileStorageService {

    private static final Logger logger = Logger.getLogger(FileStorageService.class.getName());
    private static final String DB_BOOK_REFERENCE_PREFIX = "db://book/";
    private static final List<String> COVER_IMAGE_ALLOWED_EXTENSIONS = Arrays.asList("jpg", "jpeg", "png");

    private final BookRepository bookRepository;

    @Value("${file.upload.max-size:10485760}")
    private long maxFileSize;

    @Value("${file.upload.allowed-extensions:pdf,txt,doc,docx}")
    private String allowedExtensionsStr;

    @Value("${file.upload.cover-image.max-size:5242880}")
    private long maxCoverImageSize;

    private List<String> allowedExtensions;

    public FileStorageService(BookRepository bookRepository) {
        this.bookRepository = bookRepository;
    }

    @PostConstruct
    private void initializeAllowedExtensions() {
        allowedExtensions = Arrays.stream(allowedExtensionsStr.split(","))
                .map(String::trim)
                .map(String::toLowerCase)
                .collect(Collectors.toList());
    }

    public PreparedBookFile prepareMultipartFile(MultipartFile file) throws IOException {
        return new PreparedBookFile(
                sanitizeFileName(file.getOriginalFilename()),
                resolveContentType(file),
                file.getSize(),
                file.getBytes()
        );
    }

    public void attachPreparedFileToBook(Book book, PreparedBookFile preparedFile) {
        book.setFileName(preparedFile.fileName());
        book.setFileType(preparedFile.contentType());
        book.setFileSize(preparedFile.fileSize());
        book.setFileData(preparedFile.fileData());
    }

    public void attachPreparedCoverImageToBook(Book book, PreparedBookFile preparedCoverImage) {
        book.setCoverImageName(preparedCoverImage.fileName());
        book.setCoverImageType(preparedCoverImage.contentType());
        book.setCoverImageSize(preparedCoverImage.fileSize());
        book.setCoverImageData(preparedCoverImage.fileData());
    }

    public String buildBookFileReference(Long bookId) {
        return DB_BOOK_REFERENCE_PREFIX + bookId;
    }

    /**
     * Load a book file by its opaque {@code db://book/{id}} reference, enforcing the
     * CONTRACTS §2 access rule before any bytes are handed back.
     */
    @Transactional(readOnly = true)
    public StoredFileResource loadBookFileByReference(String reference, LibraryPrincipal principal) {
        if (reference == null || reference.isBlank()) {
            throw new NotFoundException("filePath parameter is required");
        }
        if (!reference.startsWith(DB_BOOK_REFERENCE_PREFIX)) {
            throw new NotFoundException("Unsupported file reference: " + reference);
        }
        return loadBookFile(parseBookId(reference), principal);
    }

    @Transactional(readOnly = true)
    public StoredFileResource loadBookFile(Long bookId, LibraryPrincipal principal) {
        Book book = requireReadableBook(bookId, principal);

        byte[] fileData = book.getFileData();
        if (fileData == null || fileData.length == 0) {
            throw new NotFoundException("No file stored for book: " + bookId);
        }

        String fileName = (book.getFileName() != null && !book.getFileName().isBlank())
                ? book.getFileName()
                : "book-" + bookId + ".pdf";
        String contentType = (book.getFileType() != null && !book.getFileType().isBlank())
                ? book.getFileType()
                : "application/pdf";
        long fileSize = book.getFileSize() != null ? book.getFileSize() : fileData.length;

        return new StoredFileResource(namedResource(fileData, fileName), fileName, contentType, fileSize,
                etag("book", bookId, fileSize, fileName, contentType, book.getStatus().name()));
    }

    @Transactional(readOnly = true)
    public StoredFileResource loadBookCover(Long bookId, LibraryPrincipal principal) {
        Book book = requireReadableBook(bookId, principal);

        byte[] coverImageData = book.getCoverImageData();
        if (coverImageData == null || coverImageData.length == 0) {
            throw new NotFoundException("No cover image stored for book: " + bookId);
        }

        String fileName = (book.getCoverImageName() != null && !book.getCoverImageName().isBlank())
                ? book.getCoverImageName()
                : "cover-" + bookId + ".jpg";
        String contentType = (book.getCoverImageType() != null && !book.getCoverImageType().isBlank())
                ? book.getCoverImageType()
                : "image/jpeg";
        long fileSize = book.getCoverImageSize() != null ? book.getCoverImageSize() : coverImageData.length;

        return new StoredFileResource(namedResource(coverImageData, fileName), fileName, contentType, fileSize,
                etag("cover", bookId, fileSize, fileName, contentType, book.getStatus().name()));
    }

    private Book requireReadableBook(Long bookId, LibraryPrincipal principal) {
        Book book = bookRepository.findById(bookId)
                .orElseThrow(() -> new NotFoundException("Book not found: " + bookId));
        if (!FileAccessRule.canReadBookFile(book.getStatus(), book.getAuthorId(), principal)) {
            throw new AccessDeniedException("This book is not available to you.");
        }
        return book;
    }

    /**
     * Stable across restarts (no identity hashes here — every field must be a value type),
     * and changes whenever the stored bytes or the book status do.
     */
    public static String etag(String kind, Object id, long size, Object... stableFields) {
        return "\"" + kind + "-" + id + "-" + size + "-"
                + Integer.toHexString(Objects.hash(kind, String.valueOf(id), size, Arrays.hashCode(stableFields))) + "\"";
    }

    /** Handles {@code *}, weak validators and the comma-separated list form. */
    public static boolean matchesIfNoneMatch(String etag, String ifNoneMatchHeader) {
        if (etag == null || ifNoneMatchHeader == null || ifNoneMatchHeader.isBlank()) {
            return false;
        }
        String header = ifNoneMatchHeader.trim();
        if ("*".equals(header)) {
            return true;
        }
        for (String candidate : header.split(",")) {
            String normalized = candidate.trim();
            if (normalized.startsWith("W/")) {
                normalized = normalized.substring(2);
            }
            if (etag.equals(normalized)) {
                return true;
            }
        }
        return false;
    }

    private Resource namedResource(byte[] data, String fileName) {
        return new ByteArrayResource(data) {
            @Override
            public String getFilename() {
                return fileName;
            }
        };
    }

    /**
     * Validate file before storage
     */
    public boolean validateFile(MultipartFile file) {
        // Check if file is empty
        if (file.isEmpty()) {
            logger.warning("File is empty");
            return false;
        }

        // Check file size
        if (file.getSize() > maxFileSize) {
            logger.warning("File size exceeds limit: " + file.getSize());
            return false;
        }

        // Check file extension
        String fileName = file.getOriginalFilename();
        if (fileName == null) {
            logger.warning("File name is null");
            return false;
        }

        String extension = FilenameUtils.getExtension(fileName).toLowerCase();
        if (!allowedExtensions.contains(extension)) {
            logger.warning("File extension not allowed: " + extension);
            return false;
        }

        // Check MIME type
        String contentType = file.getContentType();
        if (contentType != null && !isValidMimeType(contentType)) {
            logger.warning("Invalid MIME type: " + contentType);
            return false;
        }

        return true;
    }

    /**
     * Validate optional cover image before storage.
     */
    public boolean validateCoverImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return true;
        }

        if (file.getSize() > maxCoverImageSize) {
            logger.warning("Cover image size exceeds limit: " + file.getSize());
            return false;
        }

        String fileName = file.getOriginalFilename();
        if (fileName == null) {
            logger.warning("Cover image file name is null");
            return false;
        }

        String extension = FilenameUtils.getExtension(fileName).toLowerCase();
        if (!COVER_IMAGE_ALLOWED_EXTENSIONS.contains(extension)) {
            logger.warning("Cover image extension not allowed: " + extension);
            return false;
        }

        String contentType = file.getContentType();
        if (contentType != null && !isValidCoverImageMimeType(contentType)) {
            logger.warning("Invalid cover image MIME type: " + contentType);
            return false;
        }

        return true;
    }

    private String resolveContentType(MultipartFile file) {
        String contentType = file.getContentType();
        if (contentType != null && !contentType.isBlank()) {
            return contentType;
        }

        String extension = FilenameUtils.getExtension(file.getOriginalFilename()).toLowerCase();
        return switch (extension) {
            case "pdf" -> "application/pdf";
            case "txt" -> "text/plain";
            case "doc" -> "application/msword";
            case "docx" -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            default -> "application/octet-stream";
        };
    }


    private Long parseBookId(String reference) {
        try {
            return Long.parseLong(reference.substring(DB_BOOK_REFERENCE_PREFIX.length()));
        } catch (NumberFormatException e) {
            throw new NotFoundException("Invalid book file reference: " + reference);
        }
    }

    /**
     * Sanitize filename to remove dangerous characters
     */
    private String sanitizeFileName(String fileName) {
        if (fileName == null || fileName.isEmpty()) {
            return "file";
        }

        // Remove path separators and special characters
        return fileName
                .replaceAll("[^a-zA-Z0-9._-]", "_")
                .replaceAll("^[._-]+", "")
                .replaceAll("[._-]+$", "");
    }

    /**
     * Validate MIME type
     */
    private boolean isValidMimeType(String mimeType) {
        return mimeType.equals("application/pdf") ||
                mimeType.equals("text/plain") ||
                mimeType.equals("application/msword") ||
                mimeType.equals("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    }

    private boolean isValidCoverImageMimeType(String mimeType) {
        return mimeType.equals("image/jpeg") || mimeType.equals("image/png");
    }

}
