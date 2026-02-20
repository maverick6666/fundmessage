package com.fundmessenger.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SignupRequest {

    @NotBlank(message = "이메일을 입력해주세요")
    @Email(message = "올바른 이메일 형식이 아닙니다")
    private String email;

    @NotBlank(message = "비밀번호를 입력해주세요")
    @Size(min = 8, message = "비밀번호는 8자 이상이어야 합니다")
    private String password;

    @NotBlank(message = "이름을 입력해주세요")
    @Size(min = 2, max = 100, message = "이름은 2~100자 사이여야 합니다")
    private String fullName;

    @NotNull(message = "소속 대학교를 선택해주세요")
    private Long universityId;

    @NotBlank(message = "직책을 선택해주세요")
    private String positionTitle;
}
