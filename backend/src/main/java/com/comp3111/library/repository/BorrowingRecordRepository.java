package com.comp3111.library.repository;

import com.comp3111.library.model.BorrowingRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface BorrowingRecordRepository extends JpaRepository<BorrowingRecord, Long> {
    List<BorrowingRecord> findByUserId(Long userId);
    List<BorrowingRecord> findByUserIdOrderByBorrowedDateDesc(Long userId);
    List<BorrowingRecord> findByBookId(Long bookId);
    List<BorrowingRecord> findByStatus(String status);
    List<BorrowingRecord> findByUserIdAndStatusOrderByBorrowedDateDesc(Long userId, String status);
    long countByUserIdAndStatus(Long userId, String status);
    long countByBookIdAndStatus(Long bookId, String status);
    int countByUser_IdAndBook_IdAndStatus(Long userId, Long bookId, String status);

    /**
     * Status-transition gate: flips a record to RETURNED only if it is still BORROWED.
     * A return of 0 means someone else already returned it — the caller must NOT
     * increment the book quantity.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE BorrowingRecord r SET r.status = 'RETURNED', r.returnDate = :now WHERE r.id = :id AND r.status = 'BORROWED'")
    int markReturnedIfBorrowed(@Param("id") Long id, @Param("now") LocalDateTime now);

    List<BorrowingRecord> findByStatusAndDueDateLessThanEqual(String status, java.time.LocalDateTime dueDate);

    List<BorrowingRecord> findByStatusAndDueDateBetween(String status, java.time.LocalDateTime from, java.time.LocalDateTime to);

    @Query("select distinct br.user.id from BorrowingRecord br where br.book.id = :bookId")
    List<Long> findDistinctUserIdsByBookId(@Param("bookId") Long bookId);

    interface BookCount {
        Long getBookId();
        Long getCount();
    }

    @Query("SELECT br.book.id AS bookId, COUNT(br) AS count FROM BorrowingRecord br WHERE br.book.id IN :bookIds GROUP BY br.book.id")
    List<BookCount> countTotalBorrowsByBookIds(@Param("bookIds") List<Long> bookIds);

    @Query("SELECT br.book.id AS bookId, COUNT(br) AS count FROM BorrowingRecord br GROUP BY br.book.id")
    List<BookCount> countTotalBorrowsGroupedByBook();

    @Query("SELECT br.book.id AS bookId, COUNT(br) AS count FROM BorrowingRecord br WHERE br.book.id IN :bookIds AND br.status = 'BORROWED' GROUP BY br.book.id")
    List<BookCount> countActiveBorrowsByBookIds(@Param("bookIds") List<Long> bookIds);

    @Query("SELECT br.book.id AS bookId, COUNT(DISTINCT br.user.id) AS count FROM BorrowingRecord br WHERE br.book.id IN :bookIds GROUP BY br.book.id")
    List<BookCount> countUniqueReadersByBookIds(@Param("bookIds") List<Long> bookIds);

    @Query("SELECT br.book.id AS bookId, COUNT(br) AS count FROM BorrowingRecord br WHERE br.book.id IN :bookIds AND br.readingProgress = 100 GROUP BY br.book.id")
    List<BookCount> countCompletedReadsByBookIds(@Param("bookIds") List<Long> bookIds);

    @Query(value = "SELECT to_char(date_trunc('month', borrowed_date), 'YYYY-MM') AS period, COUNT(*) AS count FROM borrowing_records WHERE book_id IN :bookIds GROUP BY date_trunc('month', borrowed_date) ORDER BY date_trunc('month', borrowed_date)", nativeQuery = true)
    List<Object[]> countMonthlyBorrowsByBookIds(@Param("bookIds") List<Long> bookIds);

    @Query(value = "SELECT to_char(date_trunc('week', borrowed_date), 'IYYY') || '-W' || to_char(date_trunc('week', borrowed_date), 'IW') AS period, COUNT(*) AS count FROM borrowing_records WHERE book_id IN :bookIds GROUP BY date_trunc('week', borrowed_date) ORDER BY date_trunc('week', borrowed_date)", nativeQuery = true)
    List<Object[]> countWeeklyBorrowsByBookIds(@Param("bookIds") List<Long> bookIds);
}
