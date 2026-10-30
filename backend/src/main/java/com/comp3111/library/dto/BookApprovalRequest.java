package com.comp3111.library.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.Min;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BookApprovalRequest {

    @NotNull(message = "bookId is required")
    private Long bookId;

    /** Boxed on purpose: an omitted field must fail validation, not silently reject the book. */
    @NotNull(message = "approved is required")
    private Boolean approved;

    @Size(max = 500, message = "Rejection reason must be 500 characters or fewer")
    private String rejectionReason;

    /** Optional stock to publish with; defaults to 1 when omitted. */
    @Min(value = 0, message = "quantity must be zero or greater")
    private Integer quantity;
}
