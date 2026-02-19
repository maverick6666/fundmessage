package com.fundmessenger.attendance.entity;

import com.fundmessenger.column.entity.TeamColumn;
import com.fundmessenger.user.entity.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "attendances", uniqueConstraints = {
        @UniqueConstraint(name = "uq_user_date", columnNames = {"user_id", "date"})
})
@Getter
@Setter
@NoArgsConstructor
public class Attendance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "user_id", nullable = false, insertable = false, updatable = false)
    private Long userId;

    @Column(name = "date", nullable = false)
    private LocalDate date;

    @Column(name = "status", length = 20, columnDefinition = "varchar(20) default 'present'")
    private String status = "present";

    @Column(name = "recovered_by_column_id", insertable = false, updatable = false)
    private Long recoveredByColumnId;

    @Column(name = "approved_by", insertable = false, updatable = false)
    private Long approvedById;

    @Column(name = "created_at", columnDefinition = "timestamptz")
    private OffsetDateTime createdAt;

    // --- ManyToOne Relationships ---

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by")
    private User approver;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recovered_by_column_id")
    private TeamColumn recoveryColumn;
}
