package com.fundmessenger.user.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UserRoleUpdate {
    @NotBlank
    private String role;
}
