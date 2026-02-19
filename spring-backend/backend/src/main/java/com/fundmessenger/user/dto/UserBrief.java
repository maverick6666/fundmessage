package com.fundmessenger.user.dto;

import lombok.*;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserBrief {
    private Long id;
    private String username;
    private String fullName;
}
