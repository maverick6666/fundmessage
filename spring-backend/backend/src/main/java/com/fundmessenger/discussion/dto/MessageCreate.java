package com.fundmessenger.discussion.dto;

import lombok.*;

import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MessageCreate {
    private String content;

    @Builder.Default
    private String messageType = "text";

    private Map<String, Object> chartData;
}
