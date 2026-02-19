package com.fundmessenger.audit.service;

import com.fundmessenger.audit.entity.AuditLog;
import com.fundmessenger.audit.repository.AuditLogRepository;
import com.fundmessenger.user.entity.User;
import com.fundmessenger.user.repository.UserRepository;
import com.fundmessenger.common.exception.NotFoundException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    /**
     * Serializes a value to a string for audit log storage.
     */
    private String serializeValue(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof BigDecimal) {
            return value.toString();
        }
        if (value instanceof List || value instanceof Map) {
            try {
                return objectMapper.writeValueAsString(value);
            } catch (Exception e) {
                log.warn("Failed to serialize audit value: {}", e.getMessage());
                return value.toString();
            }
        }
        return String.valueOf(value);
    }

    /**
     * Logs a single field change or a generic action.
     */
    @Transactional
    public AuditLog logChange(
            String entityType,
            Integer entityId,
            String action,
            Long userId,
            String fieldName,
            Object oldValue,
            Object newValue,
            Map<String, Object> changes
    ) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User", userId));

        AuditLog auditLog = new AuditLog();
        auditLog.setEntityType(entityType);
        auditLog.setEntityId(entityId);
        auditLog.setAction(action);
        auditLog.setFieldName(fieldName);
        auditLog.setOldValue(serializeValue(oldValue));
        auditLog.setNewValue(serializeValue(newValue));
        auditLog.setChanges(changes);
        auditLog.setUser(user);

        return auditLogRepository.save(auditLog);
    }

    /**
     * Convenience overload for logging an action without field-level detail.
     */
    @Transactional
    public AuditLog logChange(String entityType, Integer entityId, String action, Long userId) {
        return logChange(entityType, entityId, action, userId, null, null, null, null);
    }

    /**
     * Logs multiple field changes in a single audit record.
     * The changes map should have the format: {field: {old: ..., new: ...}, ...}
     */
    @Transactional
    public AuditLog logMultipleChanges(
            String entityType,
            Integer entityId,
            Long userId,
            Map<String, Map<String, Object>> changes
    ) {
        // Serialize the values inside each change entry
        Map<String, Object> serialized = new LinkedHashMap<>();
        for (Map.Entry<String, Map<String, Object>> entry : changes.entrySet()) {
            Map<String, Object> fieldChange = new LinkedHashMap<>();
            fieldChange.put("old", serializeValue(entry.getValue().get("old")));
            fieldChange.put("new", serializeValue(entry.getValue().get("new")));
            serialized.put(entry.getKey(), fieldChange);
        }

        return logChange(entityType, entityId, "update", userId, null, null, null, serialized);
    }

    /**
     * Retrieves audit logs for a specific entity, ordered by most recent first.
     */
    @Transactional(readOnly = true)
    public List<AuditLog> getLogsForEntity(String entityType, Integer entityId, int limit) {
        return auditLogRepository.findByEntityTypeAndEntityIdOrderByCreatedAtDesc(entityType, entityId)
                .stream()
                .limit(limit)
                .toList();
    }

    /**
     * Overload with default limit of 50.
     */
    @Transactional(readOnly = true)
    public List<AuditLog> getLogsForEntity(String entityType, Integer entityId) {
        return getLogsForEntity(entityType, entityId, 50);
    }
}
