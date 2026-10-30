package com.comp3111.library.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.Email;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RegistrationRequest {

    @NotBlank(message = "Username is required")
    @Size(max = 255, message = "Username must not exceed 255 characters")
    private String username;

    @Email(message = "Email must be a valid address")
    @Size(max = 255, message = "Email must not exceed 255 characters")
    private String email;

    @NotBlank(message = "Password is required")
    private String password;

    @NotBlank(message = "Full Name is required")
    @Size(max = 255, message = "Full Name must not exceed 255 characters")
    private String fullName;

    @Size(max = 255, message = "Employee ID must not exceed 255 characters")
    private String employeeId;

    @Size(max = 2000, message = "Bio must not exceed 2000 characters")
    private String bio;

    private String role; // "LIBRARIAN", "STUDENT", "STAFF", "AUTHOR"
}
