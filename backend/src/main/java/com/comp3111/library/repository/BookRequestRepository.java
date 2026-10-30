package com.comp3111.library.repository;

import com.comp3111.library.model.BookRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BookRequestRepository extends JpaRepository<BookRequest, Long> {

    List<BookRequest> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<BookRequest> findByStatusOrderByCreatedAtDesc(String status);

    List<BookRequest> findAllByOrderByCreatedAtDesc();

    // Find approved/pending requests that might match a newly added book title (for notifications)
    List<BookRequest> findByStatusInAndTitleIgnoreCase(List<String> statuses, String title);

    // Similar title matching for alternative notifications
    List<BookRequest> findByStatusInAndTitleContainingIgnoreCase(List<String> statuses, String title);

    // Duplicate detection: check if a user already requested the same book title+author
    boolean existsByUserIdAndTitleIgnoreCaseAndAuthorIgnoreCaseAndStatusIn(Long userId, String title, String author, List<String> statuses);

    // Global duplicate detection: check if any user already requested the same title+author
    boolean existsByTitleIgnoreCaseAndAuthorIgnoreCaseAndStatusIn(String title, String author, List<String> statuses);
}
