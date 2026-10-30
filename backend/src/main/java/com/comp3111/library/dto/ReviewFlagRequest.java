package com.comp3111.library.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.Size;

/**
 * Body of POST /api/reviews/{reviewId}/flag. The flagging author comes from the
 * JWT claim (CONTRACTS §3).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReviewFlagRequest {

    @Size(max = 500, message = "Flag reason must not exceed 500 characters")
    private String reason;
}
