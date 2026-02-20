package com.fundmessenger.university.service;

import com.fundmessenger.common.exception.BusinessException;
import com.fundmessenger.common.exception.NotFoundException;
import com.fundmessenger.university.dto.UniversityRequest;
import com.fundmessenger.university.entity.University;
import com.fundmessenger.university.repository.UniversityRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class UniversityService {

    private final UniversityRepository universityRepository;

    public List<University> getAllUniversities() {
        return universityRepository.findAllByOrderByNameAsc();
    }

    public List<University> getActiveUniversities() {
        return universityRepository.findByIsActiveTrueOrderByNameAsc();
    }

    public University getUniversityById(Long id) {
        return universityRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("University", id));
    }

    @Transactional
    public University createUniversity(UniversityRequest request) {
        if (universityRepository.existsByCode(request.getCode())) {
            throw new BusinessException(HttpStatus.CONFLICT, "이미 등록된 학교코드입니다: " + request.getCode());
        }

        University university = new University();
        university.setName(request.getName());
        university.setCode(request.getCode());
        university.setLogoUrl(request.getLogoUrl());
        university.setIsActive(true);

        University saved = universityRepository.save(university);
        log.info("University created: {} ({})", saved.getName(), saved.getCode());
        return saved;
    }

    @Transactional
    public University updateUniversity(Long id, UniversityRequest request) {
        University university = universityRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("University", id));

        // 코드 변경 시 중복 체크
        if (!university.getCode().equals(request.getCode())
                && universityRepository.existsByCode(request.getCode())) {
            throw new BusinessException(HttpStatus.CONFLICT, "이미 등록된 학교코드입니다: " + request.getCode());
        }

        university.setName(request.getName());
        university.setCode(request.getCode());
        university.setLogoUrl(request.getLogoUrl());

        University saved = universityRepository.save(university);
        log.info("University updated: {} ({})", saved.getName(), saved.getCode());
        return saved;
    }

    @Transactional
    public void deleteUniversity(Long id) {
        University university = universityRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("University", id));
        university.setIsActive(false);
        universityRepository.save(university);
        log.info("University deactivated: {} ({})", university.getName(), university.getCode());
    }
}
