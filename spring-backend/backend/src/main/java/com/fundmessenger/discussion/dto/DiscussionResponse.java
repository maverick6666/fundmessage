package com.fundmessenger.discussion.dto;

import com.fundmessenger.user.dto.UserBrief;
import lombok.*;

import java.time.OffsetDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DiscussionResponse {
    private Long id;
    private Long requestId;
    private Long positionId;
    private String title;
    private String status;
    private String summary;
    private Integer sessionCount;
    private String currentAgenda;
    private UserBrief openedBy;
    private UserBrief closedBy;
    private OffsetDateTime openedAt;
    private OffsetDateTime closedAt;
    private Long messageCount;
}
