package com.fundmessenger.notification.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PushUnsubscribeRequest {

    private String endpoint;
}
