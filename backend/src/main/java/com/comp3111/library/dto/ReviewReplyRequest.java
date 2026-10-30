package com.comp3111.library.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

/**
 * Body of POST /api/reviews/{reviewId}/reply. The replying author comes from the
 * JWT claim (CONTRACTS §3).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReviewReplyRequest {

    @NotBlank(message = "reply text is required")
    @Size(max = 1000, message = "Reply must not exceed 1000 characters")
    private String reply;
}
