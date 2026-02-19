package com.fundmessenger.attendance.repository;

import com.fundmessenger.attendance.entity.Attendance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface AttendanceRepository extends JpaRepository<Attendance, Long> {

    Optional<Attendance> findByUserIdAndDate(Long userId, LocalDate date);

    List<Attendance> findByUserIdOrderByDateDesc(Long userId);

    List<Attendance> findByDate(LocalDate date);

    boolean existsByUserIdAndDate(Long userId, LocalDate date);
}
