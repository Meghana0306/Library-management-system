package com.comp3111.library.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "book_change_logs")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BookChangeLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "book_id")
    private Long bookId;

    /** Snapshotted at write time — book_id becomes NULL when the book is deleted. */
    @Column(name = "book_title", length = 255)
    private String bookTitle;

    @Column(name = "changed_by")
    private Long changedBy;

    @Column(nullable = false, length = 20)
    private String action; // CREATE, UPDATE, DELETE, APPROVE, REJECT

    @Column(columnDefinition = "TEXT")
    private String details; // JSON payload with before/after snapshots

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
