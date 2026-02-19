package com.fundmessenger.newsdesk.repository;

import com.fundmessenger.newsdesk.entity.RawNews;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface RawNewsRepository extends JpaRepository<RawNews, Long> {

    List<RawNews> findByNewsdeskDate(LocalDate newsdeskDate);

    long countByNewsdeskDate(LocalDate newsdeskDate);
}
