package com.fundmessenger.notification.dto;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class NotificationMarkRead {

    private List<Long> notificationIds;
}
