package com.fundmessenger.common.exception;

import org.springframework.http.HttpStatus;

public class NotFoundException extends BusinessException {

    public NotFoundException(String message) {
        super(HttpStatus.NOT_FOUND, message);
    }

    public NotFoundException(String entity, Object id) {
        super(HttpStatus.NOT_FOUND, entity + " not found: " + id);
    }
}
