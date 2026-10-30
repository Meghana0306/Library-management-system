package com.comp3111.library.repository;

import com.comp3111.library.model.BookReview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BookReviewRepository extends JpaRepository<BookReview, Long> {

    interface BookRatingAggregate {
        Long getBookId();
        Double getAverageRating();
        Long getReviewCount();
    }

    List<BookReview> findByBookIdOrderByCreatedAtDesc(Long bookId);

    List<BookReview> findByBookIdOrderByRatingDesc(Long bookId);

    List<BookReview> findByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<BookReview> findByUserIdAndBookId(Long userId, Long bookId);

    boolean existsByUserIdAndBookId(Long userId, Long bookId);

    @Query("SELECT AVG(r.rating) FROM BookReview r WHERE r.bookId = :bookId")
    Double findAverageRatingByBookId(@Param("bookId") Long bookId);

    @Query("SELECT COUNT(r) FROM BookReview r WHERE r.bookId = :bookId")
    Long countByBookId(@Param("bookId") Long bookId);

    @Query("""
            SELECT r.bookId AS bookId, AVG(r.rating) AS averageRating, COUNT(r) AS reviewCount
            FROM BookReview r
            WHERE r.bookId IN :bookIds
            GROUP BY r.bookId
            """)
    List<BookRatingAggregate> findRatingAggregatesByBookIds(@Param("bookIds") List<Long> bookIds);

    interface RatingCount {
        Integer getRating();
        Long getCount();
    }

    @Query("SELECT r.rating AS rating, COUNT(r) AS count FROM BookReview r WHERE r.bookId IN :bookIds GROUP BY r.rating")
    List<RatingCount> countRatingDistributionByBookIds(@Param("bookIds") List<Long> bookIds);
}
