package com.fundmessenger.university.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UniversityRequest {

    @NotBlank(message = "대학교명을 입력해주세요")
    @Size(max = 200, message = "대학교명은 200자 이하여야 합니다")
    private String name;

    @NotBlank(message = "학교코드를 입력해주세요")
    @Size(max = 50, message = "학교코드는 50자 이하여야 합니다")
    private String code;

    private String logoUrl;
}
