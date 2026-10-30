package com.comp3111.library.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotEmpty;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AuthorBulkDeleteRequest {

    @NotEmpty(message = "bookIds is required")
    private List<Long> bookIds;
}
