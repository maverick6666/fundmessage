package com.fundmessenger.discussion.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DiscussionCreate {
    private Integer requestId;
    private Integer positionId;

    @NotBlank
    @Size(max = 200)
    private String title;

    @NotBlank
    @Size(min = 1, max = 500)
    private String agenda;
}
