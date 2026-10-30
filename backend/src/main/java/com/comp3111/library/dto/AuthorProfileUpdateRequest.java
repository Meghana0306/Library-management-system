package com.comp3111.library.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AuthorProfileUpdateRequest {

    @NotBlank(message = "Full Name is required")
    @Size(max = 255, message = "Full Name must not exceed 255 characters")
    private String fullName;

    @NotBlank(message = "Current password is required for profile updates")
    private String currentPassword;

    private String password;

    @Size(max = 2000, message = "Bio must not exceed 2000 characters")
    private String bio;
}
