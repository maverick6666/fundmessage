package com.fundmessenger.university.repository;

import com.fundmessenger.university.entity.University;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UniversityRepository extends JpaRepository<University, Long> {

    Optional<University> findByCode(String code);

    List<University> findByIsActiveTrueOrderByNameAsc();

    List<University> findAllByOrderByNameAsc();

    boolean existsByCode(String code);
}
