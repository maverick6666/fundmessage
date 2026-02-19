package com.fundmessenger.position.dto;

import lombok.*;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PositionStatusInfo {
    private String status;
    private String alert;
    private String message;
}
