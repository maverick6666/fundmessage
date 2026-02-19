package com.fundmessenger.discussion.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DiscussionReopen {

    @NotBlank
    @Size(min = 1, max = 500)
    private String agenda;
}
