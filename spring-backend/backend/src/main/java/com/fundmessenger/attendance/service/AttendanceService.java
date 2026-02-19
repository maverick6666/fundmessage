package com.fundmessenger.attendance.service;

import com.fundmessenger.attendance.entity.Attendance;
import com.fundmessenger.attendance.repository.AttendanceRepository;
import com.fundmessenger.column.entity.TeamColumn;
import com.fundmessenger.column.repository.TeamColumnRepository;
import com.fundmessenger.common.exception.BusinessException;
import com.fundmessenger.common.exception.ForbiddenException;
import com.fundmessenger.common.exception.NotFoundException;
import com.fundmessenger.common.util.KstUtil;
import com.fundmessenger.user.entity.User;
import com.fundmessenger.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AttendanceService {

    private final AttendanceRepository attendanceRepository;
    private final TeamColumnRepository teamColumnRepository;
    private final UserRepository userRepository;

    // ──────────────────────────────────────────────
    // Check-in
    // ──────────────────────────────────────────────

    /**
     * Check in for today (KST).
     * If already checked in, return existing record.
     * Auto-use shield: if yesterday was 'absent' and user has shields > 0,
     * recover yesterday and decrement shield.
     */
    @Transactional
    public Map<String, Object> checkIn(Long userId) {
        LocalDate today = KstUtil.todayKst();

        // Already checked in?
        Attendance existing = attendanceRepository.findByUserIdAndDate(userId, today).orElse(null);
        if (existing != null) {
            Map<String, Object> data = attendanceToMap(existing);
            data.put("shield_used", false);
            data.put("shield_recovered_date", null);
            data.put("remaining_shields", getUserShields(userId));
            return data;
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User", userId));

        // Auto shield: recover yesterday if absent and shields available
        LocalDate yesterday = today.minusDays(1);
        boolean shieldUsed = false;
        String shieldRecoveredDate = null;

        Attendance yesterdayAttendance = attendanceRepository
                .findByUserIdAndDate(userId, yesterday).orElse(null);

        if (yesterdayAttendance != null && "absent".equals(yesterdayAttendance.getStatus())) {
            int shields = user.getAttendanceShields() != null ? user.getAttendanceShields() : 0;
            if (shields > 0) {
                yesterdayAttendance.setStatus("recovered");
                user.setAttendanceShields(shields - 1);
                shieldUsed = true;
                shieldRecoveredDate = yesterday.toString();
            }
        }

        // Create attendance record
        Attendance attendance = new Attendance();
        attendance.setUser(user);
        attendance.setDate(today);
        attendance.setStatus("present");
        attendance.setCreatedAt(KstUtil.nowKst());

        Attendance saved = attendanceRepository.save(attendance);
        log.info("Check-in: userId={}, date={}, shieldUsed={}", userId, today, shieldUsed);

        Map<String, Object> data = attendanceToMap(saved);
        data.put("shield_used", shieldUsed);
        data.put("shield_recovered_date", shieldRecoveredDate);
        data.put("remaining_shields", user.getAttendanceShields() != null ? user.getAttendanceShields() : 0);
        return data;
    }

    // ──────────────────────────────────────────────
    // My attendance (calendar data)
    // ──────────────────────────────────────────────

    /**
     * Get monthly attendance records for a user (calendar view).
     */
    public Map<String, Object> getMyAttendance(Long userId, Integer year, Integer month) {
        return getUserAttendance(userId, year, month);
    }

    // ──────────────────────────────────────────────
    // My attendance stats
    // ──────────────────────────────────────────────

    /**
     * Get attendance statistics: total_rate, week_rate, month_rate, streak, shield count.
     */
    public Map<String, Object> getMyAttendanceStats(Long userId) {
        LocalDate today = KstUtil.todayKst();

        // All records for this user
        List<Attendance> allRecords = attendanceRepository.findByUserIdOrderByDateDesc(userId);

        long totalRecords = allRecords.size();
        long totalPresent = allRecords.stream()
                .filter(a -> "present".equals(a.getStatus()) || "recovered".equals(a.getStatus()))
                .count();

        // This week (Monday start)
        LocalDate weekStart = today.minusDays(today.getDayOfWeek().getValue() - 1);
        long weekRecords = allRecords.stream()
                .filter(a -> !a.getDate().isBefore(weekStart) && !a.getDate().isAfter(today))
                .count();
        long weekPresent = allRecords.stream()
                .filter(a -> !a.getDate().isBefore(weekStart) && !a.getDate().isAfter(today))
                .filter(a -> "present".equals(a.getStatus()) || "recovered".equals(a.getStatus()))
                .count();

        // This month
        LocalDate monthStart = today.with(TemporalAdjusters.firstDayOfMonth());
        long monthRecords = allRecords.stream()
                .filter(a -> !a.getDate().isBefore(monthStart) && !a.getDate().isAfter(today))
                .count();
        long monthPresent = allRecords.stream()
                .filter(a -> !a.getDate().isBefore(monthStart) && !a.getDate().isAfter(today))
                .filter(a -> "present".equals(a.getStatus()) || "recovered".equals(a.getStatus()))
                .count();

        // Streak: consecutive present/recovered days ending today
        int streak = 0;
        LocalDate currentDate = today;
        while (true) {
            LocalDate checkDate = currentDate;
            boolean found = allRecords.stream()
                    .anyMatch(a -> a.getDate().equals(checkDate)
                            && ("present".equals(a.getStatus()) || "recovered".equals(a.getStatus())));
            if (found) {
                streak++;
                currentDate = currentDate.minusDays(1);
            } else {
                break;
            }
        }

        int shields = getUserShields(userId);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("total_rate", totalRecords > 0 ? (double) totalPresent / totalRecords * 100 : 0.0);
        data.put("week_rate", weekRecords > 0 ? (double) weekPresent / weekRecords * 100 : 0.0);
        data.put("month_rate", monthRecords > 0 ? (double) monthPresent / monthRecords * 100 : 0.0);
        data.put("streak", streak);
        data.put("total_present", totalPresent);
        data.put("total_records", totalRecords);
        data.put("week_present", weekPresent);
        data.put("week_records", weekRecords);
        data.put("month_present", monthPresent);
        data.put("month_records", monthRecords);
        data.put("attendance_shields", shields);
        return data;
    }

    // ──────────────────────────────────────────────
    // Recovery request
    // ──────────────────────────────────────────────

    /**
     * Request attendance recovery using a column written by the user.
     */
    @Transactional
    public Map<String, Object> requestRecovery(Long userId, Long columnId, String dateStr) {
        // Validate column belongs to user
        TeamColumn column = teamColumnRepository.findById(columnId)
                .orElseThrow(() -> new NotFoundException("Column", columnId));

        if (!column.getAuthorId().equals(userId)) {
            throw new ForbiddenException("본인이 작성한 칼럼만 사용할 수 있습니다");
        }

        // Parse date
        LocalDate targetDate;
        try {
            targetDate = LocalDate.parse(dateStr);
        } catch (Exception e) {
            throw new BusinessException("잘못된 날짜 형식입니다 (YYYY-MM-DD)");
        }

        // Find attendance record
        Attendance attendance = attendanceRepository.findByUserIdAndDate(userId, targetDate)
                .orElseThrow(() -> new NotFoundException("해당 날짜의 출석 기록이 없습니다"));

        if ("present".equals(attendance.getStatus())) {
            throw new BusinessException("이미 출석 처리된 날짜입니다");
        }
        if ("recovered".equals(attendance.getStatus())) {
            throw new BusinessException("이미 복구된 날짜입니다");
        }

        // Set to pending recovery
        attendance.setRecoveryColumn(column);
        attendance.setStatus("pending_recovery");

        log.info("Recovery requested: userId={}, date={}, columnId={}", userId, targetDate, columnId);
        return attendanceToMap(attendance);
    }

    // ──────────────────────────────────────────────
    // Pending recoveries (manager)
    // ──────────────────────────────────────────────

    /**
     * Get all pending recovery attendance records with user and column info.
     */
    public Map<String, Object> getPendingRecoveries() {
        List<Attendance> pendingList = attendanceRepository.findAll().stream()
                .filter(a -> "pending_recovery".equals(a.getStatus()))
                .toList();

        List<Map<String, Object>> result = pendingList.stream().map(att -> {
            Map<String, Object> item = attendanceToMap(att);

            // Add user info
            User user = att.getUser();
            if (user != null) {
                Map<String, Object> userMap = new LinkedHashMap<>();
                userMap.put("id", user.getId());
                userMap.put("username", user.getUsername());
                userMap.put("full_name", user.getFullName());
                item.put("user", userMap);
            }

            // Add column info
            TeamColumn column = att.getRecoveryColumn();
            if (column != null) {
                Map<String, Object> columnMap = new LinkedHashMap<>();
                columnMap.put("id", column.getId());
                columnMap.put("title", column.getTitle());
                item.put("column", columnMap);
            }

            return item;
        }).collect(Collectors.toList());

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("pending", result);
        data.put("total", result.size());
        return data;
    }

    // ──────────────────────────────────────────────
    // Approve recovery (manager)
    // ──────────────────────────────────────────────

    /**
     * Approve a pending recovery request.
     */
    @Transactional
    public Map<String, Object> approveRecovery(Long attendanceId, Long managerId) {
        Attendance attendance = attendanceRepository.findById(attendanceId)
                .orElseThrow(() -> new NotFoundException("Attendance", attendanceId));

        if (!"pending_recovery".equals(attendance.getStatus())) {
            throw new BusinessException("복구 대기 상태가 아닙니다");
        }

        User manager = userRepository.findById(managerId)
                .orElseThrow(() -> new NotFoundException("User", managerId));

        attendance.setStatus("recovered");
        attendance.setApprover(manager);

        log.info("Recovery approved: attendanceId={}, managerId={}", attendanceId, managerId);
        return attendanceToMap(attendance);
    }

    // ──────────────────────────────────────────────
    // Reject recovery (manager)
    // ──────────────────────────────────────────────

    /**
     * Reject a pending recovery request.
     */
    @Transactional
    public Map<String, Object> rejectRecovery(Long attendanceId, Long managerId) {
        Attendance attendance = attendanceRepository.findById(attendanceId)
                .orElseThrow(() -> new NotFoundException("Attendance", attendanceId));

        if (!"pending_recovery".equals(attendance.getStatus())) {
            throw new BusinessException("복구 대기 상태가 아닙니다");
        }

        attendance.setStatus("absent");
        attendance.setRecoveryColumn(null);

        log.info("Recovery rejected: attendanceId={}, managerId={}", attendanceId, managerId);
        return attendanceToMap(attendance);
    }

    // ──────────────────────────────────────────────
    // User attendance (any user can view)
    // ──────────────────────────────────────────────

    /**
     * Get monthly attendance for a specific user.
     */
    public Map<String, Object> getUserAttendance(Long userId, Integer year, Integer month) {
        LocalDate today = KstUtil.todayKst();
        int targetYear = year != null ? year : today.getYear();
        int targetMonth = month != null ? month : today.getMonthValue();

        LocalDate startDate = LocalDate.of(targetYear, targetMonth, 1);
        LocalDate endDate = startDate.with(TemporalAdjusters.lastDayOfMonth());

        List<Attendance> attendances = attendanceRepository.findByUserIdOrderByDateDesc(userId).stream()
                .filter(a -> !a.getDate().isBefore(startDate) && !a.getDate().isAfter(endDate))
                .toList();

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("user_id", userId);
        data.put("year", targetYear);
        data.put("month", targetMonth);
        data.put("attendances", attendances.stream().map(this::attendanceToMap).collect(Collectors.toList()));
        return data;
    }

    // ──────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────

    private Map<String, Object> attendanceToMap(Attendance att) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", att.getId());
        map.put("user_id", att.getUserId());
        map.put("date", att.getDate() != null ? att.getDate().toString() : null);
        map.put("status", att.getStatus());
        map.put("recovered_by_column_id", att.getRecoveredByColumnId());
        map.put("approved_by", att.getApprovedById());
        map.put("created_at", att.getCreatedAt() != null ? att.getCreatedAt().toString() : null);
        return map;
    }

    private int getUserShields(Long userId) {
        return userRepository.findById(userId)
                .map(u -> u.getAttendanceShields() != null ? u.getAttendanceShields() : 0)
                .orElse(0);
    }
}
