package com.fundmessenger.university.dto;

import com.fundmessenger.university.entity.University;
import lombok.Builder;
import lombok.Getter;

import java.time.OffsetDateTime;

@Getter
@Builder
public class UniversityResponse {

    private Long id;
    private String name;
    private String code;
    private String logoUrl;
    private Boolean isActive;
    private OffsetDateTime createdAt;

    public static UniversityResponse from(University university) {
        return UniversityResponse.builder()
                .id(university.getId())
                .name(university.getName())
                .code(university.getCode())
                .logoUrl(university.getLogoUrl())
                .isActive(university.getIsActive())
                .createdAt(university.getCreatedAt())
                .build();
    }
}
