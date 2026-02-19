package com.fundmessenger.position.repository;

import com.fundmessenger.position.entity.TeamSettings;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TeamSettingsRepository extends JpaRepository<TeamSettings, Long> {

    Optional<TeamSettings> findFirstByOrderByIdAsc();
}
