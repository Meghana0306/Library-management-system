package com.comp3111.library.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.hibernate.annotations.DynamicUpdate;
import org.hibernate.annotations.Type;
import javax.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "books")
@DynamicUpdate // only changed columns are written: without it a librarian title-only edit rewrites (and clobbers) quantity
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Book {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(unique = true)
    private String isbn;

    private LocalDate publishedDate;

    @Column(length = 500)
    private String genre;

    private int quantity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BookStatus status = BookStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private BookSource source = BookSource.AUTHOR_SUBMISSION;

    @Column(name = "author_id", nullable = false)
    private Long authorId;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "author_id", insertable = false, updatable = false)
    @JsonIgnore
    private User authorUser;

    @Column(name = "author_display_name", length = 255)
    private String authorDisplayName;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 500)
    private String rejectionReason;

    @Column(nullable = false)
    private LocalDateTime submittedDate;

    private String filePath;

    private String fileName;

    private String fileType;

    private Long fileSize;

    @Lob
    @Basic(fetch = FetchType.LAZY)
    @Type(type = "org.hibernate.type.BinaryType")
    @JsonIgnore
    @Column(columnDefinition = "bytea")
    private byte[] fileData;

    private String coverImageName;

    private String coverImageType;

    private Long coverImageSize;

    @Lob
    @Basic(fetch = FetchType.LAZY)
    @Type(type = "org.hibernate.type.BinaryType")
    @JsonIgnore
    @Column(columnDefinition = "bytea")
    private byte[] coverImageData;

    @JsonProperty("author")
    public String getAuthor() {
           if (authorDisplayName != null && !authorDisplayName.isBlank()) {
               return authorDisplayName;
           }
           return authorUser != null ? authorUser.getFullName() : null;
    }

    @Transient
    public boolean isFileStored() {
        return fileData != null && fileData.length > 0;
    }

    @Transient
    public boolean isCoverImageStored() {
        return coverImageData != null && coverImageData.length > 0;
    }

    public enum BookStatus {
        PENDING,
        APPROVED,
        REJECTED
    }

    public enum BookSource {
        AUTHOR_SUBMISSION,
        LIBRARIAN_MANUAL,
        REQUEST_DOWNLOAD
    }
}
