package com.fundmessenger.user.dto;

import lombok.*;
import java.time.OffsetDateTime;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserResponse {
    private Long id;
    private String email;
    private String username;
    private String fullName;
    private String role;
    private String positionTitle;
    private Long universityId;
    private String universityName;
    private boolean isActive;
    private int attendanceShields;
    private OffsetDateTime createdAt;
}
