package com.fundmessenger.decision.dto;

import lombok.*;

import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class DecisionNoteCreate {

    private String title;
    private String content;
    private List<Map<String, Object>> blocks;
    private String noteType = "decision"; // decision | report
}
