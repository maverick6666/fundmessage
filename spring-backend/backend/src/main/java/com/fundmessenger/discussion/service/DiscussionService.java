package com.fundmessenger.discussion.service;

import com.fundmessenger.common.exception.BusinessException;
import com.fundmessenger.common.exception.NotFoundException;
import com.fundmessenger.discussion.dto.*;
import com.fundmessenger.discussion.entity.Discussion;
import com.fundmessenger.discussion.entity.Message;
import com.fundmessenger.discussion.repository.DiscussionRepository;
import com.fundmessenger.discussion.repository.MessageRepository;
import com.fundmessenger.position.entity.Position;
import com.fundmessenger.position.repository.PositionRepository;
import com.fundmessenger.request.entity.TradeRequest;
import com.fundmessenger.request.repository.TradeRequestRepository;
import com.fundmessenger.user.dto.UserBrief;
import com.fundmessenger.user.entity.User;
import com.fundmessenger.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DiscussionService {

    private final DiscussionRepository discussionRepository;
    private final MessageRepository messageRepository;
    private final TradeRequestRepository tradeRequestRepository;
    private final PositionRepository positionRepository;
    private final UserRepository userRepository;

    // ──────────────────────────────────────────────
    // Read operations
    // ──────────────────────────────────────────────

    /**
     * Get discussion by ID.
     */
    public Discussion getDiscussionById(Long id) {
        return discussionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Discussion", id));
    }

    /**
     * Get discussion by request ID.
     */
    public Discussion getDiscussionByRequestId(Long requestId) {
        List<Discussion> discussions = discussionRepository.findByRequestId(requestId);
        if (discussions.isEmpty()) {
            throw new NotFoundException("Discussion for request", requestId);
        }
        return discussions.get(0);
    }

    /**
     * Get discussions by position ID.
     */
    public List<Discussion> getDiscussionsByPositionId(Long positionId) {
        return discussionRepository.findByPositionId(positionId);
    }

    /**
     * Get all discussions with optional status filter, ordered by latest message time.
     */
    @Transactional(readOnly = true)
    public List<Discussion> getAllDiscussions(String statusFilter, int limit, int offset) {
        List<Discussion> discussions;
        if (statusFilter != null && !statusFilter.isBlank()) {
            discussions = discussionRepository.findByStatus(statusFilter);
        } else {
            discussions = discussionRepository.findAllByOrderByCreatedAtDesc();
        }

        // Sort by last message time (most recent first), falling back to created_at
        discussions.sort((a, b) -> {
            OffsetDateTime timeA = getLastMessageTime(a.getId());
            OffsetDateTime timeB = getLastMessageTime(b.getId());
            if (timeA == null) timeA = a.getCreatedAt();
            if (timeB == null) timeB = b.getCreatedAt();
            return timeB.compareTo(timeA);
        });

        // Apply offset and limit
        int start = Math.min(offset, discussions.size());
        int end = Math.min(start + limit, discussions.size());
        return discussions.subList(start, end);
    }

    /**
     * Count all discussions with optional status filter.
     */
    @Transactional(readOnly = true)
    public long countDiscussions(String statusFilter) {
        if (statusFilter != null && !statusFilter.isBlank()) {
            return discussionRepository.findByStatus(statusFilter).size();
        }
        return discussionRepository.count();
    }

    /**
     * Get messages for a discussion with pagination.
     */
    @Transactional(readOnly = true)
    public Page<Message> getMessages(Long discussionId, int page, int limit) {
        getDiscussionById(discussionId); // verify exists
        PageRequest pageable = PageRequest.of(page - 1, limit, Sort.by(Sort.Direction.ASC, "createdAt"));
        return messageRepository.findByDiscussionId(discussionId, pageable);
    }

    /**
     * Get message count for a discussion.
     */
    public long getMessageCount(Long discussionId) {
        return messageRepository.countByDiscussionId(discussionId);
    }

    /**
     * Get last text message of a discussion.
     */
    @Transactional(readOnly = true)
    public Message getLastMessage(Long discussionId) {
        List<Message> messages = messageRepository.findByDiscussionIdOrderByCreatedAtAsc(discussionId);
        // Find last text message (not system)
        for (int i = messages.size() - 1; i >= 0; i--) {
            Message msg = messages.get(i);
            if ("text".equals(msg.getMessageType()) || "chart".equals(msg.getMessageType())) {
                return msg;
            }
        }
        return messages.isEmpty() ? null : messages.get(messages.size() - 1);
    }

    /**
     * Get session info list for a discussion.
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getSessionsWithInfo(Long discussionId) {
        Discussion discussion = getDiscussionById(discussionId);
        List<Message> allMessages = messageRepository.findByDiscussionIdOrderByCreatedAtAsc(discussionId);

        List<Map<String, Object>> sessions = new ArrayList<>();
        for (int sessionNum = 1; sessionNum <= discussion.getSessionCount(); sessionNum++) {
            final int sn = sessionNum;
            List<Message> sessionMessages = allMessages.stream()
                    .filter(m -> m.getSessionNumber() != null && m.getSessionNumber() == sn)
                    .collect(Collectors.toList());

            Map<String, Object> sessionInfo = new LinkedHashMap<>();
            sessionInfo.put("session_number", sessionNum);
            sessionInfo.put("message_count", sessionMessages.size());

            // Find agenda from system message
            String agenda = null;
            for (Message msg : sessionMessages) {
                if ("system".equals(msg.getMessageType()) && msg.getContent() != null
                        && msg.getContent().contains("started")) {
                    String content = msg.getContent();
                    int agendaIdx = content.indexOf("\n\uC758\uC81C: ");
                    if (agendaIdx >= 0) {
                        agenda = content.substring(agendaIdx + 5); // length of "\n의제: "
                    }
                    break;
                }
            }
            sessionInfo.put("agenda", agenda);

            if (!sessionMessages.isEmpty()) {
                sessionInfo.put("started_at", sessionMessages.get(0).getCreatedAt());
                sessionInfo.put("ended_at", sessionMessages.get(sessionMessages.size() - 1).getCreatedAt());
            } else {
                sessionInfo.put("started_at", null);
                sessionInfo.put("ended_at", null);
            }

            // Unique participants
            Set<Long> participantIds = sessionMessages.stream()
                    .filter(m -> m.getUser() != null && !"system".equals(m.getMessageType()))
                    .map(m -> m.getUser().getId())
                    .collect(Collectors.toSet());
            sessionInfo.put("participant_count", participantIds.size());

            sessions.add(sessionInfo);
        }
        return sessions;
    }

    // ──────────────────────────────────────────────
    // Write operations
    // ──────────────────────────────────────────────

    /**
     * Create a new discussion.
     */
    @Transactional
    public Discussion createDiscussion(DiscussionCreate data, Long openedBy) {
        User opener = userRepository.findById(openedBy)
                .orElseThrow(() -> new NotFoundException("User", openedBy));

        Discussion discussion = new Discussion();
        discussion.setTitle(data.getTitle());
        discussion.setCurrentAgenda(data.getAgenda());
        discussion.setStatus("open");
        discussion.setSessionCount(1);
        discussion.setOpener(opener);
        discussion.setOpenedAt(OffsetDateTime.now());

        if (data.getRequestId() != null) {
            TradeRequest request = tradeRequestRepository.findById(Long.valueOf(data.getRequestId()))
                    .orElseThrow(() -> new NotFoundException("Request", data.getRequestId()));
            discussion.setRequest(request);

            // Update request status to discussion
            request.setStatus("discussion");
            tradeRequestRepository.save(request);

            // Also set position from request if available
            if (request.getPosition() != null) {
                discussion.setPosition(request.getPosition());
            }
        }

        if (data.getPositionId() != null) {
            Position position = positionRepository.findById(Long.valueOf(data.getPositionId()))
                    .orElseThrow(() -> new NotFoundException("Position", data.getPositionId()));
            discussion.setPosition(position);
        }

        discussion = discussionRepository.save(discussion);

        // Add system message for session start
        String systemContent = "Session 1 started\n\uC758\uC81C: " + data.getAgenda();
        createSystemMessage(discussion, systemContent, 1);

        return discussion;
    }

    /**
     * Close a discussion.
     */
    @Transactional
    public Discussion closeDiscussion(Long discussionId, DiscussionClose data, Long closedBy) {
        Discussion discussion = getDiscussionById(discussionId);
        if ("closed".equals(discussion.getStatus())) {
            throw new BusinessException("Discussion is already closed");
        }

        User closer = userRepository.findById(closedBy)
                .orElseThrow(() -> new NotFoundException("User", closedBy));

        discussion.setStatus("closed");
        discussion.setCloser(closer);
        discussion.setClosedAt(OffsetDateTime.now());
        if (data != null && data.getSummary() != null) {
            discussion.setSummary(data.getSummary());
        }

        // Add system message
        String systemContent = "Session " + discussion.getSessionCount() + " ended. Discussion closed by "
                + closer.getUsername();
        createSystemMessage(discussion, systemContent, discussion.getSessionCount());

        return discussionRepository.save(discussion);
    }

    /**
     * Reopen a discussion, incrementing session count.
     */
    @Transactional
    public Discussion reopenDiscussion(Long discussionId, Long reopenedBy, DiscussionReopen data) {
        Discussion discussion = getDiscussionById(discussionId);
        if ("open".equals(discussion.getStatus())) {
            throw new BusinessException("Discussion is already open");
        }

        User opener = userRepository.findById(reopenedBy)
                .orElseThrow(() -> new NotFoundException("User", reopenedBy));

        discussion.setStatus("open");
        discussion.setSessionCount(discussion.getSessionCount() + 1);
        discussion.setCurrentAgenda(data.getAgenda());
        discussion.setCloser(null);
        discussion.setClosedAt(null);

        // Add system message for new session
        String systemContent = "Session " + discussion.getSessionCount() + " started\n\uC758\uC81C: " + data.getAgenda();
        createSystemMessage(discussion, systemContent, discussion.getSessionCount());

        return discussionRepository.save(discussion);
    }

    /**
     * Create a message in a discussion.
     */
    @Transactional
    public Message createMessage(Long discussionId, MessageCreate data, Long userId) {
        Discussion discussion = getDiscussionById(discussionId);
        if (!"open".equals(discussion.getStatus())) {
            throw new BusinessException("Cannot send message to a closed discussion");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User", userId));

        Message message = new Message();
        message.setDiscussion(discussion);
        message.setUser(user);
        message.setContent(data.getContent());
        message.setMessageType(data.getMessageType() != null ? data.getMessageType() : "text");
        message.setSessionNumber(discussion.getSessionCount());

        if (data.getChartData() != null) {
            message.setChartData(data.getChartData());
        }

        return messageRepository.save(message);
    }

    /**
     * Update a discussion's title or agenda.
     */
    @Transactional
    public Discussion updateDiscussion(Long discussionId, DiscussionUpdate data, Long userId) {
        Discussion discussion = getDiscussionById(discussionId);

        if (data.getTitle() != null) {
            discussion.setTitle(data.getTitle());
        }
        if (data.getCurrentAgenda() != null) {
            discussion.setCurrentAgenda(data.getCurrentAgenda());
        }

        return discussionRepository.save(discussion);
    }

    /**
     * Delete all messages in a specific session.
     */
    @Transactional
    public void deleteSession(Long discussionId, int sessionNumber, Long userId) {
        Discussion discussion = getDiscussionById(discussionId);
        if (sessionNumber < 1 || sessionNumber > discussion.getSessionCount()) {
            throw new BusinessException("Invalid session number: " + sessionNumber);
        }

        List<Message> sessionMessages = messageRepository.findByDiscussionIdAndSessionNumber(
                discussionId, sessionNumber);
        messageRepository.deleteAll(sessionMessages);
    }

    /**
     * Delete a discussion and all its messages.
     */
    @Transactional
    public void deleteDiscussion(Long discussionId) {
        Discussion discussion = getDiscussionById(discussionId);
        messageRepository.deleteByDiscussionId(discussionId);
        discussionRepository.delete(discussion);
    }

    /**
     * Export discussion as a structured map.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getDiscussionExport(Long discussionId) {
        Discussion discussion = getDiscussionById(discussionId);
        List<Message> messages = messageRepository.findByDiscussionIdOrderByCreatedAtAsc(discussionId);

        Map<String, Object> export = new LinkedHashMap<>();
        export.put("discussion_id", discussion.getId());
        export.put("title", discussion.getTitle());
        export.put("status", discussion.getStatus());
        export.put("session_count", discussion.getSessionCount());
        export.put("current_agenda", discussion.getCurrentAgenda());
        export.put("summary", discussion.getSummary());
        export.put("opened_at", discussion.getOpenedAt());
        export.put("closed_at", discussion.getClosedAt());

        if (discussion.getOpener() != null) {
            export.put("opened_by", discussion.getOpener().getUsername());
        }
        if (discussion.getCloser() != null) {
            export.put("closed_by", discussion.getCloser().getUsername());
        }

        List<Map<String, Object>> messageList = new ArrayList<>();
        for (Message msg : messages) {
            Map<String, Object> msgMap = new LinkedHashMap<>();
            msgMap.put("id", msg.getId());
            msgMap.put("user", msg.getUser() != null ? msg.getUser().getUsername() : "system");
            msgMap.put("content", msg.getContent());
            msgMap.put("message_type", msg.getMessageType());
            msgMap.put("session_number", msg.getSessionNumber());
            msgMap.put("created_at", msg.getCreatedAt());
            messageList.add(msgMap);
        }
        export.put("messages", messageList);
        export.put("message_count", messages.size());

        return export;
    }

    /**
     * Export discussion as plain text.
     */
    @Transactional(readOnly = true)
    public String exportDiscussionTxt(Long discussionId, List<Integer> sessionNumbers) {
        Discussion discussion = getDiscussionById(discussionId);
        List<Message> allMessages = messageRepository.findByDiscussionIdOrderByCreatedAtAsc(discussionId);

        // Filter by session numbers if provided
        List<Message> messages;
        if (sessionNumbers != null && !sessionNumbers.isEmpty()) {
            messages = allMessages.stream()
                    .filter(m -> m.getSessionNumber() != null && sessionNumbers.contains(m.getSessionNumber()))
                    .collect(Collectors.toList());
        } else {
            messages = allMessages;
        }

        StringBuilder sb = new StringBuilder();
        sb.append("=== ").append(discussion.getTitle()).append(" ===\n");
        sb.append("Status: ").append(discussion.getStatus()).append("\n");
        sb.append("Sessions: ").append(discussion.getSessionCount()).append("\n");
        sb.append("---\n\n");

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        int currentSession = -1;
        for (Message msg : messages) {
            if (msg.getSessionNumber() != null && msg.getSessionNumber() != currentSession) {
                currentSession = msg.getSessionNumber();
                sb.append("\n--- Session ").append(currentSession).append(" ---\n\n");
            }

            String username = msg.getUser() != null ? msg.getUser().getUsername() : "system";
            String time = msg.getCreatedAt() != null ? msg.getCreatedAt().format(formatter) : "";

            if ("system".equals(msg.getMessageType())) {
                sb.append("[SYSTEM] ").append(msg.getContent()).append("\n");
            } else {
                sb.append("[").append(time).append("] ")
                        .append(username).append(": ")
                        .append(msg.getContent()).append("\n");
            }
        }

        return sb.toString();
    }

    // ──────────────────────────────────────────────
    // Mapping helpers
    // ──────────────────────────────────────────────

    /**
     * Convert Discussion entity to DiscussionResponse DTO.
     */
    public DiscussionResponse toResponse(Discussion discussion) {
        DiscussionResponse response = DiscussionResponse.builder()
                .id(discussion.getId())
                .requestId(discussion.getRequest() != null ? discussion.getRequest().getId() : null)
                .positionId(discussion.getPosition() != null ? discussion.getPosition().getId() : null)
                .title(discussion.getTitle())
                .status(discussion.getStatus())
                .summary(discussion.getSummary())
                .sessionCount(discussion.getSessionCount())
                .currentAgenda(discussion.getCurrentAgenda())
                .openedAt(discussion.getOpenedAt())
                .closedAt(discussion.getClosedAt())
                .messageCount(messageRepository.countByDiscussionId(discussion.getId()))
                .build();

        if (discussion.getOpener() != null) {
            response.setOpenedBy(toUserBrief(discussion.getOpener()));
        }
        if (discussion.getCloser() != null) {
            response.setClosedBy(toUserBrief(discussion.getCloser()));
        }

        return response;
    }

    /**
     * Convert Message entity to MessageResponse DTO.
     */
    @SuppressWarnings("unchecked")
    public MessageResponse toMessageResponse(Message message) {
        MessageResponse response = MessageResponse.builder()
                .id(message.getId())
                .discussionId(message.getDiscussion().getId())
                .content(message.getContent())
                .messageType(message.getMessageType())
                .sessionNumber(message.getSessionNumber())
                .createdAt(message.getCreatedAt())
                .build();

        if (message.getUser() != null) {
            response.setUser(toUserBrief(message.getUser()));
        }

        if (message.getChartData() instanceof Map) {
            response.setChartData((Map<String, Object>) message.getChartData());
        }

        return response;
    }

    // ──────────────────────────────────────────────
    // Private helpers
    // ──────────────────────────────────────────────

    private void createSystemMessage(Discussion discussion, String content, int sessionNumber) {
        Message systemMessage = new Message();
        systemMessage.setDiscussion(discussion);
        systemMessage.setUser(null);
        systemMessage.setContent(content);
        systemMessage.setMessageType("system");
        systemMessage.setSessionNumber(sessionNumber);
        messageRepository.save(systemMessage);
    }

    private UserBrief toUserBrief(User user) {
        return UserBrief.builder()
                .id(user.getId())
                .username(user.getUsername())
                .fullName(user.getFullName())
                .build();
    }

    private OffsetDateTime getLastMessageTime(Long discussionId) {
        List<Message> messages = messageRepository.findByDiscussionIdOrderByCreatedAtAsc(discussionId);
        if (messages.isEmpty()) {
            return null;
        }
        return messages.get(messages.size() - 1).getCreatedAt();
    }
}
