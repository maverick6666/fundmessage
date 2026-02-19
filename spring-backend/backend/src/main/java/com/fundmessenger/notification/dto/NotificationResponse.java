package com.fundmessenger.notification.dto;

import lombok.*;

import java.time.OffsetDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NotificationResponse {

    private Long id;
    private String notificationType;
    private String title;
    private String message;
    private String relatedType;
    private Long relatedId;
    private Boolean isRead;
    private OffsetDateTime createdAt;
}
