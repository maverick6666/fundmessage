package com.fundmessenger.discussion.dto;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DiscussionMessagesResponse {
    private List<MessageResponse> messages;
    private Long total;
    private Integer page;
    private Integer limit;
}
