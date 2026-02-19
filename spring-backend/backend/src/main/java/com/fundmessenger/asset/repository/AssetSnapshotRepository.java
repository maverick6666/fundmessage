package com.fundmessenger.asset.repository;

import com.fundmessenger.asset.entity.AssetSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface AssetSnapshotRepository extends JpaRepository<AssetSnapshot, Long> {

    Optional<AssetSnapshot> findBySnapshotDate(LocalDate snapshotDate);

    List<AssetSnapshot> findBySnapshotDateBetweenOrderBySnapshotDateAsc(LocalDate start, LocalDate end);
}
