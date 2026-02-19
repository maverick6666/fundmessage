package com.fundmessenger.newsdesk.repository;

import com.fundmessenger.newsdesk.entity.NewsDesk;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface NewsDeskRepository extends JpaRepository<NewsDesk, Long> {

    Optional<NewsDesk> findByPublishDate(LocalDate publishDate);

    List<NewsDesk> findByStatus(String status);

    List<NewsDesk> findByPublishDateBetween(LocalDate start, LocalDate end);
}
