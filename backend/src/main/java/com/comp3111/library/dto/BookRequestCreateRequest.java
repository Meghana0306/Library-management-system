package com.comp3111.library.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

/**
 * Body of POST /api/book-requests. The acting user comes from the JWT claim
 * (CONTRACTS §3), so any client-supplied userId is ignored.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BookRequestCreateRequest {

    @NotBlank(message = "title is required")
    @Size(max = 255, message = "title must not exceed 255 characters")
    private String title;

    @NotBlank(message = "author is required")
    @Size(max = 255, message = "author must not exceed 255 characters")
    private String author;

    @Size(max = 255, message = "genre must not exceed 255 characters")
    private String genre;

    @Size(max = 255, message = "keywords must not exceed 255 characters")
    private String keywords;

    @NotBlank(message = "reason is required")
    @Size(max = 2000, message = "reason must not exceed 2000 characters")
    private String reason;
}
