package com.fundmessenger.position.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TogglePlanItem {

    @NotBlank(message = "planType은 필수입니다")
    private String planType;

    private int index;

    private boolean completed;
}
