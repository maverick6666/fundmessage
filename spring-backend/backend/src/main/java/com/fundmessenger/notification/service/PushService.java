package com.fundmessenger.notification.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fundmessenger.common.config.AppProperties;
import com.fundmessenger.notification.entity.PushSubscription;
import com.fundmessenger.notification.repository.PushSubscriptionRepository;
import com.fundmessenger.user.entity.User;
import com.fundmessenger.user.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.Notification;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.GeneralSecurityException;
import java.security.Security;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class PushService {

    private final PushSubscriptionRepository pushSubscriptionRepository;
    private final UserRepository userRepository;
    private final AppProperties appProperties;
    private final ObjectMapper objectMapper;

    private nl.martijndwars.webpush.PushService webPushService;
    private boolean pushEnabled = false;

    @PostConstruct
    public void init() {
        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
            Security.addProvider(new BouncyCastleProvider());
        }

        String publicKey = appProperties.getVapid().getPublicKey();
        String privateKey = appProperties.getVapid().getPrivateKey();

        if (publicKey == null || publicKey.isBlank() || privateKey == null || privateKey.isBlank()) {
            log.warn("VAPID keys not configured. Web push notifications disabled.");
            return;
        }

        try {
            webPushService = new nl.martijndwars.webpush.PushService(
                    publicKey,
                    privateKey,
                    appProperties.getVapid().getClaimsEmail()
            );
            pushEnabled = true;
            log.info("Web push service initialized successfully.");
        } catch (GeneralSecurityException e) {
            log.error("Failed to initialize web push service: {}", e.getMessage(), e);
        }
    }

    @Transactional
    public PushSubscription subscribe(Long userId, String endpoint, String p256dh, String auth) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        Optional<PushSubscription> existing = pushSubscriptionRepository.findByEndpoint(endpoint);

        if (existing.isPresent()) {
            PushSubscription sub = existing.get();
            sub.setUser(user);
            sub.setP256dh(p256dh);
            sub.setAuth(auth);
            return pushSubscriptionRepository.save(sub);
        }

        PushSubscription sub = new PushSubscription();
        sub.setUser(user);
        sub.setEndpoint(endpoint);
        sub.setP256dh(p256dh);
        sub.setAuth(auth);
        sub.setCreatedAt(OffsetDateTime.now());
        return pushSubscriptionRepository.save(sub);
    }

    @Transactional
    public void unsubscribe(Long userId, String endpoint) {
        pushSubscriptionRepository.deleteByEndpoint(endpoint);
    }

    @Transactional(readOnly = true)
    public List<PushSubscription> getSubscriptions(Long userId) {
        return pushSubscriptionRepository.findByUserId(userId);
    }

    public void sendPush(Long userId, String title, String body, String url,
                         String notificationType, String relatedType, Long relatedId) {
        if (!pushEnabled) {
            log.debug("Push disabled, skipping push for user {}", userId);
            return;
        }

        List<PushSubscription> subscriptions = pushSubscriptionRepository.findByUserId(userId);
        if (subscriptions.isEmpty()) {
            log.debug("No push subscriptions found for user {}", userId);
            return;
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("title", title);
        payload.put("body", body);
        payload.put("url", url != null ? url : "/notifications");
        payload.put("notification_type", notificationType);
        payload.put("related_type", relatedType);
        payload.put("related_id", relatedId);

        String payloadJson;
        try {
            payloadJson = objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            log.error("Failed to serialize push payload: {}", e.getMessage());
            return;
        }

        for (PushSubscription sub : subscriptions) {
            try {
                Notification notification = new Notification(
                        sub.getEndpoint(),
                        sub.getP256dh(),
                        sub.getAuth(),
                        payloadJson.getBytes()
                );

                var response = webPushService.send(notification);
                int statusCode = response.getStatusLine().getStatusCode();

                if (statusCode == 410 || statusCode == 404) {
                    log.info("Push subscription expired ({}), removing: {}", statusCode, sub.getEndpoint());
                    pushSubscriptionRepository.delete(sub);
                } else if (statusCode >= 400) {
                    log.warn("Push failed for endpoint {} with status {}", sub.getEndpoint(), statusCode);
                } else {
                    log.debug("Push sent successfully to endpoint: {}", sub.getEndpoint());
                }
            } catch (Exception e) {
                log.error("Failed to send push to endpoint {}: {}", sub.getEndpoint(), e.getMessage());
            }
        }
    }
}
