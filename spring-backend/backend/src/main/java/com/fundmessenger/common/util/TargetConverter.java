package com.fundmessenger.common.util;

import java.math.BigDecimal;
import java.util.*;

/**
 * Utility class for converting and filtering target plan items.
 * Replaces the Python converters.py - converts BigDecimal to double for JSON
 * and filters out items missing price or quantity.
 */
public final class TargetConverter {

    private TargetConverter() {
        // Utility class
    }

    /**
     * Converts a list of target items, filtering out invalid entries (missing price or quantity)
     * and converting BigDecimal values to double for clean JSON serialization.
     *
     * @param targets list of target maps (each may contain price, quantity, completed, etc.)
     * @return filtered and converted list, or null if empty/null input
     */
    public static List<Map<String, Object>> convertTargets(List<?> targets) {
        if (targets == null || targets.isEmpty()) {
            return null;
        }

        List<Map<String, Object>> result = new ArrayList<>();

        for (Object target : targets) {
            if (!(target instanceof Map)) {
                continue;
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> item = (Map<String, Object>) target;

            // Filter items without price or quantity
            Object price = item.get("price");
            Object quantity = item.get("quantity");

            if (!hasValue(price) || !hasValue(quantity)) {
                continue;
            }

            // Convert BigDecimal values to double for JSON serialization
            Map<String, Object> converted = new LinkedHashMap<>();
            for (Map.Entry<String, Object> entry : item.entrySet()) {
                Object value = entry.getValue();
                if (value instanceof BigDecimal) {
                    converted.put(entry.getKey(), ((BigDecimal) value).doubleValue());
                } else {
                    converted.put(entry.getKey(), value);
                }
            }

            result.add(converted);
        }

        return result.isEmpty() ? null : result;
    }

    /**
     * Checks whether a value is present and non-zero.
     */
    private static boolean hasValue(Object value) {
        if (value == null) {
            return false;
        }
        if (value instanceof Number) {
            return ((Number) value).doubleValue() != 0.0;
        }
        if (value instanceof String) {
            try {
                return Double.parseDouble((String) value) != 0.0;
            } catch (NumberFormatException e) {
                return false;
            }
        }
        return false;
    }
}
