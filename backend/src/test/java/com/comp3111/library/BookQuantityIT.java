package com.comp3111.library;

import com.comp3111.library.model.Book;
import com.comp3111.library.repository.BookRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

import java.time.LocalDateTime;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Stock must survive a librarian edit that does not mention quantity. This is what the
 * {@code @DynamicUpdate} on {@link Book} buys: without it every librarian save rewrites
 * the quantity column from whatever the entity happened to be carrying.
 */
class BookQuantityIT extends LibraryIntegrationTestBase {

    private static final int INITIAL_QUANTITY = 5;
    private static final String LONG_DESCRIPTION =
            "A description comfortably past the fifty character minimum enforced by the librarian edit endpoint.";

    @Autowired
    private BookRepository bookRepository;

    private static boolean seeded;
    private static String studentToken;
    private static String librarianToken;
    private static long authorId;

    @BeforeEach
    void seedAccounts() {
        if (seeded) {
            return;
        }
        authorId = register("qty-author", "AUTHOR");
        register("qty-student", "STUDENT");
        register("qty-librarian", "LIBRARIAN");

        studentToken = login("/api/auth/login", username("qty-student"));
        librarianToken = login("/api/auth/login/librarian", username("qty-librarian"));
        seeded = true;
    }

    @Test
    void librarianEditWithoutQuantityDoesNotRestoreBorrowedStock() {
        long bookId = storeApprovedBook("Stock Fixture");
        assertThat(quantityOf(bookId)).isEqualTo(INITIAL_QUANTITY);

        ResponseEntity<String> borrowed = post("/api/borrow", Map.of("bookId", bookId), studentToken);
        assertThat(borrowed.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(quantityOf(bookId)).isEqualTo(INITIAL_QUANTITY - 1);

        ResponseEntity<String> edited = librarianEdit(bookId, "Stock Fixture Retitled", null);
        assertThat(edited.getStatusCode()).isEqualTo(HttpStatus.OK);

        assertThat(quantityOf(bookId)).isEqualTo(INITIAL_QUANTITY - 1);
        assertThat(bookRepository.findById(bookId).orElseThrow().getTitle()).isEqualTo("Stock Fixture Retitled");
    }

    @Test
    void librarianEditWithAnExplicitQuantityStillSetsIt() {
        long bookId = storeApprovedBook("Explicit Stock Fixture");

        ResponseEntity<String> borrowed = post("/api/borrow", Map.of("bookId", bookId), studentToken);
        assertThat(borrowed.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(quantityOf(bookId)).isEqualTo(INITIAL_QUANTITY - 1);

        ResponseEntity<String> edited = librarianEdit(bookId, "Explicit Stock Fixture", 12);
        assertThat(edited.getStatusCode()).isEqualTo(HttpStatus.OK);

        assertThat(quantityOf(bookId)).isEqualTo(12);
    }

    private ResponseEntity<String> librarianEdit(long bookId, String title, Integer quantity) {
        MultiValueMap<String, Object> form = new LinkedMultiValueMap<>();
        form.add("title", title);
        form.add("genres", "Fiction");
        form.add("description", LONG_DESCRIPTION);
        if (quantity != null) {
            form.add("quantity", String.valueOf(quantity));
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        headers.setBearerAuth(librarianToken);

        return rest.exchange("/api/books/manage/" + bookId, HttpMethod.PUT,
                new HttpEntity<>(form, headers), String.class);
    }

    private int quantityOf(long bookId) {
        return bookRepository.findQuantityById(bookId).orElseThrow();
    }

    private long storeApprovedBook(String title) {
        Book book = new Book();
        book.setTitle(title);
        book.setStatus(Book.BookStatus.APPROVED);
        book.setSource(Book.BookSource.LIBRARIAN_MANUAL);
        book.setAuthorId(authorId);
        book.setQuantity(INITIAL_QUANTITY);
        book.setSubmittedDate(LocalDateTime.now());
        book.setDescription(LONG_DESCRIPTION);
        book.setGenre("Fiction");
        return bookRepository.save(book).getId();
    }
}
