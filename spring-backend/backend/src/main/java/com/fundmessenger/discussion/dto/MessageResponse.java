package com.fundmessenger.discussion.dto;

import com.fundmessenger.user.dto.UserBrief;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MessageResponse {
    private Long id;
    private Long discussionId;
    private UserBrief user;
    private String content;
    private String messageType;
    private Map<String, Object> chartData;
    private Integer sessionNumber;
    private OffsetDateTime createdAt;
}
