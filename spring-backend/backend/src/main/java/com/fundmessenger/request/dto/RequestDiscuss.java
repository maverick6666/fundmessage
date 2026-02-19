package com.fundmessenger.request.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RequestDiscuss {

    @NotBlank
    @Size(max = 200)
    private String title;

    @NotBlank
    @Size(max = 500)
    private String agenda;
}
