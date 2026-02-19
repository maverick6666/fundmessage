package com.fundmessenger.column.service;

import com.fundmessenger.attendance.entity.Attendance;
import com.fundmessenger.attendance.repository.AttendanceRepository;
import com.fundmessenger.column.dto.TeamColumnCreate;
import com.fundmessenger.column.dto.TeamColumnUpdate;
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

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ColumnService {

    private final TeamColumnRepository teamColumnRepository;
    private final AttendanceRepository attendanceRepository;
    private final UserRepository userRepository;

    // ──────────────────────────────────────────────
    // List columns
    // ──────────────────────────────────────────────

    /**
     * Get columns with optional filtering by author and verification status.
     */
    public Map<String, Object> getColumns(int skip, int limit, Long authorId, Boolean verified) {
        List<TeamColumn> allColumns;

        if (authorId != null) {
            allColumns = teamColumnRepository.findByAuthorIdOrderByCreatedAtDesc(authorId);
        } else {
            allColumns = teamColumnRepository.findAllByOrderByCreatedAtDesc();
        }

        // Filter by verified status
        if (verified != null) {
            allColumns = allColumns.stream()
                    .filter(c -> verified.equals(c.getIsVerified()))
                    .collect(Collectors.toList());
        }

        int total = allColumns.size();

        // Apply pagination
        List<TeamColumn> paged = allColumns.stream()
                .skip(skip)
                .limit(limit)
                .toList();

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("columns", paged.stream().map(this::columnToListItem).collect(Collectors.toList()));
        data.put("total", total);
        data.put("skip", skip);
        data.put("limit", limit);
        return data;
    }

    // ──────────────────────────────────────────────
    // Get column detail
    // ──────────────────────────────────────────────

    /**
     * Get column detail with author and verifier info.
     */
    public Map<String, Object> getColumn(Long columnId) {
        TeamColumn col = teamColumnRepository.findById(columnId)
                .orElseThrow(() -> new NotFoundException("Column", columnId));
        return columnToDict(col);
    }

    // ──────────────────────────────────────────────
    // Create column
    // ──────────────────────────────────────────────

    /**
     * Create a new team column.
     */
    @Transactional
    public Map<String, Object> createColumn(TeamColumnCreate data, Long authorId) {
        User author = userRepository.findById(authorId)
                .orElseThrow(() -> new NotFoundException("User", authorId));

        TeamColumn col = new TeamColumn();
        col.setTitle(data.getTitle());
        col.setContent(data.getContent());
        col.setBlocks(data.getBlocks());
        col.setAuthor(author);
        col.setCreatedAt(KstUtil.nowKst());
        col.setUpdatedAt(KstUtil.nowKst());

        TeamColumn saved = teamColumnRepository.save(col);
        log.info("Column created: id={}, title={}, authorId={}", saved.getId(), data.getTitle(), authorId);
        return columnToDict(saved);
    }

    // ──────────────────────────────────────────────
    // Update column (author only)
    // ──────────────────────────────────────────────

    /**
     * Update a column. Only the author can update.
     */
    @Transactional
    public Map<String, Object> updateColumn(Long columnId, TeamColumnUpdate data, Long userId) {
        TeamColumn col = teamColumnRepository.findById(columnId)
                .orElseThrow(() -> new NotFoundException("Column", columnId));

        if (!col.getAuthorId().equals(userId)) {
            throw new ForbiddenException("작성자만 수정할 수 있습니다");
        }

        if (data.getTitle() != null) {
            col.setTitle(data.getTitle());
        }
        if (data.getContent() != null) {
            col.setContent(data.getContent());
        }
        if (data.getBlocks() != null) {
            col.setBlocks(data.getBlocks());
        }
        col.setUpdatedAt(KstUtil.nowKst());

        log.info("Column updated: id={}, userId={}", columnId, userId);
        return columnToDict(col);
    }

    // ──────────────────────────────────────────────
    // Delete column (author or manager)
    // ──────────────────────────────────────────────

    /**
     * Delete a column. Author or manager can delete.
     */
    @Transactional
    public void deleteColumn(Long columnId, Long userId, String userRole) {
        TeamColumn col = teamColumnRepository.findById(columnId)
                .orElseThrow(() -> new NotFoundException("Column", columnId));

        boolean isAuthor = col.getAuthorId().equals(userId);
        boolean isManager = "manager".equals(userRole);

        if (!isAuthor && !isManager) {
            throw new ForbiddenException("작성자 또는 팀장만 삭제할 수 있습니다");
        }

        teamColumnRepository.delete(col);
        log.info("Column deleted: id={}, by userId={}", columnId, userId);
    }

    // ──────────────────────────────────────────────
    // Verify column (manager only)
    // ──────────────────────────────────────────────

    /**
     * Verify a column (blue checkmark). Manager only, not own column.
     * Benefit: if author has absent attendance, recover latest absent.
     * If no absent (100% attendance), grant shield +1.
     */
    @Transactional
    public Map<String, Object> verifyColumn(Long columnId, Long verifierId) {
        TeamColumn col = teamColumnRepository.findById(columnId)
                .orElseThrow(() -> new NotFoundException("Column", columnId));

        if (Boolean.TRUE.equals(col.getIsVerified())) {
            throw new BusinessException("이미 검증된 칼럼입니다");
        }

        if (col.getAuthorId().equals(verifierId)) {
            throw new ForbiddenException("본인이 작성한 칼럼은 검증할 수 없습니다");
        }

        User verifier = userRepository.findById(verifierId)
                .orElseThrow(() -> new NotFoundException("User", verifierId));

        // Mark as verified
        col.setIsVerified(true);
        col.setVerifier(verifier);
        col.setVerifiedAt(KstUtil.nowKst());

        // Attendance benefit: recover latest absent or grant shield
        List<Attendance> authorAttendances = attendanceRepository.findByUserIdOrderByDateDesc(col.getAuthorId());
        Attendance latestAbsent = authorAttendances.stream()
                .filter(a -> "absent".equals(a.getStatus()))
                .findFirst()
                .orElse(null);

        String recoveredDate = null;
        boolean shieldGranted = false;

        if (latestAbsent != null) {
            // Recover the latest absent
            latestAbsent.setStatus("recovered");
            latestAbsent.setRecoveryColumn(col);
            latestAbsent.setApprover(verifier);
            recoveredDate = latestAbsent.getDate().toString();
        } else {
            // No absent - grant shield +1
            User author = userRepository.findById(col.getAuthorId())
                    .orElse(null);
            if (author != null) {
                int currentShields = author.getAttendanceShields() != null ? author.getAttendanceShields() : 0;
                author.setAttendanceShields(currentShields + 1);
                col.setShieldGranted(true);
                shieldGranted = true;
            }
        }

        log.info("Column verified: id={}, verifierId={}, recoveredDate={}, shieldGranted={}",
                columnId, verifierId, recoveredDate, shieldGranted);

        Map<String, Object> data = columnToDict(col);
        data.put("recovered_date", recoveredDate);
        data.put("shield_granted", shieldGranted);
        return data;
    }

    // ──────────────────────────────────────────────
    // Unverify column (manager only)
    // ──────────────────────────────────────────────

    /**
     * Undo column verification. Reverts attendance recovery or deducts shield.
     */
    @Transactional
    public Map<String, Object> unverifyColumn(Long columnId) {
        TeamColumn col = teamColumnRepository.findById(columnId)
                .orElseThrow(() -> new NotFoundException("Column", columnId));

        if (!Boolean.TRUE.equals(col.getIsVerified())) {
            throw new BusinessException("검증되지 않은 칼럼입니다");
        }

        // Undo attendance recovery or deduct shield
        List<Attendance> recoveredByColumn = attendanceRepository.findAll().stream()
                .filter(a -> col.getId().equals(a.getRecoveredByColumnId()))
                .toList();

        boolean shieldDeducted = false;

        if (!recoveredByColumn.isEmpty()) {
            // Undo attendance recovery
            Attendance recovered = recoveredByColumn.get(0);
            recovered.setStatus("absent");
            recovered.setRecoveryColumn(null);
            recovered.setApprover(null);
        } else if (Boolean.TRUE.equals(col.getShieldGranted())) {
            // Deduct shield
            User author = userRepository.findById(col.getAuthorId()).orElse(null);
            if (author != null) {
                int currentShields = author.getAttendanceShields() != null ? author.getAttendanceShields() : 0;
                if (currentShields > 0) {
                    author.setAttendanceShields(currentShields - 1);
                    shieldDeducted = true;
                }
            }
        }

        // Clear verification
        col.setIsVerified(false);
        col.setVerifier(null);
        col.setVerifiedAt(null);
        col.setShieldGranted(false);

        log.info("Column unverified: id={}, shieldDeducted={}", columnId, shieldDeducted);

        Map<String, Object> data = columnToDict(col);
        data.put("shield_deducted", shieldDeducted);
        return data;
    }

    // ──────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────

    private Map<String, Object> columnToDict(TeamColumn col) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", col.getId());
        map.put("title", col.getTitle());
        map.put("content", col.getContent());
        map.put("blocks", col.getBlocks());
        map.put("author_id", col.getAuthorId());

        User author = col.getAuthor();
        if (author != null) {
            Map<String, Object> authorMap = new LinkedHashMap<>();
            authorMap.put("id", author.getId());
            authorMap.put("username", author.getUsername());
            authorMap.put("full_name", author.getFullName());
            map.put("author", authorMap);
        } else {
            map.put("author", null);
        }

        map.put("is_verified", col.getIsVerified());
        map.put("verified_by", col.getVerifiedById());
        map.put("verified_at", col.getVerifiedAt() != null ? col.getVerifiedAt().toString() : null);
        map.put("shield_granted", col.getShieldGranted());

        User verifier = col.getVerifier();
        if (verifier != null) {
            Map<String, Object> verifierMap = new LinkedHashMap<>();
            verifierMap.put("id", verifier.getId());
            verifierMap.put("full_name", verifier.getFullName());
            map.put("verifier", verifierMap);
        } else {
            map.put("verifier", null);
        }

        map.put("created_at", col.getCreatedAt() != null ? col.getCreatedAt().toString() : null);
        map.put("updated_at", col.getUpdatedAt() != null ? col.getUpdatedAt().toString() : null);
        return map;
    }

    private Map<String, Object> columnToListItem(TeamColumn col) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", col.getId());
        map.put("title", col.getTitle());
        map.put("author_id", col.getAuthorId());

        User author = col.getAuthor();
        if (author != null) {
            Map<String, Object> authorMap = new LinkedHashMap<>();
            authorMap.put("id", author.getId());
            authorMap.put("username", author.getUsername());
            authorMap.put("full_name", author.getFullName());
            map.put("author", authorMap);
        } else {
            map.put("author", null);
        }

        map.put("is_verified", col.getIsVerified());
        map.put("created_at", col.getCreatedAt() != null ? col.getCreatedAt().toString() : null);
        return map;
    }
}
