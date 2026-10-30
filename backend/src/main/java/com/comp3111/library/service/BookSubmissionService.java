package com.comp3111.library.service;

import com.comp3111.library.model.Book;
import com.comp3111.library.model.User;
import com.comp3111.library.repository.BookRepository;
import com.comp3111.library.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class BookSubmissionService {

    private final BookRepository bookRepository;
    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;

    public BookSubmissionService(BookRepository bookRepository,
                                 UserRepository userRepository,
                                 FileStorageService fileStorageService) {
        this.bookRepository = bookRepository;
        this.userRepository = userRepository;
        this.fileStorageService = fileStorageService;
    }

    @Transactional
    public Book submitBook(Long authorId,
                           String title,
                           List<String> genres,
                           String description,
                           PreparedBookFile preparedFile,
                           PreparedBookFile preparedCoverImage) {
        User author = userRepository.findById(authorId)
                .orElseThrow(() -> new IllegalArgumentException("Author not found"));

        Book book = new Book();
        book.setTitle(title);
        String genreValue = genres != null && !genres.isEmpty()
                ? String.join(", ", genres)
                : "Uncategorized";
        if (genreValue.length() > 500) {
            throw new IllegalArgumentException("Selected genres exceed the maximum allowed length. Please select fewer genres.");
        }
        book.setGenre(genreValue);
        if (description != null && description.length() > 5000) {
            throw new IllegalArgumentException("Description must not exceed 5000 characters.");
        }
        book.setDescription(description);
        book.setAuthorId(authorId);
        book.setAuthorUser(author);
        book.setSubmittedDate(LocalDateTime.now());
        book.setStatus(Book.BookStatus.PENDING);
        book.setQuantity(0);
        book.setSource(Book.BookSource.AUTHOR_SUBMISSION);
        fileStorageService.attachPreparedFileToBook(book, preparedFile);
        if (preparedCoverImage != null) {
            fileStorageService.attachPreparedCoverImageToBook(book, preparedCoverImage);
        }

        Book savedBook = bookRepository.save(book);
        savedBook.setFilePath(fileStorageService.buildBookFileReference(savedBook.getId()));
        return savedBook;
    }
}
