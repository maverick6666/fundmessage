package com.fundmessenger.attendance.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class RecoverRequest {

    private Long columnId;
    private String date; // YYYY-MM-DD
}
