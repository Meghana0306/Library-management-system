package com.comp3111.library.dto;

import com.comp3111.library.model.Book;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PendingBookDto {
    private Long id;
    private String title;
    private String authorUsername;
    private String authorFullName;
    private String genre;
    private LocalDateTime submittedDate;
    private Book.BookStatus status;
    private String description;
    private String filePath;
}