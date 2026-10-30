package com.comp3111.library.repository;

import com.comp3111.library.model.StudentNotification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface StudentNotificationRepository extends JpaRepository<StudentNotification, Long> {
    List<StudentNotification> findByUserIdOrderByCreatedAtDesc(Long userId);

    boolean existsByUserIdAndCategoryAndReferenceBookIdAndCreatedAtAfter(
            Long userId, String category, Long referenceBookId, LocalDateTime after);
}
