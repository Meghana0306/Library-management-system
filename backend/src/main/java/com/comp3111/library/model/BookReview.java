package com.comp3111.library.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "book_reviews",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "book_id"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BookReview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "book_id", nullable = false)
    private Long bookId;

    @Column(nullable = false)
    private Integer rating; // 1–5 stars

    @Column(name = "review_text", columnDefinition = "TEXT")
    private String reviewText;

    @Column(name = "author_reply", columnDefinition = "TEXT")
    private String authorReply;

    @Column(name = "author_reply_at")
    private LocalDateTime authorReplyAt;

    @Column(name = "is_anonymous", nullable = false)
    private boolean isAnonymous = false;

    @Column(nullable = false)
    private boolean flagged = false;

    @Column(name = "flag_reason", length = 500)
    private String flagReason;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
