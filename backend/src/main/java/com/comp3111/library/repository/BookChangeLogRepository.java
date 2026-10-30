package com.comp3111.library.repository;

import com.comp3111.library.model.BookChangeLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BookChangeLogRepository extends JpaRepository<BookChangeLog, Long> {
    List<BookChangeLog> findByBookIdOrderByCreatedAtDesc(Long bookId);
}
