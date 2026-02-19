package com.fundmessenger.discussion.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DiscussionUpdate {
    private String title;
    private String currentAgenda;
}
