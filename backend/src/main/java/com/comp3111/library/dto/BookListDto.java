package com.comp3111.library.dto;

import com.comp3111.library.model.Book;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
public class BookListDto {
    private Long id;
    private String title;
    private String isbn;
    private String author;
    private LocalDate publishedDate;
    private String genre;
    private int quantity;
    private Book.BookStatus status;
    private Long authorId;
    private String description;
    private LocalDateTime submittedDate;
    private String filePath;
    private String fileName;
    private String fileType;
    private Long fileSize;
    private String rejectionReason;
    private Book.BookSource source;

    // Populated after fetch — not part of the JPQL constructor
    private Double averageRating;
    private Long reviewCount;
    private Long activeBorrows;

    /** Constructor used by JPQL queries in BookRepository. */
    public BookListDto(Long id, String title, String isbn, String author,
                       LocalDate publishedDate, String genre, int quantity,
                       Book.BookStatus status, Long authorId, String description,
                       LocalDateTime submittedDate, String filePath, String fileName,
                       String fileType, Long fileSize, String rejectionReason, Book.BookSource source) {
        this.id = id;
        this.title = title;
        this.isbn = isbn;
        this.author = author;
        this.publishedDate = publishedDate;
        this.genre = genre;
        this.quantity = quantity;
        this.status = status;
        this.authorId = authorId;
        this.description = description;
        this.submittedDate = submittedDate;
        this.filePath = filePath;
        this.fileName = fileName;
        this.fileType = fileType;
        this.fileSize = fileSize;
        this.rejectionReason = rejectionReason;
        this.source = source;
    }
}
