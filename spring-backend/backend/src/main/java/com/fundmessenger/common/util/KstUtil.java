package com.fundmessenger.common.util;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;

public final class KstUtil {

    public static final ZoneId KST = ZoneId.of("Asia/Seoul");
    public static final ZoneOffset KST_OFFSET = ZoneOffset.ofHours(9);

    private KstUtil() {}

    public static LocalDate todayKst() {
        return LocalDate.now(KST);
    }

    public static OffsetDateTime nowKst() {
        return OffsetDateTime.now(KST);
    }

    public static OffsetDateTime offsetNowKst() {
        return OffsetDateTime.now(KST);
    }

    public static ZonedDateTime zonedNowKst() {
        return ZonedDateTime.now(KST);
    }
}
