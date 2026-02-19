package com.fundmessenger.notification.dto;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NotificationListResponse {

    private List<NotificationResponse> notifications;
    private Long total;
    private Long unreadCount;
}
