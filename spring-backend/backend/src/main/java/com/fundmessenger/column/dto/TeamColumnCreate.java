package com.fundmessenger.column.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TeamColumnCreate {

    private String title;
    private String content;
    private List<Map<String, Object>> blocks;
}
