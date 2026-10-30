package com.comp3111.library.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;

/**
 * Body of POST /api/reviews. The reviewer comes from the JWT claim (CONTRACTS §3).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReviewSubmitRequest {

    @NotNull(message = "bookId is required")
    private Long bookId;

    @NotNull(message = "rating is required")
    @Min(value = 1, message = "rating must be between 1 and 5")
    @Max(value = 5, message = "rating must be between 1 and 5")
    private Integer rating;

    @Size(max = 5000, message = "reviewText must not exceed 5000 characters")
    private String reviewText;

    @JsonProperty("isAnonymous")
    private boolean anonymous;
}
