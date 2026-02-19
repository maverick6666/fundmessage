package com.fundmessenger.common.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public class BusinessException extends RuntimeException {

    private final HttpStatus status;

    public BusinessException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public BusinessException(String message) {
        this(HttpStatus.BAD_REQUEST, message);
    }
}
