package com.comp3111.library.repository;

import com.comp3111.library.dto.BookListDto;
import com.comp3111.library.dto.PendingBookDto;
import com.comp3111.library.model.Book;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

@Repository
public interface BookRepository extends JpaRepository<Book, Long> {
    Optional<Book> findByIsbn(String isbn);
    List<Book> findByStatus(Book.BookStatus status);
    List<Book> findByAuthorId(Long authorId);
    Optional<Book> findByIdAndAuthorId(Long id, Long authorId);
    List<Book> findByIdInAndAuthorId(List<Long> ids, Long authorId);

    @Query("""
        select new com.comp3111.library.dto.BookListDto(
            b.id, b.title, b.isbn,
            case
                when b.authorDisplayName is not null and trim(b.authorDisplayName) <> '' then b.authorDisplayName
                else u.fullName
            end,
            b.publishedDate, b.genre, b.quantity,
            b.status, b.authorId, b.description, b.submittedDate,
            b.filePath, b.fileName, b.fileType, b.fileSize, b.rejectionReason, b.source
        )
        from Book b
        join User u on u.id = b.authorId
        where b.status = :status
        order by b.publishedDate desc, b.submittedDate desc
        """)
    Page<BookListDto> findBookListByStatus(@Param("status") Book.BookStatus status, Pageable pageable);

    @Query("""
        select new com.comp3111.library.dto.BookListDto(
            b.id, b.title, b.isbn,
            case
                when b.authorDisplayName is not null and trim(b.authorDisplayName) <> '' then b.authorDisplayName
                else u.fullName
            end,
            b.publishedDate, b.genre, b.quantity,
            b.status, b.authorId, b.description, b.submittedDate,
            b.filePath, b.fileName, b.fileType, b.fileSize, b.rejectionReason, b.source
        )
        from Book b
        join User u on u.id = b.authorId
        where b.authorId = :authorId
        order by b.submittedDate desc
        """)
    Page<BookListDto> findBookListByAuthorId(@Param("authorId") Long authorId, Pageable pageable);

    @Query("""
        select new com.comp3111.library.dto.BookListDto(
            b.id, b.title, b.isbn,
            case
                when b.authorDisplayName is not null and trim(b.authorDisplayName) <> '' then b.authorDisplayName
                else u.fullName
            end,
            b.publishedDate, b.genre, b.quantity,
            b.status, b.authorId, b.description, b.submittedDate,
            b.filePath, b.fileName, b.fileType, b.fileSize, b.rejectionReason, b.source
        )
        from Book b
        join User u on u.id = b.authorId
        order by b.submittedDate desc
        """)
    Page<BookListDto> findBookListAll(Pageable pageable);

    List<Book> findBySource(Book.BookSource source);

    @Query("""
        select new com.comp3111.library.dto.PendingBookDto(
            b.id, b.title, u.username, u.fullName, b.genre, b.submittedDate,
            b.status, b.description, b.filePath
        )
        from Book b
        join User u on u.id = b.authorId
        where b.status = :status
        order by b.submittedDate desc
        """)
    Page<PendingBookDto> findPendingBookListByStatus(@Param("status") Book.BookStatus status, Pageable pageable);

    /** Lightweight view of a book used where the full entity (and its LOB columns) is not needed. */
    interface BookSummary {
        Long getId();
        String getTitle();
        String getAuthor();
        String getGenre();
        Integer getQuantity();
    }

    @Query("""
        select b.id as id, b.title as title,
            case
                when b.authorDisplayName is not null and trim(b.authorDisplayName) <> '' then b.authorDisplayName
                else u.fullName
            end as author,
            b.genre as genre, b.quantity as quantity
        from Book b
        join User u on u.id = b.authorId
        where b.status = :status
        """)
    List<BookSummary> findBookSummariesByStatus(@Param("status") Book.BookStatus status);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Book b SET b.quantity = b.quantity - 1 WHERE b.id = :id AND b.quantity > 0")
    int decrementQuantityIfAvailable(@Param("id") Long id);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Book b SET b.quantity = b.quantity + 1 WHERE b.id = :id")
    int incrementQuantity(@Param("id") Long id);

    /**
     * Sets stock to an absolute value, touching only the quantity column. Used for the
     * librarian "set stock to N" action so an entity save can never write back a stale
     * quantity read before a concurrent borrow decremented it.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Book b SET b.quantity = :quantity WHERE b.id = :id")
    int setQuantityAbsolute(@Param("id") Long id, @Param("quantity") int quantity);

    /**
     * Bulk variant of {@link #setQuantityAbsolute}. Runs once for a whole batch so the
     * persistence context is not cleared between per-book saves.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Book b SET b.quantity = :quantity WHERE b.id IN :ids")
    int setQuantityAbsoluteForIds(@Param("ids") List<Long> ids, @Param("quantity") int quantity);

    /** Live stock straight from the row, bypassing any stale in-memory entity state. */
    @Query("SELECT b.quantity FROM Book b WHERE b.id = :id")
    Optional<Integer> findQuantityById(@Param("id") Long id);
}
