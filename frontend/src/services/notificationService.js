import api from './api';

export const notificationService = {
  async getNotifications({ unreadOnly = false, limit = 50, offset = 0 } = {}) {
    const params = new URLSearchParams({
      unread_only: unreadOnly,
      limit,
      offset
    });
    const response = await api.get(`/notifications?${params}`);
    return response.data.data;
  },

  async getUnreadCount() {
    const response = await api.get('/notifications/unread-count');
    return response.data.data.unread_count;
  },

  async markAsRead(notificationIds) {
    const response = await api.patch('/notifications/read', {
      notification_ids: notificationIds
    });
    return response.data;
  },

  async markAllAsRead() {
    const response = await api.patch('/notifications/read-all');
    return response.data;
  },

  async deleteNotification(id) {
    const response = await api.delete(`/notifications/${id}`);
    return response.data;
  },

  async deleteAllNotifications() {
    const response = await api.delete('/notifications');
    return response.data;
  },

  // ===== Web Push =====

  async getVapidKey() {
    const response = await api.get('/notifications/vapid-key');
    return response.data.data.vapid_public_key;
  },

  async subscribePush(subscription) {
    const response = await api.post('/notifications/push/subscribe', {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.toJSON().keys.p256dh,
        auth: subscription.toJSON().keys.auth,
      }
    });
    return response.data;
  },

  async unsubscribePush(endpoint) {
    const response = await api.post('/notifications/push/unsubscribe', {
      endpoint
    });
    return response.data;
  },

  /**
   * Push 알림 권한 요청 + 구독 등록 (로그인 후 호출)
   * @returns {boolean} 구독 성공 여부
   */
  async initPushNotifications() {
    // 브라우저 지원 확인
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push notifications not supported');
      return false;
    }

    // 알림 권한 요청
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Push notification permission denied');
      return false;
    }

    try {
      // Service Worker 등록 확인
      const registration = await navigator.serviceWorker.ready;

      // VAPID 공개키 가져오기
      const vapidKey = await this.getVapidKey();
      if (!vapidKey) {
        console.log('VAPID key not configured');
        return false;
      }

      // 기존 구독 확인
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        // 새 구독 생성
        const applicationServerKey = urlBase64ToUint8Array(vapidKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      // 서버에 구독 정보 전송
      await this.subscribePush(subscription);
      console.log('Push notifications enabled');
      return true;
    } catch (error) {
      console.error('Push subscription failed:', error);
      return false;
    }
  },
};

/**
 * Base64url string -> Uint8Array (VAPID key 변환용)
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
