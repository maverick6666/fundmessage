package com.fundmessenger.notification.dto;

import lombok.*;

import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PushSubscribeRequest {

    private String endpoint;
    private Map<String, String> keys;
}
