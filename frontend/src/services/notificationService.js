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
  }
};
